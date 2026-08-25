/*
    QUEBRAR SHAPES / CONVERTER PSD EM SHAPES — SEPARAR EM CAMADAS
    After Effects JSX
    Version: 5.0.0

    Para cada camada selecionada:
    - Se já for Shape Layer: só separa cada grupo (objeto) do Contents
      em uma camada de shape individual. 100% silencioso.
    - Se for camada raster (ex.: layer de PSD):
        - se já tiver máscaras, usa elas direto;
        - se não tiver, dispara o Auto-trace nativo do AE (abre o
          diálogo padrão para você ajustar tolerância e confirmar —
          não existe forma headless de fazer isso via script no AE).
      Depois converte cada máscara em um grupo dentro de um Shape
      Layer novo (path de máscara e path de shape são compatíveis) e
      separa esse Shape Layer em camadas individuais.
    - Se a camada já tiver vetor nativo (raro em PSD/AI importado como
      vetor de verdade): tenta primeiro "Create Shapes from Vector
      Layer" antes de checar/gerar máscaras.

    Selecione as camadas e execute o script.

    Changelog:
    - 5.0.0: volta a disparar o Auto-trace nativo (com diálogo) quando
      a camada raster ainda não tem máscara, a pedido do usuário —
      preferível a exigir passo manual antes de rodar o script.
    - 4.0.0: removida qualquer tentativa de disparar o Auto-trace via
      script (sempre abriria diálogo nativo, o que não era desejado
      naquele momento). Camada raster só era convertida se já tivesse
      máscaras.
    - 3.0.0: layer.autoTrace() não existe na API de script do AE.
      Troca para o fluxo real: comando nativo Auto-trace (gera
      máscaras) + conversão de máscara em Shape Layer via código +
      separação em camadas.
    - 2.0.0: tentativa (equivocada) de usar layer.autoTrace().
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

    // --- copia posição/âncora/escala/rotação/opacidade de uma camada para outra ---
    function copyTransform(fromLayer, toLayer) {
        var fromT = fromLayer.property("ADBE Transform Group");
        var toT = toLayer.property("ADBE Transform Group");
        var props = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotation", "ADBE Opacity"];
        for (var p = 0; p < props.length; p++) {
            try {
                var fp = fromT.property(props[p]);
                var tp = toT.property(props[p]);
                if (fp && tp) tp.setValue(fp.value);
            } catch (e) {}
        }
    }

    // --- converte as máscaras de uma camada em um Shape Layer novo ---
    function masksToShapeLayer(sourceLayer) {
        var maskGroup = sourceLayer.property("ADBE Mask Parade");
        if (!maskGroup || maskGroup.numProperties === 0) return null;

        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = sourceLayer.name + " Shapes";
        copyTransform(sourceLayer, shapeLayer);

        var rootContents = shapeLayer.property("ADBE Root Vectors Group");

        for (var i = 1; i <= maskGroup.numProperties; i++) {
            var mask = maskGroup.property(i);
            var shapeVal = mask.property("ADBE Mask Shape").value;

            var group = rootContents.addProperty("ADBE Vector Group");
            group.name = mask.name;
            var gc = group.property("ADBE Vectors Group");
            var pathGroup = gc.addProperty("ADBE Vector Shape - Group");
            pathGroup.property("ADBE Vector Shape").setValue(shapeVal);
            gc.addProperty("ADBE Vector Graphic - Fill");
        }

        // limpa as máscaras da camada original, já convertidas
        for (var j = maskGroup.numProperties; j >= 1; j--) {
            try { maskGroup.property(j).remove(); } catch (e) {}
        }

        return shapeLayer;
    }

    // --- roda o comando nativo Auto-trace (abre o diálogo padrão do AE) ---
    function runAutoTraceCommand(layer) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        layer.selected = true;

        var nomesComando = ["Auto-trace...", "Auto-trace…", "Autotraçar...", "Autotraçado..."];
        var cmdId = 0;
        for (var n = 0; n < nomesComando.length; n++) {
            cmdId = app.findMenuCommandId(nomesComando[n]);
            if (cmdId) break;
        }
        if (!cmdId) return false;

        try {
            app.executeCommand(cmdId);
        } catch (e) {
            return false;
        }
        return true;
    }

    // --- camadas raster: usa máscaras existentes ou dispara o Auto-trace (abre diálogo) ---
    function convertRasterToShapes(layer, dbg) {
        var maskGroup = layer.property("ADBE Mask Parade");
        var camadaComMascaras = (maskGroup && maskGroup.numProperties > 0) ? layer : null;

        if (!camadaComMascaras) {
            var ok = runAutoTraceCommand(layer);
            if (!ok) {
                dbg.autoTraceCmdNaoEncontrado = true;
                return null;
            }
            var sel = comp.selectedLayers;
            for (var s = 0; s < sel.length; s++) {
                var mg = sel[s].property("ADBE Mask Parade");
                if (mg && mg.numProperties > 0) {
                    camadaComMascaras = sel[s];
                    break;
                }
            }
        }

        if (!camadaComMascaras) {
            dbg.semMascarasAposAutoTrace = true;
            return null;
        }

        return masksToShapeLayer(camadaComMascaras);
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
            if (!novoShapeLayer) novoShapeLayer = convertRasterToShapes(layer, dbg);

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
        if (primeiroDebug) {
            if (primeiroDebug.autoTraceCmdNaoEncontrado) msg += "\n(comando Auto-trace não encontrado no menu)";
            if (primeiroDebug.semMascarasAposAutoTrace) msg += "\n(nenhuma máscara gerada — o diálogo do Auto-trace pode ter sido cancelado)";
        }
    }

    alert(msg);
})();
