const { action, core } = window.require("photoshop");
const { batchPlay } = action;
const { executeAsModal } = core;

/**
 * Applies Exposure adjustment to the active layer.
 * @param {number} exposure - Exact range: -20.0 to +20.0
 * @param {number} offset   - Exact range: -0.5 to +0.5
 * @param {number} gamma    - Exact range: 0.01 (max right slider) to 9.99 (max left slider). Default neutral = 1.00
 */
async function applyExposure(exposure = 0.0, offset = 0.0, gamma = 1.0) {
    // Strictly clamp ranges matching exact UI limits from your screenshots
    const safeExposure = Math.max(-20.0, Math.min(20.0, Number(exposure.toFixed(2))));
    const safeOffset = Math.max(-0.5, Math.min(0.5, Number(offset.toFixed(4))));
    
    // Gamma strictly clamped between 0.01 and 9.99
    const safeGamma = Math.max(0.01, Math.min(9.99, Number(gamma.toFixed(2))));

    await executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "exposure",
                exposure: safeExposure,
                offset: safeOffset,
                gammaCorrection: safeGamma
            }
        ], { synchronousExecution: false });
    }, { "commandName": "Applying Verified Exposure" });
}

// ==========================================
// TEST EXECUTION
// ==========================================
async function testExposure() {
    try {
        console.log("Applying Exposure adjustment...");
        
        // Example: Slight exposure recovery (+0.35 stop), neutral offset (0), standard gamma (1.0)
        await applyExposure(0.35, 0.0000, 1.00);
        
        console.log("Exposure applied successfully!");
    } catch (error) {
        console.error("Exposure execution failed:", error);
    }
}


module.exports = 
{testExposure, applyExposure}