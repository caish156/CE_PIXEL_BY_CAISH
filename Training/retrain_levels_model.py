"""
retrain_levels_model.py
------------------------
Workflow:
  1. lightcorrection.json  -- code-generated: array of records, each with
       { "image": "<filename>", "input": {histogram, histogram_zones,
         avg_brightness, total_pixels, faces}, "predictedLevels": {...} }
       (predictedLevels is ignored for training -- it's just the old model's
        guess, not ground truth)

  2. manual_levels.json    -- YOUR manual ground truth, matched by filename:
       [
         {"image": "DSC_0338.JPG", "shadow": 8.2, "midpoint": 1.25, "highlight": 232.0},
         ...
       ]
       (a dict keyed by filename also works, see load_manual_levels())

  3. Script matches the two files by "image" filename, extracts the same 12
     features predictLevels.js uses, retrains black/white/gamma with Ridge
     regression, and writes output.json with the new intercept/coef values
     -- ready to paste into predictLevels.js's MODEL object.

Every time you have a bigger/updated dataset: replace lightcorrection.json
and manual_levels.json in this folder with new exports and re-run.

USAGE:
    pip install numpy scikit-learn
    python retrain_levels_model.py
"""

import json
import numpy as np
from sklearn.linear_model import RidgeCV
from sklearn.model_selection import train_test_split

LIGHTCORRECTION_FILE = "lightcorrection.json"
MANUAL_FILE = "manual_levels.json"
OUTPUT_FILE = "output.json"

# Your naming (shadow/midpoint/highlight) <-> JS MODEL naming (black/gamma/white)
KEY_MAP = {"black": "shadow", "gamma": "midpoint", "white": "highlight"}


# ---------------------------------------------------------------------------
# Feature extraction -- must stay IDENTICAL to predictLevels.js
# ---------------------------------------------------------------------------

def percentile_from_hist(histogram, p):
    total = sum(histogram)
    if total == 0:
        return 0
    running = 0
    target = p * total
    for i in range(256):
        prev = running
        running += histogram[i]
        if running >= target:
            span = running - prev
            frac = (target - prev) / span if span > 0 else 0
            val = i - 1 + frac
            return val if val >= 0 else 0
    return 255


def extract_features(before):
    histogram = before["histogram"]
    zones = before["histogram_zones"]
    avg_brightness = before["avg_brightness"]
    total_pixels = before["total_pixels"]
    faces = before.get("faces", [])

    has_face = 1.0 if len(faces) > 0 else 0.0
    face_lum = (
        sum(f["luminance"] for f in faces) / len(faces)
        if faces else avg_brightness
    )

    return [
        avg_brightness,
        face_lum,
        has_face,
        zones["dark_0_50"] / total_pixels,
        zones["mid_51_150"] / total_pixels,
        zones["bright_151_200"] / total_pixels,
        zones["highlight_201_255"] / total_pixels,
        percentile_from_hist(histogram, 0.01),
        percentile_from_hist(histogram, 0.05),
        percentile_from_hist(histogram, 0.50),
        percentile_from_hist(histogram, 0.95),
        percentile_from_hist(histogram, 0.99),
    ]


# ---------------------------------------------------------------------------
# Loading + matching the two files by filename
# ---------------------------------------------------------------------------

def load_manual_levels(path):
    """Returns dict: filename -> {"shadow":.., "midpoint":.., "highlight":..}"""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        return data  # already {filename: {...}}

    result = {}
    for entry in data:  # list format: [{"image": "...", "shadow":.., ...}, ...]
        result[entry["image"]] = entry
    return result


def load_dataset(light_path, manual_path):
    with open(light_path, "r", encoding="utf-8") as f:
        light_data = json.load(f)

    manual = load_manual_levels(manual_path)

    X, y_black, y_white, y_gamma = [], [], [], []
    matched, skipped_no_manual, skipped_bad = 0, 0, 0

    for record in light_data:
        image = record["image"]
        manual_entry = manual.get(image)
        if manual_entry is None:
            skipped_no_manual += 1
            continue

        try:
            feats = extract_features(record["input"])
            black_val = manual_entry[KEY_MAP["black"]]
            white_val = manual_entry[KEY_MAP["white"]]
            gamma_val = manual_entry[KEY_MAP["gamma"]]
        except (KeyError, TypeError, ZeroDivisionError) as e:
            skipped_bad += 1
            print(f"  [skip] {image}: {e}")
            continue

        X.append(feats)
        y_black.append(black_val)
        y_white.append(white_val)
        y_gamma.append(gamma_val)
        matched += 1

    print(f"Matched {matched} images | no manual entry: {skipped_no_manual} "
          f"| bad/incomplete data: {skipped_bad}\n")

    return np.array(X), np.array(y_black), np.array(y_white), np.array(y_gamma)


# ---------------------------------------------------------------------------
# Fit + report
# ---------------------------------------------------------------------------

def fit_and_report(X, y, name):
    if len(X) < 10:
        raise ValueError(f"Not enough matched samples ({len(X)}) to train '{name}'")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    alphas = np.logspace(-3, 3, 50)
    model = RidgeCV(alphas=alphas)
    model.fit(X_train, y_train)

    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)

    print(f"=== {name} ===")
    print(f"chosen alpha    : {model.alpha_:.4f}")
    print(f"train R^2 / MAE : {model.score(X_train, y_train):.4f} / "
          f"{np.mean(np.abs(train_pred - y_train)):.4f}")
    print(f"test  R^2 / MAE : {model.score(X_test, y_test):.4f} / "
          f"{np.mean(np.abs(test_pred - y_test)):.4f}")
    print()

    # Refit on all matched data for the final coefficients you'll ship
    final_model = RidgeCV(alphas=alphas)
    final_model.fit(X, y)
    return final_model


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    X, y_black, y_white, y_gamma = load_dataset(LIGHTCORRECTION_FILE, MANUAL_FILE)
    print(f"Feature matrix: {X.shape}\n")

    black_model = fit_and_report(X, y_black, "black")
    white_model = fit_and_report(X, y_white, "white")
    gamma_model = fit_and_report(X, y_gamma, "gamma")

    output = {
        "black": {
            "intercept": round(float(black_model.intercept_), 6),
            "coef": [round(float(c), 6) for c in black_model.coef_],
        },
        "white": {
            "intercept": round(float(white_model.intercept_), 6),
            "coef": [round(float(c), 6) for c in white_model.coef_],
        },
        "gamma": {
            "intercept": round(float(gamma_model.intercept_), 6),
            "coef": [round(float(c), 6) for c in gamma_model.coef_],
        },
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote new coefficients to {OUTPUT_FILE}")
