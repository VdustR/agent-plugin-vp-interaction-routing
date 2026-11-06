import AppKit

// Owned controls for address identity, container selection, and observation budgets.
final class AdvancedFixture: NSObject, NSApplicationDelegate, NSTableViewDataSource, NSTableViewDelegate {
    var window: NSWindow!
    var twins: [NSButton] = []
    var counts = [0, 0]
    var field = NSTextField(string: "seed")
    let table = NSTableView()
    let status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let output = ProcessInfo.processInfo.environment["DESKTOP_PK_OUTPUT"]!
    var denseWindow: NSWindow!
    var timer: Timer?

    func button(_ title: String, _ y: CGFloat, _ action: Selector) -> NSButton {
        let button = NSButton(title: title, target: self, action: action)
        button.frame = NSRect(x: 20, y: y, width: 180, height: 30)
        window.contentView!.addSubview(button)
        return button
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 350, y: 300, width: 650, height: 340), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "Routing PK Advanced"
        window.isReleasedWhenClosed = false
        twins = [button("Twin", 285, #selector(twin)), button("Twin", 245, #selector(twin))]
        _ = button("Remove first twin", 205, #selector(removeFirst))
        _ = button("Rebuild twins", 165, #selector(rebuild))
        _ = button("Arm value change", 125, #selector(arm))
        _ = button("Open dense window", 85, #selector(openDense))
        field.frame = NSRect(x: 20, y: 40, width: 260, height: 28)
        field.setAccessibilityLabel("Advanced input")
        window.contentView!.addSubview(field)
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("row"))
        column.width = 270
        table.addTableColumn(column)
        table.headerView = nil
        table.dataSource = self
        table.delegate = self
        let scroll = NSScrollView(frame: NSRect(x: 320, y: 40, width: 290, height: 270))
        scroll.documentView = table
        window.contentView!.addSubview(scroll)
        status.button?.title = "PK"
        status.button?.setAccessibilityLabel("Routing PK owned status")
        let menu = NSMenu()
        menu.addItem(withTitle: "Owned inert item", action: nil, keyEquivalent: "")
        status.menu = menu
        window.orderFront(nil)
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in self?.writeState() }
        writeState()
    }
    func numberOfRows(in tableView: NSTableView) -> Int { 3 }
    func tableView(_ tableView: NSTableView, objectValueFor tableColumn: NSTableColumn?, row: Int) -> Any? { "Owned row \(row + 1)" }
    func tableViewSelectionDidChange(_ notification: Notification) { writeState() }
    @objc func twin(_ sender: NSButton) {
        if let index = twins.firstIndex(where: { $0 === sender }) { counts[index] += 1 }
        writeState()
    }
    @objc func removeFirst() { twins[0].removeFromSuperview(); writeState() }
    @objc func rebuild() {
        for button in twins { button.removeFromSuperview() }
        twins = [button("Twin", 285, #selector(twin)), button("Twin", 245, #selector(twin))]
        counts = [0, 0]
        field.stringValue = "seed"
        table.deselectAll(nil)
        writeState()
    }
    @objc func arm() {
        field.stringValue = "seed"
        Timer.scheduledTimer(withTimeInterval: 1.5, repeats: false) { [weak self] _ in
            self?.field.stringValue = "arrived"
            self?.writeState()
        }
    }
    @objc func openDense() {
        if denseWindow == nil {
            denseWindow = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 480, height: 400), styleMask: [.titled, .closable], backing: .buffered, defer: false)
            denseWindow.title = "Routing PK Dense"
            denseWindow.isReleasedWhenClosed = false
            let scroll = NSScrollView(frame: denseWindow.contentView!.bounds)
            let content = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 48000))
            for index in 0..<2000 {
                let label = NSTextField(labelWithString: "Owned dense row \(index)")
                label.frame = NSRect(x: 5, y: index * 24, width: 420, height: 22)
                content.addSubview(label)
            }
            scroll.documentView = content
            denseWindow.contentView!.addSubview(scroll)
        }
        denseWindow.orderFront(nil)
    }
    func writeState() {
        let state: [String: Any] = ["twins": counts, "firstAttached": twins[0].superview != nil, "text": field.stringValue, "selectedRow": table.selectedRow]
        if let data = try? JSONSerialization.data(withJSONObject: state, options: [.sortedKeys]) {
            try? data.write(to: URL(fileURLWithPath: output), options: .atomic)
        }
    }
    func applicationWillTerminate(_ notification: Notification) { NSStatusBar.system.removeStatusItem(status) }
}
let app = NSApplication.shared
let delegate = AdvancedFixture()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
