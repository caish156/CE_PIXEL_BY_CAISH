/**
 * src/modules/diagnostic.js
 * Processes server payload: Filters Y < 50, sorts Top 3 faces by area.
 */
export function processFaceMetrics(serverPayload) {
    if (!serverPayload || !serverPayload.faces || serverPayload.faces.length === 0) {
        console.warn("[Diagnostic Scan]: No faces detected.");
        return { validFaces: [], avgLuminance: null };
    }

    const validFaces = serverPayload.faces.filter(face => face.luminance_Y >= 50);
    if (validFaces.length === 0) {
        return { validFaces: [], avgLuminance: null };
    }

    validFaces.sort((a, b) => b.area - a.area);
    const top3Faces = validFaces.slice(0, 3);

    const totalY = top3Faces.reduce((sum, face) => sum + face.luminance_Y, 0);
    const avgLuminance = Math.round(totalY / top3Faces.length);

    console.log(`[Diagnostic Scan]: Top 3 Faces Avg Luminance (Y) = ${avgLuminance}`);
    return { validFaces: top3Faces, avgLuminance: avgLuminance };
}