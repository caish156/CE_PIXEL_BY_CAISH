const { action, core, app } = window.require("photoshop");
const { batchPlay } = action;


async function readDocumentHistogram() {
    const result = await batchPlay([
        {
            _obj: "get",
            _target: [
                { _property: "histogram" },
                { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
            ]
        }
    ], { synchronousExecution: false });

    // Returns an array of 256 integers
    return result[0].histogram;
}



// ============================================================
// READ CHANNEL HISTOGRAM
// ============================================================

// ============================================================
// NOTE:
// Photoshop builds me channel enum values alag ho sakte hain:
//   full words  -> "red" | "green" | "blue" | "gray" | "composite"
//   short codes -> "red" | "grn"  | "bl "  | "gray" | "composite"
// Isliye candidates try karte hain — jo pehla VALID 256-bin
// histogram return kare, wahi final hai.
// ============================================================

function isValidHistogram(value) {
    return (
        Array.isArray(value) &&
        value.length === 256 &&
        value.every((v) => typeof v === "number" && isFinite(v))
    );
}

async function readChannelHistogram(channelNames) {

    const candidates =
        Array.isArray(channelNames) ? channelNames : [channelNames];

    for (const candidate of candidates) {

        try {

            const result = await batchPlay(
                [
                    {
                        _obj: "get",

                        _target: [
                            {
                                _property: "histogram"
                            },
                            {
                                _enum: "channel",
                                _ref: "channel",
                                _value: candidate
                            }
                        ],

                        _options: {
                            dialogOptions: "dontDisplay"
                        }
                    }
                ],
                {
                    synchronousExecution: true
                }
            );

            if (
                result &&
                result[0] &&
                isValidHistogram(result[0].histogram)
            ) {
                return result[0].histogram;
            }

            console.warn(
                `Channel '${candidate}' -> valid 256-bin histogram nahi mila` +
                (result && result[0]
                    ? ` (response keys: ${Object.keys(result[0]).join(", ")})`
                    : "")
            );

        } catch (err) {
            console.warn(
                `Channel '${candidate}' get failed: ${err && err.message}`
            );
        }
    }

    throw new Error(
        `Invalid histogram response for channel candidates [${candidates.join(", ")}]`
    );
}


// ============================================================
// RED
// ============================================================

async function readRedHistogram() {

    return await readChannelHistogram("red");

}


// ============================================================
// GREEN
// ============================================================

async function readGreenHistogram() {

    return await readChannelHistogram(["green", "grn"]);

}


// ============================================================
// BLUE
// ============================================================

async function readBlueHistogram() {

    return await readChannelHistogram(["blue", "bl "]);

}


module.exports = {
    readDocumentHistogram, readChannelHistogram, readRedHistogram, readGreenHistogram, readBlueHistogram
}