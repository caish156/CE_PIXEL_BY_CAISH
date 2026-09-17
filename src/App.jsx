import {
  selectFolder
} from "./utils/selectFolder.js";

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
import { runColourCorrectionWorkflow } from "./workflow/colourCorrectionWorkflow.js";

export class CorrectionWorkflow {

  constructor(onUpdate) {

    this.onUpdate = onUpdate;

    this.folder = null;
    this.imageFiles = [];

    this.currentIndex = -1;
    this.currentImageName = "";

    this.total = 0;
    this.completed = 0;

    this.running = false;
    this.processing = false;

    this.currentResult = null;

    // ============================================
    // FACE DATA
    // ============================================

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

        total: this.total,
        completed: this.completed,

        currentIndex: this.currentIndex,
        currentImageName: this.currentImageName,

        running: this.running,
        processing: this.processing,

        currentResult: this.currentResult,

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

  async start() {

    if (this.running) {
      return;
    }


    const result =
      await selectFolder();


    if (!result) {
      return;
    }


    this.folder =
      result.folder;

    this.imageFiles =
      result.imageFiles;

    this.total =
      result.total;

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
      `📂 Folder: ${this.folder.name}`
    );

    console.log(
      `📸 Images: ${this.total}`
    );

    console.log(
      "===================================="
    );


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


    // ===================================================
    // ALL DONE
    // ===================================================

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


    this.currentIndex =
      nextIndex;

    this.currentImageName =
      this.imageFiles[nextIndex].name;

    this.processing = true;
    this.currentResult = null;

    this.update();


    try {

      console.log("");

      console.log(
        `▶️ PROCESSING ${nextIndex + 1}/${this.total}`
      );

      console.log(
        `📄 ${this.currentImageName}`
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


      const faceData = await readFaceData();

      this.faceData = faceData;
      console.log(
        "✅ Face Sampling Complete"
      );


      console.log(
        "📦 Face Data:",
        this.faceData
      );


      // =================================================
      // 3. LIGHT CORRECTION WORKFLOW
      // =================================================

      console.log(
        "💡 Running Light Correction Workflow..."
      );


      const lightResult =
        await runLightCorrectionWorkflow(
          this.currentImageName,
          this.folder,
          this.faceData,
          // =============================================
          // USER SETTINGS (panel sliders)
          // =============================================

          getSettings().brightnessTarget
        );

      console.log(
        "💡 Running Colour Correction Workflow..."
      );


      // const colourResult =
      //   await runColourCorrectionWorkflow(
      //     this.currentImageName,
      //     this.folder,
      //     this.faceData
      //   );
      this.currentResult = {
        light: lightResult,
        // colour: colourResult
      };


      this.update();


      console.log(
        "✅ Light Correction Complete"
      );


      // =================================================
      // 4. RESIZE + SAVE + CLOSE
      // =================================================

      await this.delay(300);


      console.log(
        "💾 Resize → Save → Close..."
      );


      await saveResizeAndClose(
        this.folder,
        this.currentImageName
      );


      // =================================================
      // 5. MARK COMPLETE
      // =================================================

      this.completed++;

      this.processing = false;

      this.update();


      console.log(
        `✅ COMPLETE: ${this.currentImageName}`
      );

      console.log(
        `📊 PROGRESS: ${this.completed}/${this.total}`
      );


      // =================================================
      // 6. NEXT IMAGE
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

    return new Promise(resolve =>
      setTimeout(resolve, ms)
    );
  }

}