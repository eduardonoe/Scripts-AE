/*
    QUEBRAR SHAPES / CONVERTER PSD EM SHAPES — SEPARAR EM CAMADAS
    After Effects JSX
    Version: 2.0.0

    Para cada camada selecionada:
    - Se já for Shape Layer: separa cada grupo (objeto) do Contents em
      uma camada de shape individual.
    - Se for camada de footage raster (ex.: layer de PSD): usa
      layer.autoTrace() para gerar um Shape Layer real (não máscara) a
      partir do alfa da imagem, e separa o resultado em camadas.
    - Se a camada tiver vetor nativo (PSD/AI importado como vetor):
      tenta primeiro "Create Shapes from Vector Layer" (mais fiel ao
      desenho original) antes de cair no autoTrace.

    Selecione as camadas e execute o script.

    Changelog:
    - 2.0.0: troca a estratégia principal para layer.autoTrace()
      (gera Shape Layer de verdade, não máscara), já que a maioria das
      camadas de PSD é raster e não carrega vetor nativo no AE.
      "Create Shapes from Vector Layer" vira só a primeira tentativa,
      usada apenas quando a camada realmente tem dado vetorial.
    - 1.0.1: tenta múltiplos nomes/IDs de comando para "Create Shapes
      from Vector Layer" e mostra debug detalhado quando a conversão falha.
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
        alert("Selecione as camadas (shape layers e/ou camadas de PSD).");
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

    // --- tentativa 1: comando nativo, só funciona com vetor nativo real ---
    function tryCreateShapesFromVector(layer) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        layer.selected = true;

        var nomesComando = [
            "Create Shapes from Vector Layer",
            "Criar Formas a Partir de Camada de Vetor",
            "Criar Formas a Partir da Camada Vetorial"
        ];
        var cmdId = 0;
        for (var n = 0; n < nomesComando.length; n++) {
            cmdId = app.findMenuCommandId(nomesComando[n]);
            if (cmdId) break;
        }
        if (!cmdId) return null;

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

    // --- tentativa 2: autoTrace() — funciona em qualquer raster, gera Shape Layer real ---
    function tryAutoTrace(layer, dbg) {
        try {
            var traced = layer.autoTrace();
            if (traced instanceof ShapeLayer) return traced;
            dbg.autoTraceRetornouOutraCoisa = true;
        } catch (e) {
            dbg.erroAutoTrace = e.toString();
        }
        return null;
    }

    var camadasQuebradas = 0;
    var gruposSeparados = 0;
    var psdConvertidos = 0;
    var falhasConversao = 0;
    var primeiroDebug = null;

    for (var i = 0; i < targetLayers.length; i++) {
        var layer = targetLayers[i];

        if (layer instanceof ShapeLayer) {
            var qtd = splitShapeLayer(layer);
            if (qtd > 1) {
                camadasQuebradas++;
                gruposSeparados += qtd;
            }
        } else if (layer instanceof AVLayer && layer.source) {
            var novoShapeLayer = tryCreateShapesFromVector(layer);
            var dbg = {};
            if (!novoShapeLayer) novoShapeLayer = tryAutoTrace(layer, dbg);

            if (novoShapeLayer) {
                psdConvertidos++;
                var qtd2 = splitShapeLayer(novoShapeLayer);
                if (qtd2 > 1) gruposSeparados += qtd2;
            } else {
                falhasConversao++;
                if (!primeiroDebug) primeiroDebug = dbg;
            }
        }
    }

    app.endUndoGroup();

    var msg =
        "Concluído!\n\n" +
        "Shape layers quebrados: " + camadasQuebradas + "\n" +
        "Camadas PSD convertidas em shape: " + psdConvertidos + "\n" +
        "Objetos separados em camadas: " + gruposSeparados;

    if (falhasConversao > 0) {
        msg += "\n\nFalhas na conversão: " + falhasConversao;
        if (primeiroDebug && primeiroDebug.erroAutoTrace) {
            msg += "\nErro autoTrace: " + primeiroDebug.erroAutoTrace;
        }
    }

    alert(msg);
})();
