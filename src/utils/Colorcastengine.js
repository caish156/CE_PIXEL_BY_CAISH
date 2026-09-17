/**
 * colorCastEngine.js
 *
 * 5-point colour correction:
 *
 * 0   -> Shadow 0-10 Grey World, only if >=70% dominance
 * 64  -> midpoint(Gray World, Skin Reference)
 * 128 -> exact Skin Reference
 * 192 -> midpoint(Gray World, Skin Reference)
 * 255 -> Highlight 245-255 Grey World, only if >=70% dominance
 *
 * Skin Reference:
 * H/S/L slider midpoint -> RGB
 */

const INPUT_POINTS = [0, 64, 128, 192, 255];

const DEFAULT_CONFIG = {
  LUM_MIN: 90,
  LUM_MAX: 180,
  CONF_MIN: 75,

  COLOR_TOLERANCE: 0.02,

  SHADOW_MIN: 0,
  SHADOW_MAX: 10,

  HIGHLIGHT_MIN: 245,
  HIGHLIGHT_MAX: 255,

  DOMINANCE_THRESHOLD: 0.70,

  // Minimum ratio difference required
  // for a channel to be considered dominant.
  DOMINANCE_RATIO: 1.05
};


// -------------------------------------------------------------
// BASIC
// -------------------------------------------------------------

function clamp(value, min = 0, max = 255) {
  return Math.max(min, Math.min(max, value));
}


function identityCurve() {
  return INPUT_POINTS.map(input => ({
    input,
    output: input
  }));
}


// -------------------------------------------------------------
// HISTOGRAM
// -------------------------------------------------------------

function histogramTotal(hist) {
  if (!Array.isArray(hist)) return 0;

  let total = 0;

  for (let i = 0; i < hist.length; i++) {
    total += hist[i] || 0;
  }

  return total;
}


function histogramPercentile(hist, percentile) {
  if (!Array.isArray(hist) || hist.length === 0) {
    return 0;
  }

  const total = histogramTotal(hist);

  if (total <= 0) return 0;

  const target = total * percentile;

  let cumulative = 0;

  for (let i = 0; i < hist.length; i++) {
    cumulative += hist[i] || 0;

    if (cumulative >= target) {
      return i;
    }
  }

  return hist.length - 1;
}


function getHistogramRange(hist) {
  return {
    black: histogramPercentile(hist, 0.005),
    white: histogramPercentile(hist, 0.995)
  };
}


// -------------------------------------------------------------
// IMAGE AVERAGES
// -------------------------------------------------------------

function avgFromHistogram(hist) {
  if (!Array.isArray(hist)) return 0;

  let sum = 0;
  let count = 0;

  for (let i = 0; i < hist.length; i++) {
    const value = hist[i] || 0;

    sum += i * value;
    count += value;
  }

  return count > 0 ? sum / count : 0;
}


function getChannelAverages(data) {
  return {
    r:
      typeof data.avg_r === "number"
        ? data.avg_r
        : avgFromHistogram(data.histogram_r),

    g:
      typeof data.avg_g === "number"
        ? data.avg_g
        : avgFromHistogram(data.histogram_g),

    b:
      typeof data.avg_b === "number"
        ? data.avg_b
        : avgFromHistogram(data.histogram_b)
  };
}


// -------------------------------------------------------------
// FACE DATA
// -------------------------------------------------------------

function getValidFaces(faces, cfg) {
  return (faces || []).filter(face =>
    face &&
    face.rgb &&
    face.luminance >= cfg.LUM_MIN &&
    face.luminance <= cfg.LUM_MAX &&
    face.confidence >= cfg.CONF_MIN
  );
}


function getWeightedFaceRGB(faces) {
  let totalWeight = 0;

  let r = 0;
  let g = 0;
  let b = 0;

  for (const face of faces) {
    const weight = face.confidence;

    r += face.rgb.r * weight;
    g += face.rgb.g * weight;
    b += face.rgb.b * weight;

    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return null;
  }

  return {
    r: r / totalWeight,
    g: g / totalWeight,
    b: b / totalWeight
  };
}


// -------------------------------------------------------------
// HSL -> RGB
// -------------------------------------------------------------

function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360;

  s /= 100;
  l /= 100;

  if (s === 0) {
    const value = Math.round(l * 255);

    return {
      r: value,
      g: value,
      b: value
    };
  }

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;

    if (t < 1 / 6) {
      return p + (q - p) * 6 * t;
    }

    if (t < 1 / 2) {
      return q;
    }

    if (t < 2 / 3) {
      return p + (q - p) * (2 / 3 - t) * 6;
    }

    return p;
  };

  const q =
    l < 0.5
      ? l * (1 + s)
      : l + s - l * s;

  const p = 2 * l - q;
  const hk = h / 360;

  return {
    r: Math.round(hue2rgb(p, q, hk + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hk) * 255),
    b: Math.round(hue2rgb(p, q, hk - 1 / 3) * 255)
  };
}


// -------------------------------------------------------------
// SKIN REFERENCE
// -------------------------------------------------------------

function getSkinReferenceRGB(skinConfig) {
  const h =
    (skinConfig.hue.min + skinConfig.hue.max) / 2;

  const s =
    (skinConfig.saturation.min +
      skinConfig.saturation.max) / 2;

  const l =
    (skinConfig.lightness.min +
      skinConfig.lightness.max) / 2;

  return hslToRgb({
    h,
    s,
    l
  });
}


// -------------------------------------------------------------
// PURE GREY WORLD
// -------------------------------------------------------------

function getGreyWorldFactors(rgb) {
  const r = Math.max(rgb.r, 0.000001);
  const g = Math.max(rgb.g, 0.000001);
  const b = Math.max(rgb.b, 0.000001);

  return {
    r: g / r,
    g: 1,
    b: g / b
  };
}


// -------------------------------------------------------------
// SKIN REFERENCE FACTORS
// -------------------------------------------------------------

function getSkinReferenceFactors(faceRGB, targetRGB) {
  const faceG = Math.max(faceRGB.g, 0.000001);
  const targetG = Math.max(targetRGB.g, 0.000001);

  const currentRG = faceRGB.r / faceG;
  const currentBG = faceRGB.b / faceG;

  const targetRG = targetRGB.r / targetG;
  const targetBG = targetRGB.b / targetG;

  return {
    r: targetRG / currentRG,
    g: 1,
    b: targetBG / currentBG
  };
}


// -------------------------------------------------------------
// RGB SAMPLE ACCESS
//
// Expected:
//
// data.rgbSamples = [
//   { r: 12, g: 8, b: 7 },
//   { r: 10, g: 7, b: 6 },
//   ...
// ]
//
// Also accepts:
// data.samples
// data.pixels
// -------------------------------------------------------------

function getRGBSamples(data) {
  if (Array.isArray(data.rgbSamples)) {
    return data.rgbSamples;
  }

  if (Array.isArray(data.samples)) {
    return data.samples;
  }

  if (Array.isArray(data.pixels)) {
    return data.pixels;
  }

  return [];
}


// -------------------------------------------------------------
// TONAL SAMPLES
// -------------------------------------------------------------

function getTonalSamples(samples, min, max) {
  return samples.filter(pixel => {
    if (
      !pixel ||
      typeof pixel.r !== "number" ||
      typeof pixel.g !== "number" ||
      typeof pixel.b !== "number"
    ) {
      return false;
    }

    const luminance =
      0.299 * pixel.r +
      0.587 * pixel.g +
      0.114 * pixel.b;

    return luminance >= min && luminance <= max;
  });
}


// -------------------------------------------------------------
// DOMINANCE
//
// A pixel is considered:
//
// RED dominant:
//   R/G >= threshold
//   R/B >= threshold
//
// BLUE dominant:
//   B/R >= threshold
//   B/G >= threshold
//
// GREEN dominant:
//   G/R >= threshold
//   G/B >= threshold
//
// Then the same channel must dominate >=70%
// of all samples in that tonal range.
// -------------------------------------------------------------

function getDominanceStats(samples, cfg) {
  const total = samples.length;

  if (!total) {
    return {
      dominant: null,
      ratio: 0,
      r: 0,
      g: 0,
      b: 0
    };
  }

  let red = 0;
  let green = 0;
  let blue = 0;

  const threshold = cfg.DOMINANCE_RATIO;

  for (const pixel of samples) {
    const r = Math.max(pixel.r, 0.000001);
    const g = Math.max(pixel.g, 0.000001);
    const b = Math.max(pixel.b, 0.000001);

    const redDominant =
      r / g >= threshold &&
      r / b >= threshold;

    const greenDominant =
      g / r >= threshold &&
      g / b >= threshold;

    const blueDominant =
      b / r >= threshold &&
      b / g >= threshold;

    if (redDominant) {
      red++;
    } else if (greenDominant) {
      green++;
    } else if (blueDominant) {
      blue++;
    }
  }

  const redRatio = red / total;
  const greenRatio = green / total;
  const blueRatio = blue / total;

  let dominant = null;
  let ratio = 0;

  if (redRatio >= greenRatio && redRatio >= blueRatio) {
    dominant = "r";
    ratio = redRatio;
  } else if (
    greenRatio >= redRatio &&
    greenRatio >= blueRatio
  ) {
    dominant = "g";
    ratio = greenRatio;
  } else {
    dominant = "b";
    ratio = blueRatio;
  }

  if (ratio < cfg.DOMINANCE_THRESHOLD) {
    dominant = null;
  }

  return {
    dominant,
    ratio,
    r: redRatio,
    g: greenRatio,
    b: blueRatio
  };
}


// -------------------------------------------------------------
// TONAL GREY WORLD
//
// Only active when one colour dominates >=70%
// of the tonal samples.
// -------------------------------------------------------------

function getTonalGreyWorld(
  samples,
  min,
  max,
  cfg
) {
  const tonalSamples =
    getTonalSamples(samples, min, max);

  if (!tonalSamples.length) {
    return {
      active: false,
      factors: {
        r: 1,
        g: 1,
        b: 1
      }
    };
  }

  const dominance =
    getDominanceStats(
      tonalSamples,
      cfg
    );

  if (!dominance.dominant) {
    return {
      active: false,
      factors: {
        r: 1,
        g: 1,
        b: 1
      },
      dominance
    };
  }

  let r = 0;
  let g = 0;
  let b = 0;

  for (const pixel of tonalSamples) {
    r += pixel.r;
    g += pixel.g;
    b += pixel.b;
  }

  r /= tonalSamples.length;
  g /= tonalSamples.length;
  b /= tonalSamples.length;

  return {
    active: true,

    factors: getGreyWorldFactors({
      r,
      g,
      b
    }),

    dominance,

    sampleCount: tonalSamples.length
  };
}


// -------------------------------------------------------------
// FACTOR -> OUTPUT
// -------------------------------------------------------------

function applyFactor(value, factor) {
  return clamp(
    Math.round(value * factor)
  );
}


// -------------------------------------------------------------
// SHADOW / HIGHLIGHT ENDPOINT
// -------------------------------------------------------------

function getTonalEndpoint(
  samples,
  min,
  max,
  factor,
  fallback,
  cfg
) {
  const tonalSamples =
    getTonalSamples(
      samples,
      min,
      max
    );

  if (!tonalSamples.length) {
    return fallback;
  }

  const tonalGreyWorld =
    getTonalGreyWorld(
      samples,
      min,
      max,
      cfg
    );

  if (!tonalGreyWorld.active) {
    return fallback;
  }

  const values = tonalSamples.map(
    pixel =>
      0.299 * pixel.r +
      0.587 * pixel.g +
      0.114 * pixel.b
  );

  const averageLuminance =
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length;

  return applyFactor(
    averageLuminance,
    factor
  );
}


// -------------------------------------------------------------
// BUILD CHANNEL CURVE
// -------------------------------------------------------------

function buildChannelCurve({
  samples,
  histogram,
  greyWorldFactor,
  skinFactor,
  channel,
  cfg
}) {
  // -----------------------------------------------------------
  // SHADOW
  // -----------------------------------------------------------

  const histogramRange =
    getHistogramRange(histogram);

  const shadowEndpoint =
    getTonalEndpoint(
      samples,
      cfg.SHADOW_MIN,
      cfg.SHADOW_MAX,
      greyWorldFactor,
      histogramRange.black,
      cfg
    );


  // -----------------------------------------------------------
  // 64
  // -----------------------------------------------------------

  const grey64 =
    applyFactor(
      64,
      greyWorldFactor
    );

  const skin64 =
    applyFactor(
      64,
      skinFactor
    );

  const point64 =
    Math.round(
      (grey64 + skin64) / 2
    );


  // -----------------------------------------------------------
  // 128
  // EXACT SKIN REFERENCE
  // -----------------------------------------------------------

  const point128 =
    applyFactor(
      128,
      skinFactor
    );


  // -----------------------------------------------------------
  // 192
  // -----------------------------------------------------------

  const grey192 =
    applyFactor(
      192,
      greyWorldFactor
    );

  const skin192 =
    applyFactor(
      192,
      skinFactor
    );

  const point192 =
    Math.round(
      (grey192 + skin192) / 2
    );


  // -----------------------------------------------------------
  // HIGHLIGHT
  // -----------------------------------------------------------

  const highlightEndpoint =
    getTonalEndpoint(
      samples,
      cfg.HIGHLIGHT_MIN,
      cfg.HIGHLIGHT_MAX,
      greyWorldFactor,
      histogramRange.white,
      cfg
    );


  return [
    {
      input: 0,
      output: shadowEndpoint
    },
    {
      input: 64,
      output: clamp(point64)
    },
    {
      input: 128,
      output: clamp(point128)
    },
    {
      input: 192,
      output: clamp(point192)
    },
    {
      input: 255,
      output: highlightEndpoint
    }
  ];
}


// -------------------------------------------------------------
// MAIN
// -------------------------------------------------------------

function generateColorCurves(
  data,
  skinConfig,
  config = {}
) {
  const cfg = {
    ...DEFAULT_CONFIG,
    ...config
  };


  // -----------------------------------------------------------
  // VALID FACES
  // -----------------------------------------------------------

  const validFaces =
    getValidFaces(
      data.faces,
      cfg
    );

  if (!validFaces.length) {
    return {
      red: identityCurve(),
      green: identityCurve(),
      blue: identityCurve()
    };
  }


  const faceRGB =
    getWeightedFaceRGB(
      validFaces
    );

  if (!faceRGB) {
    return {
      red: identityCurve(),
      green: identityCurve(),
      blue: identityCurve()
    };
  }


  // -----------------------------------------------------------
  // GLOBAL GREY WORLD
  // -----------------------------------------------------------

  const avgRGB =
    getChannelAverages(data);

  const greyWorld =
    getGreyWorldFactors(
      avgRGB
    );


  // -----------------------------------------------------------
  // SKIN REFERENCE
  // -----------------------------------------------------------

  const skinReferenceRGB =
    getSkinReferenceRGB(
      skinConfig
    );

  const skinReference =
    getSkinReferenceFactors(
      faceRGB,
      skinReferenceRGB
    );


  // -----------------------------------------------------------
  // ACTUAL RGB SAMPLES
  // -----------------------------------------------------------

  const samples =
    getRGBSamples(data);


  // -----------------------------------------------------------
  // TONAL GREY WORLD
  // -----------------------------------------------------------

  const shadowGreyWorld =
    getTonalGreyWorld(
      samples,
      cfg.SHADOW_MIN,
      cfg.SHADOW_MAX,
      cfg
    );

  const highlightGreyWorld =
    getTonalGreyWorld(
      samples,
      cfg.HIGHLIGHT_MIN,
      cfg.HIGHLIGHT_MAX,
      cfg
    );


  // -----------------------------------------------------------
  // USE TONAL GREY WORLD ONLY IF 70% DOMINANCE PASSES
  // OTHERWISE FALL BACK TO GLOBAL GREY WORLD
  // -----------------------------------------------------------

  const shadowFactorR =
    shadowGreyWorld.active
      ? shadowGreyWorld.factors.r
      : greyWorld.r;

  const shadowFactorG =
    shadowGreyWorld.active
      ? shadowGreyWorld.factors.g
      : greyWorld.g;

  const shadowFactorB =
    shadowGreyWorld.active
      ? shadowGreyWorld.factors.b
      : greyWorld.b;


  const highlightFactorR =
    highlightGreyWorld.active
      ? highlightGreyWorld.factors.r
      : greyWorld.r;

  const highlightFactorG =
    highlightGreyWorld.active
      ? highlightGreyWorld.factors.g
      : greyWorld.g;

  const highlightFactorB =
    highlightGreyWorld.active
      ? highlightGreyWorld.factors.b
      : greyWorld.b;


  // -----------------------------------------------------------
  // CHANNEL CURVES
  // -----------------------------------------------------------

  const redCurve =
    buildChannelCurve({
      samples,
      histogram: data.histogram_r,
      greyWorldFactor: greyWorld.r,
      skinFactor: skinReference.r,
      channel: "r",
      cfg
    });


  const greenCurve =
    buildChannelCurve({
      samples,
      histogram: data.histogram_g,
      greyWorldFactor: greyWorld.g,
      skinFactor: skinReference.g,
      channel: "g",
      cfg
    });


  const blueCurve =
    buildChannelCurve({
      samples,
      histogram: data.histogram_b,
      greyWorldFactor: greyWorld.b,
      skinFactor: skinReference.b,
      channel: "b",
      cfg
    });


  // -----------------------------------------------------------
  // REPLACE ENDPOINTS WITH TONAL GREY WORLD
  // -----------------------------------------------------------

  if (shadowGreyWorld.active) {
    redCurve[0].output =
      applyFactor(
        redCurve[0].output,
        shadowFactorR / Math.max(greyWorld.r, 0.000001)
      );

    greenCurve[0].output =
      applyFactor(
        greenCurve[0].output,
        shadowFactorG / Math.max(greyWorld.g, 0.000001)
      );

    blueCurve[0].output =
      applyFactor(
        blueCurve[0].output,
        shadowFactorB / Math.max(greyWorld.b, 0.000001)
      );
  }


  if (highlightGreyWorld.active) {
    redCurve[4].output =
      applyFactor(
        redCurve[4].output,
        highlightFactorR / Math.max(greyWorld.r, 0.000001)
      );

    greenCurve[4].output =
      applyFactor(
        greenCurve[4].output,
        highlightFactorG / Math.max(greyWorld.g, 0.000001)
      );

    blueCurve[4].output =
      applyFactor(
        blueCurve[4].output,
        highlightFactorB / Math.max(greyWorld.b, 0.000001)
      );
  }


  return {
    red: redCurve,
    green: greenCurve,
    blue: blueCurve
  };
}


module.exports = {
  generateColorCurves
};