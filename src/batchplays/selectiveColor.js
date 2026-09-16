const { action, core } = window.require("photoshop");
const { batchPlay } = action;
const { executeAsModal } = core;

/**
 * Valid color targets allowed by Photoshop Action Descriptor
 */
const VALID_COLORS = [
    "reds", "yellows", "greens", "cyans", 
    "blues", "magentas", "whites", "neutrals", "blacks"
];

/**
 * Helper to clamp integer CMYK values between -100 and +100
 */
function sanitizeCMYK(val) {
    return Math.max(-100, Math.min(100, Math.round(val || 0)));
}

/**
 * Applies Selective Color adjustment to active layer.
 * @param {Array<Object>} corrections - Array of target color objects with CMYK shifts.
 * @param {boolean} isAbsolute - true = Absolute method, false = Relative method (Default).
 */
async function applySelectiveColor(corrections = [], isAbsolute = false) {
    // Format and sanitize array for batchPlay descriptor
    const formattedCorrections = [];

    for (const item of corrections) {
        if (!VALID_COLORS.includes(item.target)) {
            console.warn(`Skipping invalid target color: ${item.target}`);
            continue;
        }

        formattedCorrections.push({
            _obj: "colorCorrection",
            colors: {
                _enum: "colors",
                _value: item.target
            },
            cyan: sanitizeCMYK(item.c),
            magenta: sanitizeCMYK(item.m),
            yellow: sanitizeCMYK(item.y),
            black: sanitizeCMYK(item.k)
        });
    }

    if (formattedCorrections.length === 0) {
        console.error("No valid selective color targets provided.");
        return;
    }

    await executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "selectiveColor",
                method: {
                    _enum: "colorsCorrectionType",
                    _value: isAbsolute ? "absolute" : "relative"
                },
                colorCorrection: formattedCorrections
            }
        ], { synchronousExecution: false });
    }, { "commandName": "Applying Selective Color" });
}

// ==========================================
// TEST EXECUTION
// ==========================================
module.exports = async function testSelectiveColor() {
    try {
        console.log("Applying Selective Color adjustment...");
        
        // Example: Wedding album skin-tone clean up (Red & Yellow targets) + Richer Blacks
        const colorShifts = [
            {
                target: "reds",
                c: -10,  // Reduce Cyan to boost redness/warmth
                m: +5,   // Slight Magenta punch
                y: +10,  // Warm up skin
                k: 0
            },
            {
                target: "yellows",
                c: -15,  // Clean muddy yellows
                m: +2,
                y: -5,
                k: -5    // Brighten highlights in yellow zones
            },
            {
                target: "blacks",
                c: +5,
                m: +5,
                y: +5,
                k: +8    // Deepen overall pure shadows/blacks
            }
        ];

        // Using 'false' for Relative method (smoother blending)
        await applySelectiveColor(colorShifts, false);
        
        console.log("Selective Color applied successfully!");
    } catch (error) {
        console.error("Selective Color execution failed:", error);
    }
}