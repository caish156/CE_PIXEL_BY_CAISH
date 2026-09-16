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
// GREY WORLD CALCULATION            (step 5 - colour cast SKIPPED for now)
//     ↓
// CONVERT FACTORS TO CURVE POINTS
//     ↓
// APPLY CHANNEL CURVES (RED / BLUE)
//
// ONLY THIS WORKFLOW FUNCTION IS EXPORTED
// ============================================================


const {
   app,
  action,
  core
} = window.require("photoshop");

const {
  getGreyWorldCast,
  getChannelAverages
} = require("../utils/Colorcastengine");


// STEP 5 IMPORTS (commented out together with step 5)
// const {
//   getColorCastPercent,
//   getCorrectionFactors
// } = require("../utils/colorCastEngine");


const {
  readImageColourData
} = require("../utils/utilities");


const {
  applyRedCurves,
  applyBlueCurves,
  factorToCurvePoints
} = require("../batchplays/curves");


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
  // 5. COLOUR CAST  (SKIPPED FOR NOW)
  // ==========================================================
  //
  // Commented out for testing — correctionFactors nahi use ho rahe.
  // Correction ab directly grey-world formula se calculate hoti hai.
  //

  // console.log(
  //   "🌈 Calculating colour cast..."
  // );
  //
  // const colourCast =
  //   getColorCastPercent(data);
  //
  // console.log(
  //   "🌈 Colour Cast Result:",
  //   colourCast
  // );
  //
  // const correctionFactors =
  //   getCorrectionFactors(colourCast);
  //
  // console.log(
  //   "🎨 Correction Factors:",
  //   correctionFactors
  // );


  // ==========================================================
  // 6. PREDICT COLOUR CORRECTION (GREY WORLD)
  // ==========================================================
  //
  // GREY WORLD FORMULA (from Colorcastengine.js):
  //
  //   castR = avg_r / avg_g
  //   castB = avg_b / avg_g        (green = neutral reference)
  //
  // Full correction multipliers (channel ko cast ke inverse se scale karo):
  //
  //   factorR = 1 / castR          (corrected avg_r == avg_g)
  //   factorB = 1 / castB          (corrected avg_b == avg_g)
  //
  // Green channel untouched (reference).
  //

  console.log(
    "🧠 Predicting colour correction (grey world)..."
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


  let factorR = 1 / castR;

  let factorB = 1 / castB;


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
      "⚠️ Extreme grey-world factor clamped to [0.5, 2.0]",
      { castR, castB, factorR, factorB }
    );
  }


  factorR =
    Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, factorR));

  factorB =
    Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, factorB));


  // CONVERT FACTORS -> CURVE POINTS
  const redCurve =
    factorToCurvePoints(factorR);

  const blueCurve =
    factorToCurvePoints(factorB);


  console.log(
    "🧮 GREY WORLD CALCULATION:",
    JSON.stringify({
      avg_r,
      avg_g,
      avg_b,
      castR,
      castB,
      factorR,
      factorB,
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


  await applyRedCurves(redCurve);

  await applyBlueCurves(blueCurve);


  console.log(
    "✅ Channel curves applied."
  );


  // ==========================================================
  // 8. RESULT
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
    // GREY WORLD CORRECTION (step 6 output)
    // --------------------------------------------------------

    greyWorld: {
      castR,
      castB,
      factorR,
      factorB,
      redCurve,
      blueCurve
    }

    // --------------------------------------------------------
    // STEP 5 FIELDS (commented together with step 5)
    // --------------------------------------------------------
    // colorCastPercent:
    //   colourCast.colorCastPercent,
    //
    // colorCastStatus:
    //   colourCast.status,
    //
    // correctionFactors:
    //   correctionFactors
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