/*
    QUEBRAR SHAPES / CONVERTER PSD EM SHAPES — SEPARAR EM CAMADAS
    After Effects JSX
    Version: 1.0.0

    Para cada camada selecionada:
    - Se já for Shape Layer: separa cada grupo (objeto) do Contents em
      uma camada de shape individual.
    - Se for camada de footage (ex.: layer de PSD/AI com dado vetorial):
      tenta converter via "Create Shapes from Vector Layer" e, em
      seguida, separa o resultado em camadas individuais também.

    Selecione as camadas e execute o script.
*/
(function quebrarShapesPsdEmCamadas() {
    app.beginUndoGroup("Quebrar Shapes / Converter PSD em Camadas");

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Abra uma composição e selecione os layers.");
        app.endUndoGroup();
        return;
    }

    var targetLayers = comp.selectedLayers;
    if (targetLayers.length === 0) {
        alert("Selecione as camadas (shape layers e/ou camadas de PSD com vetor).");
        app.endUndoGroup();
        return;
    }
    // cópia estática, pois a seleção muda durante o processo
    targetLayers = targetLayers.slice(0);

    // --- separa os grupos do Contents de um shape layer em camadas individuais ---
    function splitShapeLayer(layer) {
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) return 0;

        var n = contents.numProperties;
        if (n <= 1) return 0;

        var names = [];
        for (var i = 1; i <= n; i++) names.push(contents.property(i).name);

        for (var i = n; i >= 2; i--) {
            var dup = layer.duplicate();
            var dupContents = dup.property("ADBE Root Vectors Group");
            for (var j = dupContents.numProperties; j >= 1; j--) {
                if (j !== i) {
                    try { dupContents.property(j).remove(); } catch (e) {}
                }
            }
            dup.name = names[i - 1];
        }

        for (var j = contents.numProperties; j >= 1; j--) {
            if (j !== 1) {
                try { contents.property(j).remove(); } catch (e) {}
            }
        }
        layer.name = names[0];

        return n;
    }

    // --- tenta rodar "Create Shapes from Vector Layer" na camada isolada ---
    function convertToShapes(layer) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        layer.selected = true;

        var cmdId = app.findMenuCommandId("Create Shapes from Vector Layer");
        if (!cmdId) cmdId = 2649; // fallback: ID conhecido do comando em versões que não resolvem pelo nome

        try {
            app.executeCommand(cmdId);
        } catch (e) {
            return null;
        }

        var sel = comp.selectedLayers;
        for (var s = 0; s < sel.length; s++) {
            if (sel[s] instanceof ShapeLayer) return sel[s];
        }
        return null;
    }

    var camadasQuebradas = 0;
    var gruposSeparados = 0;
    var psdConvertidos = 0;
    var falhasConversao = 0;

    for (var i = 0; i < targetLayers.length; i++) {
        var layer = targetLayers[i];

        if (layer instanceof ShapeLayer) {
            var qtd = splitShapeLayer(layer);
            if (qtd > 1) {
                camadasQuebradas++;
                gruposSeparados += qtd;
            }
        } else if (layer instanceof AVLayer && layer.source) {
            var novoShapeLayer = convertToShapes(layer);
            if (novoShapeLayer) {
                psdConvertidos++;
                var qtd2 = splitShapeLayer(novoShapeLayer);
                if (qtd2 > 1) gruposSeparados += qtd2;
            } else {
                falhasConversao++;
            }
        }
    }

    app.endUndoGroup();

    alert(
        "Concluído!\n\n" +
        "Shape layers quebrados: " + camadasQuebradas + "\n" +
        "Camadas PSD convertidas em shape: " + psdConvertidos + "\n" +
        "Objetos separados em camadas: " + gruposSeparados +
        (falhasConversao > 0 ? "\n\nFalhas na conversão PSD → Shape: " + falhasConversao +
            "\n(a camada pode não conter dado vetorial, ou o comando \"Create Shapes from Vector Layer\" não foi encontrado no menu desta versão do AE)" : "")
    );
})();
