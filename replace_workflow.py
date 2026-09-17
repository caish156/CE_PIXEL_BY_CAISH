import re

path = 'd:/Users/Documents/Adobe/Plugin/CE_1.0.0/src/workflow/colourCorrectionWorkflow.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find section 5 start
idx5 = content.find('  // ==========================================================\n  // 5. COLOUR CAST')
if idx5 == -1:
    print("ERROR: Could not find section 5 start")
    exit(1)

# Find section 6 start  
idx6 = content.find('  // ==========================================================\n  // 6. PREDICT')
if idx6 == -1:
    print("ERROR: Could not find section 6 start")
    exit(1)

# New section 5 text
new_section5 = '''  // ==========================================================
  // 5. COLOUR CORRECTION — ENGINE-DRIVEN (FACE-ANCHORED)
  // ==========================================================
  //
  // Colorcastengine.js is now the ONLY source of truth for colour
  // correction decisions. The workflow delegates entirely to
  // generateColorCurves(), which:
  //
  //   1. Weighted-average face RGB -> HSL
  //   2. Classifies H/S against skinConfig target range
  //   3. Uses standardFace.l to decide light below/at/above standard
  //   4. Builds target HSL (nearest in-range H/S, preserves L)
  //   5. Computes face-anchored R/G/B ratios (target / existing)
  //   6. Blends with capped, direction-agreeing grey-world nudge
  //   7. Softens by STRENGTH (0.65 default)
  //   8. Builds 5-point tonal curves centered on face luminance
  //
  // Returns: { red, green, blue } — each [5 points] in
  // { input, output } object format.
  //
  // The workflow's job: convert to [x,y] arrays and apply.
  //

  console.log(
    "🎨 Calculating colour correction via ColourCastEngine..."
  );

  // Log the skin config being passed to the engine
  if (skinConfig) {
    console.log("SKIN CONFIG (HSL ranges):");
    console.log(JSON.stringify(skinConfig, null, 2));
  }

  console.log(
    "📐 Standard face reference (HSL):",
    JSON.stringify(standardFace)
  );

  // ----------------------------------------------------------
  // Call generateColorCurves — the single source of truth
  // ----------------------------------------------------------
  const engineResult = generateColorCurves(
    data,
    skinConfig,
    standardFace
  );

  console.log(
    "🎨 COLOUR CAST ENGINE RESULT:"
  );
  console.log("  Red curve:");
  engineResult.red.forEach(p => console.log(`    input:${p.input} -> output:${p.output}`));
  console.log("  Green curve:");
  engineResult.green.forEach(p => console.log(`    input:${p.input} -> output:${p.output}`));
  console.log("  Blue curve:");
  engineResult.blue.forEach(p => console.log(`    input:${p.input} -> output:${p.output}`));
'''

# Replace
new_content = content[:idx5] + new_section5 + content[idx6:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"Replaced section 5 ({idx6-idx5} chars -> {len(new_section5)} chars)")
print("Done!")

