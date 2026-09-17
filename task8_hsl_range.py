import os

path = "d:/Users/Documents/Adobe/Plugin/CE_1.0.0/src/panels/correctionPanel.jsx"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the line after skinTone state definition and add skinHslRange
old_code = """    const [skinEdit, setSkinEdit] = React.useState(true);"""

new_code = """    const [skinEdit, setSkinEdit] = React.useState(true);

    // Task 8: HSL Skin Range object (auto-updates with skinTone state)
    const skinHslRange = {
        hue: {
            min: skinTone.hue.min,
            max: skinTone.hue.max
        },
        saturation: {
            min: skinTone.saturation.min,
            max: skinTone.saturation.max
        },
        lightness: {
            min: skinTone.lightness.min,
            max: skinTone.lightness.max
        }
    };

    console.log("SKIN HSL RANGE:", JSON.stringify(skinHslRange, null, 2));"""

content = content.replace(old_code, new_code)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Task 8: skinHslRange added")

