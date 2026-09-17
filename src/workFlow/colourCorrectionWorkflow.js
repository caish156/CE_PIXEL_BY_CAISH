// ============================================================
// workflow/colourCorrectionWorkflow.js
//
// COLOUR CORRECTION WORKFLOW
//
// RUNS AFTER THE LIGHT CORRECTION WORKFLOW
//
// VALIDATE ALL INPUTS         (imageName, imageFolder, faceData,
//     ↓                        skinConfig, standardFace)
// ACTIVE DOCUMENT             (Photoshop)
//     ↓
// COLLECT CURRENT COLOUR DATA (readImageColourData — AFTER light correction)
//     ↓
// GENERATE COLOUR CURVES      (generateColorCurves, engine = single source)
//     ↓
// APPLY CHANNEL CURVES        (RED / GREEN / BLUE)
//     ↓
// RE-COLLECT COLOUR DATA      (POST-CORRECTION)
//     ↓
// SAVE DATASET JSON (all images accumulate in 1 file)
//
// ONLY THIS WORKFLOW FUNCTION IS EXPORTED
// ============================================================


const { app } = window.require("photoshop");
const { generateColorCurves } = require("../utils/Colorcastengine.example");

const {
  readImageColourData
} = require("../utils/utilities");


const {
  saveJsonData
} = require("../utils/saveJsonData");


const {
  applyRedCurves,
  applyGreenCurves,
  applyBlueCurves,
  convertCurveObjectsToPoints
} = require("../batchplays/curves");

/**
 * INPUT CONTRACT (order matters — matches App.jsx call site):
 *
 *   imageName      : non-empty string — dataset record ki identity
 *   imageFolder    : UXP folder entry — dataset JSON yahin save hota hai
 *   faceData       : existing face sampling { has_face, face_count, faces }
 *   skinConfig     : HSL target ranges { hue, saturation, lightness } each { min, max }
 *   standardFace   : reference HSL { h, s, l }; no default is inferred here
 *
 * All five are validated up-front, BEFORE any Photoshop / image operation.
 */

function validateColourCorrectionInputs({
  imageName,
  imageFolder,
  faceData,
  skinConfig,
  standardFace
}) {

  if (typeof imageName !== "string" || imageName.trim() === "") {

    throw new Error(
      "imageName is required (non-empty string) for Colour Correction Workflow"
    );
  }


  if (!imageFolder) {

    throw new Error(
      "imageFolder is required for Colour Correction Workflow (dataset JSON is saved there)"
    );
  }


  if (!faceData || typeof faceData !== "object") {

    throw new Error(
      "Face data not provided to Colour Correction Workflow"
    );
  }


  // faces optional hai (no-face case), par agar diya hai to array hona chahiye
  if (faceData.faces !== undefined && !Array.isArray(faceData.faces)) {

    throw new Error(
      "faceData.faces must be an array when provided to Colour Correction Workflow"
    );
  }


  if (!standardFace || !["h", "s", "l"].every(key => Number.isFinite(standardFace[key]))) {

    throw new Error(
      "standardFace must be a caller-provided HSL reference { h, s, l }"
    );
  }


  if (!skinConfig || !["hue", "saturation", "lightness"].every(key => {

    const range = skinConfig[key];

    return range &&
      Number.isFinite(range.min) &&
      Number.isFinite(range.max) &&
      range.min <= range.max;
  })) {

    throw new Error(
      "skinConfig must contain HSL ranges { hue, saturation, lightness }, each { min, max }"
    );
  }
}


// ============================================================
// MAIN WORKFLOW
// ============================================================

async function runColourCorrectionWorkflow(
  imageName = "",
  imageFolder = null,
  faceData = null,
  skinConfig = null,
  standardFace = null
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
  // 1. INPUT VALIDATION  (Photoshop / image operations se PEHLE)
  // ==========================================================
  //
  // Saare required inputs yahin validate hote hain. Iske baad hi
  // Photoshop document ya image colour data touch kiya jaata hai.
  //
  //   imageName      -> dataset record ki identity (non-empty string)
  //   imageFolder    -> dataset JSON isi folder me save hota hai
  //   faceData       -> existing face sampling (has_face / face_count / faces)
  //   skinConfig     -> HSL target ranges (UI sliders se)
  //   standardFace   -> reference HSL { h, s, l }
  //

  validateColourCorrectionInputs({
    imageName,
    imageFolder,
    faceData,
    skinConfig,
    standardFace
  });

  console.log(
    "✅ Inputs validated:",
    JSON.stringify({
      imageName,
      face_count: faceData.face_count,
      skinConfig,
      standardFace
    })
  );


  // ==========================================================
  // 2. ACTIVE DOCUMENT
  // ==========================================================

  const doc =
    app.activeDocument;


  if (!doc) {

    throw new Error(
      "No active document"
    );
  }


  console.log(
    "🎯 Using existing face sampling data..."
  );


  // ==========================================================
  // 3. COLLECT CURRENT IMAGE COLOUR DATA (POST LIGHT CORRECTION)
  // ==========================================================
  //
  // IMPORTANT:
  // Image has already gone through the LIGHT CORRECTION workflow.
  // Isliye colour data CURRENT document se FRESH padhna hai —
  // light correction se pehle ka (stale) colour data use nahi karna.
  //
  // readImageColourData() koi argument nahi leta, koi cache nahi —
  // ye active document ke RGB histograms live read karta hai.
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
 console.log(data);
  // ==========================================================
  // 5. GENERATE COLOUR CURVES — ENGINE IS THE SINGLE SOURCE
  // ==========================================================

  // All correction decisions belong to the engine. Keep its object points unchanged.
  const engineResult = generateColorCurves(data, skinConfig, standardFace);
  console.log("COLOUR CURVES FROM ENGINE:", JSON.stringify(engineResult));


  // ==========================================================
  // 6. APPLY CHANNEL CURVES (RED / GREEN / BLUE)
  // ==========================================================

  // Only skip exact identity curves; no thresholds or additional correction.
  const appliedChannels = {};
  const channelAppliers = {
    red: applyRedCurves,
    green: applyGreenCurves,
    blue: applyBlueCurves
  };

  for (const channel of Object.keys(channelAppliers)) {
    const curve = engineResult[channel];
    appliedChannels[channel] = curve.some(point => point.input !== point.output);
    if (appliedChannels[channel]) {
      await channelAppliers[channel](convertCurveObjectsToPoints(curve));
    }
  }

  // ==========================================================
  // 7. RE-COLLECT POST-CORRECTION COLOUR DATA
  // ==========================================================
  //
  // Engine curves apply hone ke BAAD document se
  // FRESH colour data padhte hain (histograms + averages).
  //

  console.log(
    "📊 Re-collecting post-correction colour data..."
  );



  // ==========================================================
  // 8. SAVE DATASET JSON (single file, all images accumulate)
  // ==========================================================
  //
  // Light correction jaisa hi — colourCorrectionDataset.json
  // me har image ka ek record append hota hai.
  // 500 images correct hui -> file me 500 records.
  //
  //   input          -> pre-correction colour data + face data
  //                     (same data passed to generateColorCurves)
  //   correction     -> engine curves and applied channels
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
    skinConfig,
    standardFace,
    correction: { curves: engineResult, appliedChannels },

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
  // 9. RESULT
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

    correction: { curves: engineResult, appliedChannels },
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