// ============================================================
// utils/brightnessMath.js
//
// BRIGHTNESS TARGET MATH
//
// predictLevels model image ka mean brightness ~146 pe laata hai.
// User slider (130-160) se apna target choose karta hai.
//
// Levels me output mean approximately:
//
//     mean_out = mean_in^(1/gamma) * 255
//
// Predicted gamma 146 deta hai, to:
//
//     ln(146/255) = (1/gamma) * ln(mean_in/255)
//
// Target T ke liye naya gamma:
//
//     gamma' = gamma * ln(146/255) / ln(T/255)
//
//     T = 146 -> gamma' = gamma      (koi change nahi)
//     T > 146 -> gamma' > gamma      (PS gamma bada = brighter)
//     T < 146 -> gamma' < gamma      (PS gamma chhota = darker)
//
// ============================================================

// Model ka default target (jisse predictLevels train hua)
const REFERENCE_MEAN_BRIGHTNESS = 146;

// UI slider range (delta scale: 0 center, ±1..±5 @ 3 ke gap)
//   -5 -> 131 | 0 -> 146 | +5 -> 161
const BRIGHTNESS_MIN = 131;
const BRIGHTNESS_MAX = 161;

// UI delta stops ka internal gap (1 UI step = 3 brightness units)
const BRIGHTNESS_DELTA_STEP = 3;

// Safety hard limits (workflow side, UI se aane wale kisi bhi value ke liye)
const HARD_MIN = 100;
const HARD_MAX = 250;

/** Brightness target ko hard limits me clamp karta hai. */
function clampBrightnessTarget(value) {
  const v = Number(value);

  if (!Number.isFinite(v)) {
    return REFERENCE_MEAN_BRIGHTNESS;
  }

  return Math.min(HARD_MAX, Math.max(HARD_MIN, Math.round(v)));
}

/**
 * Predicted gamma ko user ke brightness target ke hisaab se adjust karta hai.
 *
 * @param {number} gamma            - predictLevels wala midpoint (PS gamma)
 * @param {number} targetBrightness - slider value (146 = no change)
 * @returns {number} adjusted gamma (0.3 - 3.0 clamp)
 */
function adjustGammaForBrightness(gamma, targetBrightness) {
  if (!Number.isFinite(gamma) || gamma <= 0) {
    return gamma;
  }

  const target = clampBrightnessTarget(targetBrightness);

  // Slider exactly 146 pe ho to model ka gamma as-is use hoga
  if (Math.abs(target - REFERENCE_MEAN_BRIGHTNESS) < 0.5) {
    return gamma;
  }

  const lnReference = Math.log(REFERENCE_MEAN_BRIGHTNESS / 255);
  const lnTarget = Math.log(target / 255);

  if (!Number.isFinite(lnTarget) || lnTarget === 0) {
    return gamma;
  }

  const adjusted = gamma * (lnReference / lnTarget);

  // Same clamp jo predictLevels me use hota hai
  return Math.min(3.0, Math.max(0.3, adjusted));
}

/**
 * Internal brightness target -> UI delta stop (-5..+5, 0 = default).
 *
 * @param {number} targetBrightness - internal value (e.g. 149)
 * @returns {number} delta (e.g. +1)
 */
function deltaFromTarget(targetBrightness) {
  return Math.round(
    (clampBrightnessTarget(targetBrightness) - REFERENCE_MEAN_BRIGHTNESS) /
      BRIGHTNESS_DELTA_STEP
  );
}

/**
 * UI delta stop (-5..+5) -> internal brightness target.
 *
 * @param {number} delta - UI step (e.g. -2)
 * @returns {number} internal value (e.g. 140)
 */
function targetFromDelta(delta) {
  const d = Number(delta);

  if (!Number.isFinite(d)) {
    return REFERENCE_MEAN_BRIGHTNESS;
  }

  return clampBrightnessTarget(
    REFERENCE_MEAN_BRIGHTNESS + Math.round(d) * BRIGHTNESS_DELTA_STEP
  );
}

/**
 * UI display ke liye signed delta string.
 *   +2 -> "+2" | -3 -> "-3" | 0 -> "0"
 */
function formatBrightnessDelta(delta) {
  if (delta > 0) {
    return `+${delta}`;
  }

  if (delta < 0) {
    return `${delta}`;
  }

  return "0";
}

module.exports = {
  adjustGammaForBrightness,
  clampBrightnessTarget,
  deltaFromTarget,
  targetFromDelta,
  formatBrightnessDelta,
  REFERENCE_MEAN_BRIGHTNESS,
  BRIGHTNESS_MIN,
  BRIGHTNESS_MAX,
  BRIGHTNESS_DELTA_STEP,
};
