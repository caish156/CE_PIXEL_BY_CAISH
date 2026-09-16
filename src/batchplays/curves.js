const { action, core } = window.require("photoshop");
const { batchPlay } = action;
const { executeAsModal } = core;

/**
 * Validates and clamps 4 curve points to prevent sharp twists or inversions.
 */
function sanitize4PointCurve(shadowY, highlightY) {
    // Fixed anchors
    const p1 = [0, 0];
    const p4 = [255, 255];

    // Fixed X positions for Shadows (1/4) and Highlights (3/4)
    const shadowX = 64;
    const highlightX = 192;

    // Rule 1: Limit maximum vertical shift to +-25 from linear diagonal to prevent harsh curves
    const maxShift = 25;
    let safeShadowY = Math.max(shadowX - maxShift, Math.min(shadowX + maxShift, shadowY));
    let safeHighlightY = Math.max(highlightX - maxShift, Math.min(highlightX + maxShift, highlightY));

    // Rule 2: Enforce strict monotonicity (Shadow Y must be lower than Highlight Y with safety margin)
    if (safeShadowY >= safeHighlightY - 20) {
        safeShadowY = Math.min(safeShadowY, 118);
        safeHighlightY = Math.max(safeHighlightY, 138);
    }

    return [p1, [shadowX, safeShadowY], [highlightX, safeHighlightY], p4];
}

async function applyCurvesAdjustment(points) {
    const formattedPoints = points.map(pt => ({
        _obj: "point",
        horizontal: pt[0],
        vertical: pt[1]
    }));

    await executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "curves",
                presetKind: {
                    _enum: "presetKindType",
                    _value: "presetKindCustom"
                },
                adjustment: [
                    {
                        _obj: "curveEnum",
                        channel: {
                            _ref: "channel",
                            _enum: "channel",
                            _value: "composite"
                        },
                        curve: formattedPoints
                    }
                ]
            }
        ], { synchronousExecution: false });
    }, { "commandName": "Applying Safe 4-Point Curve" });
}

// ==========================================
// CHANNEL-SPECIFIC CURVES (Red / Green / Blue)
// ==========================================

/**
 * Photoshop ke batchPlay descriptor engine me channel enum values FIXED hote hain.
 * User-friendly names ko exact descriptor values pe map karte hain:
 *
 *   "red"       -> "red"
 *   "green"     -> "grn"       (descriptor value "green" NAHI hota!)
 *   "blue"      -> "bl "       (trailing space MANDATORY hai, warna batchPlay fail hota hai)
 *   "gray"      -> "gray"
 *   "composite" -> "composite" (RGB document ka combined curve)
 */
const CHANNEL_ENUM_MAP = {
    red: "red",
    green: "grn",
    blue: "bl ",
    gray: "gray",
    composite: "composite"
};

/**
 * Converts a user-friendly channel name to the exact Photoshop descriptor enum value.
 * @param {string} channel - "red" | "green" | "blue" | "gray" | "composite" (case-insensitive)
 * @returns {string} Descriptor enum value for the `channel` _enum
 * @throws {Error} If the channel name is not supported
 */
function resolveChannelEnum(channel) {
    const key = String(channel ?? "").trim().toLowerCase();
    const enumValue = CHANNEL_ENUM_MAP[key];
    if (!enumValue) {
        throw new Error(
            `Invalid channel "${channel}". Allowed values: ${Object.keys(CHANNEL_ENUM_MAP).join(", ")}`
        );
    }
    return enumValue;
}

/**
 * Cleans curve points so Photoshop always accepts them:
 * - Clamps X/Y to 0..255 and rounds them
 * - Sorts by X (Photoshop rejects unsorted curves)
 * - Drops duplicate X positions (strictly increasing X is required)
 */
function sanitizeCurvePoints(points) {
    const clamped = (points || [[0, 0], [255, 255]]).map(pt => [
        Math.max(0, Math.min(255, Math.round(pt[0]))),
        Math.max(0, Math.min(255, Math.round(pt[1])))
    ]);

    const cleaned = [];
    for (const pt of clamped.sort((a, b) => a[0] - b[0])) {
        if (cleaned.length && pt[0] <= cleaned[cleaned.length - 1][0]) continue;
        cleaned.push(pt);
    }
    return cleaned;
}

/**
 * Applies a curves adjustment to a SPECIFIC channel (e.g. red, green, blue).
 * Curve is applied destructively on the ACTIVE layer (same behavior as applyCurvesAdjustment).
 *
 * @param {string} channel - "red" | "green" | "blue" | "gray" | "composite"
 * @param {Array<Array<number>>} points - Curve points [[x, y], ...] e.g. [[0,0],[64,55],[192,210],[255,255]]
 * @returns {Promise<void>}
 */
async function applyChannelCurves(channel, points) {
    const enumValue = resolveChannelEnum(channel);
    const safePoints = sanitizeCurvePoints(points);

    const formattedPoints = safePoints.map(pt => ({
        _obj: "point",
        horizontal: pt[0],
        vertical: pt[1]
    }));

    await executeAsModal(
        async () => {
            await batchPlay(
                [
                    {
                        _obj: "curves",
                        presetKind: {
                            _enum: "presetKindType",
                            _value: "presetKindCustom"
                        },
                        adjustment: [
                            {
                                _obj: "curveEnum",
                                channel: {
                                    _ref: "channel",
                                    _enum: "channel",
                                    _value: enumValue
                                },
                                curve: formattedPoints
                            }
                        ]
                    }
                ],
                { synchronousExecution: false }
            );
        },
        { "commandName": `Applying ${channel} Channel Curve` }
    );
}

// Convenience wrappers
function applyRedCurves(points) { return applyChannelCurves("red", points); }
function applyGreenCurves(points) { return applyChannelCurves("green", points); }
function applyBlueCurves(points) { return applyChannelCurves("blue", points); }

/**
 * Converts a linear channel gain factor (e.g. grey-world multiplier) into
 * curve points. Behaviour: output = input * factor, clamped to 0..255.
 *
 *   factor 1.0 -> linear curve (no change)
 *   factor 1.2 -> curve lifts the channel (e.g. more Red)
 *   factor 0.8 -> curve pulls the channel down
 *
 * @param {number} factor - channel gain multiplier (must be > 0)
 * @returns {Array<Array<number>>} curve points [[x, y], ...]
 */
function factorToCurvePoints(factor) {
    const f = Number(factor);
    if (!isFinite(f) || f <= 0) {
        throw new Error(`Invalid curve factor: ${factor}`);
    }
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
    return [
        [0, 0],
        [128, clamp(128 * f)],
        [255, clamp(255 * f)]
    ];
}



// ==========================================
// TEST EXECUTION
// ==========================================

async function testChannelCurves() {
    try {
        console.log("Applying channel curves...");

        // Example: subtle R lift + slight B compression for a warm filmic feel
        await applyRedCurves([[0, 0], [64, 55], [192, 200], [255, 255]]);
        await applyGreenCurves([[0, 0], [128, 128], [255, 255]]);   // Neutral (linear)
        await applyBlueCurves([[0, 5], [128, 125], [255, 250]]);    // Blue thoda kam (warm shift)

        console.log("Channel curves applied successfully!");
    } catch (error) {
        console.error("Channel curves execution failed:", error);
    }
}

module.exports = {
    sanitize4PointCurve,
    applyCurvesAdjustment,
    resolveChannelEnum,
    sanitizeCurvePoints,
    applyChannelCurves,
    applyRedCurves,
    applyGreenCurves,
    applyBlueCurves,
    factorToCurvePoints,
    testChannelCurves
}