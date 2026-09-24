const { localFileSystem } = window.require("uxp").storage;


// ============================================================
// IMAGE EXTENSIONS
// ============================================================

const IMAGE_EXTENSIONS =
    /\.(jpg|jpeg|png|tif|tiff|bmp|nef|cr2|arw|dng|raf|orf)$/i;


function isImageFile(name) {

    return IMAGE_EXTENSIONS.test(name);

}


// ============================================================
// RECURSIVE IMAGE SCAN
// ============================================================

async function scanFolderRecursive(folder, relativePath = "") {

    const entries = await folder.getEntries();

    let imageFiles = [];

    for (const entry of entries) {

        // ----------------------------------------------------
        // FILE
        // ----------------------------------------------------

        if (!entry.isFolder) {

            if (isImageFile(entry.name)) {

                imageFiles.push({

                    file: entry,

                    name: entry.name,

                    // Example:
                    // bride/img1.jpg
                    // bride/day1/img2.jpg
                    relativePath: relativePath
                        ? `${relativePath}/${entry.name}`
                        : entry.name

                });

            }

            continue;
        }


        // ----------------------------------------------------
        // SUB FOLDER
        // ----------------------------------------------------

        const childRelativePath = relativePath
            ? `${relativePath}/${entry.name}`
            : entry.name;


        const childImages =
            await scanFolderRecursive(
                entry,
                childRelativePath
            );


        imageFiles.push(...childImages);

    }


    return imageFiles;

}


// ============================================================
// SORT
// ============================================================

function sortImageFiles(a, b) {

    return a.relativePath.localeCompare(
        b.relativePath,
        undefined,
        {
            numeric: true,
            sensitivity: "base"
        }
    );

}


// ============================================================
// SELECT SOURCE FOLDER
// ============================================================

async function selectFolder() {

    const folder =
        await localFileSystem.getFolder();


    if (!folder) {

        return null;

    }


    console.log(
        "===================================="
    );

    console.log(
        "📂 SOURCE FOLDER:",
        folder.name
    );


    // --------------------------------------------------------
    // RECURSIVE SCAN
    // --------------------------------------------------------

    const imageFiles =
        await scanFolderRecursive(folder);


    imageFiles.sort(sortImageFiles);


    console.log(
        "📸 TOTAL IMAGES:",
        imageFiles.length
    );


    console.log(
        "===================================="
    );


    // --------------------------------------------------------
    // DEBUG
    // --------------------------------------------------------

    imageFiles.forEach((image, index) => {

        console.log(
            `${index + 1}. ${image.relativePath}`
        );

    });


    return {

        folder,

        imageFiles,

        total: imageFiles.length

    };

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    selectFolder

};