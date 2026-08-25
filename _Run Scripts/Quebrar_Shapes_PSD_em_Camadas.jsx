/*
    QUEBRAR SHAPES / CONVERTER PSD EM SHAPES — SEPARAR EM CAMADAS
    After Effects JSX
    Version: 1.0.1

    Para cada camada selecionada:
    - Se já for Shape Layer: separa cada grupo (objeto) do Contents em
      uma camada de shape individual.
    - Se for camada de footage (ex.: layer de PSD/AI com dado vetorial):
      tenta converter via "Create Shapes from Vector Layer" e, em
      seguida, separa o resultado em camadas individuais também.

    Selecione as camadas e execute o script.

    Changelog:
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

    // IDs conhecidos do comando "Create Shapes from Vector Layer" em diferentes
    // versões/idiomas do After Effects (o findMenuCommandId por nome nem sempre resolve).
    var FALLBACK_CMD_IDS = [2649, 2665, 3628];

    // --- tenta rodar "Create Shapes from Vector Layer" na camada isolada ---
    function convertToShapes(layer, dbg) {
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
        dbg.foundByName = !!cmdId;

        var idsParaTentar = cmdId ? [cmdId] : FALLBACK_CMD_IDS;
        dbg.idsTentados = idsParaTentar.join(",");

        for (var k = 0; k < idsParaTentar.length; k++) {
            try {
                app.executeCommand(idsParaTentar[k]);
            } catch (e) {
                dbg.erro = e.toString();
                continue;
            }
            var sel = comp.selectedLayers;
            dbg.selApos = sel.length;
            for (var s = 0; s < sel.length; s++) {
                if (sel[s] instanceof ShapeLayer) {
                    dbg.cmdIdUsado = idsParaTentar[k];
                    return sel[s];
                }
            }
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
            var dbg = {};
            var novoShapeLayer = convertToShapes(layer, dbg);
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
        msg += "\n\nFalhas na conversão PSD → Shape: " + falhasConversao +
            "\n\n[debug 1ª falha]" +
            "\nComando achado pelo nome: " + (primeiroDebug.foundByName ? "sim" : "não") +
            "\nIDs tentados: " + primeiroDebug.idsTentados +
            "\nID usado com sucesso: " + (primeiroDebug.cmdIdUsado || "nenhum") +
            "\nCamadas selecionadas após comando: " + (primeiroDebug.selApos !== undefined ? primeiroDebug.selApos : "n/a") +
            (primeiroDebug.erro ? "\nErro: " + primeiroDebug.erro : "");
    }

    alert(msg);
})();
