import {
    selectFolder
} from "./utils/selectFolder.js";

import {
    runAction
} from "./batchplays/actionPlay.js";

import {
    openImageAtIndex
} from "./utils/openImageAtIndex.js";

import {
    saveResizeAndClose
} from "./utils/saveResizeAndClose.js";

import {
    runLightCorrectionWorkflow
} from "./workflow/lightCorrectionWorkflow.js";

import {
    readFaceData
} from "./utils/utilities.js";

import {
    get as getSettings
} from "./utils/settingsStore.js";

import {
    runColourCorrectionWorkflow
} from "./workflow/colourCorrectionWorkflow.js";


export class CorrectionWorkflow {

    constructor(onUpdate) {

        this.onUpdate = onUpdate;

        // ====================================================
        // SOURCE
        // ====================================================

        this.folder = null;

        this.imageFiles = [];


        // ====================================================
        // DESTINATION
        // ====================================================

        this.destinationFolder = null;


        // ====================================================
        // OUTPUT ROOT
        // ====================================================

        this.outputRootFolder = null;


        // ====================================================
        // STATE
        // ====================================================

        this.currentIndex = -1;

        this.currentImageName = "";

        this.total = 0;

        this.completed = 0;

        this.running = false;

        this.processing = false;

        this.currentResult = null;


        // ====================================================
        // FACE DATA
        // ====================================================

        this.faceData = null;

    }


    // =====================================================
    // UPDATE UI
    // =====================================================

    update(data = {}) {

        Object.assign(this, data);


        if (this.onUpdate) {

            this.onUpdate({

                folder: this.folder,

                destinationFolder:
                    this.destinationFolder,

                total: this.total,

                completed: this.completed,

                currentIndex:
                    this.currentIndex,

                currentImageName:
                    this.currentImageName,

                running: this.running,

                processing:
                    this.processing,

                currentResult:
                    this.currentResult,

                progress:
                    this.total > 0
                        ? Math.round(
                            (this.completed / this.total) * 100
                        )
                        : 0

            });

        }

    }


    // =====================================================
    // START
    // =====================================================

    async start(destinationFolder = null) {

        if (this.running) {

            return;

        }


        // ==================================================
        // SELECT SOURCE
        // ==================================================

        const result =
            await selectFolder();


        if (!result) {

            return;

        }


        // ==================================================
        // SOURCE DATA
        // ==================================================

        this.folder =
            result.folder;

        this.imageFiles =
            result.imageFiles;

        this.total =
            result.total;


        // ==================================================
        // DESTINATION
        // ==================================================

        this.destinationFolder =
            destinationFolder || null;


        // ==================================================
        // OUTPUT ROOT
        // ==================================================

        if (this.destinationFolder) {

            // User selected destination.
            //
            // Example:
            //
            // SOURCE/bride/img1.jpg
            //
            // becomes:
            //
            // DEST/bride/img1.jpg

            this.outputRootFolder =
                this.destinationFolder;


            console.log(
                "📁 OUTPUT MODE: DESTINATION FOLDER"
            );

            console.log(
                "📁 Destination:",
                this.destinationFolder.name
            );

        } else {

            // No destination selected.
            //
            // Create:
            //
            // SOURCE/
            // └── SOURCE_correction/

            this.outputRootFolder =
                null;


            console.log(
                "📁 OUTPUT MODE: SOURCE CORRECTION FOLDER"
            );

        }


        // ==================================================
        // RESET STATE
        // ==================================================

        this.completed = 0;

        this.currentIndex = -1;

        this.currentImageName = "";

        this.running = true;

        this.processing = false;

        this.currentResult = null;

        this.faceData = null;


        this.update();


        console.log(
            "===================================="
        );

        console.log(
            "🚀 CORRECTION WORKFLOW STARTED"
        );

        console.log(
            `📂 Source: ${this.folder.name}`
        );

        console.log(
            `📸 Images: ${this.total}`
        );

        console.log(
            `📁 Destination: ${
                this.destinationFolder
                    ? this.destinationFolder.name
                    : "SOURCE/_correction"
            }`
        );

        console.log(
            "===================================="
        );


        // ==================================================
        // NO IMAGES
        // ==================================================

        if (this.total === 0) {

            this.running = false;

            this.update();


            console.log(
                "⚠️ No images found"
            );

            return;

        }


        await this.processNext();

    }


    // =====================================================
    // PROCESS NEXT IMAGE
    // =====================================================

    async processNext() {

        if (!this.running) {

            return;

        }


        const nextIndex =
            this.currentIndex + 1;


        // ==================================================
        // ALL DONE
        // ==================================================

        if (nextIndex >= this.total) {

            this.running = false;

            this.processing = false;

            this.currentImageName = "";

            this.currentResult = null;


            this.update();


            console.log(
                "===================================="
            );

            console.log(
                "🎉 WORKFLOW COMPLETE"
            );

            console.log(
                `📸 Processed: ${this.completed}/${this.total}`
            );

            console.log(
                "===================================="
            );


            return;

        }


        // ==================================================
        // CURRENT IMAGE
        // ==================================================

        this.currentIndex =
            nextIndex;


        const currentImage =
            this.imageFiles[nextIndex];


        this.currentImageName =
            currentImage.name;


        this.processing = true;

        this.currentResult = null;


        this.update();


        try {

            console.log("");

            console.log(
                `▶️ PROCESSING ${nextIndex + 1}/${this.total}`
            );

            console.log(
                `📄 ${currentImage.relativePath}`
            );


            // =================================================
            // 1. OPEN IMAGE
            // =================================================

            console.log(
                "📂 Opening image..."
            );


            await openImageAtIndex(
                nextIndex,
                this.imageFiles
            );


            await this.delay(1200);

            this.update();


            // =================================================
            // 2. FACE SAMPLING
            // =================================================

            console.log(
                "🤖 Running Face Sampling..."
            );


            const faceData =
                await readFaceData();


            this.faceData =
                faceData;


            console.log(
                "✅ Face Sampling Complete"
            );


            console.log(
                "📦 Face Data:",
                this.faceData
            );


            // =================================================
            // 3. LIGHT CORRECTION
            // =================================================

            console.log(
                "💡 Running Light Correction Workflow..."
            );


            await runAction(
                "CE_001",
                "CORRECTION ENGINE SET"
            );


            const lightResult =
                await runLightCorrectionWorkflow(

                    this.currentImageName,

                    this.folder,

                    this.faceData,

                    getSettings().brightnessTarget

                );


            // =================================================
            // 4. COLOUR CORRECTION
            // =================================================

            console.log(
                "🎨 Running Colour Correction Workflow..."
            );


            const settings =
                getSettings();


            console.log(
                "Passing HSL skin config to ColourCastEngine:",
                settings.skinTone
            );


            console.log(
                "Passing standard face reference to ColourCastEngine:",
                settings.standardFace
            );


            const colourResult =
                await runColourCorrectionWorkflow(

                    this.currentImageName,

                    this.folder,

                    this.faceData,

                    settings.skinTone,

                    settings.standardFace

                );


            this.currentResult = {

                light:
                    lightResult,

                colour:
                    colourResult

            };


            this.update();


            console.log(
                "✅ Light + Colour Correction Complete"
            );


            // =================================================
            // 5. SKIN FINER
            // =================================================

            await runAction(
                "SkinFiner",
                "MyActions"
            );


            // =================================================
            // 6. SAVE
            // =================================================

            await this.delay(300);


            console.log(
                "💾 Resize → Save → Close..."
            );


            await saveResizeAndClose(

                // SOURCE ROOT
                this.folder,

                // OUTPUT ROOT
                this.destinationFolder,

                // CURRENT IMAGE INFO
                currentImage

            );


            // =================================================
            // 7. MARK COMPLETE
            // =================================================

            this.completed++;

            this.processing = false;


            this.update();


            console.log(
                `✅ COMPLETE: ${currentImage.relativePath}`
            );


            console.log(
                `📊 PROGRESS: ${this.completed}/${this.total}`
            );


            // =================================================
            // 8. NEXT
            // =================================================

            await this.delay(500);

            await this.processNext();


        } catch (error) {

            console.error(
                `❌ Workflow failed for ${this.currentImageName}`,
                error
            );


            this.processing = false;

            this.running = false;


            this.update();

        }

    }


    // =====================================================
    // STOP
    // =====================================================

    async stop() {

        this.running = false;

        this.processing = false;


        this.update();


        console.log(
            "🛑 Workflow stopped"
        );

    }


    // =====================================================
    // DELAY
    // =====================================================

    delay(ms) {

        return new Promise(
            resolve =>
                setTimeout(resolve, ms)
        );

    }

}