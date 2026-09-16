const { action } = window.require("photoshop");
const app = window.require("photoshop").app;
const fs = window.require("uxp").storage.localFileSystem;

let currentBeforeState = null;

// Helper: Get Histogram Stats
async function getDocHistogramStats() {
    const result = await action.batchPlay([
        {
            _obj: "get",
            _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
            _property: "histogram"
        }
    ], { synchronousExecution: false });

    const hist = result[0].histogram; 
    let totalPixels = 0, weightedSum = 0, shadowClip = 0, highlightClip = 255;
    
    for(let i = 0; i < 256; i++) {
        totalPixels += hist[i];
        weightedSum += (i * hist[i]);
    }
    const mean = totalPixels > 0 ? (weightedSum / totalPixels) : 0;

    for(let i = 0; i < 256; i++) {
        if(hist[i] > (totalPixels * 0.0001)) { shadowClip = i; break; }
    }
    for(let i = 255; i >= 0; i--) {
        if(hist[i] > (totalPixels * 0.0001)) { highlightClip = i; break; }
    }

    return { mean: Math.round(mean), shadowClip, highlightClip };
}

// Helper: Read Applied Levels from Adjustment Layer
async function getAppliedLevels() {
    try {
        const result = await action.batchPlay([
            {
                _obj: "get",
                _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
                _property: "adjustment"
            }
        ], { synchronousExecution: false });

        const adj = result[0].adjustment;
        if (adj && adj[0] && adj[0].levelAdjustment) {
            const master = adj[0].levelAdjustment;
            return {
                shadow: master.shadowInput ? master.shadowInput[0] : 0,
                gamma: master.gammaInput ? master.gammaInput[0] : 1.0,
                highlight: master.highlightInput ? master.highlightInput[0] : 255
            };
        }
    } catch(e) {
        console.log("Not an adjustment layer");
    }
    return { shadow: 0, gamma: 1.0, highlight: 255 };
}

// ----------------------------------------------------
// FILE SAVING ENGINE (Direct Disk Write)
// ----------------------------------------------------
async function appendRecordToJSON(newRecord) {
    try {
        const dataFolder = await fs.getDataFolder();
        let file;
        let existingData = [];

        // Check agar file pehle se hai
        try {
            file = await dataFolder.getEntry("levels_dataset.json");
            const content = await file.read();
            if (content) existingData = JSON.parse(content);
        } catch (e) {
            // File nahi hai toh nayi create karo
            file = await dataFolder.createEntry("levels_dataset.json", { overwrite: true });
        }

        // Naya record append karo
        existingData.push(newRecord);

        // JSON file update karo
        await file.write(JSON.stringify(existingData, null, 2));
        console.log(`Saved! Total Images in JSON: ${existingData.length}`);
        console.log(`File Location: ${file.nativePath}`);
        
    } catch (err) {
        console.error("File write me error aaya:", err);
    }
}

// ----------------------------------------------------
// BUTTON 1: BEFORE CLICK
// ----------------------------------------------------
export async function handleBeforeClick(apiFaceData) {
    if (!app.activeDocument) return;
    
    const stats = await getDocHistogramStats();
    
    currentBeforeState = {
        docName: app.activeDocument.name,
        faceData: apiFaceData, // API se aane wala face luma / data
        beforeMean: stats.mean,
        beforeShadowClip: stats.shadowClip,
        beforeHighlightClip: stats.highlightClip
    };
    
    console.log("Captured Before for:", currentBeforeState.docName);
}

// ----------------------------------------------------
// BUTTON 2: AFTER CLICK (Directly Saves to Disk)
// ----------------------------------------------------
export async function handleAfterClick() {
    if (!currentBeforeState) {
        alert("Pehle 'Before' capture karo!");
        return;
    }
    
    const afterStats = await getDocHistogramStats();
    const appliedLevels = await getAppliedLevels(); 

    const completeRecord = {
        ...currentBeforeState,
        afterMean: afterStats.mean,
        appliedShadow: appliedLevels.shadow,
        appliedGamma: appliedLevels.gamma,
        appliedHighlight: appliedLevels.highlight
    };

    // Runtime memory me rakhne ke bajaye seedha JSON file me save!
    await appendRecordToJSON(completeRecord);
    
    currentBeforeState = null; 
}