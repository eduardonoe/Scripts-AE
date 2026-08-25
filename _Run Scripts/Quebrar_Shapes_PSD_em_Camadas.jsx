/*
    QUEBRAR SHAPES / CONVERTER PSD EM SHAPES — SEPARAR EM CAMADAS
    After Effects JSX
    Version: 6.1.0

    Para cada camada selecionada:
    - Se já for Shape Layer: só separa cada grupo (objeto) do Contents
      em uma camada de shape individual. 100% silencioso.
    - Se for camada raster (ex.: layer de PSD):
        - se já tiver máscaras, usa elas direto;
        - se não tiver, dispara o Auto-trace nativo do AE (abre o
          diálogo padrão para você ajustar tolerância e confirmar —
          não existe forma headless de fazer isso via script no AE).
      Qualquer máscara cuja área caiba inteira dentro de outra (por
      posição/tamanho, não por modo) é tratada como FURO daquela
      máscara — ex.: miolo da letra "A", "O", "B" — e fundida no mesmo
      grupo via Merge Paths, sem virar shape sólido separado.
    - Se a camada já tiver vetor nativo (raro em PSD/AI importado como
      vetor de verdade): tenta primeiro "Create Shapes from Vector
      Layer" antes de checar/gerar máscaras.
    - As camadas resultantes da separação são reordenadas na stack:
      linhas de cima pra baixo (para logos/desenhos com elementos em
      alturas diferentes) e, dentro da mesma linha, esquerda pra
      direita (ordem natural de leitura para texto).

    Selecione as camadas e execute o script.

    Changelog:
    - 6.1.0: corrige dois bugs graves. (1) MergePathsMode não existe no
      ExtendScript do AE — o setValue lançava exceção que abortava o
      script inteiro (grupo ficava sem Fill e nada era separado em
      camadas); agora usa o inteiro 3 (Subtract). (2) Contenção por
      bounding box engolia letras vizinhas (o "L" tem caixa retangular
      gigante que cobre "U" e "A"); agora usa point-in-polygon real, só
      o miolo verdadeiro vira furo. Também blinda o loop com try/catch
      para que uma falha isolada não derrube o resto.
    - 6.0.0: agrupamento de furo trocado para detecção por contenção
      espacial (bounding box), já que modo/Inverted da máscara não
      são um sinal confiável no Auto-trace desta versão do AE. Também
      adicionada reorganização automática das camadas resultantes por
      posição (linha e esquerda→direita).
    - 5.1.0: máscaras Subtract/Intersect que representam furo de uma
      letra/objeto (ex.: miolo do "A", "O", "B") deixam de virar shape
      sólido separado — agora são fundidas via Merge Paths no mesmo
      grupo do objeto pai, preservando o furo real.
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

    // --- centro (em espaço da comp) de uma camada, para ordenar por posição ---
    function getLayerCenter(layer) {
        var transform = layer.property("ADBE Transform Group");
        var pos = transform.property("ADBE Position").value;
        try {
            var rect = layer.sourceRectAtTime(comp.time, false);
            var anchor = transform.property("ADBE Anchor Point").value;
            return {
                x: pos[0] + (rect.left + rect.width / 2 - anchor[0]),
                y: pos[1] + (rect.top + rect.height / 2 - anchor[1])
            };
        } catch (e) {
            return { x: pos[0], y: pos[1] };
        }
    }

    // --- reordena camadas na stack: linhas de cima pra baixo, e dentro da linha, esquerda pra direita ---
    function organizeLayersByPosition(layerArr) {
        if (layerArr.length <= 1) return;

        var comLPos = [];

        for (var i = 0; i < layerArr.length; i++) {
            var c = getLayerCenter(layerArr[i]);
            comLPos.push({ layer: layerArr[i], x: c.x, y: c.y });
        }

        var LINHA_TOLERANCIA = 40; // px: considera "mesma linha" se a diferença de Y for pequena
        comLPos.sort(function (a, b) {
            if (Math.abs(a.y - b.y) > LINHA_TOLERANCIA) return a.y - b.y;
            return a.x - b.x;
        });

        for (var i = 1; i < comLPos.length; i++) {
            try { comLPos[i].layer.moveAfter(comLPos[i - 1].layer); } catch (e) {}
        }
    }

    // --- separa os grupos do Contents de um shape layer em camadas individuais, já organizadas ---
    function splitShapeLayer(layer) {
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) return [layer];

        var n = contents.numProperties;
        if (n <= 1) return [layer];

        var names = [];
        for (var i = 1; i <= n; i++) names.push(contents.property(i).name);

        var novasCamadas = [];
        for (var i = n; i >= 2; i--) {
            var dup = layer.duplicate();
            var dupContents = dup.property("ADBE Root Vectors Group");
            for (var j = dupContents.numProperties; j >= 1; j--) {
                if (j !== i) {
                    try { dupContents.property(j).remove(); } catch (e) {}
                }
            }
            dup.name = names[i - 1];
            novasCamadas.push(dup);
        }

        for (var j = contents.numProperties; j >= 1; j--) {
            if (j !== 1) {
                try { contents.property(j).remove(); } catch (e) {}
            }
        }
        layer.name = names[0];
        novasCamadas.push(layer);

        organizeLayersByPosition(novasCamadas);

        return novasCamadas;
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

    // --- agrupa máscaras por CONTENÇÃO GEOMÉTRICA REAL (point-in-polygon) ---
    // Bounding box não serve: letras em "L" ou "C" têm caixa retangular gigante que engole
    // letras vizinhas. Aqui testa-se se os vértices de uma máscara caem DENTRO do polígono da
    // outra, então só o miolo real (ex.: furo do "A", "O", "B") é tratado como furo.
    function getMaskVerts(mask) {
        return mask.property("ADBE Mask Shape").value.vertices;
    }

    function getBBox(verts) {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < verts.length; i++) {
            var x = verts[i][0], y = verts[i][1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    function bboxArea(b) {
        return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY);
    }

    function bboxContains(outer, inner) {
        var pad = 0.5;
        return inner.minX >= outer.minX - pad && inner.maxX <= outer.maxX + pad &&
               inner.minY >= outer.minY - pad && inner.maxY <= outer.maxY + pad;
    }

    // ray casting: o ponto está dentro do polígono?
    function pointInPoly(pt, verts) {
        var inside = false;
        for (var i = 0, j = verts.length - 1; i < verts.length; j = i++) {
            var xi = verts[i][0], yi = verts[i][1];
            var xj = verts[j][0], yj = verts[j][1];
            var intersecta = ((yi > pt[1]) !== (yj > pt[1])) &&
                (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
            if (intersecta) inside = !inside;
        }
        return inside;
    }

    // "inner" só é furo de "outer" se a maioria dos seus vértices estiver dentro do polígono
    function polyContains(outerVerts, outerBBox, innerVerts, innerBBox) {
        if (!bboxContains(outerBBox, innerBBox)) return false;
        var dentro = 0;
        for (var i = 0; i < innerVerts.length; i++) {
            if (pointInPoly(innerVerts[i], outerVerts)) dentro++;
        }
        return innerVerts.length > 0 && (dentro / innerVerts.length) >= 0.7;
    }

    function groupMasksByCompound(maskGroup) {
        var masks = [];
        for (var i = 1; i <= maskGroup.numProperties; i++) {
            var m = maskGroup.property(i);
            var v = getMaskVerts(m);
            masks.push({ mask: m, verts: v, bbox: getBBox(v) });
        }

        // pai = menor máscara que realmente contém esta
        var parentIndex = [];
        for (var i = 0; i < masks.length; i++) {
            var best = -1, bestArea = Infinity;
            for (var j = 0; j < masks.length; j++) {
                if (i === j) continue;
                if (polyContains(masks[j].verts, masks[j].bbox, masks[i].verts, masks[i].bbox)) {
                    var area = bboxArea(masks[j].bbox);
                    if (area < bestArea) { bestArea = area; best = j; }
                }
            }
            parentIndex.push(best);
        }

        function topAncestor(idx) {
            var visited = {};
            while (parentIndex[idx] !== -1 && !visited[idx]) {
                visited[idx] = true;
                idx = parentIndex[idx];
            }
            return idx;
        }

        var groupsByRoot = {};
        var rootOrder = [];
        for (var i = 0; i < masks.length; i++) {
            var root = topAncestor(i);
            if (!groupsByRoot[root]) { groupsByRoot[root] = []; rootOrder.push(root); }
            groupsByRoot[root].push(masks[i].mask);
        }

        // o path externo (raiz) tem que vir primeiro no grupo, para o Subtract funcionar
        var groups = [];
        for (var r = 0; r < rootOrder.length; r++) {
            var rootIdx = rootOrder[r];
            var rootMask = masks[rootIdx].mask;
            var arr = groupsByRoot[rootIdx];
            var ordenado = [rootMask];
            for (var k = 0; k < arr.length; k++) {
                if (arr[k] !== rootMask) ordenado.push(arr[k]);
            }
            groups.push({ masks: ordenado, bbox: masks[rootIdx].bbox });
        }

        // ordena os objetos por linha (topo→base) e, na mesma linha, esquerda→direita
        var LINHA_TOL = 40;
        groups.sort(function (a, b) {
            var ay = (a.bbox.minY + a.bbox.maxY) / 2, by = (b.bbox.minY + b.bbox.maxY) / 2;
            if (Math.abs(ay - by) > LINHA_TOL) return ay - by;
            return a.bbox.minX - b.bbox.minX;
        });

        var resultado = [];
        for (var g = 0; g < groups.length; g++) resultado.push(groups[g].masks);
        return resultado;
    }

    // --- converte as máscaras de uma camada em um Shape Layer novo, preservando furos ---
    function masksToShapeLayer(sourceLayer) {
        var maskGroup = sourceLayer.property("ADBE Mask Parade");
        if (!maskGroup || maskGroup.numProperties === 0) return null;

        var shapeLayer = comp.layers.addShape();
        shapeLayer.name = sourceLayer.name + " Shapes";
        copyTransform(sourceLayer, shapeLayer);

        var rootContents = shapeLayer.property("ADBE Root Vectors Group");
        var objetos = groupMasksByCompound(maskGroup);

        for (var g = 0; g < objetos.length; g++) {
            var masksDoObjeto = objetos[g];

            var group = rootContents.addProperty("ADBE Vector Group");
            group.name = masksDoObjeto[0].name;
            var gc = group.property("ADBE Vectors Group");

            for (var i = 0; i < masksDoObjeto.length; i++) {
                var pathGroup = gc.addProperty("ADBE Vector Shape - Group");
                pathGroup.property("ADBE Vector Shape").setValue(masksDoObjeto[i].property("ADBE Mask Shape").value);
            }

            // se houver mais de uma máscara no objeto, funde os paths preservando o(s) furo(s).
            // MergePathsMode não existe como enum no ExtendScript do AE — usar inteiro:
            // 1=Merge, 2=Add, 3=Subtract, 4=Intersect, 5=Exclude Intersections
            if (masksDoObjeto.length > 1) {
                try {
                    var merge = gc.addProperty("ADBE Vector Filter - Merge");
                    merge.property("ADBE Vector Merge Types").setValue(3);
                } catch (e) {}
            }

            try { gc.addProperty("ADBE Vector Graphic - Fill"); } catch (e) {}
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

    var erroInesperado = null;

    for (var i = 0; i < targetLayers.length; i++) {
        var layer = targetLayers[i];

        try {
            if (layer instanceof ShapeLayer) {
                var novas = splitShapeLayer(layer);
                if (novas.length > 1) {
                    camadasQuebradas++;
                    gruposSeparados += novas.length;
                }
            } else if (layer instanceof AVLayer && layer.source) {
                var novoShapeLayer = tryCreateShapesFromVector(layer);
                var dbg = {};
                if (!novoShapeLayer) novoShapeLayer = convertRasterToShapes(layer, dbg);

                if (novoShapeLayer) {
                    psdConvertidos++;
                    var novas2 = splitShapeLayer(novoShapeLayer);
                    if (novas2.length > 1) gruposSeparados += novas2.length;
                } else {
                    falhasConversao++;
                    if (!primeiroDebug) primeiroDebug = dbg;
                }
            }
        } catch (e) {
            falhasConversao++;
            if (!erroInesperado) erroInesperado = e.toString() + (e.line ? " (linha " + e.line + ")" : "");
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
        if (erroInesperado) msg += "\nErro: " + erroInesperado;
    }

    alert(msg);
})();
