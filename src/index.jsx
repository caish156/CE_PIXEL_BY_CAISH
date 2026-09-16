import React from "react";

import "./styles.css";
import { PanelController } from "./controllers/PanelController.jsx";
import { CommandController } from "./controllers/CommandController.jsx";
import { About } from "./components/About.jsx";
import { CorrectionPanel } from "./panels/correctionPanel.jsx";

import { entrypoints } from "uxp";

const aboutController = new CommandController(
    ({ dialog }) => <About dialog={dialog} />,
    {
        id: "showAbout",
        title: "React Starter Plugin Demo",
        size: {
            width: 480,
            height: 480
        }
    }
);

const correctionPanelController = new PanelController(
    () => <CorrectionPanel />,
    {
        id: "correctionPanel",
        menuItems: [
            {
                id: "reload1",
                label: "Reload Plugin",
                enabled: true,
                checked: false,
                oninvoke: () => location.reload()
            },
            {
                id: "dialog1",
                label: "About this Plugin",
                enabled: true,
                checked: false,
                oninvoke: () => aboutController.run()
            }
        ]
    }
);

entrypoints.setup({
    plugin: {
        create(plugin) {
            console.log("created", plugin);
        },

        destroy() {
            console.log("destroyed");
        }
    },

    commands: {
        showAbout: aboutController
    },

    panels: {
        correctionPanel: correctionPanelController
    }
});
