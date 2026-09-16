const { app, core } = window.require("photoshop");

async function openImageAtIndex(index, imageFiles) {
    if (!imageFiles || index < 0 || index >= imageFiles.length) {
        return null;
    }

    const entry = imageFiles[index];

    console.log(`📂 IMAGE ${index + 1}/${imageFiles.length}`);
    console.log(`📄 Opening: ${entry.name}`);

    // Close currently open document
    try {
        const doc = app.activeDocument;

        if (doc) {
            await core.executeAsModal(
                async () => {
                    await doc.close();
                },
                {
                    commandName: "Close Previous Document"
                }
            );

            console.log("🔒 Previous document closed");
        }
    } catch (e) {
        console.log("⚠️ Previous document close:", e.message);
    }

    // Open next image
    await core.executeAsModal(
        async () => {
            await app.open(entry);
        },
        {
            commandName: "Open Image"
        }
    );

    console.log(`✅ Opened: ${entry.name}`);

    return entry.name;
}

module.exports = {
    openImageAtIndex
};