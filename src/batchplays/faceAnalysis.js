const { batchPlay } = window.require("photoshop").action;
const { core } = window.require("photoshop");

async function getFaceLightBatchPlay(x, y, width, height) {
    return await core.executeAsModal(async () => {
        // 1. Create Rectangular Selection on the active canvas
        await batchPlay([
            {
                _obj: "set",
                _target: [{ _ref: "channel", _property: "selection" }],
                to: {
                    _obj: "rectangle",
                    top: { _unit: "pixelsUnit", _value: Math.round(y) },
                    left: { _unit: "pixelsUnit", _value: Math.round(x) },
                    bottom: { _unit: "pixelsUnit", _value: Math.round(y + height) },
                    right: { _unit: "pixelsUnit", _value: Math.round(x + width) }
                },
                _options: { dialogOptions: "dontDisplay" }
            }
        ], {});

        // Helper: Fetches exact mean of a specific color channel inside the selection.
        // Accepts enum candidates — Photoshop builds me channel enums alag hote hain
        // (full words "green"/"blue" vs short codes "grn"/"bl ").
        const getChannelMean = async (channelCandidates) => {
            const candidates =
                Array.isArray(channelCandidates) ? channelCandidates : [channelCandidates];

            for (const channelEnumName of candidates) {
                try {
                    const res = await batchPlay([
                        {
                            _obj: "get",
                            _target: [
                                { _property: "histogram" },
                                {
                                    _ref: "channel",
                                    _enum: "channel",
                                    _value: channelEnumName
                                }
                            ],
                            _options: { dialogOptions: "dontDisplay" }
                        }
                    ], { synchronousExecution: false });

                    const histArray = res[0] && res[0].histogram;
                    if (!histArray || !Array.isArray(histArray)) {
                        console.warn(`Channel '${channelEnumName}' histogram nahi mila, next candidate try...`);
                        continue;
                    }

                    let totalPixels = 0;
                    let weightedSum = 0;
                    for (let i = 0; i < histArray.length; i++) {
                        const count = histArray[i];
                        totalPixels += count;
                        weightedSum += count * i;
                    }
                    return totalPixels === 0 ? 0 : weightedSum / totalPixels;
                } catch (err) {
                    console.warn(`Could not read channel ${channelEnumName}: ${err && err.message}`);
                }
            }

            console.warn(`Could not read channel(s) [${candidates.join(", ")}], defaulting to 128`);
            return 128;
        };

        // 2. Read Exact Means for R, G, and B inside the selection
        const avgR = Math.round(await getChannelMean(["red"]));
        const avgG = Math.round(await getChannelMean(["green", "grn"]));
        const avgB = Math.round(await getChannelMean(["blue", "bl "]));

        // Calculate standard perceived luminance
        const luminance = Number((0.299 * avgR + 0.587 * avgG + 0.114 * avgB).toFixed(1));

        // 3. Clear Selection immediately so canvas remains clean
        await batchPlay([
            {
                _obj: "set",
                _target: [{ _ref: "channel", _property: "selection" }],
                to: { _enum: "ordinal", _value: "none" },
                _options: { dialogOptions: "dontDisplay" }
            }
        ], {});

        return {
            light: luminance,
            rgb: { r: avgR, g: avgG, b: avgB }
        };
    }, { commandName: "Sampling Face Skin Patch Light" });
}

module.exports = {
    getFaceLightBatchPlay
};