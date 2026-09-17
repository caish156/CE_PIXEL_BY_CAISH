from pathlib import Path

path = Path('d:/Users/Documents/Adobe/Plugin/CE_1.0.0/src/workFlow/colourCorrectionWorkflow.js')
text = path.read_text(encoding='utf-8')

def replace_section(start, end, replacement):
    global text
    a = text.index(start)
    b = text.index(end, a)
    text = text[:a] + replacement + text[b:]

replace_section('// CURRENT IMAGE', '// ONLY THIS WORKFLOW', '''// Collect fresh colour data + existing face samples
// -> generateColorCurves(data, skinConfig, standardFace)
// -> convert engine points for Photoshop -> apply RGB curves
// -> collect post-correction data -> save dataset
//
''')
replace_section('const {\n   app,', 'const {\n  readImageColourData', '''const { app } = window.require("photoshop");
const { generateColorCurves } = require("../utils/Colorcastengine");

''')
replace_section('const {\n  applyRedCurves,', '// ============================================================\n// MAIN WORKFLOW', '''const {
  applyRedCurves,
  applyGreenCurves,
  applyBlueCurves,
  convertCurveObjectsToPoints
} = require("../batchplays/curves");

/**
 * skinConfig: HSL ranges { hue, saturation, lightness }, each { min, max }.
 * standardFace: caller-provided reference HSL { h, s, l }; no default is inferred.
 */
''')
replace_section('  if (!standardFace)', '  console.log(\n    "🎯', '''  if (!standardFace || !["h", "s", "l"].every(key => Number.isFinite(standardFace[key]))) {
    throw new Error("standardFace must be a caller-provided HSL reference { h, s, l }");
  }

  if (!skinConfig || !["hue", "saturation", "lightness"].every(key => {
    const range = skinConfig[key];
    return range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max;
  })) {
    throw new Error("skinConfig must contain HSL ranges { hue, saturation, lightness }, each { min, max }");
  }

''')
replace_section('  // ==========================================================\n  // 5.', '  // ==========================================================\n  // 8.', '''  // All correction decisions belong to the engine. Keep its object points unchanged.
  const engineResult = generateColorCurves(data, skinConfig, standardFace);
  console.log("COLOUR CURVES FROM ENGINE:", JSON.stringify(engineResult));

  // Only skip exact identity curves; no thresholds or additional correction.
  const appliedChannels = {};
  const channelAppliers = {
    red: applyRedCurves,
    green: applyGreenCurves,
    blue: applyBlueCurves
  };

  for (const channel of Object.keys(channelAppliers)) {
    const curve = engineResult[channel];
    appliedChannels[channel] = curve.some(point => point.input !== point.output);
    if (appliedChannels[channel]) {
      await channelAppliers[channel](convertCurveObjectsToPoints(curve));
    }
  }

''')
text = text.replace('Grey-world + warm tone apply hone ke BAAD document se', 'Engine curves apply hone ke BAAD document se')
text = text.replace('(same data jo colourCast ko diya gaya tha)', '(same data passed to generateColorCurves)')
text = text.replace('cast %, factors, curves jo apply hue', 'engine curves and applied channels')
text = text.replace('      faces: data.faces\n    },', '''      faces: data.faces
    },
    skinConfig,
    standardFace,
    correction: { curves: engineResult, appliedChannels },
    postCorrection: postColourData,''')
replace_section('    // --------------------------------------------------------\n    // STEP 5', '    // --------------------------------------------------------\n    // DATASET JSON', '''    correction: { curves: engineResult, appliedChannels },
    postCorrection: postColourData,

''')
path.write_text(text, encoding='utf-8')
print('Workflow integration completed.')
