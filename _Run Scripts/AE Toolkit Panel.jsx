/*
    AE TOOLKIT PANEL
    After Effects JSX (ScriptUI Panel)
    Version: 1.1.0

    Painel único com um conjunto de ferramentas do dia a dia, substituindo o
    uso do Declutter e centralizando scripts que antes eram avulsos. Tudo
    nesse arquivo é autocontido — nenhum botão chama outro .jsx externo.

    Pode ser executado como script comum (abre uma janela flutuante) ou
    instalado em Scripts/ScriptUI Panels para abrir como painel encaixável
    (Window > nome do arquivo).

    GRUPOS
      Projeto    : Declutter, Reduce Project, Remove Unused Footage
      Limpeza    : Limpar Expressões, Reset Layer (tudo pros padrões)
      Time Remap : Hold Time Remap (com opção de apagar o último keyframe)
      Curvas     : Copiar Curva, Colar Curva
      Camadas    : Layer Normalize, Quebrar Shapes, Precomp Extractor,
                   Layer Organizer

    Este arquivo cresce com o tempo — novos botões entram nos grupos
    existentes ou em grupos novos, mantendo o mesmo padrão.

    Changelog:
    - 1.1.0: Declutter passa a classificar por EXTENSÃO de arquivo (não só
      vídeo/áudio) e ganha estrutura de categorias editável e persistente
      (nome + extensões por pasta), salva em app.settings — botão "Editar
      Estrutura" abre o editor. "Comps" e "Solids" são categorias especiais
      sem extensão.
    - 1.0.0: versão inicial, reunindo Limpar Expressões/Layer Styles, Hold
      Time Remap (+ apagar último key), Easy Curve Copy/Paste, Layer
      Normalize, Quebrar Shapes, Precomp Extractor, Layer Organizer, e as
      ferramentas novas de projeto (Declutter, Reduce Project, Remove
      Unused Footage).
*/
(function () {

    // ============================================================
    // ESTADO COMPARTILHADO (clipboard de curva em memória, não em arquivo)
    // ============================================================
    var easyCurveClipboard = null;

    // ============================================================
    // HELPERS GERAIS
    // ============================================================

    function comp() {
        return app.project.activeItem instanceof CompItem ? app.project.activeItem : null;
    }

    function ehGrupo(p) {
        return p.propertyType === PropertyType.NAMED_GROUP ||
               p.propertyType === PropertyType.INDEXED_GROUP;
    }

    function acharComando(nomes) {
        for (var i = 0; i < nomes.length; i++) {
            var id = app.findMenuCommandId(nomes[i]);
            if (id) return id;
        }
        return 0;
    }

    function selecionarApenas(c, layer) {
        for (var i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
        layer.selected = true;
    }

    // ============================================================
    // PROJETO — Declutter (organiza o Project Panel em pastas por tipo,
    // com estrutura de categorias editável, por extensão de arquivo)
    // ============================================================

    var DECLUTTER_SETTINGS_SECTION = "AEToolkit_Declutter";
    var DECLUTTER_SETTINGS_KEY = "categorias";

    function categoriasPadrao() {
        return [
            { nome: "Comps", exts: [] },              // especial: sempre pega CompItem
            { nome: "Solids", exts: [] },              // especial: sempre pega SolidSource
            { nome: "Audio", exts: ["mp3", "wav", "aac", "m4a", "aif", "aiff"] },
            { nome: "Images", exts: ["jpg", "jpeg", "png", "tif", "tiff", "svg", "eps", "gif", "webp"] },
            { nome: "AI", exts: ["ai"] },
            { nome: "PSD", exts: ["psd"] },
            { nome: "Footage", exts: ["mp4", "mov", "avi", "mxf", "mkv", "webm", "prores", "m4v"] }
        ];
    }

    function carregarCategorias() {
        try {
            if (app.settings.haveSetting(DECLUTTER_SETTINGS_SECTION, DECLUTTER_SETTINGS_KEY)) {
                var raw = app.settings.getSetting(DECLUTTER_SETTINGS_SECTION, DECLUTTER_SETTINGS_KEY);
                var data = eval("(" + raw + ")");
                if (data && data.length > 0) return data;
            }
        } catch (e) {}
        return categoriasPadrao();
    }

    function salvarCategorias(categorias) {
        try {
            app.settings.saveSetting(DECLUTTER_SETTINGS_SECTION, DECLUTTER_SETTINGS_KEY, categorias.toSource());
        } catch (e) {}
    }

    function acharOuCriarPasta(nome) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.parentFolder === app.project.rootFolder && it.name === nome) {
                return it;
            }
        }
        return app.project.items.addFolder(nome);
    }

    function extensaoDoItem(item) {
        try {
            var src = item.mainSource;
            if (src && src.file) {
                var nome = src.file.name;
                var pontoIdx = nome.lastIndexOf(".");
                if (pontoIdx >= 0) return nome.substring(pontoIdx + 1).toLowerCase();
            }
        } catch (e) {}
        return null;
    }

    // Retorna o NOME da categoria (da lista configurável) para este item, ou
    // null se ele deve ficar de fora (pastas, ou nenhuma categoria bate).
    function categoriaDoItem(item, categorias) {
        if (item instanceof FolderItem) return null;

        if (item instanceof CompItem) {
            for (var c = 0; c < categorias.length; c++) {
                if (categorias[c].nome === "Comps" && categorias[c].exts.length === 0) return categorias[c].nome;
            }
            return null;
        }

        if (item instanceof FootageItem) {
            if (item.mainSource instanceof SolidSource) {
                for (var s = 0; s < categorias.length; s++) {
                    if (categorias[s].nome === "Solids" && categorias[s].exts.length === 0) return categorias[s].nome;
                }
                return null;
            }

            var ext = extensaoDoItem(item);
            if (ext) {
                for (var i = 0; i < categorias.length; i++) {
                    var exts = categorias[i].exts;
                    for (var e = 0; e < exts.length; e++) {
                        if (exts[e].toLowerCase() === ext) return categorias[i].nome;
                    }
                }
            }

            // sem extensão reconhecida: usa vídeo/áudio como fallback
            if (item.hasAudio && !item.hasVideo) {
                for (var a = 0; a < categorias.length; a++) {
                    if (categorias[a].nome === "Audio") return categorias[a].nome;
                }
            }
            for (var f = 0; f < categorias.length; f++) {
                if (categorias[f].nome === "Footage") return categorias[f].nome;
            }
        }

        return "Outros";
    }

    function declutter() {
        var categorias = carregarCategorias();

        app.beginUndoGroup("Declutter");
        try {
            var pastas = {};
            var total = app.project.numItems;
            // percorre uma cópia dos índices atuais; novos itens (pastas criadas)
            // entram no fim e não afetam os já processados
            for (var i = 1; i <= total; i++) {
                var item = app.project.item(i);
                if (item.parentFolder !== app.project.rootFolder) continue; // já organizado

                var destino = categoriaDoItem(item, categorias);
                if (!destino) continue;

                if (!pastas[destino]) pastas[destino] = acharOuCriarPasta(destino);
                item.parentFolder = pastas[destino];
            }
        } catch (e) {
            alert("Declutter — erro: " + e.toString());
        } finally {
            app.endUndoGroup();
        }
    }

    // --- editor da estrutura de pastas (nome + extensões por categoria) ---
    function editarEstruturaDeclutter() {
        var categorias = carregarCategorias();

        var dlg = new Window("dialog", "Editar Estrutura de Pastas");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 6;
        dlg.margins = 12;

        dlg.add("statictext", undefined,
            "Cada linha vira uma pasta. \"Comps\" e \"Solids\" são especiais (sem extensão).\n" +
            "Nas demais, liste as extensões separadas por vírgula (ex.: mp4, mov, mxf).");

        var linhasGroup = dlg.add("group");
        linhasGroup.orientation = "column";
        linhasGroup.alignChildren = ["fill", "top"];
        linhasGroup.spacing = 3;

        var linhas = []; // { row, nomeField, extField, especial }

        function addLinha(nome, exts) {
            var especial = (nome === "Comps" || nome === "Solids");
            var row = linhasGroup.add("group");
            row.orientation = "row";
            row.alignChildren = ["fill", "center"];

            var nomeField = row.add("edittext", undefined, nome);
            nomeField.characters = 12;

            var extField = row.add("edittext", undefined, exts.join(", "));
            extField.characters = 30;
            extField.enabled = !especial;

            var btnRemover = row.add("button", undefined, "✕");
            btnRemover.preferredSize = [24, 22];
            btnRemover.onClick = function () {
                linhasGroup.remove(row);
                for (var li = 0; li < linhas.length; li++) {
                    if (linhas[li].row === row) { linhas.splice(li, 1); break; }
                }
                dlg.layout.layout(true);
            };

            linhas.push({ row: row, nomeField: nomeField, extField: extField });
        }

        for (var i = 0; i < categorias.length; i++) addLinha(categorias[i].nome, categorias[i].exts);

        var btnAdd = dlg.add("button", undefined, "+ Nova categoria");
        btnAdd.alignment = ["left", "top"];
        btnAdd.onClick = function () {
            addLinha("Nova", []);
            dlg.layout.layout(true);
        };

        var botoes = dlg.add("group");
        botoes.alignment = "right";
        var btnCancelar = botoes.add("button", undefined, "Cancelar", { name: "cancel" });
        var btnSalvar = botoes.add("button", undefined, "Salvar", { name: "ok" });

        btnSalvar.onClick = function () {
            var novasCategorias = [];
            for (var li = 0; li < linhas.length; li++) {
                var nome = linhas[li].nomeField.text.replace(/^\s+|\s+$/g, "");
                if (!nome) continue;
                var raw = linhas[li].extField.text;
                var exts = [];
                var partes = raw.split(",");
                for (var p = 0; p < partes.length; p++) {
                    var v = partes[p].replace(/^\s+|\s+$/g, "").replace(/^\./, "").toLowerCase();
                    if (v) exts.push(v);
                }
                novasCategorias.push({ nome: nome, exts: (nome === "Comps" || nome === "Solids") ? [] : exts });
            }
            salvarCategorias(novasCategorias);
            dlg.close(1);
        };
        btnCancelar.onClick = function () { dlg.close(0); };

        dlg.center();
        dlg.show();
    }

    // ============================================================
    // PROJETO — Reduce Project / Remove Unused Footage
    // ============================================================

    function fecharAbasOrfas() {
        // Depois de reduzir o projeto, itens deletados podem deixar abas de
        // comp "fantasma" abertas (comum após restaurar um workspace salvo).
        // Não há API para enumerar abas abertas — a única forma de garantir
        // que nenhuma fique órfã é fechar todas e reabrir a atual.
        var atual = app.project.activeItem;
        var nomes = ["Close All"];
        var id = acharComando(nomes);
        if (id) {
            try { app.executeCommand(id); } catch (e) {}
        }
        if (atual && atual instanceof CompItem) {
            try { atual.openInViewer(); } catch (e) {}
        }
    }

    function reduceProject() {
        var alvos = [];
        var painelSel = app.project.selection;
        for (var i = 0; i < painelSel.length; i++) {
            if (painelSel[i] instanceof CompItem) alvos.push(painelSel[i]);
        }
        if (alvos.length === 0) {
            var ativa = comp();
            if (ativa) alvos.push(ativa);
        }
        if (alvos.length === 0) {
            alert("Selecione uma ou mais comps no Project Panel, ou abra a comp que quer manter.");
            return;
        }

        app.beginUndoGroup("Reduce Project");
        try {
            app.project.reduceProject(alvos);
        } catch (e) {
            alert("Reduce Project — erro: " + e.toString());
        } finally {
            app.endUndoGroup();
        }

        fecharAbasOrfas();
    }

    function removeUnusedFootage() {
        app.beginUndoGroup("Remove Unused Footage");
        try {
            app.project.removeUnusedFootage();
        } catch (e) {
            alert("Remove Unused Footage — erro: " + e.toString());
        } finally {
            app.endUndoGroup();
        }
    }

    // ============================================================
    // LIMPEZA — Limpar Expressões / Reset Layer
    // ============================================================

    function removeExpressoesRecursivo(propGroup) {
        if (!propGroup) return;
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            if (prop.propertyType === PropertyType.PROPERTY) {
                if (prop.canSetExpression && prop.expression !== "") {
                    try { prop.expression = ""; } catch (e) {}
                }
            } else if (ehGrupo(prop)) {
                removeExpressoesRecursivo(prop);
            }
        }
    }

    function limparExpressoes() {
        var c = comp();
        if (!c) return;
        var layers = c.selectedLayers;
        if (layers.length === 0) return;

        app.beginUndoGroup("Limpar Expressões");
        for (var i = 0; i < layers.length; i++) {
            removeExpressoesRecursivo(layers[i]);
        }
        app.endUndoGroup();
    }

    function removeEfeitos(layer) {
        try {
            var fx = layer.property("ADBE Effect Parade");
            if (!fx) return;
            for (var e = fx.numProperties; e >= 1; e--) {
                try { fx.property(e).remove(); } catch (err) {}
            }
        } catch (err) {}
    }

    // Layer styles: o grupo é NAMED_GROUP com 10 slots fixos, sempre presente.
    // remove() num slot é proibido pelo AE ("parent is not an INDEXED_GROUP").
    // Desligar cada style dá o mesmo resultado visual — é a única via confiável.
    function limparLayerStyles(layer) {
        var styles;
        try { styles = layer.property("ADBE Layer Styles"); } catch (e) { return; }
        if (!styles) return;
        try { styles.remove(); return; } catch (e) {}
        for (var s = 1; s <= styles.numProperties; s++) {
            try {
                var style = styles.property(s);
                if (style.matchName === "ADBE Blend Options Group") continue;
                if (style.enabled) style.enabled = false;
            } catch (err) {}
        }
    }

    // Centraliza o anchor point no objeto, compensando a posição para nada se mover.
    function centralizarAnchor(layer) {
        try {
            var transform = layer.property("ADBE Transform Group");
            var anchorProp = transform.property("ADBE Anchor Point");
            var posProp = transform.property("ADBE Position");
            var rect = layer.sourceRectAtTime(0, false);
            var novoAnchor = [rect.left + rect.width / 2, rect.top + rect.height / 2];
            var anchorAtual = anchorProp.value;
            var posAtual = posProp.value;
            var escala = transform.property("ADBE Scale").value;
            var dx = (novoAnchor[0] - anchorAtual[0]) * (escala[0] / 100);
            var dy = (novoAnchor[1] - anchorAtual[1]) * (escala[1] / 100);
            if (anchorAtual.length > 2) {
                anchorProp.setValue([novoAnchor[0], novoAnchor[1], anchorAtual[2]]);
                posProp.setValue([posAtual[0] + dx, posAtual[1] + dy, posAtual[2]]);
            } else {
                anchorProp.setValue(novoAnchor);
                posProp.setValue([posAtual[0] + dx, posAtual[1] + dy]);
            }
        } catch (e) {}
    }

    // Reset completo: remove fx/expressões/styles e volta Transform aos
    // valores padrão de uma camada recém-criada (âncora no centro do
    // conteúdo, posição no centro da comp, escala 100, rotação 0, opacidade 100).
    function resetarLayer() {
        var c = comp();
        if (!c) return;
        var layers = c.selectedLayers;
        if (layers.length === 0) return;

        app.beginUndoGroup("Reset Layer");
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];

            removeExpressoesRecursivo(layer);
            removeEfeitos(layer);
            limparLayerStyles(layer);

            var t = layer.property("ADBE Transform Group");
            var props = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Opacity"];
            for (var p = 0; p < props.length; p++) {
                try {
                    var prop = t.property(props[p]);
                    while (prop.numKeys > 0) prop.removeKey(1);
                    prop.expression = "";
                } catch (e) {}
            }

            try {
                var rot = t.property("ADBE Rotation");
                while (rot.numKeys > 0) rot.removeKey(1);
                rot.expression = "";
                rot.setValue(0);
            } catch (e) {}

            try { t.property("ADBE Scale").setValue(layer.threeDLayer ? [100, 100, 100] : [100, 100]); } catch (e) {}
            try { t.property("ADBE Opacity").setValue(100); } catch (e) {}

            try {
                var pos = t.property("ADBE Position");
                pos.setValue(layer.threeDLayer ? [c.width / 2, c.height / 2, 0] : [c.width / 2, c.height / 2]);
            } catch (e) {}

            centralizarAnchor(layer);
        }
        app.endUndoGroup();
    }

    // ============================================================
    // TIME REMAP — Hold Time Remap (com apagar último keyframe)
    // ============================================================

    function holdTimeRemap() {
        var c = comp();
        if (!c) return;
        var layers = c.selectedLayers;
        if (!layers || layers.length === 0) return;

        app.beginUndoGroup("Hold Time Remap");
        var t = c.time;

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            try {
                if (!(layer instanceof AVLayer) || !layer.canSetTimeRemapEnabled) continue;
                if (!layer.timeRemapEnabled) layer.timeRemapEnabled = true;

                var tr = layer.property("ADBE Time Remapping");
                if (!tr) continue;

                var remapValue = tr.valueAtTime(t, false);
                var epsilon = c.frameDuration / 100.0;
                var keyIndex = 0;

                for (var k = 1; k <= tr.numKeys; k++) {
                    if (Math.abs(tr.keyTime(k) - t) <= epsilon) { keyIndex = k; break; }
                }
                if (keyIndex === 0) keyIndex = tr.addKey(t);

                tr.setValueAtKey(keyIndex, remapValue);
                tr.setInterpolationTypeAtKey(
                    keyIndex,
                    KeyframeInterpolationType.LINEAR,
                    KeyframeInterpolationType.HOLD
                );

                // apaga o último keyframe da propriedade, se ele vier DEPOIS do
                // hold recém-criado (normalmente o keyframe final que o AE cria
                // sozinho ao ligar o Time Remap) — sem isso o remap "puxava" de
                // volta para aquele valor no fim, quebrando o congelamento
                if (tr.numKeys > keyIndex) {
                    try { tr.removeKey(tr.numKeys); } catch (e) {}
                }
            } catch (layerErr) {}
        }
        app.endUndoGroup();
    }

    // ============================================================
    // CURVAS — Easy Curve Copy / Paste (clipboard em memória)
    // ============================================================

    function coletarAnimadas(group, result) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) {
                if (p.numKeys > 0) result.push(p);
            } else {
                coletarAnimadas(p, result);
            }
        }
    }

    function keysSelecionadasOuTodas(prop) {
        var keys = prop.selectedKeys;
        if (keys && keys.length > 0) return keys;
        keys = [];
        for (var i = 1; i <= prop.numKeys; i++) keys.push(i);
        return keys;
    }

    function nomeInterpolacao(value) {
        if (value === KeyframeInterpolationType.HOLD) return "HOLD";
        if (value === KeyframeInterpolationType.LINEAR) return "LINEAR";
        return "BEZIER";
    }

    function valorInterpolacao(name) {
        if (name === "HOLD") return KeyframeInterpolationType.HOLD;
        if (name === "LINEAR") return KeyframeInterpolationType.LINEAR;
        return KeyframeInterpolationType.BEZIER;
    }

    function easeParaDados(eases) {
        var result = [];
        for (var i = 0; i < eases.length; i++) {
            result.push({ speed: eases[i].speed, influence: eases[i].influence });
        }
        return result;
    }

    function propriedadesAlvo(c) {
        var props = [];
        var selecionadas = c.selectedProperties;
        for (var i = 0; i < selecionadas.length; i++) {
            var sp = selecionadas[i];
            if (sp.propertyType === PropertyType.PROPERTY && sp.numKeys > 0) props.push(sp);
        }
        if (props.length === 0) {
            var layers = c.selectedLayers;
            for (i = 0; i < layers.length; i++) coletarAnimadas(layers[i], props);
        }
        return props;
    }

    function copiarCurva() {
        var c = comp();
        if (!c) return;

        var props = propriedadesAlvo(c);
        if (props.length === 0) return;

        var data = { properties: [] };
        for (var i = 0; i < props.length; i++) {
            var prop = props[i];
            var keyIndexes = keysSelecionadasOuTodas(prop);
            var propData = { matchName: prop.matchName, keys: [] };

            for (var k = 0; k < keyIndexes.length; k++) {
                var ki = keyIndexes[k];
                try {
                    propData.keys.push({
                        inType: nomeInterpolacao(prop.keyInInterpolationType(ki)),
                        outType: nomeInterpolacao(prop.keyOutInterpolationType(ki)),
                        inEase: easeParaDados(prop.keyInTemporalEase(ki)),
                        outEase: easeParaDados(prop.keyOutTemporalEase(ki)),
                        continuous: prop.keyTemporalContinuous(ki),
                        autoBezier: prop.keyTemporalAutoBezier(ki)
                    });
                } catch (e) {}
            }
            if (propData.keys.length > 0) data.properties.push(propData);
        }

        if (data.properties.length === 0) return;
        easyCurveClipboard = data;
    }

    function fazerEaseArray(sourceEase, count) {
        var result = [];
        var fallback = sourceEase.length > 0 ? sourceEase[0] : { speed: 0, influence: 33.333 };
        for (var i = 0; i < count; i++) {
            var item = sourceEase[i] || fallback;
            var influence = Math.max(0.1, Math.min(100, item.influence));
            result.push(new KeyframeEase(item.speed, influence));
        }
        return result;
    }

    function colarCurva() {
        var c = comp();
        if (!c) return;
        if (!easyCurveClipboard || !easyCurveClipboard.properties || easyCurveClipboard.properties.length === 0) return;

        var props = propriedadesAlvo(c);
        if (props.length === 0) return;

        app.beginUndoGroup("Colar Curva");
        var n = Math.min(easyCurveClipboard.properties.length, props.length);

        for (var i = 0; i < n; i++) {
            var sourceProp = easyCurveClipboard.properties[i];
            var targetProp = props[i];
            var targetKeys = keysSelecionadasOuTodas(targetProp);
            var keyCount = Math.min(sourceProp.keys.length, targetKeys.length);

            for (var k = 0; k < keyCount; k++) {
                var sourceKey = sourceProp.keys[k];
                var targetKey = targetKeys[k];
                try {
                    targetProp.setInterpolationTypeAtKey(
                        targetKey,
                        valorInterpolacao(sourceKey.inType),
                        valorInterpolacao(sourceKey.outType)
                    );

                    var inLen = targetProp.keyInTemporalEase(targetKey).length;
                    var outLen = targetProp.keyOutTemporalEase(targetKey).length;
                    targetProp.setTemporalEaseAtKey(
                        targetKey,
                        fazerEaseArray(sourceKey.inEase, inLen),
                        fazerEaseArray(sourceKey.outEase, outLen)
                    );

                    if (!sourceKey.autoBezier) {
                        targetProp.setTemporalContinuousAtKey(targetKey, sourceKey.continuous);
                    }
                    targetProp.setTemporalAutoBezierAtKey(targetKey, sourceKey.autoBezier);
                } catch (e) {}
            }
        }
        app.endUndoGroup();
    }

    // ============================================================
    // CAMADAS — Layer Normalize
    // ============================================================

    function layerNormalize() {
        var c = comp();
        if (!c) return;
        var layers = c.selectedLayers;
        if (!layers || layers.length === 0) return;

        app.beginUndoGroup("Layer Normalize");
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var textGroup = layer.property("ADBE Text Properties");
            if (!textGroup) continue;

            var sourceText = textGroup.property("ADBE Text Document");
            var transform = layer.property("ADBE Transform Group");
            var scaleProp = transform.property("ADBE Scale");
            var anchorProp = transform.property("ADBE Anchor Point");

            if (layer.threeDLayer) continue;
            if (scaleProp.numKeys > 0 || scaleProp.expressionEnabled) continue;
            if (sourceText.numKeys > 0 || sourceText.expressionEnabled) continue;

            var scale = scaleProp.value;
            var sx = scale[0] / 100;
            var sy = scale[1] / 100;
            if (sx <= 0 || sy <= 0) continue;

            var wasLocked = layer.locked;
            layer.locked = false;

            try {
                var doc = sourceText.value;
                doc.fontSize = doc.fontSize * sy;
                try { doc.horizontalScale = doc.horizontalScale * (sx / sy); } catch (e1) {}
                try { if (!doc.autoLeading) doc.leading = doc.leading * sy; } catch (e2) {}
                try { doc.strokeWidth = doc.strokeWidth * sy; } catch (e3) {}
                try { doc.baselineShift = doc.baselineShift * sy; } catch (e4) {}
                try {
                    if (doc.boxText) {
                        var box = doc.boxTextSize;
                        doc.boxTextSize = [box[0] * sx, box[1] * sy];
                    }
                } catch (e5) {}

                sourceText.setValue(doc);

                var anchor = anchorProp.value;
                anchorProp.setValue([anchor[0] * sx, anchor[1] * sy]);
                scaleProp.setValue([100, 100]);
            } catch (err) {}

            layer.locked = wasLocked;
        }
        app.endUndoGroup();
    }

    // ============================================================
    // CAMADAS — Quebrar Shapes (mesma lógica do Quebrar Shapes PSD)
    // ============================================================

    function splitShapeLayerCore(c, layer) {
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) return [layer];

        var n = contents.numProperties;
        if (n <= 1) return [layer];

        var names = [];
        for (var i = 1; i <= n; i++) names.push(contents.property(i).name);

        var novas = [];
        for (var idx = n; idx >= 2; idx--) {
            var dup = layer.duplicate();
            var dupContents = dup.property("ADBE Root Vectors Group");
            for (var j = dupContents.numProperties; j >= 1; j--) {
                if (j !== idx) { try { dupContents.property(j).remove(); } catch (e) {} }
            }
            dup.name = names[idx - 1];
            novas.push(dup);
        }
        for (var j2 = contents.numProperties; j2 >= 1; j2--) {
            if (j2 !== 1) { try { contents.property(j2).remove(); } catch (e) {} }
        }
        layer.name = names[0];
        novas.push(layer);

        for (var k = 0; k < novas.length; k++) centralizarAnchor(novas[k]);
        organizarPorPosicao(c, novas);

        return novas;
    }

    function centroDaCamada(c, layer) {
        var transform = layer.property("ADBE Transform Group");
        var pos = transform.property("ADBE Position").value;
        try {
            var rect = layer.sourceRectAtTime(c.time, false);
            var anchor = transform.property("ADBE Anchor Point").value;
            return {
                x: pos[0] + (rect.left + rect.width / 2 - anchor[0]),
                y: pos[1] + (rect.top + rect.height / 2 - anchor[1])
            };
        } catch (e) {
            return { x: pos[0], y: pos[1] };
        }
    }

    function organizarPorPosicao(c, layerArr) {
        if (layerArr.length <= 1) return;
        var comPos = [];
        for (var i = 0; i < layerArr.length; i++) {
            var ctr = centroDaCamada(c, layerArr[i]);
            comPos.push({ layer: layerArr[i], x: ctr.x, y: ctr.y });
        }
        var TOL = 40;
        comPos.sort(function (a, b) {
            if (Math.abs(a.y - b.y) > TOL) return a.y - b.y;
            return a.x - b.x;
        });
        for (var j = 1; j < comPos.length; j++) {
            try { comPos[j].layer.moveAfter(comPos[j - 1].layer); } catch (e) {}
        }
    }

    function tentarCriarShapesDoVetor(c, layer) {
        selecionarApenas(c, layer);
        var cmdId = acharComando(["Create Shapes from Vector Layer"]);
        if (!cmdId) return null;
        try { app.executeCommand(cmdId); } catch (e) { return null; }
        var sel = c.selectedLayers;
        for (var s = 0; s < sel.length; s++) {
            if (sel[s] instanceof ShapeLayer) return sel[s];
        }
        return null;
    }

    function dispararAutoTrace(c, layer) {
        selecionarApenas(c, layer);
        var cmdId = acharComando(["Auto-trace...", "Auto-trace…"]);
        if (!cmdId) return false;
        try { app.executeCommand(cmdId); return true; } catch (e) { return false; }
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

    function bboxArea(b) { return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY); }

    function bboxContains(outer, inner) {
        var pad = 0.5;
        return inner.minX >= outer.minX - pad && inner.maxX <= outer.maxX + pad &&
               inner.minY >= outer.minY - pad && inner.maxY <= outer.maxY + pad;
    }

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

    function polyContains(outerVerts, outerBBox, innerVerts, innerBBox) {
        if (!bboxContains(outerBBox, innerBBox)) return false;
        var dentro = 0;
        for (var i = 0; i < innerVerts.length; i++) {
            if (pointInPoly(innerVerts[i], outerVerts)) dentro++;
        }
        return innerVerts.length > 0 && (dentro / innerVerts.length) >= 0.7;
    }

    function agruparMascarasPorContencao(maskGroup) {
        var masks = [];
        for (var i = 1; i <= maskGroup.numProperties; i++) {
            var m = maskGroup.property(i);
            var v = m.property("ADBE Mask Shape").value.vertices;
            masks.push({ mask: m, verts: v, bbox: getBBox(v) });
        }

        var parentIndex = [];
        for (var a = 0; a < masks.length; a++) {
            var best = -1, bestArea = Infinity;
            for (var b = 0; b < masks.length; b++) {
                if (a === b) continue;
                if (polyContains(masks[b].verts, masks[b].bbox, masks[a].verts, masks[a].bbox)) {
                    var area = bboxArea(masks[b].bbox);
                    if (area < bestArea) { bestArea = area; best = b; }
                }
            }
            parentIndex.push(best);
        }

        function topAncestor(idx) {
            var visited = {};
            while (parentIndex[idx] !== -1 && !visited[idx]) { visited[idx] = true; idx = parentIndex[idx]; }
            return idx;
        }

        var groupsByRoot = {}, rootOrder = [];
        for (var c2 = 0; c2 < masks.length; c2++) {
            var root = topAncestor(c2);
            if (!groupsByRoot[root]) { groupsByRoot[root] = []; rootOrder.push(root); }
            groupsByRoot[root].push(masks[c2].mask);
        }

        var groups = [];
        for (var r = 0; r < rootOrder.length; r++) {
            var rootIdx = rootOrder[r];
            var rootMask = masks[rootIdx].mask;
            var arr = groupsByRoot[rootIdx];
            var ordenado = [rootMask];
            for (var k2 = 0; k2 < arr.length; k2++) if (arr[k2] !== rootMask) ordenado.push(arr[k2]);
            groups.push({ masks: ordenado, bbox: masks[rootIdx].bbox });
        }

        var TOL = 40;
        groups.sort(function (x, y) {
            var xy = (x.bbox.minY + x.bbox.maxY) / 2, yy = (y.bbox.minY + y.bbox.maxY) / 2;
            if (Math.abs(xy - yy) > TOL) return xy - yy;
            return x.bbox.minX - y.bbox.minX;
        });

        var resultado = [];
        for (var g = 0; g < groups.length; g++) resultado.push(groups[g].masks);
        return resultado;
    }

    function copiarTransform(fromLayer, toLayer) {
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

    function mascarasParaShapeLayer(c, sourceLayer) {
        var maskGroup = sourceLayer.property("ADBE Mask Parade");
        if (!maskGroup || maskGroup.numProperties === 0) return null;

        var shapeLayer = c.layers.addShape();
        shapeLayer.name = sourceLayer.name + " Shapes";
        copiarTransform(sourceLayer, shapeLayer);

        var rootContents = shapeLayer.property("ADBE Root Vectors Group");
        var objetos = agruparMascarasPorContencao(maskGroup);

        for (var g = 0; g < objetos.length; g++) {
            var masksDoObjeto = objetos[g];
            var group = rootContents.addProperty("ADBE Vector Group");
            group.name = masksDoObjeto[0].name;
            var gc = group.property("ADBE Vectors Group");

            for (var i = 0; i < masksDoObjeto.length; i++) {
                var pathGroup = gc.addProperty("ADBE Vector Shape - Group");
                pathGroup.property("ADBE Vector Shape").setValue(masksDoObjeto[i].property("ADBE Mask Shape").value);
            }

            var fill = gc.addProperty("ADBE Vector Graphic - Fill");
            if (masksDoObjeto.length > 1) {
                var regra = fill.property("ADBE Vector Fill Rule");
                if (!regra) { try { regra = fill.property(2); } catch (e) {} }
                if (regra) { try { regra.setValue(2); } catch (e) {} } // Even-Odd
            }
        }

        for (var j = maskGroup.numProperties; j >= 1; j--) {
            try { maskGroup.property(j).remove(); } catch (e) {}
        }
        return shapeLayer;
    }

    function converterRasterParaShapes(c, layer, dbg) {
        var maskGroup = layer.property("ADBE Mask Parade");
        var camadaComMascaras = (maskGroup && maskGroup.numProperties > 0) ? layer : null;

        if (!camadaComMascaras) {
            var ok = dispararAutoTrace(c, layer);
            if (!ok) { dbg.semComando = true; return null; }
            var sel = c.selectedLayers;
            for (var s = 0; s < sel.length; s++) {
                var mg = sel[s].property("ADBE Mask Parade");
                if (mg && mg.numProperties > 0) { camadaComMascaras = sel[s]; break; }
            }
        }
        if (!camadaComMascaras) { dbg.semMascaras = true; return null; }
        return mascarasParaShapeLayer(c, camadaComMascaras);
    }

    function quebrarShapes() {
        var c = comp();
        if (!c) { alert("Abra uma composição e selecione os layers."); return; }

        var alvo = c.selectedLayers;
        if (alvo.length === 0) { alert("Selecione as camadas (shape layers e/ou camadas de PSD)."); return; }
        alvo = alvo.slice(0);

        var quebrados = 0, gruposSeparados = 0, psdConvertidos = 0, falhas = 0;

        for (var i = 0; i < alvo.length; i++) {
            var layer = alvo[i];
            try {
                if (layer instanceof ShapeLayer) {
                    var novas = splitShapeLayerCore(c, layer);
                    if (novas.length > 1) { quebrados++; gruposSeparados += novas.length; }
                } else if (layer instanceof AVLayer && layer.source) {
                    var novoShape = tentarCriarShapesDoVetor(c, layer);
                    var dbg = {};
                    if (!novoShape) novoShape = converterRasterParaShapes(c, layer, dbg);
                    if (novoShape) {
                        psdConvertidos++;
                        var novas2 = splitShapeLayerCore(c, novoShape);
                        if (novas2.length > 1) gruposSeparados += novas2.length;
                    } else {
                        falhas++;
                    }
                }
            } catch (e) { falhas++; }
        }

        if (quebrados === 0 && psdConvertidos === 0 && falhas > 0) {
            alert("Nenhuma conversão bem-sucedida. Falhas: " + falhas +
                "\n(pode faltar dado vetorial na camada, ou o Auto-trace precisa ser confirmado no diálogo)");
        }
    }

    // ============================================================
    // CAMADAS — Precomp Extractor
    // ============================================================

    function flattenLayer(layer, c, cmdCopy, cmdPaste, cmdClose) {
        if (!(layer instanceof AVLayer) || !layer.source || !(layer.source instanceof CompItem)) return;

        var source = layer.source;
        source.openInViewer();
        for (var i = 1; i <= source.numLayers; i++) source.layer(i).selected = true;
        var hasLayers = source.numLayers > 0;
        if (hasLayers) app.executeCommand(cmdCopy);
        app.executeCommand(cmdClose);

        if (!hasLayers) { layer.remove(); return; }

        c.openInViewer();
        for (var j = 1; j <= c.numLayers; j++) c.layer(j).selected = false;
        layer.selected = true;
        app.executeCommand(cmdPaste);

        var pasted = c.selectedLayers.slice();
        layer.remove();

        for (var k = 0; k < pasted.length; k++) flattenLayer(pasted[k], c, cmdCopy, cmdPaste, cmdClose);
    }

    function precompExtractor() {
        var c = comp();
        if (!c) { alert("Selecione uma composição ativa."); return; }

        var selected = c.selectedLayers.slice();
        if (selected.length === 0) { alert("Selecione uma ou mais camadas de precomp."); return; }

        var cmdCopy = acharComando(["Copy"]);
        var cmdPaste = acharComando(["Paste"]);
        var cmdClose = acharComando(["Close"]);
        if (!cmdCopy || !cmdPaste || !cmdClose) {
            alert("Comandos de menu Copy/Paste/Close não encontrados.");
            return;
        }

        app.beginUndoGroup("Precomp Extractor");
        try {
            for (var i = 0; i < selected.length; i++) flattenLayer(selected[i], c, cmdCopy, cmdPaste, cmdClose);
        } finally {
            app.endUndoGroup();
        }
        c.openInViewer();
    }

    // ============================================================
    // CAMADAS — Layer Organizer
    // ============================================================

    function layerOrganizer() {
        var c = comp();
        if (!c) { alert("Abra a composição que você quer reorganizar."); return; }

        var n = c.numLayers;
        if (n <= 1) return;

        var temSelecao = c.selectedLayers.length > 0;
        var alvo = [];
        for (var i = 1; i <= n; i++) {
            var layer = c.layer(i);
            if (!temSelecao || layer.selected) {
                alvo.push({ layer: layer, inPoint: layer.inPoint, indiceOriginal: i });
            }
        }
        if (alvo.length <= 1) return;

        var ordenados = alvo.slice(0);
        ordenados.sort(function (a, b) {
            if (a.inPoint !== b.inPoint) return b.inPoint - a.inPoint;
            return a.indiceOriginal - b.indiceOriginal;
        });

        var fullOrder = [];
        var cursor = 0;
        for (var j = 1; j <= n; j++) {
            var lyr = c.layer(j);
            if (!temSelecao || lyr.selected) {
                fullOrder.push(ordenados[cursor].layer);
                cursor++;
            } else {
                fullOrder.push(lyr);
            }
        }

        app.beginUndoGroup("Layer Organizer");
        for (var k = fullOrder.length - 1; k >= 0; k--) {
            try { fullOrder[k].moveToBeginning(); } catch (e) {}
        }
        app.endUndoGroup();
    }

    // ============================================================
    // UI
    // ============================================================

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "AE Toolkit", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        function addGrupo(titulo) {
            var p = win.add("panel", undefined, titulo);
            p.orientation = "column";
            p.alignChildren = ["fill", "top"];
            p.margins = [10, 16, 10, 10];
            p.spacing = 4;
            return p;
        }

        function addLinha(parent) {
            var g = parent.add("group");
            g.orientation = "row";
            g.alignChildren = ["fill", "center"];
            g.spacing = 4;
            return g;
        }

        function addBtn(linha, icone, label, tip, fn) {
            var b = linha.add("button", undefined, icone + "  " + label);
            b.preferredSize = [128, 26];
            if (tip) b.helpTip = tip;
            b.onClick = function () {
                try { fn(); } catch (e) { alert(label + " — erro:\n" + e.toString()); }
            };
            return b;
        }

        // --- Projeto ---
        var gProjeto = addGrupo("Projeto");
        var l1 = addLinha(gProjeto);
        addBtn(l1, "🗂", "Declutter", "Organiza o Project Panel em pastas por tipo, conforme a estrutura configurada (botão ao lado).", declutter);
        addBtn(l1, "⚙", "Editar Estrutura", "Edita as categorias/pastas do Declutter (nome + extensões).", editarEstruturaDeclutter);
        var l2 = addLinha(gProjeto);
        addBtn(l2, "🗜", "Reduce Project", "Reduz o projeto às comps selecionadas no Project Panel (ou à comp ativa). Fecha abas órfãs depois.", reduceProject);
        addBtn(l2, "🧹", "Remove Unused", "Remove footage não utilizada no projeto.", removeUnusedFootage);

        // --- Limpeza ---
        var gLimpeza = addGrupo("Limpeza");
        var l3 = addLinha(gLimpeza);
        addBtn(l3, "✕", "Limpar Expressões", "Remove todas as expressões das camadas selecionadas.", limparExpressoes);
        addBtn(l3, "↺", "Reset Layer", "Remove efeitos, expressões e layer styles, e volta Transform aos valores padrão.", resetarLayer);

        // --- Time Remap ---
        var gRemap = addGrupo("Time Remap");
        var l4 = addLinha(gRemap);
        addBtn(l4, "⏸", "Hold Time Remap", "Cria hold no Time Remap a partir do CTI e apaga o último keyframe (evita puxar de volta no fim).", holdTimeRemap);

        // --- Curvas ---
        var gCurvas = addGrupo("Curvas");
        var l5 = addLinha(gCurvas);
        addBtn(l5, "▤", "Copiar Curva", "Copia interpolação/ease dos keyframes selecionados (ou de todas as propriedades animadas).", copiarCurva);
        addBtn(l5, "▥", "Colar Curva", "Cola a curva copiada nos keyframes selecionados.", colarCurva);

        // --- Camadas ---
        var gCamadas = addGrupo("Camadas");
        var l6 = addLinha(gCamadas);
        addBtn(l6, "T↔", "Layer Normalize", "Zera a escala de camadas de texto, absorvendo o valor no tamanho da fonte.", layerNormalize);
        addBtn(l6, "✂", "Quebrar Shapes", "Separa shape layers em objetos, e converte camadas de PSD/vetor em shapes separados por camada.", quebrarShapes);
        var l7 = addLinha(gCamadas);
        addBtn(l7, "⛶", "Precomp Extractor", "Traz os layers de uma precomp (e das aninhadas) para a comp atual.", precompExtractor);
        addBtn(l7, "☰", "Layer Organizer", "Reordena camadas pela posição horizontal na timeline.", layerOrganizer);

        win.layout.layout(true);
        win.layout.resize();
        if (win instanceof Window) {
            win.onResizing = win.onResize = function () { this.layout.resize(); };
            win.center();
            win.show();
        }
        return win;
    }

    buildUI(this);

})();
