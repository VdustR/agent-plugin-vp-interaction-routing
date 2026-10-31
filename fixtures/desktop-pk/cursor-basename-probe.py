#!/usr/bin/env python3
"""Compare cursor renderer startup using identical macOS binary copies."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", required=True, type=Path,
                        help="Trusted installed native macOS binary, not the npm JS launcher")
    parser.add_argument("--out", required=True, type=Path,
                        help="New absolute task-owned directory for copies and evidence")
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("This probe requires macOS")
    source = args.binary.resolve(strict=True)
    output = args.out
    if not output.is_absolute() or output.exists():
        parser.error("--out must be a new absolute directory")
    output.mkdir(mode=0o700, parents=True)
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    normal = output / "agent-desktop"
    platform = output / "agent-desktop-darwin-arm64"
    for destination in [normal, platform]:
        shutil.copy2(source, destination)
        assert hashlib.sha256(destination.read_bytes()).hexdigest() == digest
    state = output / "state"
    environment = dict(os.environ, AGENT_DESKTOP_HOME=str(state))
    session = None
    report = {"sha256": digest, "checks": [], "limit": "Socket evidence is not pixel evidence"}

    def run(binary, *arguments):
        result = subprocess.run([str(binary), *arguments], env=environment,
                                capture_output=True, text=True, timeout=15)
        value = json.loads(result.stdout)
        if result.returncode or not value.get("ok"):
            raise RuntimeError(value)
        return value["data"]

    def sockets():
        return len(list(state.glob(".cursor-overlay-*.sock")))

    try:
        version = run(platform, "version")
        report["version"] = version
        session = run(platform, "session", "start", "--name", "cursor-basename-probe",
                      "--no-trace")["session_id"]
        arguments = ["cursor-overlay", "enable", "--session", session,
                     "--label", "CURSOR BASENAME PROBE", "--fill", "#00FF99", "--size", "2"]
        for binary in [platform, normal, platform]:
            run(normal, "cursor-overlay", "disable", "--session", session)
            assert sockets() == 0
            value = run(binary, *arguments)
            report["checks"].append({"executableName": binary.name,
                                     "rendered": value.get("rendered"),
                                     "rendererSocketCount": sockets()})
        report["observedSocketSequence"] = [r["rendererSocketCount"] for r in report["checks"]]
        report["reproduced"] = report["observedSocketSequence"] == [0, 1, 0]
    finally:
        try:
            if session:
                run(normal, "cursor-overlay", "disable", "--session", session)
                run(normal, "session", "end", session)
                ended = next(row for row in run(normal, "session", "list")["sessions"]
                             if row["session_id"] == session)
                report["cleanup"] = {"sessionEnded": bool(ended.get("ended_at")),
                                     "rendererSocketsRemaining": sockets()}
        finally:
            (output / "result.json").write_text(json.dumps(report, indent=2) + "\n")
            print(json.dumps(report))


if __name__ == "__main__":
    main()
