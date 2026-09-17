// ============================================================
// workflow/colourCorrectionWorkflow.js
//
// COLOUR CORRECTION WORKFLOW
//
// CURRENT IMAGE
//     ↓
// COLLECT COLOUR DATA
//     ↓
// USE EXISTING FACE DATA
//     ↓
// COLOUR CAST + CAST %             (face-anchored: theme colors pe 0%)
//     ↓
// GREY WORLD x CAST % BLEND
//     ↓
// WARM TONE FINISH (subtle warm signature)
//     ↓
// CONVERT FACTORS TO CURVE POINTS
//     ↓
// APPLY CHANNEL CURVES (RED / BLUE)
//     ↓
// RE-COLLECT COLOUR DATA (POST-CORRECTION)
//     ↓
// SAVE DATASET JSON (all images accumulate in 1 file)
//
// ONLY THIS WORKFLOW FUNCTION IS EXPORTED
// ============================================================


const {
   app,
  action,
  core
} = window.require("photoshop");

const {
  getColorCastPercent,
  getCorrectionFactors,
  getAppliedCastPercent,
  getGreyWorldCast,
  getChannelAverages,
  DEFAULT_CONFIG
} = require("../utils/Colorcastengine");


const {
  readImageColourData
} = require("../utils/utilities");


const {
  saveJsonData
} = require("../utils/saveJsonData");


const {
  applyRedCurves,
  applyBlueCurves,
  factorToCurvePoints
} = require("../batchplays/curves");


// ============================================================
// WARM TONE FINISH (taste setting)
// ============================================================
// Grey-world correction image ko neutral/white bana deta hai.
// Ye subtle warm signature correction ke UPAR add hota hai:
//   Red thoda up (+S), Blue thoda down (-S)
// 0 = off | 0.04 = subtle (default) | 0.08 = strong
// ============================================================

const WARM_TONE_STRENGTH = 0.04;


// ============================================================
// MAIN WORKFLOW
// ============================================================

async function runColourCorrectionWorkflow(
  imageName = "",
  imageFolder = null,
  faceData = null
) {

  console.log("");

  console.log(
    "=========================================="
  );

  console.log(
    "🎨 COLOUR CORRECTION WORKFLOW"
  );

  console.log(
    "=========================================="
  );


  // ==========================================================
  // 1. ACTIVE DOCUMENT
  // ==========================================================

  const doc =
    app.activeDocument;


  if (!doc) {

    throw new Error(
      "No active document"
    );
  }


  // ==========================================================
  // 2. FACE DATA
  // ==========================================================

  if (!faceData) {

    throw new Error(
      "Face data not provided to Colour Correction Workflow"
    );
  }


  console.log(
    "🎯 Using existing face sampling data..."
  );


  // ==========================================================
  // 3. COLLECT FRESH COLOUR DATA
  // ==========================================================
  //
  // IMPORTANT:
  // Image has already gone through Light Correction.
  // Therefore colour data MUST be collected again
  // from the current document.
  //
  // ==========================================================

  console.log(
    "📊 Collecting fresh colour data..."
  );


  const colourData =
    await readImageColourData();


  // ==========================================================
  // 4. COMBINE COLOUR DATA + FACE DATA
  // ==========================================================

  const data = {

    image:
      imageName,

    // --------------------------------------------------------
    // GLOBAL COLOUR DATA
    // --------------------------------------------------------

    histogram_r:
      colourData.histogram_r,

    histogram_g:
      colourData.histogram_g,

    histogram_b:
      colourData.histogram_b,

    total_pixels:
      colourData.total_pixels,

    avg_r:
      colourData.avg_r,

    avg_g:
      colourData.avg_g,

    avg_b:
      colourData.avg_b,


    // --------------------------------------------------------
    // FACE / SKIN DATA
    // --------------------------------------------------------

    has_face:
      faceData.has_face,

    face_count:
      faceData.face_count,

    faces:
      faceData.faces
  };

  // ==========================================================
  // 5. COLOUR CAST — FACE-ANCHORED (UNLOCKED)
  // ==========================================================
  //
  // Colorcastengine.js ka role:
  //
  //   Haldi / sangeet jaise events me yellow scene THEME hota hai,
  //   cast nahi. Engine face ke skin tone ko natural locus se check
  //   karta hai:
  //
  //     - Face colour already natural   -> colorCastPercent = 0
  //       (theme color — correction bilkul NAHI, yellow preserve)
  //
  //     - Real cast + grey-world skin ko natural zone me le aata hai
  //       -> colorCastPercent 0-100 (kitna % improvement mila)
  //
  //     - Koi valid face nahi -> NO_FACE_FALLBACK_PERCENT (100)
  //
  // getCorrectionFactors() us % ko grey-world factors me blend karta hai:
  //
  //   t       = colorCastPercent / 100
  //   factorR = 1 + (1/castR - 1) * t
  //   factorB = 1 + (1/castB - 1) * t
  //

  console.log(
    "🌈 Calculating face-anchored colour cast..."
  );

  const colourCast =
    getColorCastPercent(data);

  console.log(
    "🌈 COLOUR CAST RESULT:",
    JSON.stringify(colourCast)
  );

  // ==========================================================
  // 5b. CAST % WINDOW — CLAMP to 15-85
  // ==========================================================
  //
  // Policy (Colorcastengine config: CAST_PERCENT_MIN / MAX):
  //
  //   raw 0%   -> 15%  (minimum correction hamesha lagti hai)
  //   raw 50%  -> 50%  (as-is)
  //   raw 100% -> 85%  (full raw grey-world kabhi nahi lagti)
  //

  const castPercentRaw =
    colourCast.colorCastPercent;

  const castPercentApplied =
    getAppliedCastPercent(castPercentRaw);

  if (castPercentApplied !== castPercentRaw) {

    console.log(
      `🎚️ Cast % clamped: ${castPercentRaw}% -> ${castPercentApplied}% (range ${DEFAULT_CONFIG.CAST_PERCENT_MIN}-${DEFAULT_CONFIG.CAST_PERCENT_MAX})`
    );
  }

  const correctionFactors =
    getCorrectionFactors({
      ...colourCast,
      colorCastPercent: castPercentApplied
    });

  console.log(
    "🎨 CORRECTION FACTORS (grey world x cast %):",
    JSON.stringify(correctionFactors)
  );


  // ==========================================================
  // 6. PREDICT COLOUR CORRECTION (GREY WORLD x CAST %)
  // ==========================================================
  //
  // GREY WORLD FULL CORRECTION (green = neutral reference):
  //
  //   castR = avg_r / avg_g
  //   castB = avg_b / avg_g
  //   factorR_full = 1 / castR
  //   factorB_full = 1 / castB
  //
  // FINAL factors step 5 (correctionFactors) se aate hain —
  // grey-world ko colorCastPercent ke hisaab se blend karke:
  //
  //   factorR = 1 + (factorR_full - 1) * (colorCastPercent / 100)
  //   factorB = 1 + (factorB_full - 1) * (colorCastPercent / 100)
  //
  //   castPercentApplied = 15 -> halka touch-up (minimum)
  //   castPercentApplied = 85 -> near-full grey-world (maximum)
  //

  console.log(
    "🧠 Predicting colour correction (grey world x cast %)..."
  );


  const { avg_r, avg_g, avg_b } =
    getChannelAverages(data);


  if (!(avg_g > 0)) {

    throw new Error(
      "Grey world cast needs avg_g > 0 (green histogram empty)"
    );
  }


  const { castR, castB } =
    getGreyWorldCast(avg_r, avg_g, avg_b);


  const factorR_full = 1 / castR;

  const factorB_full = 1 / castB;


  // Step 5 ka blended output hi FINAL hai
  let factorR = correctionFactors.factorR;

  let factorB = correctionFactors.factorB;


  // SAFETY CLAMP — testing ke liye sane range (50% .. 200%)
  const MIN_FACTOR = 0.5;
  const MAX_FACTOR = 2.0;


  if (
    factorR < MIN_FACTOR ||
    factorR > MAX_FACTOR ||
    factorB < MIN_FACTOR ||
    factorB > MAX_FACTOR
  ) {

    console.warn(
      "⚠️ Extreme correction factor clamped to [0.5, 2.0]",
      { factorR, factorB }
    );
  }


  factorR =
    Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, factorR));

  factorB =
    Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, factorB));


  // ==========================================================
  // WARM TONE FINISH — subtle warm signature
  // ==========================================================
  //
  // Grey-world neutral banata hai; ye finish warm look wapas deti hai:
  //   finalFactorR = correctionFactorR x (1 + WARM_TONE_STRENGTH)
  //   finalFactorB = correctionFactorB x (1 - WARM_TONE_STRENGTH)
  //

  const warmFactorR = 1 + WARM_TONE_STRENGTH;

  const warmFactorB = 1 - WARM_TONE_STRENGTH;

  const finalFactorR = factorR * warmFactorR;

  const finalFactorB = factorB * warmFactorB;

  console.log(
    `🔥 WARM TONE FINISH: R x${warmFactorR}, B x${warmFactorB} (strength ${WARM_TONE_STRENGTH})`
  );


  // CONVERT FACTORS -> CURVE POINTS
  const redCurve =
    factorToCurvePoints(finalFactorR);

  const blueCurve =
    factorToCurvePoints(finalFactorB);


  // APPLY DECISION — final factor exactly 1 ho to channel untouched
  const EPSILON = 0.001;

  const applyRed =
    Math.abs(finalFactorR - 1) > EPSILON;

  const applyBlue =
    Math.abs(finalFactorB - 1) > EPSILON;


  console.log(
    "🧮 GREY WORLD x CAST% PLAN:",
    JSON.stringify({
      status: colourCast.status,
      castPercentRaw: colourCast.colorCastPercent,
      castPercentApplied,
      avg_r,
      avg_g,
      avg_b,
      castR,
      castB,
      factorR_full,
      factorB_full,
      correctionFactorR: factorR,
      correctionFactorB: factorB,
      warmFactorR,
      warmFactorB,
      factorR: finalFactorR,
      factorB: finalFactorB,
      applyRed,
      applyBlue,
      redCurve,
      blueCurve
    })
  );


  // ==========================================================
  // 7. APPLY COLOUR CORRECTION (CHANNEL CURVES)
  // ==========================================================

  console.log(
    "🎨 Applying colour correction via channel curves..."
  );

  if (applyRed) {

    await applyRedCurves(redCurve);

    console.log(
      "🔴 Red channel curve applied"
    );

  } else {

    console.log(
      "🔴 Red channel untouched (cast% = 0)"
    );
  }


  if (applyBlue) {

    await applyBlueCurves(blueCurve);

    console.log(
      "🔵 Blue channel curve applied"
    );

  } else {

    console.log(
      "🔵 Blue channel untouched (cast% = 0)"
    );
  }


  console.log(
    "✅ Channel curves applied."
  );


  // ==========================================================
  // 8. RE-COLLECT POST-CORRECTION COLOUR DATA
  // ==========================================================
  //
  // Grey-world + warm tone apply hone ke BAAD document se
  // FRESH colour data padhte hain (histograms + averages).
  //

  console.log(
    "📊 Re-collecting post-correction colour data..."
  );

  const postColourData =
    await readImageColourData();


  // ==========================================================
  // 9. SAVE DATASET JSON (single file, all images accumulate)
  // ==========================================================
  //
  // Light correction jaisa hi — colourCorrectionDataset.json
  // me har image ka ek record append hota hai.
  // 500 images correct hui -> file me 500 records.
  //
  //   input          -> pre-correction colour data + face data
  //                     (same data jo colourCast ko diya gaya tha)
  //   correction     -> cast %, factors, curves jo apply hue
  //   postCorrection -> correction ke BAAD ka fresh colour data
  //

  const datasetRecord = {

    timestamp:
      new Date().toISOString(),

    image:
      imageName,

    // --------------------------------------------------------
    // INPUT (pre-correction colour data + face data)
    // --------------------------------------------------------

    input: {
      image: data.image,
      histogram_r: data.histogram_r,
      histogram_g: data.histogram_g,
      histogram_b: data.histogram_b,
      total_pixels: data.total_pixels,
      avg_r: data.avg_r,
      avg_g: data.avg_g,
      avg_b: data.avg_b,
      has_face: data.has_face,
      face_count: data.face_count,
      faces: data.faces
    },
  };

  const datasetSave =
    await saveJsonData(
      "colourCorrectionDataset.json",
      imageFolder,
      datasetRecord
    );

  console.log(
    "💾 Colour correction dataset:",
    JSON.stringify(datasetSave)
  );


  // ==========================================================
  // 10. RESULT
  // ==========================================================

  const result = {

    image:
      imageName,

    histogram_r:
      colourData.histogram_r,

    histogram_g:
      colourData.histogram_g,

    histogram_b:
      colourData.histogram_b,

    total_pixels:
      colourData.total_pixels,

    avg_r:
      colourData.avg_r,

    avg_g:
      colourData.avg_g,

    avg_b:
      colourData.avg_b,

    has_face:
      faceData.has_face,

    face_count:
      faceData.face_count,

    faces:
      faceData.faces,

    // --------------------------------------------------------
    // STEP 5 — FACE-ANCHORED COLOUR CAST
    // --------------------------------------------------------

    colourCast: {
      status: colourCast.status,
      colorCastPercent: colourCast.colorCastPercent,
      castPercentApplied,
      validFaceCount: colourCast.validFaceCount ?? null,
      note: colourCast.note ?? null
    },

    // --------------------------------------------------------
    // STEP 6 — GREY WORLD x CAST % (final correction)
    // --------------------------------------------------------

    greyWorld: {
      castR,
      castB,
      factorR_full,
      factorB_full,
      factorR: finalFactorR,
      factorB: finalFactorB,
      warmToneStrength: WARM_TONE_STRENGTH,
      appliedR: applyRed,
      appliedB: applyBlue,
      redCurve,
      blueCurve
    },

    // --------------------------------------------------------
    // DATASET JSON SAVE INFO
    // --------------------------------------------------------

    datasetSaved: datasetSave
  };


  console.log(
    result
  );


  console.log(
    "✅ COLOUR CORRECTION COMPLETE"
  );

  console.log(
    "=========================================="
  );


  return result;
}


// ============================================================
// ONLY ONE EXPORT
// ============================================================

module.exports = {
  runColourCorrectionWorkflow
};