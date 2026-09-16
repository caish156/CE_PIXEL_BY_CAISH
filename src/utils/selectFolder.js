const { localFileSystem } = window.require("uxp").storage;

const IMAGE_EXTENSIONS =
    /\.(jpg|jpeg|png|tif|tiff|bmp|nef|cr2|arw|dng|raf|orf)$/i;

function isImageFile(name) {
    return IMAGE_EXTENSIONS.test(name);
}

async function selectFolder() {

    const folder = await localFileSystem.getFolder();

    if (!folder) {
        return null;
    }

    const entries = await folder.getEntries();

    const imageFiles = entries
        .filter(e => !e.isFolder && isImageFile(e.name))
        .sort((a, b) => a.name.localeCompare(b.name));

    console.log("====================================");
    console.log("📂 FOLDER LOADED");
    console.log("📸 TOTAL IMAGES:", imageFiles.length);
    console.log("====================================");

    return {
        folder,
        imageFiles,
        total: imageFiles.length
    };
}

module.exports = {
    selectFolder
};