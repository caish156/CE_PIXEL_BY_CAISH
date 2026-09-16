const { action, core } = window.require("photoshop");
const { batchPlay } = action;
const { executeAsModal } = core;

/**
 * Applies Brightness/Contrast directly to active layer.
 * @param {number} brightness - Native Range: -150 to +150
 * @param {number} contrast   - Native Range: -50 to +100
 */
async function applyBrightnessContrast(brightness = 0, contrast = 0) {
    // Clamping to Photoshop's exact native limits to prevent script errors
    const safeBrightness = Math.max(-150, Math.min(150, Math.round(brightness)));
    const safeContrast = Math.max(-50, Math.min(100, Math.round(contrast)));

    await executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "brightnessEvent",
                brightness: safeBrightness,
                contrast: safeContrast,
                useLegacy: false // False = Modern algorithm (Prevents harsh clipping)
            }
        ], { synchronousExecution: false });
    }, { "commandName": "Applying Brightness/Contrast" });
}

// ==========================================
// TEST EXECUTION
// ==========================================
async function testBrightnessContrast() {
    try {
        console.log("Applying Brightness/Contrast...");
        // Example: Slight punch in exposure (+12) and moderate contrast boost (+18)
        await applyBrightnessContrast(12, 18);
        console.log("Brightness/Contrast applied successfully!");
    } catch (error) {
        console.error("Brightness/Contrast execution failed:", error);
    }
}

module.exports = {testBrightnessContrast}