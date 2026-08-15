/*
    ORGANIC WAVEFORM — POSITION Y ONLY
    After Effects JSX
    Selecione os layers e execute o script.
*/
(function organicWaveformPositionY() {
    app.beginUndoGroup("Organic Waveform - Position Y");

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Abra uma composição e selecione os layers.");
        app.endUndoGroup();
        return;
    }

    var layers = comp.selectedLayers;
    if (layers.length === 0) {
        alert("Selecione os layers que formam o waveform.");
        app.endUndoGroup();
        return;
    }

    var positionExpression =
        "// ORGANIC WAVEFORM - POSITION Y\n" +
        "amp = 55;\n" +
        "speed = 0.65;\n" +
        "smoothness = 0.18;\n" +
        "phase = index * smoothness;\n" +
        "n1 = noise(time * speed + phase);\n" +
        "n2 = noise(time * speed * 0.37 + phase * 0.6 + 100);\n" +
        "wave = n1 * 0.75 + n2 * 0.25;\n" +
        "[value[0], value[1] + wave * amp];";

    var applied = 0;
    for (var i = 0; i < layers.length; i++) {
        try {
            var transform = layers[i].property("ADBE Transform Group");
            if (!transform) continue;
            var position = transform.property("ADBE Position");
            if (position && position.canSetExpression) {
                position.expression = positionExpression;
                applied++;
            }
        } catch (err) {}
    }

    app.endUndoGroup();
    alert("Organic Waveform — Position Y aplicado!\n\nLayers processados: " + applied);
})();
