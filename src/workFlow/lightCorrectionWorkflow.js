// ============================================================
// workflow/lightCorrectionWorkflow.js
//
// LIGHT CORRECTION WORKFLOW
//
// OPEN IMAGE
//     ↓
// COLLECT RAW IMAGE DATA
//     ↓
// ACTION CALL
//     ↓
// USE FACE DATA
//     ↓
// ASSEMBLE DATA
//     ↓
// PREDICT LEVELS
//     ↓
// SAVE RAW DATA + PREDICTED LEVELS
//     ↓
// BLACK / GAMMA / WHITE
//     ↓
// APPLY LEVELS
//
// ONLY THIS WORKFLOW FUNCTION IS EXPORTED
// ============================================================


const { app } =
  window.require("photoshop");


const {
  readImageLightData
} = require("../utils/utilities");


const {
  predictLevels
} = require("../analytics/predictLevels");


const {
  applyLevelsAdjustment
} = require("../batchplays/levels");


const {
  saveJsonData
} = require("../utils/saveJsonData");


const {
  runAction
} = require("../batchplays/actionPlay");


// ============================================================
// MAIN WORKFLOW
// ============================================================

async function runLightCorrectionWorkflow(
  imageName = "",
  imageFolder = null,
  faceData = null
) {

  console.log("");

  console.log(
    "=========================================="
  );

  console.log(
    "💡 LIGHT CORRECTION WORKFLOW"
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
  // 2. COLLECT RAW IMAGE DATA
  // ==========================================================

  console.log(
    "📊 Collecting image data..."
  );


  const imageData =
    await readImageLightData();


  // ==========================================================
  // 3. ACTION CALL
  // ==========================================================

  console.log(
    "⚡ Running light correction action..."
  );


  await runAction(
    "CE_001",
    "CORRECTION ENGINE SET"
  );


  console.log(
    "✅ Action complete."
  );


  // ==========================================================
  // 4. FACE DATA
  // ==========================================================

  console.log(
    "🎯 Using existing face sampling data..."
  );


  if (!faceData) {

    throw new Error(
      "Face data not provided to Light Correction Workflow"
    );
  }


  // ==========================================================
  // 5. ASSEMBLE RAW DATA
  // ==========================================================

  const data = {

    image:
      imageName,

    total_pixels:
      imageData.total_pixels,

    avg_brightness:
      imageData.avg_brightness,

    histogram:
      imageData.histogram,

    histogram_zones:
      imageData.histogram_zones,

    has_face:
      faceData.has_face,

    face_count:
      faceData.face_count,

    faces:
      faceData.faces
  };


  console.log(
    "📦 RAW LIGHT DATA READY"
  );


  // ==========================================================
  // 6. PREDICT LEVELS
  // ==========================================================

  console.log(
    "🧠 Predicting Levels..."
  );


  const levels =
    predictLevels(data);


  // ==========================================================
  // 7. VALIDATE LEVEL OUTPUT
  // ==========================================================

  if (!levels) {

    throw new Error(
      "Levels prediction returned nothing"
    );
  }


  const shadow =
    levels.shadow ??
    levels.black;


  const midpoint =
    levels.midpoint ??
    levels.gamma;


  const highlight =
    levels.highlight ??
    levels.white;


  if (
    typeof shadow !== "number" ||
    typeof midpoint !== "number" ||
    typeof highlight !== "number"
  ) {

    throw new Error(
      "Invalid Levels prediction: " +
      JSON.stringify(levels)
    );
  }


  console.log(
    "🎚️ LEVELS PREDICTION:"
  );


  console.log(
    JSON.stringify({
      shadow,
      midpoint,
      highlight
    })
  );


  // ==========================================================
  // 8. SAVE LIGHT CORRECTION DATA
  // ==========================================================

  await saveJsonData(
    "lightCorrectionDataset.json",
    imageFolder,
    {

      timestamp:
        new Date().toISOString(),

      image:
        imageName,

      input:
        data,

      predictedLevels: {

        shadow,

        midpoint,

        highlight
      }
    }
  );


  // ==========================================================
  // 9. APPLY LEVELS
  // ==========================================================

  console.log(
    "🎨 Applying Levels..."
  );


  await applyLevelsAdjustment(
    shadow,
    midpoint,
    highlight
  );


  // ==========================================================
  // 10. RESULT
  // ==========================================================

  const result = {

    image:
      imageName,

    data,

    levels: {

      shadow,

      midpoint,

      highlight
    }
  };


  console.log(
    "✅ LIGHT CORRECTION COMPLETE"
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
  runLightCorrectionWorkflow
};