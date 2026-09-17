import os

path = "d:/Users/Documents/Adobe/Plugin/CE_1.0.0/src/panels/correctionPanel.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

start_marker = "<div className=\"ce-bright-row\">"
end_marker = "</div>\n\n                    <div className=\"ce-strip"

start_idx = content.find(start_marker)
if start_idx == -1:
    print("ERROR: Could not find ce-bright-row start")
    exit(1)

end_idx = content.find(end_marker, start_idx)
if end_idx == -1:
    print("ERROR: Could not find ce-strip after ce-bright-row")
    exit(1)

close_idx = content.rfind("</div>", start_idx, end_idx)
if close_idx == -1:
    print("ERROR: Could not find closing div")
    exit(1)

print(f"Found Brightness row: {start_idx} to {close_idx}")

new_row = """                    <div className="ce-bright-row">

                        <button
                            className="ce-step-btn"
                            onClick={() => stepBrightness(-1)}
                        >
                            −
                        </button>

                        <button
                            className="ce-step-btn"
                            onClick={() => stepBrightness(1)}
                        >
                            +
                        </button>

                        <div className="ce-brightness-track">
                            <div
                                className="ce-brightness-handle"
                                style={{ left: (((brightnessDelta + 5) / 10 * 100).toFixed(1)) + "%" }}
                            />
                        </div>

                        <button
                            className="ce-step-btn"
                            onClick={() => stepBrightness(-1)}
                        >
                            −
                        </button>

                        <button
                            className="ce-step-btn"
                            onClick={() => stepBrightness(1)}
                        >
                            +
                        </button>

                    </div>"""

new_content = content[:start_idx] + new_row + content[close_idx + 6:]

with open(path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("TASK 7: Brightness visual slider implemented")