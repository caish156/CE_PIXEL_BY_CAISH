const { action, core } = window.require("photoshop");
const { batchPlay } = action;
const { executeAsModal } = core;

/**
 * Helper to clamp integer values safely
 */
function sanitizeInt(val, min, max, defaultVal) {
    const num = Math.round(val !== undefined ? val : defaultVal);
    return Math.max(min, Math.min(max, num));
}


/**
 * Custom Shadow/Highlight recovery matching studio standard screenshot.
 * Shadows strictly untouched (0/0/0). Highlights dynamic based on clipping.
 */
async function applyHighlightRecovery(dynamicHighlightAmount = 17) {
    await core.executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "adaptCorrect",
                shadowMode: {
                    _obj: "adaptCorrectTones",
                    amount: { _unit: "percentUnit", _value: 0 }, // Strict 0 (No shadow touch)
                    width: { _unit: "percentUnit", _value: 0 },  // Tone 0%
                    radius: 0                                    // Radius 0px
                },
                highlightMode: {
                    _obj: "adaptCorrectTones",
                    amount: { _unit: "percentUnit", _value: dynamicHighlightAmount }, // Dynamic!
                    width: { _unit: "percentUnit", _value: 0 },                       // Tone 0%
                    radius: 100                                                       // Radius 100px
                },
                colorCorrection: 20, // Adjustments -> Color +20
                midtoneContrast: 0,  // Adjustments -> Midtone 0
                blackClip: 0.01,     // Black Clip 0.01%
                whiteClip: 0.01      // White Clip 0.01%
            }
        ], {});
    }, { commandName: `Highlight Recovery (${dynamicHighlightAmount}%)` });
}

module.exports ={ applyHighlightRecovery}