const { app } = window.require("photoshop");

const SERVER_URL = "http://127.0.0.1:8000";

// ==========================================
// CHECK SERVER CONNECTION
// ==========================================
async function initServerConnection() {
    try {
        const response = await fetch(`${SERVER_URL}/ping`);

        if (!response.ok) {
            throw new Error("Server responded with error.");
        }

        console.log("✅ Python Server Connected!");
        return true;

    } catch (error) {
    console.error("❌", error.message);
    console.error(error.stack);
    return false;
}
}

// ==========================================
// FETCH FACE ANCHOR FROM PYTHON
// ==========================================
async function requestSkinAnchor() {

    const doc = app.activeDocument;

    if (!doc) {
        throw new Error("Photoshop me koi image open nahi hai.");
    }

    let filePath;

    try {
        filePath = doc.path;
    } catch (e) {
        throw new Error(
            "Image save nahi hai. Pehle Ctrl+S karke save karo."
        );
    }

    const response = await fetch(`${SERVER_URL}/get-skin-anchor`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            image_path: filePath,
        }),
    });

    if (!response.ok) {
        throw new Error("Python server se response nahi mila.");
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error);
    }

    return data;
}

module.exports = {
    initServerConnection,
    requestSkinAnchor,
};