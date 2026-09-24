const { app, core } = window.require("photoshop");

async function openImageAtIndex(index, imageFiles) {

    if (
        !imageFiles ||
        index < 0 ||
        index >= imageFiles.length
    ) {
        return null;
    }


    // ========================================================
    // CURRENT IMAGE DATA
    // ========================================================

    const imageData =
        imageFiles[index];


    // Recursive selectFolder() ke baad:
    //
    // {
    //     file: UXP file entry,
    //     name: "img1.jpg",
    //     relativePath: "bride/day1/img1.jpg"
    // }


    const entry =
        imageData.file;


    console.log(
        `📂 IMAGE ${index + 1}/${imageFiles.length}`
    );

    console.log(
        `📄 Opening: ${imageData.relativePath}`
    );


    // ========================================================
    // CLOSE CURRENTLY OPEN DOCUMENT
    // ========================================================

    try {

        const doc =
            app.activeDocument;


        if (doc) {

            await core.executeAsModal(

                async () => {

                    await doc.close();

                },

                {
                    commandName:
                        "Close Previous Document"
                }

            );


            console.log(
                "🔒 Previous document closed"
            );

        }

    } catch (e) {

        console.log(
            "⚠️ Previous document close:",
            e.message
        );

    }


    // ========================================================
    // OPEN NEXT IMAGE
    // ========================================================

    await core.executeAsModal(

        async () => {

            await app.open(entry);

        },

        {
            commandName:
                "Open Image"
        }

    );


    console.log(
        `✅ Opened: ${imageData.relativePath}`
    );


    return imageData.name;

}


module.exports = {

    openImageAtIndex

};