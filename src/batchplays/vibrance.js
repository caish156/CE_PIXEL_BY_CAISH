/**
 * Applies Vibrance adjustment to active layer.
 * @param {number} vibrance   - Native Range: -100 to +100 (Smart skin-safe saturation)
 * @param {number} saturation - Native Range: -100 to +100 (Linear saturation)
 */
async function applyVibrance(vibrance = 0, saturation = 0) {
    const safeVibrance = sanitizeInt(vibrance, -100, 100, 0);
    const safeSaturation = sanitizeInt(saturation, -100, 100, 0);

    await executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "vibrance",
                vibrance: safeVibrance,
                saturation: safeSaturation
            }
        ], { synchronousExecution: false });
    }, { "commandName": "Applying Vibrance" });
}

// ==========================================
// TEST EXECUTION (Vibrance)
// ==========================================
async function testVibrance() {
    try {
        console.log("Applying Vibrance...");
        // Example: Boost colors while protecting skin tones (+18 vibrance, +3 sat)
        await applyVibrance(18, 3);
        console.log("Vibrance applied successfully!");
    } catch (error) {
        console.error("Vibrance execution failed:", error);
    }
}