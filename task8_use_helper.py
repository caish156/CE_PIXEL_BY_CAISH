import os

path = "d:/Users/Documents/Adobe/Plugin/CE_1.0.0/src/panels/correctionPanel.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Import the new helper at the top (after other imports)
old_import_section = """import {
    get as getSettings,
    update as updateSettings,
    subscribe as subscribeSettings
} from "../utils/settingsStore.js";"""

new_import_section = """import {
    get as getSettings,
    update as updateSettings,
    subscribe as subscribeSettings
} from "../utils/settingsStore.js";

import {
    hslToRgb,
    getSkinHslSamplePoints
} from "../utils/skinToneRange.js";"""

content = content.replace(old_import_section, new_import_section)

# Add console.log after skinHslRange is defined
old_log = """console.log("SKIN HSL RANGE:", JSON.stringify(skinHslRange, null, 2));"""

new_log = """console.log("SKIN HSL RANGE:", JSON.stringify(skinHslRange, null, 2));

const skinHslSamplePoints = getSkinHslSamplePoints(skinHslRange);
console.log("SKIN HSL SAMPLE POINTS:", skinHslSamplePoints.map(p => ({
    hsl: `${p.h}, ${p.s}, ${p.l}`,
    rgb: `${p.r}, ${p.g}, ${p.b}`
})));"""

content = content.replace(old_log, new_log)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Task 2: Helper integrated into correctionPanel.jsx")

