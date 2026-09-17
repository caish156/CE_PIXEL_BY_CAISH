// ============================================================
// utils/presetStore.js
//
// PRESET MANAGEMENT
//
// User apne settings snapshots (brightness + skin tone + standard face) ko
// named presets ki tarah plugin me save kar sakta hai.
// localStorage pe persist hota hai.
//
// Builtin "Default" preset hamesha available rehta hai aur
// delete nahi ho sakta.
//
// PRESET SHAPE:
//   {
//     name: "Default",
//     builtin: true,
//     settings: {
//       brightnessTarget: 146,
//       skinTone: { hue: { min, max }, saturation: { min, max }, lightness: { min, max } },
//       standardFace: { h, s, l }
//     }
//   }
//
// NOTE: purane presets jinme standardFace nahi hai wo tootte nahi —
// normalizeSettings() unhe default standardFace par fallback karta hai.
// ============================================================

const STORAGE_KEY = "ce_presets_v1";

// standardFace ka SINGLE default definition settingsStore me hai.
// Yahan duplicate literal nahi rakhte — wahi ek source reuse karte hain.
const { DEFAULTS: SETTINGS_DEFAULTS } = require("./settingsStore.js");

const DEFAULT_PRESET_NAME = "Default";

const DEFAULT_PRESET_SETTINGS = {
  brightnessTarget: 146,
  // Using range format: { min, max } for each channel
  skinTone: {
    hue: { min: 22, max: 28 },
    saturation: { min: 17, max: 23 },
    lightness: { min: 67, max: 73 },
  },
  // Standard / reference face (HSL) — skinTone aur brightnessTarget ke saath
  // preset me travel karta hai.
  // DEFAULT YAHAN DEFINE NAHI HOTA: settingsStore.DEFAULTS.standardFace hi
  // single source of truth hai (duplicate literal nahi).
  standardFace: SETTINGS_DEFAULTS.standardFace,
};

// skin tone channels ki valid ranges (UI ke slider ranges)
const SKIN_RANGES = {
  hue: [10, 50],
  saturation: [0, 40],
  lightness: [60, 90],
};

// standardFace channels ki valid ranges (engine domain: h 0-360, s/l 0-100)
const STANDARD_FACE_RANGES = {
  h: [0, 360],
  s: [0, 100],
  l: [0, 100],
};

// brightness target ki valid range (internal)
const BRIGHTNESS_RANGE = [131, 161];

const listeners = new Set();

let state = null;

function clampRange(value, range) {
  const v = Number(value);
  if (!Number.isFinite(v)) return range[0];
  return Math.min(range[1], Math.max(range[0], Math.round(v)));
}

// Single-value clamp: invalid/missing value ko fallback (default) rakhta hai,
// range[0] par nahi — isse purane presets default standardFace paate hain.
function clampFaceValue(value, range, fallback) {
  const v = Number(value);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(range[1], Math.max(range[0], Math.round(v)));
}

/**
 * standardFace ko normalized { h, s, l } me convert karta hai.
 * Purana/legacy preset jisme standardFace nahi hai -> default par fallback
 * (kabhi throw nahi karta).
 */
function normalizeStandardFace(value, fallback) {
  const src = value && typeof value === 'object' ? value : {};
  const base = fallback || DEFAULT_PRESET_SETTINGS.standardFace;

  return {
    h: clampFaceValue(src.h, STANDARD_FACE_RANGES.h, base.h),
    s: clampFaceValue(src.s, STANDARD_FACE_RANGES.s, base.s),
    l: clampFaceValue(src.l, STANDARD_FACE_RANGES.l, base.l),
  };
}

/** Settings ko valid/normalized shape me convert karta hai. */
function normalizeSettings(settings) {
  const s = settings || {};

  const tone = s.skinTone || {};

  // Helper to normalize a range value (handles both old single value and new range format)
  const normalizeChannel = (channel, defaultRange) => {
    const val = tone[channel];
    // If it's already a range object, validate and return as-is
    if (val && typeof val === 'object' && 'min' in val && 'max' in val) {
      const min = clampRange(val.min, SKIN_RANGES[channel]);
      const max = clampRange(val.max, SKIN_RANGES[channel]);
      // Ensure min < max
      if (min >= max) {
        return { min: Math.max(SKIN_RANGES[channel][0], max - 1), max };
      }
      return { min, max };
    }
    // If it's a single number (old format), convert to range
    if (typeof val === 'number') {
      const clamped = clampRange(val, SKIN_RANGES[channel]);
      return { min: clamped - 3, max: clamped + 3 };
    }
    // Default range
    return defaultRange;
  };

  return {
    brightnessTarget: clampRange(
      s.brightnessTarget !== undefined
        ? s.brightnessTarget
        : DEFAULT_PRESET_SETTINGS.brightnessTarget,
      BRIGHTNESS_RANGE
    ),

    skinTone: {
      hue: normalizeChannel('hue', DEFAULT_PRESET_SETTINGS.skinTone.hue),
      saturation: normalizeChannel('saturation', DEFAULT_PRESET_SETTINGS.skinTone.saturation),
      lightness: normalizeChannel('lightness', DEFAULT_PRESET_SETTINGS.skinTone.lightness),
    },

    // standardFace preset ka part hai — skinTone/brightnessTarget ke saath
    standardFace: normalizeStandardFace(s.standardFace),
  };
}

function freshState() {
  return {
    active: DEFAULT_PRESET_NAME,
    presets: [
      {
        name: DEFAULT_PRESET_NAME,
        builtin: true,
        settings: normalizeSettings(DEFAULT_PRESET_SETTINGS),
      },
    ],
  };
}

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);

      const loaded = {
        active:
          typeof parsed.active === "string"
            ? parsed.active
            : DEFAULT_PRESET_NAME,

        presets: Array.isArray(parsed.presets) ? parsed.presets : [],
      };

      // builtin Default hamesha ensure karo
      if (!loaded.presets.some((p) => p && p.name === DEFAULT_PRESET_NAME)) {
        loaded.presets.unshift({
          name: DEFAULT_PRESET_NAME,
          builtin: true,
          settings: normalizeSettings(DEFAULT_PRESET_SETTINGS),
        });
      }

      // har preset ki settings normalize karo
      loaded.presets = loaded.presets
        .filter((p) => p && typeof p.name === "string")
        .map((p) => ({
          name: p.name,
          builtin: p.name === DEFAULT_PRESET_NAME,
          settings: normalizeSettings(p.settings),
        }));

      // active valid hai?
      if (!loaded.presets.some((p) => p.name === loaded.active)) {
        loaded.active = DEFAULT_PRESET_NAME;
      }

      return loaded;
    }
  } catch (error) {
    console.warn("⚠️ presetStore: load failed, defaults use ho rahe hain", error);
  }

  return freshState();
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("⚠️ presetStore: persist failed (session only)", error);
  }
}

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn("⚠️ presetStore listener failed", error);
    }
  });
}

function ensureLoaded() {
  if (!state) {
    state = load();
  }
}

/** Saare presets ki copy return karta hai. */
function list() {
  ensureLoaded();

  return JSON.parse(JSON.stringify(state.presets));
}

/** Abhi kaunsa preset active hai. */
function getActive() {
  ensureLoaded();

  return state.active;
}

/** Naam se preset (copy) — na mile to null. */
function getPreset(name) {
  ensureLoaded();

  const found = state.presets.find((p) => p.name === name);

  return found ? JSON.parse(JSON.stringify(found)) : null;
}

/** Preset select karo — preset settings return karta hai (ya null). */
function setActive(name) {
  ensureLoaded();

  const preset = getPreset(name);

  if (!preset) {
    return null;
  }

  state.active = preset.name;

  persist();

  notify();

  return preset;
}

/**
 * Preset save/update karo.
 * name khali ho to currently active preset overwrite hota hai.
 * Returns: preset name jis me save hua.
 */
function save(name, settings) {
  ensureLoaded();

  const presetName =
    typeof name === "string" && name.trim()
      ? name.trim()
      : state.active;

  const clean = normalizeSettings(settings);

  const existing = state.presets.find((p) => p.name === presetName);

  if (existing) {
    existing.settings = clean;
  } else {
    state.presets.push({
      name: presetName,
      builtin: false,
      settings: clean,
    });
  }

  state.active = presetName;

  persist();

  notify();

  return presetName;
}

/**
 * Preset delete karo. Builtin "Default" delete nahi hota.
 * Returns: true agar delete hua.
 */
function remove(name) {
  ensureLoaded();

  const preset = getPreset(name);

  if (!preset || preset.builtin) {
    return false;
  }

  state.presets = state.presets.filter((p) => p.name !== name);

  if (state.active === name) {
    state.active = DEFAULT_PRESET_NAME;
  }

  persist();

  notify();

  return true;
}

/** Preset changes ki notification ke liye. Returns unsubscribe. */
function subscribe(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

module.exports = {
  list,
  save,
  remove,
  setActive,
  getActive,
  getPreset,
  subscribe,
  normalizeSettings,
  normalizeStandardFace,
  DEFAULT_PRESET_NAME,
  DEFAULT_PRESET_SETTINGS,
  SKIN_RANGES,
  STANDARD_FACE_RANGES,
};


