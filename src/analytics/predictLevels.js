/**
 * predictLevels.js
 * -----------------
 * Input : a "before" record in the exact shape your data collector produces
 *         { histogram, histogram_zones, avg_brightness, total_pixels, faces }
 * Output: { black, white, gamma }
 *
 * Trained on 152 image pairs. v2 coefficients.
 */

// ---- 1. PASTE YOUR "before" OBJECT HERE ---------------------------------
const before = {
  histogram: [], // <- paste the 256-value histogram array
  histogram_zones: {
    dark_0_50: 0,
    mid_51_150: 0,
    bright_151_200: 0,
    highlight_201_255: 0,
  },
  avg_brightness: 0,
  total_pixels: 0,
  faces: [], // <- array of { luminance: <number>, ... } - can be empty
};
// --------------------------------------------------------------------------

const MODEL = {
  black: {
    intercept: 6.617520,
    coef: [0.061007, 0.061771, 1.336285, -0.101510, 0.285880,
           -0.103849, -0.212935, 0.977766, -0.151649, -0.064650,
           -0.069254, 0.043866],
  },
  white: {
    intercept: 37.225775,
    coef: [0.249141, 0.235994, -0.788359, -0.161760, 0.136341,
           -0.164025, 0.122803, -0.004937, -0.172309, -0.049781,
            0.123991, 0.463238],
  },
  gamma: {
    intercept: 2.347915,
    coef: [0.005608, -0.003864, 0.060307, 0.040081, -0.059789,
           -0.001901, 0.009535, 0.005231, -0.003400, -0.004679,
           -0.002559, -0.000565],
  },
};

function percentileFromHist(histogram, p) {
  const total = histogram.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let running = 0;
  const target = p * total;
  for (let i = 0; i < 256; i++) {
    const prev = running;
    running += histogram[i];
    if (running >= target) {
      const span = running - prev;
      const frac = span > 0 ? (target - prev) / span : 0;
      const val = i - 1 + frac;
      return val >= 0 ? val : 0;
    }
  }
  return 255;
}

function clip(v, lo, hi) {
  return Math.min(Math.max(v, lo), hi);
}

function linearPredict(features, model) {
  let y = model.intercept;
  for (let i = 0; i < features.length; i++) y += model.coef[i] * features[i];
  return y;
}

/**
 * @param {Object} before - { histogram, histogram_zones, avg_brightness, total_pixels, faces }
 * @returns {{black:number, white:number, gamma:number}}
 */
function predictLevels(before) {
  const { histogram, histogram_zones, avg_brightness, total_pixels, faces = [] } = before;

  const hasFace = faces.length > 0 ? 1.0 : 0.0;
  const faceLum = faces.length > 0
    ? faces.reduce((sum, f) => sum + f.luminance, 0) / faces.length
    : avg_brightness;

  const features = [
    avg_brightness,
    faceLum,
    hasFace,
    histogram_zones.dark_0_50 / total_pixels,
    histogram_zones.mid_51_150 / total_pixels,
    histogram_zones.bright_151_200 / total_pixels,
    histogram_zones.highlight_201_255 / total_pixels,
    percentileFromHist(histogram, 0.01),
    percentileFromHist(histogram, 0.05),
    percentileFromHist(histogram, 0.50),
    percentileFromHist(histogram, 0.95),
    percentileFromHist(histogram, 0.99),
  ];

  let black = linearPredict(features, MODEL.black);
  let white = linearPredict(features, MODEL.white);
  let gamma = linearPredict(features, MODEL.gamma);

  black = clip(black, 0, 254);
  white = clip(white, black + 1, 255);
  gamma = clip(gamma, 0.3, 3.0);

  return { black, white, gamma };
}

// ---- Run it ---------------------------------------------------------------
const result = predictLevels(before);
console.log(result);

module.exports = { predictLevels };
