const { app, core } =
    window.require("photoshop");

const { localFileSystem } =
    window.require("uxp").storage;


// ============================================================
// SANITIZE
// ============================================================

function sanitizeName(name) {

    return String(name)
        .replace(/[\\/:*?"<>|#]/g, "_")
        .trim();

}


// ============================================================
// GET / CREATE FOLDER
// ============================================================

async function getOrCreateFolder(
    parentFolder,
    folderName
) {

    const safeName =
        sanitizeName(folderName);


    try {

        return await parentFolder.getEntry(
            safeName
        );

    } catch (error) {

        return await parentFolder.createFolder(
            safeName
        );

    }

}


// ============================================================
// CREATE NESTED OUTPUT FOLDER
// ============================================================

async function createNestedFolder(
    rootFolder,
    folderParts
) {

    let currentFolder =
        rootFolder;


    for (const part of folderParts) {

        if (!part) {
            continue;
        }


        currentFolder =
            await getOrCreateFolder(
                currentFolder,
                part
            );

    }


    return currentFolder;

}


// ============================================================
// GET SOURCE CORRECTION ROOT
// ============================================================

async function getCorrectionRoot(
    originalFolder
) {

    const sourceName =
        sanitizeName(
            originalFolder.name
        );


    const correctionFolderName =
        `${sourceName}_correction`;


    console.log(
        `📁 Correction root: ${correctionFolderName}`
    );


    return await getOrCreateFolder(

        originalFolder,

        correctionFolderName

    );

}


// ============================================================
// SAVE → RESIZE → CLOSE
// ============================================================

async function saveResizeAndClose(

    originalFolder,

    destinationFolder,

    imageData

) {

    const doc =
        app.activeDocument;


    if (!doc) {

        throw new Error(
            "No active document"
        );

    }


    if (!originalFolder) {

        throw new Error(
            "Original folder not provided"
        );

    }


    if (!imageData) {

        throw new Error(
            "Image data not provided"
        );

    }


    console.log(
        "💾 Preparing corrected image..."
    );


    // ========================================================
    // IMAGE INFO
    // ========================================================

    const outputFileName =
        imageData.name;


    const relativePath =
        imageData.relativePath;


    console.log(
        `📄 Relative path: ${relativePath}`
    );


    // ========================================================
    // 1. DETERMINE OUTPUT ROOT
    // ========================================================

    let outputRoot;


    if (destinationFolder) {

        // ----------------------------------------------------
        // DESTINATION SELECTED
        // ----------------------------------------------------

        outputRoot =
            destinationFolder;


        console.log(
            "📁 Using selected destination folder"
        );


    } else {

        // ----------------------------------------------------
        // NO DESTINATION
        //
        // SOURCE/
        // └── SOURCE_correction/
        // ----------------------------------------------------

        outputRoot =
            await getCorrectionRoot(
                originalFolder
            );


        console.log(
            "📁 Using source correction folder"
        );

    }


    // ========================================================
    // 2. GET RELATIVE DIRECTORY
    // ========================================================

    const pathParts =
        relativePath
            .split("/")
            .filter(Boolean);


    // Remove filename.
    pathParts.pop();


    // ========================================================
    // 3. CREATE SAME FOLDER STRUCTURE
    // ========================================================

    const outputFolder =
        await createNestedFolder(
            outputRoot,
            pathParts
        );


    console.log(
        "📁 Output folder:",
        outputFolder.name
    );


    // ========================================================
    // 4. IMAGE SIZE
    // ========================================================

    let width =
        doc.width;


    let height =
        doc.height;


    console.log(
        `📐 Original size: ${width} × ${height}`
    );


    // ========================================================
    // 5. RESIZE MAX SIDE 3000
    // ========================================================

    const maxSide =
        Math.max(
            width,
            height
        );


    if (maxSide > 3000) {

        const ratio =
            3000 / maxSide;


        const newWidth =
            Math.round(
                width * ratio
            );


        const newHeight =
            Math.round(
                height * ratio
            );


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
                commandName:
                    "Resize Corrected Image"
            }

        );

    } else {

        console.log(
            "✅ Resize not required"
        );

    }


    // ========================================================
    // 6. SAFE FILE NAME
    // ========================================================

    const safeFileName =
        sanitizeName(
            outputFileName
        );


    // ========================================================
    // 7. CREATE OUTPUT FILE
    // ========================================================

    const outputFile =
        await outputFolder.createFile(

            safeFileName,

            {
                overwrite: true
            }

        );


    console.log(
        `📄 Output file created: ${safeFileName}`
    );


    // ========================================================
    // 8. SAVE JPEG
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
            commandName:
                "Save Corrected Image"
        }

    );


    console.log(
        `✅ JPEG saved: ${safeFileName}`
    );


    // ========================================================
    // 9. CLOSE WITHOUT SAVING ORIGINAL
    // ========================================================

    await core.executeAsModal(

        async () => {

            await doc.closeWithoutSaving();

        },

        {
            commandName:
                "Close Original Without Saving"
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
// EXPORT
// ============================================================

module.exports = {

    saveResizeAndClose

};