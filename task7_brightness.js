
const fs = require("fs");

const path = "d:/Users/Documents/Adobe/Plugin/CE_1.0.0/src/panels/correctionPanel.jsx";

let content = fs.readFileSync(path, "utf-8");

// Replace the Brightness row - remove native input, add visual track + two more buttons
// The old row has the input type="range" that needs to be replaced

const oldBrightRow = `                    <div className="ce-bright-row">

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

                        <input
                            className="ce-slider-dark"
                            type="range"
                            min="-5"
                            max="5"
                            step="1"
                            value={brightnessDelta}
                            onInput={changeBrightnessTarget}
                            onChange={changeBrightnessTarget}
                        />

                    </div>`;

const newBrightRow = `                    <div className="ce-bright-row">

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

                    </div>`;

if (content.includes(oldBrightRow)) {
    content = content.replace(oldBrightRow, newBrightRow);
    console.log("Replaced Brightness row with visual track");
} else {
    console.log("ERROR: Could not find old Brightness row pattern");
    // Try to find what we have
    const idx = content.indexOf("ce-bright-row");
    if (idx !== -1) {
        console.log("Found ce-bright-row at:", idx);
        console.log("Context:", content.substring(idx - 20, idx + 400));
    }
    process.exit(1);
}

fs.writeFileSync(path, content, "utf-8");
console.log("TASK 7: Brightness visual slider implemented");

