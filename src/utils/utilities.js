const {
  app,
} = window.require("photoshop");

const {
  readDocumentHistogram , readChannelHistogram,  readRedHistogram, readGreenHistogram, readBlueHistogram
} = require("../batchplays/histogramAnalysis");

const {requestSkinAnchor} = require("../modules/api");

const {getFaceLightBatchPlay} = require("../batchplays/faceAnalysis");


function calculateAverageBrightness(histogram) {

  const totalPixels =
    histogram.reduce((a, b) => a + b, 0);

  let sumBrightness = 0;

  for (let i = 0; i < 256; i++) {

    sumBrightness +=
      histogram[i] * i;
  }

  const avgBrightness =
    totalPixels > 0
      ? sumBrightness / totalPixels
      : 0;

  return {
    totalPixels,
    avgBrightness:
      Number(avgBrightness.toFixed(2))
  };
}


function calculateHistogramZones(histogram) {

  const zoneDark =
    histogram
      .slice(0, 50)
      .reduce((a, b) => a + b, 0);

  const zoneMid =
    histogram
      .slice(51, 150)
      .reduce((a, b) => a + b, 0);

  const zoneBright =
    histogram
      .slice(151, 200)
      .reduce((a, b) => a + b, 0);

  const zoneHighlight =
    histogram
      .slice(201, 255)
      .reduce((a, b) => a + b, 0);

  return {

    dark_0_50:
      zoneDark,

    mid_51_150:
      zoneMid,

    bright_151_200:
      zoneBright,

    highlight_201_255:
      zoneHighlight
  };
}


async function readImageLightData() {

  const doc = app.activeDocument;

  if (!doc) {
    throw new Error(
      "No active document"
    );
  }


  // ----------------------------------------------------------
  // Histogram
  // ----------------------------------------------------------

  const histogram =
    await readDocumentHistogram();


  if (
    !Array.isArray(histogram) ||
    histogram.length !== 256
  ) {

    throw new Error(
      "Invalid histogram data"
    );
  }


  // ----------------------------------------------------------
  // Average brightness + total pixels
  // ----------------------------------------------------------

  const brightness =
    calculateAverageBrightness(
      histogram
    );


  // ----------------------------------------------------------
  // Histogram zones
  // ----------------------------------------------------------

  const histogramZones =
    calculateHistogramZones(
      histogram
    );


  return {

    histogram,

    histogram_zones:
      histogramZones,

    avg_brightness:
      brightness.avgBrightness,

    total_pixels:
      brightness.totalPixels
  };
}
async function readFaceData() {

  let facesData = [];

  let hasFace = false;


  try {

    console.log(
      "🔄 requestSkinAnchor() calling..."
    );


    // --------------------------------------------------------
    // INSIGHTFACE
    // --------------------------------------------------------

    const aiResponse =
      await requestSkinAnchor();


    console.log(
      "✅ requestSkinAnchor response:",
      JSON.stringify(aiResponse)
    );


    if (
      aiResponse &&
      aiResponse.success &&
      Array.isArray(aiResponse.faces)
    ) {

      console.log(
        `📸 Got ${aiResponse.faces.length} faces from AI engine`
      );


      // ------------------------------------------------------
      // EVERY DETECTED FACE
      // ------------------------------------------------------

      for (
        let fi = 0;
        fi < aiResponse.faces.length;
        fi++
      ) {

        const faceInfo =
          aiResponse.faces[fi];


        const patch =
          faceInfo.skin_patch;


        // ----------------------------------------------------
        // Missing skin patch
        // ----------------------------------------------------

        if (!patch) {

          console.warn(
            `⚠️ Face[${fi}] has no skin_patch`
          );

          continue;
        }


        console.log(
          `   Face[${fi}]: patch=(${patch.x},${patch.y} ${patch.width}x${patch.height}) conf=${faceInfo.confidence}%`
        );


        try {

          // --------------------------------------------------
          // BATCHPLAY FACE LIGHT SAMPLE
          // --------------------------------------------------

          const faceSample =
            await getFaceLightBatchPlay(
              patch.x,
              patch.y,
              patch.width,
              patch.height
            );


          console.log(
            `   Face[${fi}] sample:`,
            JSON.stringify(faceSample)
          );


          // --------------------------------------------------
          // STORE FACE DATA
          // --------------------------------------------------

          facesData.push({

            luminance:
              typeof faceSample === "object"
                ? faceSample.light
                : faceSample,

            rgb:
              typeof faceSample === "object"
                ? faceSample.rgb
                : null,

            bbox:
              faceInfo.bbox,

            skin_patch:
              faceInfo.skin_patch,

            anchor:
              faceInfo.anchor,

            confidence:
              faceInfo.confidence
          });


        } catch (fiErr) {

          console.error(
            `   ❌ Face[${fi}] sample failed:`,
            fiErr.message
          );
        }
      }


      if (facesData.length > 0) {
        hasFace = true;
      }


      console.log(
        `📊 Final: hasFace=${hasFace} facesData.length=${facesData.length}`
      );


    } else {

      console.log(
        "⚠️ requestSkinAnchor returned no faces:",
        JSON.stringify(aiResponse)
      );
    }


  } catch (e) {

    console.error(
      "❌ requestSkinAnchor threw:",
      e.message
    );

    console.error(
      e.stack
    );
  }


  return {

    has_face:
      hasFace,

    face_count:
      facesData.length,

    faces:
      facesData
  };
}

// ============================================================
// utils/readImageColourData.js
//
// COLLECT COLOUR DATA FOR GRAY WORLD
//
// RETURNS:
// histogram_r → 256 values
// histogram_g → 256 values
// histogram_b → 256 values
// total_pixels
// avg_r
// avg_g
// avg_b
// ============================================================
// ============================================================
// MAIN
// ============================================================

async function readImageColourData() {

  // ==========================================================
  // RGB HISTOGRAMS
  // ==========================================================

  const histogram_r =
    await readRedHistogram();

  const histogram_g =
    await readGreenHistogram();

  const histogram_b =
    await readBlueHistogram();


  // ==========================================================
  // DEBUG
  // ==========================================================




  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (!Array.isArray(histogram_r)) {
    throw new Error(
      "Red histogram did not return an array"
    );
  }

  if (!Array.isArray(histogram_g)) {
    throw new Error(
      "Green histogram did not return an array"
    );
  }

  if (!Array.isArray(histogram_b)) {
    throw new Error(
      "Blue histogram did not return an array"
    );
  }


  // ==========================================================
  // TOTAL PIXELS
  // ==========================================================

  const total_pixels =
    histogram_r.reduce(
      (sum, value) => sum + value,
      0
    );


  // ==========================================================
  // CHANNEL AVERAGES
  // ==========================================================

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;


  for (let i = 0; i < 256; i++) {

    sumR += histogram_r[i] * i;
    sumG += histogram_g[i] * i;
    sumB += histogram_b[i] * i;
  }


  const avg_r =
    total_pixels > 0
      ? sumR / total_pixels
      : 0;

  const avg_g =
    total_pixels > 0
      ? sumG / total_pixels
      : 0;

  const avg_b =
    total_pixels > 0
      ? sumB / total_pixels
      : 0;


  // ==========================================================
  // RESULT
  // ==========================================================

  return {

    histogram_r,

    histogram_g,

    histogram_b,

    total_pixels,

    avg_r,

    avg_g,

    avg_b
  };
}


 
module.exports = {readImageLightData, calculateAverageBrightness, calculateHistogramZones, readFaceData, readImageColourData};