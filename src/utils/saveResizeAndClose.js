const { app, core } = window.require("photoshop");


// ============================================================
// SAVE → RESIZE → COMPRESS → CLOSE WITHOUT SAVING ORIGINAL
// ============================================================

async function saveResizeAndClose(
    originalFolder,
    outputFileName
) {
    const doc = app.activeDocument;

    if (!doc) {
        throw new Error("No active document");
    }

    if (!originalFolder) {
      
        throw new Error("Original folder not provided");
    }

    console.log("💾 Preparing corrected image...");


    // ========================================================
    // 1. CREATE / GET CORRECTION FOLDER
    // ========================================================

const folderName = String(originalFolder.name)
    .split("\\")
    .filter(Boolean)
    .pop();

const safeFolderName = folderName
    .replace(/[\\/:*?"<>|#]/g, "_")
    .trim();

    const correctionFolderName =
        `${safeFolderName}_correction`;

    console.log(
        `📁 Correction folder: ${correctionFolderName}`
    );

    let correctionFolder;

    try {

        correctionFolder =
            await originalFolder.getEntry(
                correctionFolderName
            );

        console.log(
            "📂 Correction folder already exists"
        );

    } catch (error) {

        console.log(
            "📂 Creating correction folder..."
        );

        correctionFolder =
            await originalFolder.createFolder(
                correctionFolderName
            );

        console.log(
            `✅ Correction folder created`
        );
    }


    // ========================================================
    // 2. CHECK IMAGE SIZE
    // ========================================================

    const width = doc.width;
    const height = doc.height;

    console.log(
        `📐 Original size: ${width} × ${height}`
    );


    // ========================================================
    // 3. RESIZE — MAXIMUM SIDE 3000PX
    // ========================================================

    const maxSide =
        Math.max(width, height);

    if (maxSide > 3000) {

        const ratio =
            3000 / maxSide;

        const newWidth =
            Math.round(width * ratio);

        const newHeight =
            Math.round(height * ratio);

        console.log(
            `📉 Resizing → ${newWidth} × ${newHeight}`
        );

        await core.executeAsModal(
            async () => {

                await doc.resizeImage(
                    newWidth,
                    newHeight
                );

            },
            {
                commandName: "Resize Corrected Image"
            }
        );

    } else {

        console.log(
            "✅ Resize not required"
        );
    }


    // ========================================================
    // 4. SANITIZE OUTPUT FILE NAME
    // ========================================================

    const safeFileName =
        outputFileName
            .replace(/[\\/:*?"<>|#]/g, "_")
            .trim();


    // ========================================================
    // 5. CREATE OUTPUT FILE
    // ========================================================

    const outputFile =
        await correctionFolder.createFile(
            safeFileName,
            {
                overwrite: true
            }
        );

    console.log(
        `📄 Output file created: ${safeFileName}`
    );


    // ========================================================
    // 6. SAVE JPEG
    // ========================================================

    await core.executeAsModal(
        async () => {

            await doc.saveAs.jpg(
                outputFile,
                {
                    quality: 92
                }
            );

        },
        {
            commandName: "Save Corrected Image"
        }
    );

    console.log(
        `✅ JPEG saved: ${safeFileName}`
    );


    // ========================================================
    // 7. CLOSE ORIGINAL WITHOUT SAVING
    // ========================================================

    await core.executeAsModal(
        async () => {

            await doc.closeWithoutSaving();

        },
        {
            commandName: "Close Original Without Saving"
        }
    );

    console.log(
        "✅ Original document closed WITHOUT saving"
    );

    console.log(
        "🎯 SAVE → RESIZE → COMPRESS → CLOSE COMPLETE"
    );
}


// ============================================================
// ONLY ONE FUNCTION EXPORT
// ============================================================

module.exports = {
    saveResizeAndClose
};