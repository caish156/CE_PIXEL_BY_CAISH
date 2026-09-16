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

async function readChannelHistogram(channelName) {

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
                        _value: channelName
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
        !result ||
        !result[0] ||
        !Array.isArray(result[0].histogram)
    ) {
        throw new Error(
            `Invalid ${channelName} histogram response`
        );
    }


    return result[0].histogram;
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

    return await readChannelHistogram("grn");

}


// ============================================================
// BLUE
// ============================================================

async function readBlueHistogram() {

    return await readChannelHistogram("bl ");

}


module.exports = {
    readDocumentHistogram, readChannelHistogram, readRedHistogram, readGreenHistogram, readBlueHistogram
}