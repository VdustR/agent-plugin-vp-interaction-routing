import AppKit

final class Fixture: NSObject, NSApplicationDelegate {
    var main: NSWindow!
    var secondary: NSWindow!
    var count = 0
    var secondCount = 0
    var label = NSTextField(labelWithString: "Counter: 0")
    var secondLabel = NSTextField(labelWithString: "Secondary counter: 0")
    var field = NSTextField(string: "seed")
    var check = NSButton(checkboxWithTitle: "Enabled", target: nil, action: nil)
    var timer: Timer?
    var lastState = ""
    let output = ProcessInfo.processInfo.environment["DESKTOP_PK_OUTPUT"]!

    func button(_ title: String, _ id: String, _ y: CGFloat, _ action: Selector, _ view: NSView) -> NSButton {
        let b = NSButton(title: title, target: self, action: action)
        b.frame = NSRect(x: 20, y: y, width: 190, height: 32)
        b.setAccessibilityIdentifier(id)
        view.addSubview(b)
        return b
    }
    func window(_ title: String) -> NSWindow {
        let w = NSWindow(contentRect: NSRect(x: 420, y: 350, width: 430, height: 300), styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
        w.title = title
        w.isReleasedWhenClosed = false
        return w
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        main = window("Routing PK Main")
        let v = main.contentView!
        label.frame = NSRect(x: 20, y: 250, width: 390, height: 25)
        label.setAccessibilityIdentifier("counter")
        v.addSubview(label)
        _ = button("Increment", "increment", 210, #selector(increment), v)
        field.frame = NSRect(x: 20, y: 165, width: 380, height: 28)
        field.setAccessibilityIdentifier("input")
        field.setAccessibilityLabel("Sample input")
        v.addSubview(field)
        check.frame = NSRect(x: 20, y: 120, width: 220, height: 28)
        check.setAccessibilityIdentifier("enabled")
        check.target = self
        check.action = #selector(changed)
        v.addSubview(check)
        _ = button("Reset fixture", "reset", 75, #selector(reset), v)
        _ = button("Open second window", "open-second", 30, #selector(openSecond), v)
        secondary = window("Routing PK Secondary")
        secondary.setFrameOrigin(NSPoint(x: 880, y: 350))
        secondLabel.frame = NSRect(x: 20, y: 250, width: 390, height: 25)
        secondary.contentView!.addSubview(secondLabel)
        _ = button("Increment", "increment-secondary", 210, #selector(incrementSecond), secondary.contentView!)
        let menu = NSMenu()
        let appItem = NSMenuItem()
        menu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Routing PK Fixture", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        NSApp.mainMenu = menu
        main.orderFront(nil)
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in self?.writeState() }
        writeState()
    }
    @objc func increment() { count += 1; label.stringValue = "Counter: \(count)"; writeState() }
    @objc func incrementSecond() { secondCount += 1; secondLabel.stringValue = "Secondary counter: \(secondCount)"; writeState() }
    @objc func changed() { writeState() }
    @objc func reset() {
        count = 0; secondCount = 0; field.stringValue = "seed"; check.state = .off
        label.stringValue = "Counter: 0"; secondLabel.stringValue = "Secondary counter: 0"
        secondary.orderOut(nil); writeState()
    }
    @objc func openSecond() { secondary.orderFront(nil); writeState() }
    func writeState() {
        let d: [String: Any] = ["counter": count, "secondaryCounter": secondCount, "text": field.stringValue, "checked": check.state == .on, "secondaryVisible": secondary.isVisible, "fixtureFrontmost": NSWorkspace.shared.frontmostApplication?.processIdentifier == ProcessInfo.processInfo.processIdentifier, "pointerX": NSEvent.mouseLocation.x, "pointerY": NSEvent.mouseLocation.y, "clipboardChangeCount": NSPasteboard.general.changeCount]
        guard let data = try? JSONSerialization.data(withJSONObject: d, options: [.sortedKeys]), let s = String(data: data, encoding: .utf8), s != lastState else { return }
        lastState = s
        try? data.write(to: URL(fileURLWithPath: output), options: .atomic)
    }
}
let app = NSApplication.shared
let delegate = Fixture()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
