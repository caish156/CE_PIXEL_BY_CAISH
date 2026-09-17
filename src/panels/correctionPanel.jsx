import React from "react";
import { CorrectionWorkflow } from "../App"
import {
    get as getSettings,
    update as updateSettings,
    subscribe as subscribeSettings,
    DEFAULTS as SETTINGS_DEFAULTS
} from "../utils/settingsStore.js";

import {
    deltaFromTarget,
    targetFromDelta,
    formatBrightnessDelta
} from "../utils/brightnessMath.js";
import {
    list as listPresetsFromStore,
    save as savePresetInStore,
    remove as removePresetInStore,
    setActive as activatePresetInStore,
    getActive as getActivePresetFromStore,
    getPreset as getPresetFromStore,
    DEFAULT_PRESET_NAME
} from "../utils/presetStore.js";

export const CorrectionPanel = () => {

    // Skin tone slider config (Lab ranges — UI reference image ke hisaab se)
    const SKIN_SLIDERS = [
        {
            key: "hue",
            label: "Hue",
            min: 10,
            max: 50,
            ticks: []
        },
        {
            key: "saturation",
            label: "Saturation",
            min: 0,
            max: 40,
            ticks: []
        },
        {
            key: "lightness",
            label: "Lightness",
            min: 60,
            max: 90,
            ticks: []
        }
    ];

    // Standard / reference face sliders — single value per channel.
    // Engine standardFace.l ko light reference ki tarah use karta hai.
    // Ranges skin tone sliders ke saath consistent rakhe gaye hain.



    const [state, setState] = React.useState({
        folder: null,
        total: 0,
        completed: 0,
        currentIndex: -1,
        currentImageName: "",
        running: false,
        processing: false,
        currentResult: null,
        progress: 0
    });
    console.log("CorrectionPanel state:");

    const workflowRef = React.useRef(null);


    // ============================================
    // USER SETTINGS (persisted via settingsStore)
    // ============================================

    const [brightnessTarget, setBrightnessTarget] = React.useState(
        () => getSettings().brightnessTarget
    );

    // Skin Tone — HSL target ranges (ColourCastEngine ka skinConfig).
    // settingsStore.skinTone hi source of truth hai.
    // Now using range format: { min, max } for each channel
    const [skinTone, setSkinTone] = React.useState(() => {
        const saved = getSettings().skinTone;
        // Convert old single-value format to new range format if needed
        if (saved && typeof saved.hue === 'number') {
            return {
                hue: { min: saved.hue - 5, max: saved.hue + 5 },
                saturation: { min: saved.saturation - 3, max: saved.saturation + 3 },
                lightness: { min: saved.lightness - 3, max: saved.lightness + 3 }
            };
        }
        // Default range values
        return {
            hue: { min: 22, max: 28 },
            saturation: { min: 17, max: 23 },
            lightness: { min: 67, max: 73 }
        };
    });

    // Persisted reference face HSL used by the colour-correction workflow.
    // No separate Standard Face UI is rendered.
    const [standardFace, setStandardFace] = React.useState(() => {
        const saved = getSettings().standardFace;

        if (!saved || typeof saved !== "object") {
            return { ...SETTINGS_DEFAULTS.standardFace };
        }

        return {
            h: Number(saved.h),
            s: Number(saved.s),
            l: Number(saved.l)
        };
    });

       // PRESETS
    const [presetList, setPresetList] = React.useState(
        () => listPresetsFromStore()
    );

    const [activePreset, setActivePresetState] = React.useState(
        () => getActivePresetFromStore()
    );

    const [presetName, setPresetName] = React.useState("");

    // Skin tone sliders edit mode (Edit pill toggle)
    const [skinEdit, setSkinEdit] = React.useState(true);

    // Legacy RGB-ratio pipeline (HSL range → sample points → ratio locus) remove
    // kar di gayi hai: ColourCastEngine ab HSL ranges (skinTone) + standardFace
    // use karta hai, ratios nahi.

    // Gradient for HSL tracks (display only — slider state untouched).
    // Saturation gradient derives from current Hue center; Lightness derives
    // from current Hue center + Saturation center.
    const skinTrackBackground = (key) => {
        const hueC = Math.round((skinTone.hue.min + skinTone.hue.max) / 2);
        const satC = Math.round((skinTone.saturation.min + skinTone.saturation.max) / 2);
        const hueDeg = Math.round(14 + ((Math.max(10, Math.min(50, hueC)) - 10) / 40) * 26);
        if (key === "saturation") {
            return "linear-gradient(90deg, hsl(" + hueDeg + ", 62%, 42%) 0%, hsl(" + hueDeg + ", 74%, 52%) 50%, hsl(" + hueDeg + ", 88%, 58%) 100%)";
        }
        if (key === "lightness") {
            const s = Math.max(38, Math.min(72, satC * 2 + 12));
            return "linear-gradient(90deg, hsl(" + hueDeg + ", " + s + "%, 26%) 0%, hsl(" + hueDeg + ", " + s + "%, 48%) 35%, hsl(" + hueDeg + ", " + s + "%, 68%) 65%, hsl(" + hueDeg + ", " + Math.max(18, Math.min(38, s - 20)) + "%, 90%) 100%)";
        }
        const stops = [10, 20, 30, 40, 50].map((h, i) => {
            const deg = Math.round(12 + ((h - 10) / 40) * 28);
            return "hsl(" + deg + ", 78%, " + (i === 2 ? "58%" : i === 0 || i === 4 ? "46%" : "52%") + ") " + (i * 25) + "%";
        });
        return "linear-gradient(90deg, " + stops.join(", ") + ")";
    };


    React.useEffect(() => {

        // do panels/instances sync rahein
        const unsubscribe = subscribeSettings((settings) => {
            setBrightnessTarget(settings.brightnessTarget);

            if (settings.skinTone) {
                setSkinTone(settings.skinTone);
            }

            if (settings.standardFace) {
                setStandardFace(settings.standardFace);
            }
        });

        return unsubscribe;

    }, []);


    const changeBrightnessTarget = (event) => {

        // slider delta stops (-5..+5) pe chalta hai, internal value
        // (146 + delta*3) sirf settings me store hoti hai
        const delta = Number(event.target.value);

        if (!Number.isFinite(delta)) {
            return;
        }

        setBrightnessTarget(targetFromDelta(delta));

        updateSettings({
            brightnessTarget: targetFromDelta(delta)
        });

    };


    // −/+ buttons: brightness delta ek step aage/peeche
    const stepBrightness = (direction) => {
        // === BRIGHTNESS CLICK START ===
        console.log("=== BRIGHTNESS CLICK START ===");
        console.log("direction:", direction);
        console.log("current brightnessTarget:", brightnessTarget);
        console.log("current brightnessDelta:", deltaFromTarget(brightnessTarget));
        // === END BRIGHTNESS CLICK START ===

        // A: deltaFromTarget(brightnessTarget)
        console.log("=== BRIGHTNESS STEP ===");
        console.log("A START: deltaFromTarget(brightnessTarget)");
        const currentDelta = deltaFromTarget(brightnessTarget);
        console.log("A RESULT:", currentDelta);

        // B: Math.max / Math.min calculation
        console.log("B START: Math.max(-5, Math.min(5, currentDelta + direction))");
        const nextDelta = Math.max(
            -5,
            Math.min(5, currentDelta + direction)
        );
        console.log("B RESULT:", nextDelta);

        // C: targetFromDelta(nextDelta)
        console.log("C START: targetFromDelta(nextDelta)");
        const nextTarget = targetFromDelta(nextDelta);
        console.log("C RESULT:", nextTarget);

        // D: setBrightnessTarget(nextTarget)
        console.log("D BEFORE: setBrightnessTarget(nextTarget)");
        setBrightnessTarget(nextTarget);
        console.log("D DONE: setBrightnessTarget completed");

        // E: updateSettings({ brightnessTarget: nextTarget })
        console.log("E BEFORE: updateSettings({ brightnessTarget: nextTarget })");
        updateSettings({
            brightnessTarget: nextTarget
        });
        console.log("E DONE: updateSettings completed");

        console.log("=== BRIGHTNESS CLICK END ===");
    };


    // Skin tone range slider change (hue / saturation / lightness)
    // Handles dual-handle sliders with min/max values
    const changeSkinTone = (channel, handle, value) => {
        const numValue = Number(value);
        if (!Number.isFinite(numValue)) {
            return;
        }

        const current = skinTone[channel];
        const sliderConfig = SKIN_SLIDERS.find(s => s.key === channel);
        
        if (!sliderConfig) {
            return;
        }

        let newMin = current.min;
        let newMax = current.max;

        // Update the appropriate handle
        if (handle === 'min') {
            newMin = numValue;
            // Ensure min doesn't exceed max-1 (minimum separation of 1)
            if (newMin >= current.max) {
                newMin = current.max - 1;
            }
        } else if (handle === 'max') {
            newMax = numValue;
            // Ensure max doesn't go below min+1
            if (newMax <= current.min) {
                newMax = current.min + 1;
            }
        }

        // Clamp values to slider range
        newMin = Math.max(sliderConfig.min, Math.min(sliderConfig.max, newMin));
        newMax = Math.max(sliderConfig.min, Math.min(sliderConfig.max, newMax));

        // Final check to ensure min < max after clamping
        if (newMin >= newMax) {
            if (handle === 'min') {
                newMin = newMax - 1;
            } else {
                newMax = newMin + 1;
            }
        }

        const next = {
            ...skinTone,
            [channel]: { min: newMin, max: newMax }
        };

        setSkinTone(next);
        updateSettings({
            skinTone: next
        });
    };

    // Get center value for display
    const getCenterValue = (channel) => {
        const current = skinTone[channel];
        return Math.round((current.min + current.max) / 2);
    };


    // ==========================
    // PRESETS
    // ==========================

    const applyPresetByName = (name) => {

        const preset = activatePresetInStore(name);

        if (!preset) {
            return;
        }

        setBrightnessTarget(preset.settings.brightnessTarget);

        setSkinTone(preset.settings.skinTone);

        // standardFace bhi preset ka hissa hai. Preset store use normalize karta
        // hai (legacy presets -> default), isliye yahan hamesha ek valid value
        // milti hai; agar phir bhi missing ho to CURRENT value preserve karte hain.
        const nextStandardFace = preset.settings.standardFace
            ? preset.settings.standardFace
            : standardFace;

        setStandardFace(nextStandardFace);

        updateSettings({
            brightnessTarget: preset.settings.brightnessTarget,
            skinTone: preset.settings.skinTone,
            standardFace: nextStandardFace
        });

        setActivePresetState(preset.name);

        setPresetList(listPresetsFromStore());

    };


    const onPresetSelect = (event) => {
        applyPresetByName(event.target.value);
    };


    const onSavePreset = () => {

        // naam khali -> currently active preset overwrite
        const name = savePresetInStore(presetName, {
            brightnessTarget,
            skinTone,
            standardFace
        });

        setPresetList(listPresetsFromStore());

        setActivePresetState(name);

        setPresetName("");

    };


    const onDeletePreset = () => {

        const current = getPresetFromStore(activePreset);

        // builtin Default delete nahi hota
        if (!current || current.builtin) {
            return;
        }

        const removed = removePresetInStore(activePreset);

        setPresetList(listPresetsFromStore());

        if (removed) {
            applyPresetByName(DEFAULT_PRESET_NAME);
        }

    };


    const isBuiltinPresetActive = (() => {
        const current = getPresetFromStore(activePreset);
        return Boolean(current && current.builtin);
    })();


    // Skin tone preview swatch (UI-only approximation — engine wiring baad me)
    // Use center values from the range for preview
    const skinPreviewColor =
        `hsl(${getCenterValue('hue')}, ${15 + getCenterValue('saturation')}%, ${75 - (getCenterValue('lightness') - 60)}%)`;

    const brightnessDelta = deltaFromTarget(brightnessTarget);

    // === DIAGNOSTIC LOG ===
    console.log("=== CORRECTION PANEL RENDER ===");
    console.log("brightnessTarget:", brightnessTarget);
    console.log("brightnessDelta:", brightnessDelta);
    console.log("skinTone (skinConfig):", skinTone);
    console.log("standardFace:", standardFace);
    // === END DIAGNOSTIC LOG ===


    React.useEffect(() => {

        workflowRef.current =
            new CorrectionWorkflow(setState);

        return () => {

            if (workflowRef.current) {
                workflowRef.current.stop();
            }

        };

    }, []);


    const start = async () => {

        if (!workflowRef.current) {
            return;
        }

        await workflowRef.current.start();

    };


    const stop = async () => {

        if (!workflowRef.current) {
            return;
        }

        await workflowRef.current.stop();

    };

    const statusText = !state.folder
        ? "Waiting for image folder"
        : !state.running && state.completed === state.total
            ? "All images completed"
            : state.processing
                ? `Processing ${state.currentIndex + 1} of ${state.total}`
                : "Ready";


    return (
        <div className="ce-app">

            {/* HEADER */}

            <div className="ce-header">

                <div>
                    <div className="ce-title">
                        CORRECTION ENGINE
                    </div>

                    <div className="ce-subtitle">
                        Face-Anchored Light Correction
                    </div>
                </div>

                <div className="ce-version">
                    v1.0.0
                </div>

            </div>
           {/* FOLDER */}
            <div className="ce-section">

                <div className="ce-section-title">
                    SOURCE FOLDER
                </div>

                <button
                    className="ce-folder-button"
                    onClick={start}
                    disabled={state.running}
                >
                    {state.running
                        ? "PROCESSING..."
                        : "SELECT IMAGE FOLDER"
                    }
                </button>


                {state.folder && (
                    <div className="ce-folder-info">

                        <div className="ce-folder-name">
                            {state.folder.name}
                        </div>

                        <div className="ce-folder-path">
                            {state.total} images found
                        </div>

                    </div>
                )}

            </div>
            {/* CONTROLS */}
            <div className="ce-section">

                <div className="ce-control-panel">

                    {/* PRESETS */}

                    <div className="ce-control-header">

                        <div className="ce-section-title">
                            PRESETS
                        </div>

                    </div>

                    <div className="ce-preset-compact-row">

                        <select
                            className="ce-preset-select"
                            value={activePreset}
                            onChange={onPresetSelect}
                        >

                            {presetList.map((preset) => (
                                <option key={preset.name} value={preset.name}>
                                    {preset.name}{preset.builtin ? " •" : ""}
                                </option>
                            ))}

                        </select>

                        <input
                            className="ce-preset-name"
                            type="text"
                            placeholder="New preset name…"
                            value={presetName}
                            onChange={(event) => setPresetName(event.target.value)}
                        />

                        <button
                            className="ce-mini-btn  ce-mini-btn-danger"
                            onClick={onSavePreset}
                        >
                            SAVE
                        </button>

                        <button
                            className="ce-mini-btn ce-mini-btn-danger"
                            onClick={onDeletePreset}
                            disabled={isBuiltinPresetActive}
                        >
                            DEL
                        </button>

                    </div>

                    <div className="ce-divider" />

                    {/* BRIGHTNESS */}

                    <div className="ce-control-header">

                        <div className="ce-section-title">
                            BRIGHTNESS
                        </div>

                        <div className="ce-card-value">
                            {formatBrightnessDelta(brightnessDelta)}
                        </div>

                    </div>

                    <div className="ce-bright-row">

                        <button
                            type="button"
                            className="ce-step-btn"
                            onClick={() => stepBrightness(-1)}
                            disabled={brightnessDelta <= -5}
                        >
                            −
                        </button>

                        <button
                            type="button"
                            className="ce-step-btn"
                            onClick={() => stepBrightness(1)}
                            disabled={brightnessDelta >= 5}
                        >
                            +
                        </button>

                        <div className="ce-brightness-track">
                            <div
                                className="ce-brightness-handle"
                                style={{ left: (((brightnessDelta + 5) / 10 * 100).toFixed(1)) + "%" }}
                            />
                        </div>

                        <button
                            type="button"
                            className="ce-step-btn"
                            onClick={() => stepBrightness(1)}
                            disabled={brightnessDelta >= 5}
                        >
                            +
                        </button>

                        <button
                            type="button"
                            className="ce-step-btn"
                            onClick={() => stepBrightness(-1)}
                            disabled={brightnessDelta <= -5}
                        >
                            −
                        </button>

                    </div>
                    <div className="ce-strip ce-strip-brightness border-red" />

                                        <div className="ce-divider" />

                    {/* SKIN TONE (LAB) */}

                    <div className="ce-control-header">

                        <div className="ce-section-title">
                            SKIN TONE (LAB)
                        </div>

                        <span
                            className="ce-help"
                            title="HSL-based skin tone target — ColourCastEngine in ranges ka use karta hai"
                        >
                            ?
                        </span>

                    </div>

                    <div className="ce-skin-body">

                        <div className="ce-skin-controls">

                             {SKIN_SLIDERS.map((slider) => {
                                const range = skinTone[slider.key];
                                const center = getCenterValue(slider.key);
                                const minP = ((range.min - slider.min) / (slider.max - slider.min)) * 100;
                                const maxP = ((range.max - slider.min) / (slider.max - slider.min)) * 100;
                                const trackBg = skinTrackBackground(slider.key);
                                return (
                                <div className="ce-skin-slider-group" key={slider.key}>
                                    <div className="ce-skin-slider-head">
                                        <div className="ce-skin-label">{slider.label}</div>
                                        <div className="ce-card-value ce-card-value-lg">{range.min} - {range.max}</div>
                                    </div>
                                    <div className="ce-color-row">
                                        <div className="ce-color-btns">
                                            <button type="button" className="ce-color-btn" aria-label="Decrease minimum" disabled={!skinEdit || range.min <= slider.min} onClick={() => changeSkinTone(slider.key, "min", range.min - 1)}>-</button>
                                            <button type="button" className="ce-color-btn" aria-label="Increase minimum" disabled={!skinEdit || range.min >= Math.min(slider.max, range.max - 1)} onClick={() => changeSkinTone(slider.key, "min", range.min + 1)}>+</button>
                                        </div>
                                        <div className="ce-color-gradient" style={{ background: trackBg }}>
                                            <div className="ce-range-handle min" style={{ left: minP + "%" }} />
                                            <div className="ce-range-handle max" style={{ left: maxP + "%" }} />
                                        </div>
                                        <div className="ce-color-btns">
                                            <button type="button" className="ce-color-btn" aria-label="Decrease maximum" disabled={!skinEdit || range.max <= Math.max(slider.min, range.min + 1)} onClick={() => changeSkinTone(slider.key, "max", range.max - 1)}>-</button>
                                            <button type="button" className="ce-color-btn" aria-label="Increase maximum" disabled={!skinEdit || range.max >= slider.max} onClick={() => changeSkinTone(slider.key, "max", range.max + 1)}>+</button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}


                        </div>

                    </div>

      

            </div>
            {/* IMAGE SUMMARY */}

            <div className="ce-section">

                <div className="ce-section-title">
                    IMAGE SUMMARY
                </div>

                <div className="ce-stats">

                    <div className="ce-stat">

                        <div className="ce-stat-value">
                            {state.total}
                        </div>

                        <div className="ce-stat-label">
                            TOTAL
                        </div>

                    </div>


                    <div className="ce-stat">

                        <div className="ce-stat-value">
                            {state.completed}
                        </div>

                        <div className="ce-stat-label">
                            COMPLETED
                        </div>

                    </div>


                    <div className="ce-stat">

                        <div className="ce-stat-value">
                            {Math.max(
                                state.total - state.completed,
                                0
                            )}
                        </div>

                        <div className="ce-stat-label">
                            REMAINING
                        </div>

                    </div>

                </div>

            </div>


            {/* CURRENT IMAGE */}

            {state.currentImageName && (

                <div className="ce-section">

                    <div className="ce-section-title">
                        CURRENT IMAGE
                    </div>

                    <div className="ce-current-image">

                        <div className="ce-current-label">
                            PROCESSING
                        </div>

                        <div className="ce-current-name">
                            {state.currentImageName}
                        </div>

                    </div>

                </div>

            )}


            {/* PROGRESS */}

            <div className="ce-section">

                <div className="ce-progress-header">

                    <div className="ce-section-title">
                        PROGRESS
                    </div>

                    <div className="ce-progress-percent">
                        {state.progress}%
                    </div>

                </div>


                <div className="ce-progress-track">

                    <div
                        className="ce-progress-fill"
                        style={{
                            width: `${state.progress}%`
                        }}
                    />

                </div>


                <div className="ce-progress-details">

                    <span>
                        {state.completed} of {state.total}
                    </span>

                    <span>
                        {Math.max(
                            state.total - state.completed,
                            0
                        )} remaining
                    </span>

                </div>

            </div>


            {/* FACE RESULT */}

            {state.currentResult && (

                <div className="ce-section">

                    <div className="ce-section-title">
                        FACE SAMPLING
                    </div>

                    <div className="ce-face-card">

                        <div>
                            Faces detected:{" "}
                            <strong>
                                {state.currentResult.faces?.length || 0}
                            </strong>
                        </div>

                    </div>

                </div>

            )}


            {/* CONTROL */}

            {state.running && (

                <div className="ce-section">

                    <button
                        className="ce-process-button"
                        onClick={stop}
                    >
                        STOP
                    </button>

                </div>

            )}


            {/* STATUS */}

            <div className="ce-status">

                <div className="ce-status-dot" />
               
                <div className="ce-status-text">
                    {statusText}
                </div>

            </div>

        </div></div>
    );
};
