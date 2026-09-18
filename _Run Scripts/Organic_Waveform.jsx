/*
    Organic Waveform
    Adobe After Effects JSX

    Selecione os layers desejados e execute em:
    File > Scripts > Run Script File...
*/

(function organicWaveform() {
    app.beginUndoGroup("Organic Waveform");

    try {
        var comp = app.project.activeItem;

        if (!(comp instanceof CompItem)) {
            alert("Abra uma composicao e selecione os layers desejados.");
            return;
        }

        var layers = comp.selectedLayers;

        if (!layers || layers.length === 0) {
            alert("Selecione pelo menos um layer para aplicar o Organic Waveform.");
            return;
        }

        // Ordena pela posicao X no frame atual. O index da timeline nao e usado.
        var orderedLayers = [];
        for (var layerIndex = 0; layerIndex < layers.length; layerIndex++) {
            var layerTransform = layers[layerIndex].property("ADBE Transform Group");
            var layerPosition = layerTransform.property("ADBE Position");
            var currentPosition = layerPosition.valueAtTime(comp.time, false);

            orderedLayers.push({
                layer: layers[layerIndex],
                x: currentPosition[0],
                timelineIndex: layers[layerIndex].index
            });
        }

        orderedLayers.sort(function (a, b) {
            if (a.x === b.x) {
                return a.timelineIndex - b.timelineIndex;
            }
            return a.x - b.x;
        });

        function makePositionExpression(waveOrder) {
            return "// ORGANIC WAVEFORM - POSITION Y / ORDEM X\n" +
                "amp = 230;\n" +
                "speed = 2.9;\n" +
                "smoothness = 0.28;\n" +
                "waveOrder = " + waveOrder + ";\n" +
                "phase = waveOrder * smoothness;\n" +
                "n1 = noise(time * speed + phase);\n" +
                "n2 = noise(time * speed * 0.37 + phase * 0.6 + 100);\n" +
                "n3 = noise(time * speed * 1.7 + waveOrder * 2.73 + 300);\n" +
                "wave = n1 * 0.55 + n2 * 0.20 + n3 * 0.25;\n" +
                "result = value;\n" +
                "result[1] = value[1] + wave * amp;\n" +
                "result;";
        }

        function makeScaleExpression(waveOrder) {
            return "// ORGANIC WAVEFORM - SCALE Y / ORDEM X\n" +
                "amp = 28;\n" +
                "speed = 2.3;\n" +
                "smoothness = 0.28;\n" +
                "waveOrder = " + waveOrder + ";\n" +
                "phase = waveOrder * smoothness;\n" +
                "n1 = noise(time * speed + phase);\n" +
                "n2 = noise(time * speed * 0.37 + phase * 0.6 + 200);\n" +
                "n3 = noise(time * speed * 1.7 + waveOrder * 2.73 + 400);\n" +
                "wave = n1 * 0.55 + n2 * 0.20 + n3 * 0.25;\n" +
                "result = value;\n" +
                "result[1] = value[1] + wave * amp;\n" +
                "result;";
        }

        var applied = 0;
        var skipped = 0;

        for (var i = 0; i < orderedLayers.length; i++) {
            try {
                var transform = orderedLayers[i].layer.property("ADBE Transform Group");
                var position = transform.property("ADBE Position");
                var scale = transform.property("ADBE Scale");

                if (position && scale && position.canSetExpression && scale.canSetExpression) {
                    position.expression = makePositionExpression(i);
                    position.expressionEnabled = true;
                    scale.expression = makeScaleExpression(i);
                    scale.expressionEnabled = true;
                    applied++;
                } else {
                    skipped++;
                }
            } catch (layerError) {
                skipped++;
            }
        }

        var message = "Organic Waveform aplicado a " + applied + " layer(s)." +
            "\n\nOrdem da onda: esquerda para direita, pela posicao X atual.";
        if (skipped > 0) {
            message += "\n\n" + skipped + " layer(s) nao puderam ser alterados.";
        }
        alert(message);
    } catch (error) {
        alert("Nao foi possivel aplicar o Organic Waveform.\n\n" + error.toString());
    } finally {
        app.endUndoGroup();
    }
}());
