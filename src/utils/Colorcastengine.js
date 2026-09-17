/**
 * colorCastEngine.js
 * ---------------------------------------------------------------
 * Processes per-image analysis data (histograms + face data) and
 * returns a COLOR CAST % — a single control value that tells your
 * grey-world implementation how much correction to actually apply.
 *
 *   colorCastPercent = 0    -> don't touch color (theme/scene color,
 *                              e.g. haldi yellow, colored lighting)
 *   colorCastPercent = 100  -> apply full grey-world correction
 *   anything in between     -> blend proportionally
 *
 * ALL thresholds (skin ratio locus, luminance range, confidence
 * cutoff) are passed in via `config`. Nothing is hardcoded inside
 * the logic — you fully control the direction/strength by changing
 * config values per shoot / per ceremony / per your own dataset.
 * ---------------------------------------------------------------
 */

/**
 * Default config — override any/all of these when calling
 * getColorCastPercent(data, { ...yourOverrides }).
 */
const DEFAULT_CONFIG = {
  // face validity filter
  LUM_MIN: 90,
  LUM_MAX: 180,
  CONF_MIN: 75,

  // natural skin tone ratio locus (R/G, R/B, G/B) — YOU decide these
  SKIN_RG_MIN: 1.25, SKIN_RG_MAX: 1.55,
  SKIN_RB_MIN: 1.50, SKIN_RB_MAX: 2.00,
  SKIN_GB_MIN: 1.10, SKIN_GB_MAX: 1.20,

  // deviation below this = "already natural", cast% forced to 0
  NATURAL_EPSILON: 0.03,

  // if no valid face is found at all, what cast% to fall back to
  NO_FACE_FALLBACK_PERCENT: 100,

  // correction window: applied cast% is CLAMPED to [MIN, MAX]:
  //   raw <= MIN -> MIN  (e.g. 0% -> 15% minimum correction)
  //   raw >= MAX -> MAX  (e.g. 100% -> 85% maximum correction)
  CAST_PERCENT_MIN: 15,
  CAST_PERCENT_MAX: 85,
};

/** Merge user config on top of defaults (shallow). */
function resolveConfig(userConfig) {
  return Object.assign({}, DEFAULT_CONFIG, userConfig || {});
}

/**
 * Compute channel average from a 256-bin histogram, if avg_* isn't
 * already provided in the data (fallback path).
 */
function avgFromHistogram(hist) {
  let sum = 0, count = 0;
  for (let i = 0; i < hist.length; i++) {
    sum += i * hist[i];
    count += hist[i];
  }
  return count > 0 ? sum / count : 0;
}

/** Resolve avg_r/avg_g/avg_b from data, computing from histograms if needed. */
function getChannelAverages(data) {
  const avg_r = typeof data.avg_r === 'number' ? data.avg_r : avgFromHistogram(data.histogram_r);
  const avg_g = typeof data.avg_g === 'number' ? data.avg_g : avgFromHistogram(data.histogram_g);
  const avg_b = typeof data.avg_b === 'number' ? data.avg_b : avgFromHistogram(data.histogram_b);
  return { avg_r, avg_g, avg_b };
}

/** Step 1: keep only well-lit, high-confidence faces. */
function getValidFaces(faces, cfg) {
  return (faces || []).filter(f =>
    f.luminance >= cfg.LUM_MIN &&
    f.luminance <= cfg.LUM_MAX &&
    f.confidence >= cfg.CONF_MIN
  );
}

/** Step 2: confidence-weighted average skin RGB across valid faces. */
function getWeightedSkinTone(validFaces) {
  let totalWeight = 0, r = 0, g = 0, b = 0;
  validFaces.forEach(f => {
    const w = f.confidence;
    r += f.rgb.r * w;
    g += f.rgb.g * w;
    b += f.rgb.b * w;
    totalWeight += w;
  });
  return { r: r / totalWeight, g: g / totalWeight, b: b / totalWeight };
}

/** Step 3: distance of a given RGB from the natural skin-tone locus (0 = inside locus). */
function skinDeviation(rgb, cfg) {
  const rg = rgb.r / rgb.g;
  const rb = rgb.r / rgb.b;
  const gb = rgb.g / rgb.b;

  const devRG = rg < cfg.SKIN_RG_MIN ? cfg.SKIN_RG_MIN - rg
              : rg > cfg.SKIN_RG_MAX ? rg - cfg.SKIN_RG_MAX : 0;
  const devRB = rb < cfg.SKIN_RB_MIN ? cfg.SKIN_RB_MIN - rb
              : rb > cfg.SKIN_RB_MAX ? rb - cfg.SKIN_RB_MAX : 0;
  const devGB = gb < cfg.SKIN_GB_MIN ? cfg.SKIN_GB_MIN - gb
              : gb > cfg.SKIN_GB_MAX ? gb - cfg.SKIN_GB_MAX : 0;

  return devRG + devRB + devGB;
}

/** Step 4: grey-world cast ratios, green channel as neutral reference. */
function getGreyWorldCast(avg_r, avg_g, avg_b) {
  return { castR: avg_r / avg_g, castB: avg_b / avg_g };
}

/** Step 5: hypothetical fully-corrected RGB if grey-world were fully applied. */
function applyCorrection(rgb, castR, castB) {
  return { r: rgb.r / castR, g: rgb.g, b: rgb.b / castB };
}

/**
 * MAIN: returns the color cast % to drive your grey-world correction,
 * plus supporting numbers for debugging/logging.
 *
 * @param {object} data   - your per-image analysis JSON (histograms + faces)
 * @param {object} config - optional overrides for any DEFAULT_CONFIG key
 */
function getColorCastPercent(data, config) {
  const cfg = resolveConfig(config);
  const { avg_r, avg_g, avg_b } = getChannelAverages(data);
  const { castR, castB } = getGreyWorldCast(avg_r, avg_g, avg_b);

  const validFaces = getValidFaces(data.faces, cfg);

  if (validFaces.length === 0) {
    return {
      status: 'no_valid_face',
      colorCastPercent: cfg.NO_FACE_FALLBACK_PERCENT,
      castR, castB,
      note: 'No face passed LUM_MIN/LUM_MAX/CONF_MIN filters — using NO_FACE_FALLBACK_PERCENT.',
    };
  }

  const skin = getWeightedSkinTone(validFaces);
  const devBefore = skinDeviation(skin, cfg);

  // skin already inside your defined natural locus -> treat cast as theme color
  if (devBefore <= cfg.NATURAL_EPSILON) {
    return {
      status: 'theme_color_likely',
      colorCastPercent: 0,
      validFaceCount: validFaces.length,
      skinTone: skin,
      castR, castB,
      deviationBefore: devBefore,
      note: 'Skin tone already within configured natural locus — cast% forced to 0.',
    };
  }

  // test whether grey-world correction actually pulls skin back toward natural
  const correctedSkin = applyCorrection(skin, castR, castB);
  const devAfter = skinDeviation(correctedSkin, cfg);

  let colorCastPercent, status;

  if (devAfter < devBefore) {
    const improvement = (devBefore - devAfter) / devBefore; // 0..1
    colorCastPercent = Math.round(Math.min(1, Math.max(0, improvement)) * 100);
    status = 'real_cast';
  } else {
    colorCastPercent = 0;
    status = 'theme_color_likely';
  }

  return {
    status,
    colorCastPercent,
    validFaceCount: validFaces.length,
    skinTone: skin,
    castR, castB,
    deviationBefore: devBefore,
    deviationAfter: devAfter,
    note: status === 'real_cast'
      ? `Correction improves skin naturalness by ${colorCastPercent}% -> applying that much of grey-world.`
      : 'Correction does not improve skin naturalness -> treating as theme/scene color.',
  };
}

/**
 * HELPER: turn colorCastPercent into actual per-channel multipliers
 * to plug into your grey-world / regression pipeline.
 *   pixel.R *= factorR
 *   pixel.G *= factorG   (always 1, green is the reference channel)
 *   pixel.B *= factorB
 */
function getCorrectionFactors(result) {
  const t = result.colorCastPercent / 100;
  return {
    factorR: 1 + (1 / result.castR - 1) * t,
    factorG: 1,
    factorB: 1 + (1 / result.castB - 1) * t,
  };
}

/**
 * WINDOW: raw cast% (0-100) ko [CAST_PERCENT_MIN, CAST_PERCENT_MAX]
 * me CLAMP karta hai:
 *
 *   raw 0%   -> MIN (15%)   minimum correction hamesha lagti hai
 *   raw 100% -> MAX (85%)   full raw grey-world kabhi nahi lagti
 *   15-85 ke beech -> jaisa hai waisa hi
 *
 * e.g. MIN=15, MAX=85:  raw 0% -> 15% | raw 50% -> 50% | raw 100% -> 85%
 *
 * @param {number} rawPercent - engine ka raw cast % (0-100)
 * @param {object} config - optional overrides (CAST_PERCENT_MIN / CAST_PERCENT_MAX)
 * @returns {number} applied percent (15-85)
 */
function getAppliedCastPercent(rawPercent, config) {
  const cfg = resolveConfig(config);
  return Math.min(cfg.CAST_PERCENT_MAX, Math.max(cfg.CAST_PERCENT_MIN, rawPercent));
}

module.exports = {
  getColorCastPercent,
  getCorrectionFactors,
  getAppliedCastPercent,
  getValidFaces,
  getWeightedSkinTone,
  skinDeviation,
  getGreyWorldCast,
  getChannelAverages,
  DEFAULT_CONFIG,
};