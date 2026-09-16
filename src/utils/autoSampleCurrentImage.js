const { app } = window.require("photoshop");

const { requestSkinAnchor } = require("../modules/api");
const { getFaceLightBatchPlay } = require("../batchplays/faceAnalysis");


async function autoSampleCurrentImage(currentImageName) {

    const doc = app.activeDocument;

    if (!doc) {
        throw new Error("No active Photoshop document");
    }

    console.log("");
    console.log("🔍 FACE SAMPLING STARTED");
    console.log(`📄 ${currentImageName}`);

    let aiResponse;

    try {

        aiResponse = await requestSkinAnchor();

    } catch (e) {

        console.error(
            "❌ AI request failed:",
            e.message
        );

        return {
            success: false,
            faces: []
        };
    }


    if (
        !aiResponse ||
        !aiResponse.success ||
        !Array.isArray(aiResponse.faces)
    ) {

        console.log("⚠️ NO FACE DETECTED");

        return {
            success: false,
            faces: []
        };
    }


    console.log(
        `👤 FACES FOUND: ${aiResponse.faces.length}`
    );


    const faces = [];


    for (
        let i = 0;
        i < aiResponse.faces.length;
        i++
    ) {

        const face = aiResponse.faces[i];

        const patch = face.skin_patch;


        if (!patch) {

            console.log(
                `⚠️ Face ${i + 1}: no skin patch`
            );

            continue;
        }


        try {

            const sample =
                await getFaceLightBatchPlay(
                    patch.x,
                    patch.y,
                    patch.width,
                    patch.height
                );


            const result = {

                face: i + 1,

                luminance:
                    typeof sample === "object"
                        ? sample.light
                        : sample,

                rgb:
                    typeof sample === "object"
                        ? sample.rgb
                        : null,

                confidence: face.confidence,

                bbox: face.bbox,

                skin_patch: face.skin_patch,

                anchor: face.anchor

            };


            faces.push(result);


            console.log(
                `👤 FACE ${i + 1}`,
                result
            );


        } catch (e) {

            console.error(
                `❌ Face ${i + 1} sampling failed:`,
                e.message
            );

        }

    }


    console.log("");
    console.log("📊 SAMPLING RESULT");

    console.log({
        image: currentImageName,
        faces: faces.length,
        data: faces
    });

    console.log("====================================");


    return {
        success: true,
        faces
    };
}


module.exports = {
    autoSampleCurrentImage
};