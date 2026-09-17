const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

// ---- settingsStore / presetStore ke liye minimal window + localStorage ----
const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => { storage.set(key, String(value)); },
    removeItem: key => { storage.delete(key); }
  }
};

function freshRequire(relativePath) {
  const abs = require.resolve(path.join(root, relativePath));
  delete require.cache[abs];
  return require(abs);
}

const settingsStore = require(path.join(root, "src/utils/settingsStore.js"));
const presetStore = require(path.join(root, "src/utils/presetStore.js"));
const SETTINGS_KEY = "ce_correction_settings_v1";
const PRESETS_KEY = "ce_presets_v1";

const engine = require(path.join(root, "src/utils/Colorcastengine.js"));
const plain = value => JSON.parse(JSON.stringify(value));
const inputs = [0, 64, 128, 192, 255];
const source = fs.readFileSync(path.join(root, "src/workFlow/colourCorrectionWorkflow.js"), "utf8");
const quiet = { log() {}, warn() {}, error() {} };

// Workflow ko ab imageName + imageFolder bhi required hain.
const testImageName = "IMG_0001.jpg";
const imageFolder = { name: "test-folder" };

function harness() {
  const calls = [];
  const saves = [];
  let reads = 0;
  let engineCalls = 0;
  let docReads = 0;
  const colourData = { avg_r: 170, avg_g: 130, avg_b: 100, total_pixels: 1,
    histogram_r: [1], histogram_g: [1], histogram_b: [1] };
  const photoshop = {
    // getter se count hota hai ki Photoshop document KAB touch hua —
    // validation se pehle touch hua to ye 0 rehna chahiye.
    app: { get activeDocument() { docReads++; return {}; } },
    core: { executeAsModal: async fn => fn() },
    action: { batchPlay: async descriptors => { calls.push(...plain(descriptors)); return [{}]; } }
  };
  const window = { require(name) { assert.equal(name, "photoshop"); return photoshop; } };
  const curveModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, "src/batchplays/curves.js"), "utf8"),
    { window, module: curveModule, console: quiet });
  const workflowModule = { exports: {} };
  vm.runInNewContext(source, { window, module: workflowModule, console: quiet,
    require(name) {
      if (name === "../utils/Colorcastengine") return {
        generateColorCurves(...args) { engineCalls++; assert.equal(args.length, 3); return engine.generateColorCurves(...args); }
      };
      if (name === "../batchplays/curves") return curveModule.exports;
      if (name === "../utils/utilities") return { readImageColourData: async () => { reads++; return colourData; } };
      if (name === "../utils/saveJsonData") return { saveJsonData: async (...args) => { saves.push(args); return { saved: true }; } };
      throw new Error(`Unexpected dependency: ${name}`);
    }
  });
  return { run: workflowModule.exports.runColourCorrectionWorkflow, calls, saves, colourData,
    stats: () => ({ reads, engineCalls, docReads }) };
}

function isStandardFaceShape(value) {
  return Boolean(value) &&
    Number.isFinite(value.h) &&
    Number.isFinite(value.s) &&
    Number.isFinite(value.l);
}

function testSettingsStoreStandardFace() {
  const defaults = settingsStore.DEFAULTS.standardFace;

  assert.ok(
    isStandardFaceShape(defaults),
    "settingsStore.DEFAULTS.standardFace { h, s, l } hona chahiye"
  );

  // SINGLE default definition: preset store me duplicate literal nahi hai —
  // wahi ek object (identity) reuse hota hai.
  assert.strictEqual(
    presetStore.DEFAULT_PRESET_SETTINGS.standardFace,
    defaults,
    "standardFace ka default sirf settingsStore me define hona chahiye"
  );

  assert.deepEqual(presetStore.DEFAULT_PRESET_SETTINGS.standardFace, defaults);

  // update -> persist (persistent global source of truth)
  settingsStore.update({ standardFace: { h: 30, s: 25, l: 65 } });

  assert.deepEqual(settingsStore.get().standardFace, { h: 30, s: 25, l: 65 });
  assert.deepEqual(
    JSON.parse(storage.get(SETTINGS_KEY)).standardFace,
    { h: 30, s: 25, l: 65 }
  );

  // Legacy settings (standardFace ke bina) -> default fallback, kuch tootta nahi
  storage.set(SETTINGS_KEY, JSON.stringify({
    brightnessTarget: 140,
    skinTone: {
      hue: { min: 22, max: 28 },
      saturation: { min: 17, max: 23 },
      lightness: { min: 67, max: 73 }
    }
  }));

  const legacySettings = freshRequire("src/utils/settingsStore.js");

  assert.equal(legacySettings.get().brightnessTarget, 140);
  assert.deepEqual(legacySettings.get().standardFace, defaults);

  console.log("PASS settingsStore: standardFace default, persist, legacy fallback");
}

function testPresetStoreStandardFace() {
  const defaultFace = presetStore.DEFAULT_PRESET_SETTINGS.standardFace;

  // 1. standardFace preset shape me include hota hai
  const withFace = presetStore.normalizeSettings({
    brightnessTarget: 150,
    skinTone: {
      hue: { min: 22, max: 28 },
      saturation: { min: 17, max: 23 },
      lightness: { min: 67, max: 73 }
    },
    standardFace: { h: 28, s: 18, l: 68 }
  });

  assert.deepEqual(
    Object.keys(withFace).sort(),
    ["brightnessTarget", "skinTone", "standardFace"]
  );
  assert.deepEqual(withFace.standardFace, { h: 28, s: 18, l: 68 });

  // 2. clamping engine domain tak (h 0-360, s/l 0-100)
  const clamped = presetStore.normalizeSettings({
    standardFace: { h: 999, s: -5, l: 500 }
  });

  assert.deepEqual(clamped.standardFace, { h: 360, s: 0, l: 100 });

  // 3. legacy settings (standardFace ke bina) -> default fallback, throw nahi
  const legacyNormalized = presetStore.normalizeSettings({
    brightnessTarget: 150,
    skinTone: { hue: { min: 22, max: 28 } }
  });

  assert.deepEqual(legacyNormalized.standardFace, defaultFace);

  // 4. save -> getPreset round trip
  presetStore.save("Standard Face Test", {
    brightnessTarget: 140,
    skinTone: {
      hue: { min: 22, max: 28 },
      saturation: { min: 17, max: 23 },
      lightness: { min: 67, max: 73 }
    },
    standardFace: { h: 27, s: 19, l: 69 }
  });

  assert.deepEqual(
    presetStore.getPreset("Standard Face Test").settings.standardFace,
    { h: 27, s: 19, l: 69 }
  );

  // 5. localStorage me pada purana preset (bina standardFace) load par safe hai
  storage.set(PRESETS_KEY, JSON.stringify({
    active: "Old Preset",
    presets: [
      {
        name: "Old Preset",
        settings: {
          brightnessTarget: 146,
          skinTone: {
            hue: { min: 22, max: 28 },
            saturation: { min: 17, max: 23 },
            lightness: { min: 67, max: 73 }
          }
        }
      }
    ]
  }));

  const legacyPresets = freshRequire("src/utils/presetStore.js");
  const loadedLegacy = legacyPresets.getPreset("Old Preset");

  assert.ok(loadedLegacy, "legacy preset load hona chahiye");
  assert.deepEqual(loadedLegacy.settings.standardFace, defaultFace);

  console.log("PASS presetStore: standardFace in shape, clamping, legacy fallback, save/load");
}

function testLegacyRatioCodeRemoved() {
  // 1. skinRatioConfig ka koi active consumer nahi bacha (settings/panel/preset)
  for (const file of [
    "src/utils/settingsStore.js",
    "src/utils/presetStore.js",
    "src/panels/correctionPanel.jsx"
  ]) {
    const src = fs.readFileSync(path.join(root, file), "utf8");

    assert.doesNotMatch(
      src,
      /skinRatioConfig/,
      `${file} me legacy skinRatioConfig nahi hona chahiye`
    );
  }

  // 2. RGB-ratio helpers aur unka pipeline remove ho gaya
  const ratioModule = fs.readFileSync(
    path.join(root, "src/utils/skinToneRange.js"),
    "utf8"
  );

  assert.doesNotMatch(
    ratioModule,
    /getSkinHslSamplePoints|getSkinRatioSamples|getSkinRatioLocus|SKIN_RG_MIN|SKIN_RB_MIN|SKIN_GB_MIN/,
    "RGB-ratio helpers remove hone chahiye"
  );

  // 3. hslToRgb generic utility ke roop me KEEP hai (ratio system ka part nahi tha)
  assert.match(
    ratioModule,
    /export function hslToRgb/,
    "hslToRgb keep karna hai"
  );

  // 4. panel se dead ratio imports / logs hat gaye
  const panelSource = fs.readFileSync(
    path.join(root, "src/panels/correctionPanel.jsx"),
    "utf8"
  );

  assert.doesNotMatch(
    panelSource,
    /skinToneRange|skinHslSamplePoints|skinRatioSamples|skinRatioLocus/,
    "panel me legacy ratio imports/logs nahi hone chahiye"
  );

  // 5. presetStore me standardFace ka duplicate literal nahi (single default)
  const presetSource = fs.readFileSync(
    path.join(root, "src/utils/presetStore.js"),
    "utf8"
  );

  assert.match(
    presetSource,
    /standardFace: SETTINGS_DEFAULTS\.standardFace/,
    "presetStore ko settingsStore default reuse karna chahiye"
  );

  assert.doesNotMatch(
    presetSource,
    /standardFace:\s*\{[^}]*h:\s*\d/,
    "presetStore me duplicate standardFace literal nahi hona chahiye"
  );

  console.log("PASS cleanup: single standardFace default, legacy ratio code removed, hslToRgb kept");
}

function testUiWiring() {
  const appSource = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");
  const callMatch = appSource.match(/runColourCorrectionWorkflow\(([\s\S]*?)\);/);

  assert.ok(callMatch, "App.jsx me runColourCorrectionWorkflow call milna chahiye");

  const callArgs = callMatch[1];

  assert.match(callArgs, /this\.currentImageName/);
  assert.match(callArgs, /this\.folder/);
  assert.match(callArgs, /this\.faceData/);
  assert.match(callArgs, /settings\.skinTone/);
  assert.match(callArgs, /settings\.standardFace/);
  assert.doesNotMatch(
    appSource,
    /skinRatioConfig/,
    "App.jsx ko legacy skinRatioConfig pass nahi karna chahiye"
  );

  const panelSource = fs.readFileSync(
    path.join(root, "src/panels/correctionPanel.jsx"),
    "utf8"
  );

  // state ka source of truth settingsStore hi hai
  assert.match(panelSource, /getSettings\(\)\.standardFace/);

  // persistence
  assert.match(panelSource, /updateSettings\(\{\s*standardFace: next\s*\}\)/);

  // panels/instances sync
  assert.match(panelSource, /setStandardFace\(settings\.standardFace\)/);

  // preset save ke saath standardFace bhi jaata hai
  assert.match(
    panelSource,
    /savePresetInStore\(presetName,\s*\{[\s\S]*?standardFace[\s\S]*?\}\)/
  );

  // preset apply karte waqt settingsStore.standardFace update hota hai
  const applyBlock = panelSource.match(/const applyPresetByName[\s\S]*?\n    \};/);

  assert.ok(applyBlock, "applyPresetByName milna chahiye");
  assert.match(applyBlock[0], /standardFace/);
  assert.match(applyBlock[0], /updateSettings\(/);

  // UI control maujood hai
  assert.match(panelSource, /STANDARD FACE/);
  assert.match(panelSource, /changeStandardFace/);
  assert.match(panelSource, /STANDARD_FACE_SLIDERS/);

  console.log("PASS UI wiring: App.jsx 5 args, panel standardFace state/persist/preset/UI");
}

async function main() {
  testSettingsStoreStandardFace();
  testPresetStoreStandardFace();
  testLegacyRatioCodeRemoved();
  testUiWiring();

  assert.deepEqual(Object.keys(engine), ["generateColorCurves"]);
  assert.doesNotMatch(source, /getColorCastPercent|getCorrectionFactors|getAppliedCastPercent|getGreyWorldCast|getChannelAverages|WARM_TONE|factorToCurvePoints|correctionFactors|castPercent|finalFactor/);
  const face = { luminance: 140, confidence: 90, rgb: { r: 180, g: 140, b: 100 } };
  const inside = { hue: { min: 25, max: 35 }, saturation: { min: 30, max: 40 }, lightness: { min: 60, max: 75 } };
  const outside = { hue: { min: 10, max: 15 }, saturation: { min: 10, max: 20 }, lightness: { min: 60, max: 75 } };
  for (const [label, faces, config, l, changed] of [
    ["A: inside, below standard", [face], inside, 80, false],
    ["C: inside, above standard", [face], inside, 30, false],
    ["B: outside, below standard", [face], outside, 80, true],
    ["D: outside, above standard", [face], outside, 30, true],
    ["no faces", [], outside, 70, false],
    ["invalid face", [{ ...face, confidence: 10 }], outside, 70, false]
  ]) {
    const h = harness();
    const reference = { h: 23, s: 42, l };
    const faceData = { has_face: faces.length > 0, face_count: faces.length, faces };
    const expected = engine.generateColorCurves({ ...h.colourData, faces }, config, reference);
    const before = JSON.stringify({ faceData, config, reference });
    const result = await h.run(testImageName, imageFolder, faceData, config, reference);
    assert.deepEqual(plain(result.correction.curves), expected);
    assert.equal(JSON.stringify({ faceData, config, reference }), before);
    assert.deepEqual(h.stats(), { reads: 2, engineCalls: 1, docReads: 1 });
    assert.equal(h.saves.length, 1);
    assert.deepEqual(plain(h.saves[0][2].correction.curves), expected);
    const channels = Object.keys(expected).filter(c => expected[c].some(p => p.input !== p.output));
    assert.equal(channels.length > 0, changed);
    assert.deepEqual(h.calls.map(d => d.adjustment[0].channel._value), channels);
    for (const c of Object.keys(expected)) {
      assert.deepEqual(expected[c].map(p => p.input), inputs);
      expected[c].forEach(p => { assert.deepEqual(Object.keys(p), ["input", "output"]); assert.ok(Number.isFinite(p.output)); });
    }
    h.calls.forEach((d, i) => assert.deepEqual(d.adjustment[0].curve,
      expected[channels[i]].map(p => ({ _obj: "point", horizontal: p.input, vertical: p.output }))));
    if (changed) assert.ok(channels.includes("green"));
    console.log(`PASS ${label}`);
  }
  // ---- wiring contract: real settings/preset shapes workflow validation pass karein ----
  for (const [label, wiring] of [
    ["settingsStore", settingsStore.get()],
    ["presetStore default", presetStore.normalizeSettings(presetStore.DEFAULT_PRESET_SETTINGS)]
  ]) {
    const h = harness();

    const result = await h.run(
      testImageName,
      imageFolder,
      { has_face: true, face_count: 1, faces: [face] },
      wiring.skinTone,
      wiring.standardFace
    );

    assert.ok(
      result.correction.curves,
      `${label} ke values se workflow chalna chahiye`
    );
    assert.deepEqual(h.stats(), { reads: 2, engineCalls: 1, docReads: 1 });
    assert.deepEqual(
      plain(h.saves[0][2].standardFace),
      plain(wiring.standardFace)
    );

    console.log(`PASS wiring contract: ${label} -> workflow accepted`);
  }

  // ---- input contract: saare required inputs validation ----
  // Har case me: koi Photoshop document access, colour data read, engine call
  // ya dataset save NAHI hona chahiye (validation pehle hoti hai).
  for (const [label, args, pattern] of [
    ["missing imageName", ["", imageFolder, { faces: [] }, inside, { h: 20, s: 40, l: 70 }], /imageName/],
    ["blank imageName", ["   ", imageFolder, { faces: [] }, inside, { h: 20, s: 40, l: 70 }], /imageName/],
    ["missing imageFolder", [testImageName, null, { faces: [] }, inside, { h: 20, s: 40, l: 70 }], /imageFolder/],
    ["missing faceData", [testImageName, imageFolder, null, inside, { h: 20, s: 40, l: 70 }], /Face data/],
    ["malformed faces", [testImageName, imageFolder, { faces: {} }, inside, { h: 20, s: 40, l: 70 }], /faces/],
    ["missing standardFace", [testImageName, imageFolder, { faces: [] }, inside, undefined], /standardFace/],
    ["incomplete standardFace", [testImageName, imageFolder, { faces: [] }, inside, { h: 20, s: 40 }], /standardFace/],
    ["null standardFace", [testImageName, imageFolder, { faces: [] }, inside, null], /standardFace/],
    ["legacy ratio skinConfig", [testImageName, imageFolder, { faces: [] }, { SKIN_RG_MIN: 1 }, { h: 20, s: 40, l: 70 }], /skinConfig/],
    ["missing skinConfig", [testImageName, imageFolder, { faces: [] }, undefined, { h: 20, s: 40, l: 70 }], /skinConfig/],
    ["inverted skinConfig range", [testImageName, imageFolder, { faces: [] }, { ...inside, hue: { min: 40, max: 10 } }, { h: 20, s: 40, l: 70 }], /skinConfig/]
  ]) {
    const h = harness();

    await assert.rejects(h.run(...args), pattern, `${label} reject hona chahiye`);

    assert.deepEqual(
      h.stats(),
      { reads: 0, engineCalls: 0, docReads: 0 },
      `${label}: validation se pehle koi Photoshop/image operation nahi hona chahiye`
    );
    assert.equal(h.calls.length, 0, `${label}: koi curve apply nahi hona chahiye`);
    assert.equal(h.saves.length, 0, `${label}: dataset save nahi hona chahiye`);

    console.log(`PASS validation before Photoshop: ${label}`);
  }

  // ---- fresh colour data: read AFTER light correction, no stale data ----
  const freshReads = source.match(/await readImageColourData\(\)/g) || [];

  assert.equal(freshReads.length, 2, "colour data do baar fresh read hona chahiye (pre + post)");
  assert.match(
    source,
    /const colourData =\s*\n\s*await readImageColourData\(\);/,
    "pre-correction colour data readImageColourData() se hi aana chahiye"
  );
  assert.doesNotMatch(
    source,
    /readImageColourData\([^)]/,
    "readImageColourData() ko koi argument (stale data) pass nahi hona chahiye"
  );
  assert.ok(
    source.indexOf("await readImageColourData()") > source.indexOf("validateColourCorrectionInputs({"),
    "colour data validation ke BAAD read hona chahiye"
  );
  assert.ok(
    source.indexOf("validateColourCorrectionInputs({") < source.indexOf("app.activeDocument"),
    "validation Photoshop document access se PEHLE honi chahiye"
  );

  const appSource = fs.readFileSync(path.join(root, "src/App.jsx"), "utf8");

  assert.ok(
    appSource.indexOf("runLightCorrectionWorkflow(") < appSource.indexOf("runColourCorrectionWorkflow("),
    "light correction colour correction se pehle chalna chahiye"
  );

  console.log("PASS fresh colour data: post-light-correction read, validation first");

  console.log("PASS input validation and public API");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
