/*
    Hold Time Remap From CTI.jsx

    Comportamento:
    - O layer reproduz normalmente até a posição atual da agulha (CTI).
    - No CTI é criado um keyframe de Time Remap preservando o frame daquele instante.
    - A partir desse keyframe, o Time Remap fica em HOLD.
    - A interpolação de entrada permanece LINEAR, portanto o vídeo não congela antes da agulha.
    - Execução silenciosa, sem popups.
*/

(function holdTimeRemapFromCTI() {
    app.beginUndoGroup("Hold Time Remap From CTI");

    try {
        var comp = app.project.activeItem;

        if (!(comp instanceof CompItem)) {
            return;
        }

        var layers = comp.selectedLayers;
        if (!layers || layers.length === 0) {
            return;
        }

        var t = comp.time;

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];

            try {
                if (!(layer instanceof AVLayer) || !layer.canSetTimeRemapEnabled) {
                    continue;
                }

                if (!layer.timeRemapEnabled) {
                    layer.timeRemapEnabled = true;
                }

                var tr = layer.property("ADBE Time Remapping");
                if (!tr) {
                    continue;
                }

                // Guarda o frame que está sendo exibido exatamente no CTI.
                var remapValue = tr.valueAtTime(t, false);

                // Verifica se já existe um keyframe praticamente no mesmo instante.
                var keyIndex = 0;
                var epsilon = comp.frameDuration / 100.0;

                for (var k = 1; k <= tr.numKeys; k++) {
                    if (Math.abs(tr.keyTime(k) - t) <= epsilon) {
                        keyIndex = k;
                        break;
                    }
                }

                // Cria o keyframe no CTI, se necessário.
                if (keyIndex === 0) {
                    keyIndex = tr.addKey(t);
                }

                // Garante que o keyframe representa exatamente o frame visto no CTI.
                tr.setValueAtKey(keyIndex, remapValue);

                // IMPORTANTE:
                // Entrada LINEAR = reproduz normalmente ATÉ a agulha.
                // Saída HOLD   = congela DA AGULHA EM DIANTE.
                tr.setInterpolationTypeAtKey(
                    keyIndex,
                    KeyframeInterpolationType.LINEAR,
                    KeyframeInterpolationType.HOLD
                );

            } catch (layerErr) {
                // Ignora silenciosamente layers incompatíveis.
            }
        }

    } finally {
        app.endUndoGroup();
    }
})();
