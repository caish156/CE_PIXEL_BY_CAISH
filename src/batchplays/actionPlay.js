const { action, core } = window.require("photoshop");

async function runAction(actionName, actionSet) {
    return await core.executeAsModal(async () => {
        return await action.batchPlay(
            [{
                _obj: "play",
                _target: [
                    { _ref: "action", _name: actionName },
                    { _ref: "actionSet", _name: actionSet }
                ],
                _options: { dialogOptions: "dontDisplay" }
            }],
            { synchronousExecution: false }
        );
    }, { commandName: `Running Action: ${actionName}` });
}

module.exports = { runAction };