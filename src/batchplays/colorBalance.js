const { action, core } = window.require("photoshop");
const { batchPlay } = action;
const { executeAsModal } = core;

/**
 * Helper to clamp array values between -100 and +100 as integers.
 */
function sanitizeLevels(arr = [0, 0, 0]) {
    return arr.map(val => Math.max(-100, Math.min(100, Math.round(val))));
}

/**
 * Applies Color Balance adjustment to the active layer.
 * Array format: [Cyan(-) to Red(+), Magenta(-) to Green(+), Yellow(-) to Blue(+)]
 * 
 * @param {Array<number>} midtones - e.g. [10, 0, -15]
 * @param {Array<number>} shadows - e.g. [0, 0, 0]
 * @param {Array<number>} highlights - e.g. [-5, 0, 10]
 * @param {boolean} preserveLuminosity - Prevents exposure shifts during color grading
 */
async function applyColorBalance(midtones = [0, 0, 0], shadows = [0, 0, 0], highlights = [0, 0, 0], preserveLuminosity = true) {
    const safeMidtones = sanitizeLevels(midtones);
    const safeShadows = sanitizeLevels(shadows);
    const safeHighlights = sanitizeLevels(highlights);

    await executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "colorBalance",
                shadowLevels: safeShadows,
                midtoneLevels: safeMidtones,
                highlightLevels: safeHighlights,
                preserveLuminosity: preserveLuminosity
            }
        ], { synchronousExecution: false });
    }, { "commandName": "Applying Color Balance" });
}

// ==========================================
// TEST EXECUTION
// ==========================================
async function testColorBalance() {
    try {
        console.log("Applying Color Balance...");
        
        // Example: Subtle warm skin-tone boost in midtones (+12 Red, -5 Yellow/warm shift)
        // and cooling down shadows slightly (+8 Blue)
        const midtones = [12, 0, -5];   // [Red boost, Green neutral, Yellow boost (negative Blue)]
        const shadows = [0, 0, 8];      // [Neutral, Neutral, Blue boost]
        const highlights = [0, 0, 0];   // Untouched

        await applyColorBalance(midtones, shadows, highlights, true);
        console.log("Color Balance applied successfully!");
    } catch (error) {
        console.error("Color Balance execution failed:", error);
    }
}

module.exports = {applyColorBalance, testColorBalance}