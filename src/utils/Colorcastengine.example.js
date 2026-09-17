/**
 * colorCastEngine.js  (v2 — face-anchored / target-directed / curve-based)
 * ---------------------------------------------------------------
 * REPLACES the old 15–85% grey-world "colorCastPercent" system.
 *
 * This engine no longer returns a blend percentage + RGB multiplier.
 * It returns actual PHOTOSHOP CHANNEL CURVE POINTS (Red + Blue,
 * 5 points each: shadow / low-mid / mid / high-mid / highlight),
 * derived from:
 *
 *   1. The existing (confidence-weighted) face colour, converted to HSL.
 *   2. The user's selected HSL target range (skinConfig, from UI sliders).
 *   3. A standard/reference face HSL (standardFace) used ONLY to decide
 *      whether the face is under-lit or over-lit relative to "normal".
 *   4. Grey-world averages, used only as a *secondary, capped* nudge —
 *      never as the primary driver (so scene lighting, e.g. warm wedding
 *      venue light, is preserved instead of neutralised away).
 *
 * Decision table (see spec):
 *   CASE A: light below standard, colour (H/S) already in target range -> NO correction
 *   CASE B: light below standard, colour (H/S) outside target range    -> correct H/S,
 *           existing Lightness is preserved (light pipeline handles brightness)
 *   CASE C: light above/at standard, colour (H/S) already in target    -> NO correction
 *   CASE D: light above/at standard, colour (H/S) outside target       -> correct H/S,
 *           existing Lightness is preserved
 *
 * Public API: only `generateColorCurves` is exported. It returns exactly:
 *   { red: [...5 points], green: [...5 points], blue: [...5 points] }
 * ---------------------------------------------------------------
 */

const DEFAULT_CONFIG = {
  // face validity filter (unchanged from v1 — reused as-is)
  LUM_MIN: 90,
  LUM_MAX: 180,
  CONF_MIN: 75,

  // how far (in L, 0-100 scale) existing face lightness must be from
  // standardFace.l before we call it "below" / "above" standard
  LIGHT_EPSILON: 3,

  // small tolerance so "just barely outside the slider range" doesn't
  // trigger a full correction cycle
  RANGE_EPSILON: { h: 1, s: 1, l: 1 },

  // overall correction softness: 1.0 = move fully to the target point,
  // 0.0 = no movement at all. Kept well under 1 so the result stays
  // "natural photograph", not "mathematically neutral".
  STRENGTH: 0.65,

  // how much influence grey-world image-level cast is allowed to add
  // ON TOP of the face-target ratio — capped, and only applied when
  // grey-world agrees with the direction the face already needs to move.
  GREY_WORLD_MAX_INFLUENCE: 0.15,

  // tonal shaping: correction is centered on the face's own luminance
  // and tapers off toward shadows/highlights so the rest of the image
  // (background, dress, décor) isn't dragged along with the skin fix.
  TONAL_SIGMA: 70,       // spread, in 0-255 units
  TONAL_TAPER_MIN: 0.35, // minimum relative strength at the far tonal ends

  // green is only touched if the required green ratio deviates from
  // 1.0 by more than this (rare — colour casts are ~always R/B).
  GREEN_RATIO_THRESHOLD: 0.03,

  // if there's no valid face at all, we cannot be face-anchored —
  // engine returns identity curves rather than guessing.
};

function resolveConfig(userConfig) {
  return Object.assign(
    {},
    DEFAULT_CONFIG,
    userConfig || {},
    userConfig && userConfig.RANGE_EPSILON
      ? { RANGE_EPSILON: Object.assign({}, DEFAULT_CONFIG.RANGE_EPSILON, userConfig.RANGE_EPSILON) }
      : {}
  );
}

/* ---------------------------------------------------------------
 * Basic helpers (histogram averaging, face filtering/weighting) —
 * carried over from v1 unchanged, still useful building blocks.
 * ------------------------------------------------------------- */

function avgFromHistogram(hist) {
  let sum = 0, count = 0;
  for (let i = 0; i < hist.length; i++) {
    sum += i * hist[i];
    count += hist[i];
  }
  return count > 0 ? sum / count : 0;
}

function getChannelAverages(data) {
  const avg_r = typeof data.avg_r === 'number' ? data.avg_r : avgFromHistogram(data.histogram_r);
  const avg_g = typeof data.avg_g === 'number' ? data.avg_g : avgFromHistogram(data.histogram_g);
  const avg_b = typeof data.avg_b === 'number' ? data.avg_b : avgFromHistogram(data.histogram_b);
  return { avg_r, avg_g, avg_b };
}

function getValidFaces(faces, cfg) {
  return (faces || []).filter(f =>
    f.luminance >= cfg.LUM_MIN &&
    f.luminance <= cfg.LUM_MAX &&
    f.confidence >= cfg.CONF_MIN
  );
}

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

function getGreyWorldCast(avg_r, avg_g, avg_b) {
  return { castR: avg_r / avg_g, castB: avg_b / avg_g };
}

/* ---------------------------------------------------------------
 * RGB <-> HSL
 * ------------------------------------------------------------- */

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = 0; s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = h / 360;

  return {
    r: Math.round(hue2rgb(p, q, hk + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hk) * 255),
    b: Math.round(hue2rgb(p, q, hk - 1 / 3) * 255),
  };
}

/* ---------------------------------------------------------------
 * Step 2: classify one HSL channel against the UI target range,
 * and return the nearest valid point (used to build the target HSL).
 * ------------------------------------------------------------- */

function classifyChannel(value, range, epsilon) {
  if (value < range.min - epsilon) {
    return { status: 'below', distance: range.min - value, nearest: range.min };
  }
  if (value > range.max + epsilon) {
    return { status: 'above', distance: value - range.max, nearest: range.max };
  }
  return { status: 'inside', distance: 0, nearest: value };
}

/* ---------------------------------------------------------------
 * Step 6/7: face-target ratio blended with a capped, direction-
 * agreeing nudge from grey-world image-level averages.
 * ------------------------------------------------------------- */

function blendWithGreyWorld(faceRatio, greyRatio, cfg) {
  const faceDir = Math.sign(faceRatio - 1);
  const greyDir = Math.sign(greyRatio - 1);

  // Grey-world only gets a say if it agrees with the direction the
  // face already needs to move in. Otherwise it's ignored entirely —
  // this is what stops a warm venue light from being "corrected away".
  if (faceDir === 0 || greyDir !== faceDir) return faceRatio;

  const influence = Math.min(cfg.GREY_WORLD_MAX_INFLUENCE, Math.abs(greyRatio - 1));
  return faceRatio + (greyRatio - faceRatio) * influence;
}

/* ---------------------------------------------------------------
 * Step 9: build a smooth, monotonic 5-point curve for one channel.
 * The correction is centered on the face's own luminance and tapers
 * toward shadow/highlight so untouched areas of the frame stay put.
 * ------------------------------------------------------------- */

function buildCurve(ratio, faceLuminance, cfg) {
  const inputs = [0, 64, 128, 192, 255];
  return inputs.map(input => {
    const dist = input - faceLuminance;
    const gaussian = Math.exp(-(dist * dist) / (2 * cfg.TONAL_SIGMA * cfg.TONAL_SIGMA));
    const weight = cfg.TONAL_TAPER_MIN + (1 - cfg.TONAL_TAPER_MIN) * gaussian;
    const effectiveRatio = 1 + (ratio - 1) * weight;
    const output = Math.round(Math.min(255, Math.max(0, input * effectiveRatio)));
    return { input, output };
  });
}

function identityCurve() {
  return [0, 64, 128, 192, 255].map(v => ({ input: v, output: v }));
}

/* ---------------------------------------------------------------
 * MAIN (only exported function)
 * ------------------------------------------------------------- */

function generateColorCurves(data, skinConfig, standardFace, config) {
  const cfg = resolveConfig(config);

  const validFaces = getValidFaces(data.faces, cfg);
  if (validFaces.length === 0) {
    return {
      red: identityCurve(),
      green: identityCurve(),
      blue: identityCurve(),
    };
  }

  const existingFaceRGB = getWeightedSkinTone(validFaces);
  const existingFaceHSL = rgbToHsl(existingFaceRGB);

  const hueStatus = classifyChannel(existingFaceHSL.h, skinConfig.hue, cfg.RANGE_EPSILON.h);
  const satStatus = classifyChannel(existingFaceHSL.s, skinConfig.saturation, cfg.RANGE_EPSILON.s);
  const lightStatus = classifyChannel(existingFaceHSL.l, skinConfig.lightness, cfg.RANGE_EPSILON.l);

  // Colour correctness is determined by Hue + Saturation ONLY.
  // Lightness does not factor into whether colour needs correction.
  const colorInsideRange = hueStatus.status === 'inside' && satStatus.status === 'inside';

  const lightBelowStandard = existingFaceHSL.l < standardFace.l - cfg.LIGHT_EPSILON;

  const { avg_r, avg_g, avg_b } = getChannelAverages(data);
  const { castR, castB } = getGreyWorldCast(avg_r, avg_g, avg_b);

  // CASE A / CASE C — colour (H/S) already inside the selected target range.
  // No colour correction regardless of whether light is below or above
  // standard; light correction (if any) is left to the separate light pipeline.
  if (colorInsideRange) {
    return {
      red: identityCurve(),
      green: identityCurve(),
      blue: identityCurve(),
    };
  }

  // Colour (H/S) is outside the target range -> CASE B (light below standard)
  // or CASE D (light at/above standard). Build the target HSL point.
  const targetHue = hueStatus.nearest;
  const targetSat = satStatus.nearest;

  // Lightness is never moved by this engine — Case B and Case D both
  // preserve the existing Lightness; the separate light-correction
  // pipeline is responsible for brightness.
  const targetLight = existingFaceHSL.l;

  const targetHSL = { h: targetHue, s: targetSat, l: targetLight };
  const targetRGB = hslToRgb(targetHSL);

  // Step 6: face-anchored ratios (target / existing), each guarded
  // against divide-by-zero on a near-black sample.
  const safe = v => (v === 0 ? 1e-6 : v);
  const faceRatioR = targetRGB.r / safe(existingFaceRGB.r);
  const faceRatioB = targetRGB.b / safe(existingFaceRGB.b);
  const faceRatioG = targetRGB.g / safe(existingFaceRGB.g);

  // Step 7: capped, direction-agreeing grey-world nudge.
  const blendedRatioR = blendWithGreyWorld(faceRatioR, 1 / castR, cfg);
  const blendedRatioB = blendWithGreyWorld(faceRatioB, 1 / castB, cfg);

  // Step 8: soften — move only part-way, never full mathematical snap.
  const finalRatioR = 1 + (blendedRatioR - 1) * cfg.STRENGTH;
  const finalRatioB = 1 + (blendedRatioB - 1) * cfg.STRENGTH;
  const finalRatioG = Math.abs(faceRatioG - 1) > cfg.GREEN_RATIO_THRESHOLD
    ? 1 + (faceRatioG - 1) * cfg.STRENGTH
    : 1;

  const redCurve = buildCurve(finalRatioR, existingFaceRGB.r, cfg);
  const blueCurve = buildCurve(finalRatioB, existingFaceRGB.b, cfg);
  const greenCurve = finalRatioG === 1 ? identityCurve() : buildCurve(finalRatioG, existingFaceRGB.g, cfg);

  return {
    red: redCurve,
    green: greenCurve,
    blue: blueCurve,
  };
}

module.exports = {
  generateColorCurves
};

/* ---------------------------------------------------------------
 * Example usage (matches the values you gave: standard L*20 H, 50 S, 70 L%):
 *
 * const { generateColorCurves } = require('./colorCastEngine');
 *
 * const result = generateColorCurves(
 *   imageAnalysisData,                                   // { avg_r, avg_g, avg_b, faces: [...] }
 *   { hue: { min: 15, max: 35 },
 *     saturation: { min: 35, max: 55 },
 *     lightness: { min: 55, max: 75 } },                 // skinConfig, from UI sliders
 *   { h: 20, s: 50, l: 70 }                               // standardFace
 * );
 *
 * console.log(result.red, result.green, result.blue);
 * ------------------------------------------------------------- */