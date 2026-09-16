// ============================================================
// utils/saveJsonData.js
//
// GENERIC JSON DATA STORAGE HELPER
//
// INPUT:
//     fileName → JSON file name
//     folder   → UXP folder entry
//     data     → data to store
//
// BEHAVIOUR:
//     1. Find JSON file
//     2. Create if it does not exist
//     3. Read existing data
//     4. Append new entry
//     5. Write JSON back
//
// EXAMPLE:
//
// await saveJsonData(
//   "lightCorrectionDataset.json",
//   folder,
//   data
// );
//
// ============================================================


const { localFileSystem } =
  require("uxp").storage;


// ============================================================
// MAIN FUNCTION
// ============================================================

async function saveJsonData(
  fileName,
  folder,
  data
) {

  try {

    // ----------------------------------------------------------
    // VALIDATE INPUT
    // ----------------------------------------------------------

    if (!fileName) {

      throw new Error(
        "JSON file name is required"
      );
    }


    if (!folder) {

      throw new Error(
        "Folder is required"
      );
    }


    // ----------------------------------------------------------
    // GET / CREATE JSON FILE
    // ----------------------------------------------------------

    let file = null;


    try {

      file =
        await folder.getEntry(
          fileName
        );

    } catch (error) {

      console.log(
        "📄 JSON file not found. Creating:",
        fileName
      );


      file =
        await folder.createFile(
          fileName,
          {
            overwrite: false
          }
        );
    }


    // ----------------------------------------------------------
    // READ EXISTING DATA
    // ----------------------------------------------------------

    let existingData = [];


    try {

      const content =
        await file.read();


      if (
        content &&
        content.trim()
      ) {

        const parsed =
          JSON.parse(content);


        // ----------------------------------------------------
        // Existing file must contain an array
        // ----------------------------------------------------

        if (Array.isArray(parsed)) {

          existingData =
            parsed;

        } else {

          console.warn(
            "⚠️ Existing JSON is not an array."
          );

          existingData = [];
        }
      }

    } catch (error) {

      console.warn(
        "⚠️ Could not read existing JSON. Starting fresh.",
        error
      );

      existingData = [];
    }


    // ----------------------------------------------------------
    // APPEND DATA
    // ----------------------------------------------------------

    existingData.push(data);


    // ----------------------------------------------------------
    // WRITE JSON
    // ----------------------------------------------------------

    await file.write(
      JSON.stringify(
        existingData,
        null,
        2
      )
    );


    // ----------------------------------------------------------
    // SUCCESS
    // ----------------------------------------------------------

    console.log(
      "💾 JSON DATA SAVED:",
      fileName
    );

    console.log(
      "📊 Total entries:",
      existingData.length
    );


    return {

      success: true,

      fileName,

      entries:
        existingData.length
    };


  } catch (error) {

    // ----------------------------------------------------------
    // ERROR
    // ----------------------------------------------------------

    console.error(
      "❌ JSON DATA SAVE FAILED:",
      fileName,
      error
    );


    return {

      success: false,

      fileName,

      error:
        error.message
    };
  }
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  saveJsonData
};