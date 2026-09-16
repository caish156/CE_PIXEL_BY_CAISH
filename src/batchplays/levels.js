const { action, core } = window.require("photoshop");
const { batchPlay } = action;
const { executeAsModal } = core;

async function applyLevelsAdjustment(shadow, midpoint, highlight) {
    // Photoshop state modify karne wale batchPlay ko executeAsModal me wrap karna hoga
    await executeAsModal(async () => {
        await batchPlay([
            {
                _obj: "levels",
                presetKind: {
                    _enum: "presetKindType",
                    _value: "presetKindCustom"
                },
                adjustment: [
                    {
                        _obj: "levelsAdjustment",
                        channel: {
                            _ref: "channel",
                            _enum: "channel",
                            _value: "composite"
                        },
                        input: [shadow, highlight],
                        gamma: midpoint,
                        output: [0, 255]
                    }
                ]
            }
        ], { synchronousExecution: false });
    }, { "commandName": "Applying Auto Levels" });
}

module.exports= {applyLevelsAdjustment}