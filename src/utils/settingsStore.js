// ============================================================
// utils/settingsStore.js
//
// PERSISTENT PLUGIN SETTINGS
//
// Panel ke sliders/toggles ki values yahan store hoti hain.
// localStorage pe save hota hai -> panel band/reload hone par
// bhi user ki settings yaad rehti hain.
//
// CURRENT SETTINGS:
//   brightnessTarget : 130-160 (default 146) light correction ka target mean
//   (skinTone: aane wale update ke liye)
// ============================================================

const STORAGE_KEY = "ce_correction_settings_v1";

const DEFAULTS = {
  // Light correction ka target mean brightness
  // UI delta scale: -5..+5 (0 = default), internal 131-161, default 146
  brightnessTarget: 146,

  // Skin Tone (Lab) controls — abhi sirf UI/store, engine wiring baad me
  // Using range format: { min, max } for each channel
  skinTone: {
    hue: { min: 22, max: 28 },
    saturation: { min: 17, max: 23 },
    lightness: { min: 67, max: 73 },
  },
};

let cached = null;

const listeners = new Set();

function load() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);
      return Object.assign({}, DEFAULTS, parsed);
    }
  } catch (error) {
    console.warn(
      "⚠️ settingsStore: localStorage read failed, defaults use kar rahe hain",
      error
    );
  }

  return Object.assign({}, DEFAULTS);
}

function persist() {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(cached)
    );
  } catch (error) {
    console.warn(
      "⚠️ settingsStore: localStorage write failed (settings sirf is session ke liye)",
      error
    );
  }
}

/** Current settings ka snapshot (copy) return karta hai. */
function get() {
  if (!cached) {
    cached = load();
  }

  return Object.assign({}, cached);
}

/** Settings update karo (merge) + persist + listeners ko notify. */
function update(partial = {}) {
  if (!cached) {
    cached = load();
  }

  cached = Object.assign({}, cached, partial);

  persist();

  listeners.forEach((listener) => {
    try {
      listener(get());
    } catch (error) {
      console.warn("⚠️ settingsStore listener failed", error);
    }
  });

  return get();
}

/** Panel React state ko settings ke saath sync rakhe ke liye. Returns unsubscribe. */
function subscribe(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

module.exports = {
  get,
  update,
  subscribe,
  DEFAULTS,
};
