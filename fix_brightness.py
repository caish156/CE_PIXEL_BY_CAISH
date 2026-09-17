import os

path = "d:/Users/Documents/Adobe/Plugin/CE_1.0.0/src/panels/correctionPanel.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_bright_section = """                    <div className="ce-bright-row">

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

new_bright_section = """                    <div className="ce-bright-row">

                        <button
                            className="ce-step-btn"
                            onClick={() => stepBrightness(-1)}
                        >
                            −
                        </button>

                        <div className="ce-brightness-track">
                            <div
                                className="ce-brightness-handle"
                                style={{ left: (((brightnessDelta + 5) / 10 * 100).toFixed(1)) + "%" }}
                            />
                        </div>

                        <button
                            className="ce-step-btn"
                            onClick={() => stepBrightness(1)}
                        >
                            +
                        </button>

                    </div>"""

content = content.replace(old_bright_section, new_bright_section)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fixed: Brightness now has 2 buttons (minus left, plus right)")

