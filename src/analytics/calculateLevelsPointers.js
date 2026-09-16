function calculateLevelsPointers(histogram) {
    const totalPixels = histogram.reduce((sum, count) => sum + count, 0);

    // 0.05% percentile clipping threshold to ignore sensor noise/dead pixels
    const shadowClipThreshold = totalPixels * 0.0005;
    const highlightClipThreshold = totalPixels * 0.0005;

    let shadowPoint = 0;
    let highlightPoint = 255;

    // 1. Find Shadow Point (Left pointer)
    let accumulator = 0;
    for (let i = 0; i < 256; i++) {
        accumulator += histogram[i];
        if (accumulator > shadowClipThreshold) {
            shadowPoint = i;
            break;
        }
    }

    // 2. Find Highlight Point (Right pointer)
    accumulator = 0;
    for (let i = 255; i >= 0; i--) {
        accumulator += histogram[i];
        if (accumulator > highlightClipThreshold) {
            highlightPoint = i;
            break;
        }
    }

    // Prevent overlap edge case
    if (shadowPoint >= highlightPoint) {
        shadowPoint = 0;
        highlightPoint = 255;
    }

    // 3. Find Midpoint/Gamma (Middle pointer) via Mean Luminance
    let weightedSum = 0;
    for (let i = 0; i < 256; i++) {
        weightedSum += i * histogram[i];
    }
    const meanLuminance = weightedSum / totalPixels;

    // Standard normalized mid-tone shift
    // Target midpoint is 0.5 (128 luminance). Calculate required gamma shift.
    const normalizedMean = (meanLuminance - shadowPoint) / (highlightPoint - shadowPoint);
    let gamma = Math.log(0.5) / Math.log(Math.max(0.01, Math.min(0.99, normalizedMean)));

    // Clamp gamma between Photoshop's acceptable range (0.10 to 9.99)
    gamma = Math.max(0.2, Math.min(3.0, Number(gamma.toFixed(2))));

    return {
        shadow: shadowPoint,
        midpoint: gamma,
        highlight: highlightPoint
    };
}

module.exports = {calculateLevelsPointers}