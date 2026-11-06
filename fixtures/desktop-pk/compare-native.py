#!/usr/bin/env python3
"""Compare installed drivers on the owned Routing PK Main fixture.

Start Fixture.swift and discover each driver's window ID before running.
The output contains local diagnostics; sanitize it before publication.
The caller owns the fixture, agent-desktop session, and helper teardown.
"""

import argparse
import json
import os
from pathlib import Path
import subprocess
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--driver", choices=["ad", "pb"], required=True)
    parser.add_argument("--window", required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--witness", type=Path, required=True)
    parser.add_argument("--session")
    parser.add_argument("--state-root", type=Path, required=True)
    parser.add_argument("--ad-bin", default="agent-desktop")
    parser.add_argument("--pb-bin", default="peekaboo")
    args = parser.parse_args()
    if args.out.exists():
        parser.error("--out must be a new file")
    if args.driver == "ad" and not args.session:
        parser.error("--session is required for agent-desktop")
    env = dict(os.environ, AGENT_DESKTOP_HOME=str(args.state_root.resolve()))
    calls = []
    report = {}

    def run(*argv):
        started = time.perf_counter()
        result = subprocess.run(argv, capture_output=True, text=True,
                                env=env, timeout=30)
        envelope = json.loads(result.stdout)
        calls.append({"args": argv, "exitCode": result.returncode,
                      "ms": round((time.perf_counter() - started) * 1000, 2),
                      "response": envelope})
        return envelope

    def snapshot():
        if args.driver == "ad":
            return run(args.ad_bin, "--session", args.session, "snapshot",
                       "--app", "Routing PK Fixture", "--window-id", args.window)
        return run(args.pb_bin, "see", "--window-id", args.window,
                   "--tree", "--no-screenshot", "--json")

    def walk(node):
        yield node
        for child in node.get("children", []):
            yield from walk(child)

    def nodes(envelope):
        if args.driver == "pb":
            return envelope["data"]["ui_elements"]
        return list(walk(envelope["data"]["tree"]))

    def find(envelope, identifier):
        if args.driver == "ad":
            return next(node["ref_id"] for node in nodes(envelope)
                        if node.get("native_id", {}).get("value") == identifier)
        return next(node["id"] for node in nodes(envelope)
                    if node.get("identifier") == identifier)

    def act(command, envelope, identifier, value=None):
        ref = find(envelope, identifier)
        values = [] if value is None else [value]
        if args.driver == "ad":
            argv = [args.ad_bin, "--session", args.session, command, ref, *values]
        else:
            argv = [args.pb_bin, command, *values, "--on", ref, "--snapshot",
                    envelope["data"]["snapshot_id"], "--json"]
        return run(*argv)

    def witness():
        return json.loads(args.witness.read_text())

    def assert_state(**expected):
        deadline = time.monotonic() + 2
        while True:
            state = witness()
            if all(state[key] == value for key, value in expected.items()):
                return
            if time.monotonic() > deadline:
                raise AssertionError((expected, state))
            time.sleep(0.05)

    def assert_value(envelope, text):
        assert any(node.get(key) == text for node in nodes(envelope)
                   for key in ["value", "name", "label"]), text

    try:
        initial = snapshot()
        assert initial.get("ok", initial.get("success")), initial
        data = initial["data"]
        title = data.get("window_title", data.get("window", {}).get("title"))
        assert title == "Routing PK Main", title
        assert_state(counter=0, secondaryCounter=0, text="seed", checked=False,
                     secondaryVisible=False)
        before = witness()
        report["rounds"] = []
        for _ in range(3):
            started = time.perf_counter()
            initial = snapshot()
            assert_value(initial, "Counter: 0")
            act("click", initial, "increment")
            incremented = snapshot()
            assert_value(incremented, "Counter: 1")
            assert_state(counter=1)
            act("click", incremented, "reset")
            restored = snapshot()
            assert_value(restored, "Counter: 0")
            assert_state(counter=0)
            report["rounds"].append({
                "milliseconds": round((time.perf_counter() - started) * 1000, 2),
                "readCharacters": sum(len(json.dumps(item, separators=(",", ":")))
                                      for item in [initial, incremented, restored]),
                "passed": True,
            })
        observed = snapshot()
        report["setValue"] = act("set-value", observed, "input", "native sample")
        observed = snapshot()
        assert_value(observed, "native sample")
        assert_state(text="native sample")
        report["checkbox"] = act("click", observed, "enabled")
        observed = snapshot()
        assert_state(checked=True)
        assert_value(observed, "1")
        report["readbackPassed"] = True
        after = witness()
        report["cohortEndpoints"] = {
            "fixtureFrontmostBefore": before["fixtureFrontmost"],
            "fixtureFrontmostAfter": after["fixtureFrontmost"],
            "pointerUnchanged": all(before[key] == after[key]
                                    for key in ["pointerX", "pointerY"]),
            "clipboardChangeCountDelta":
                after["clipboardChangeCount"] - before["clipboardChangeCount"],
        }
        act("click", observed, "reset")
        snapshot()
        assert_state(counter=0, secondaryCounter=0, text="seed", checked=False,
                     secondaryVisible=False)
    finally:
        args.out.write_text(json.dumps({"driver": args.driver, "report": report,
                                       "calls": calls}, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
