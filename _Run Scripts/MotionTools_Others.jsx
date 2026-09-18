// ============================================================
// MOTION TOOLS OTHERS - Utilitários Avulsos
// ============================================================

function buildOthers_UI(parentPanel, buildSectionHelper, COLORS, mtStatus) {

    var sec = buildSectionHelper(parentPanel, "Others", COLORS.others[0], COLORS.others[1], COLORS.others[2], false);

    // ==========================================
    // UI: LABEL COLOR RANDOMIZER
    // ==========================================

    var lblTitle = sec.add("statictext", undefined, "Label Color");
    lblTitle.graphics.font = ScriptUI.newFont("Arial", "BOLD", 10);

    var btnSame = sec.add("button", undefined, "🎨  MESMA COR PARA TODAS");
    btnSame.preferredSize[1] = 28;
    btnSame.helpTip = "Sorteia UMA cor de label e aplica em todas as layers selecionadas";

    var btnEach = sec.add("button", undefined, "🎲  COR DIFERENTE POR LAYER");
    btnEach.preferredSize[1] = 28;
    btnEach.helpTip = "Sorteia uma cor de label diferente para cada layer selecionada";

    // ==========================================
    // UI: BAKE PARENTS
    // ==========================================
    
    var sep = sec.add("panel"); // Linha separadora subtil
    sep.alignment = "fill";
    sep.preferredSize[1] = 2;

    var btnBakeParents = sec.add("button", undefined, "⚓  BAKE PARENTS");
    btnBakeParents.preferredSize[1] = 28;
    btnBakeParents.helpTip = "Faz o bake do movimento da layer e desparenta, preservando a animação visual em keyframes.";

    // ==========================================
    // UI: SMART COPY ALL
    // ==========================================

    var sep2 = sec.add("panel");
    sep2.alignment = "fill";
    sep2.preferredSize[1] = 2;

    var btnSmartCopy = sec.add("button", undefined, "📋  SMART COPY ALL");
    btnSmartCopy.preferredSize[1] = 28;
    btnSmartCopy.helpTip = "Copia de forma inteligente os atributos da layer selecionada.\nInclui: Efeitos, Animadores de Texto, Máscaras, Estilos e propriedades com Keyframes/Expressões.";

    // ==========================================
    // LÓGICA: LABELS
    // ==========================================

    var AE_LABEL_NAMES = [
        "None",       // 0 — nunca usado (evitamos aplicar "sem cor")
        "Red",        // 1
        "Yellow",     // 2
        "Aqua",       // 3
        "Pink",       // 4
        "Lavender",   // 5
        "Peach",      // 6
        "Sea Foam",   // 7
        "Blue",       // 8
        "Green",      // 9
        "Purple",     // 10
        "Orange",     // 11
        "Brown",      // 12
        "Fuchsia",    // 13
        "Cyan",       // 14
        "Sandstone",  // 15
        "Dark Green"  // 16
    ];

    function randomLabel() {
        return Math.floor(Math.random() * 16) + 1;
    }

    function getLabelName(idx) {
        return (idx >= 0 && idx < AE_LABEL_NAMES.length) ? AE_LABEL_NAMES[idx] : "Label " + idx;
    }

    function getSelectedLayers() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return null;
        var selected = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).selected) selected.push(comp.layer(i));
        }
        return selected;
    }

    btnSame.onClick = function () {
        var layers = getSelectedLayers();
        if (!layers || layers.length === 0) {
            if (mtStatus) mtStatus.text = "⚠ Nenhuma layer selecionada.";
            return;
        }
        var labelIdx = randomLabel();
        app.beginUndoGroup("Others: Label mesma cor");
        try {
            for (var i = 0; i < layers.length; i++) layers[i].label = labelIdx;
            if (mtStatus) mtStatus.text = "✔ " + getLabelName(labelIdx) + " → " + layers.length + " layer(s).";
        } catch (e) {
            if (mtStatus) mtStatus.text = "✗ Erro: " + e.message;
        }
        app.endUndoGroup();
    };

    btnEach.onClick = function () {
        var layers = getSelectedLayers();
        if (!layers || layers.length === 0) {
            if (mtStatus) mtStatus.text = "⚠ Nenhuma layer selecionada.";
            return;
        }
        app.beginUndoGroup("Others: Label por layer");
        try {
            for (var i = 0; i < layers.length; i++) layers[i].label = randomLabel();
            if (mtStatus) mtStatus.text = "✔ " + layers.length + " cor(es) aleatória(s) aplicada(s).";
        } catch (e) {
            if (mtStatus) mtStatus.text = "✗ Erro: " + e.message;
        }
        app.endUndoGroup();
    };

    // ==========================================
    // LÓGICA: BAKE PARENTS (V3)
    // ==========================================

    btnBakeParents.onClick = function () {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Abra uma composição primeiro.");
            return;
        }

        var selected = comp.selectedLayers;
        if (!selected || selected.length === 0) {
            alert("Selecione ao menos uma layer na timeline.");
            return;
        }

        var withParent = [];
        for (var i = 0; i < selected.length; i++) {
            if (selected[i].parent) withParent.push(selected[i]);
        }

        if (withParent.length === 0) {
            alert("Nenhuma layer selecionada tem pai.\nSelecione layers que estejam parentadas.");
            return;
        }

        function getTGProp(layer, matchName) {
            try {
                var tg = layer.property("ADBE Transform Group");
                if (!tg) return null;
                return tg.property(matchName) || null;
            } catch(e) { return null; }
        }

        function clearKeys(prop) {
            try {
                while (prop.numKeys > 0) prop.removeKey(1);
            } catch(e) {}
        }

        function bakeLayer(layer, comp, sampleEvery) {
            if (!layer.parent) return false;

            var fps      = comp.frameRate;
            var frameDur = 1 / fps;
            var step     = frameDur * sampleEvery;

            var startT = layer.inPoint;
            var endT   = layer.outPoint;
            var is3D   = layer.threeDLayer === true;

            var tempNull = comp.layers.addNull();
            tempNull.name = "Bake_Temp_" + layer.index;
            tempNull.enabled = false; 

            var pProp = getTGProp(tempNull, "ADBE Position");
            var rProp = getTGProp(tempNull, "ADBE Rotate Z");
            var sProp = getTGProp(tempNull, "ADBE Scale");

            pProp.expression = "thisComp.layer(" + layer.index + ").toWorld(thisComp.layer(" + layer.index + ").transform.anchorPoint);";
            rProp.expression = "var L = thisComp.layer(" + layer.index + "); var r = L.transform.rotation; while(L.hasParent){ L = L.parent; r += L.transform.rotation; } r;";
            sProp.expression = "var L = thisComp.layer(" + layer.index + "); var s = L.transform.scale; while(L.hasParent){ s = [s[0]*L.parent.transform.scale[0]/100, s[1]*L.parent.transform.scale[1]/100]; L = L.parent; } s;";

            var samples = [];
            var t = startT;

            while (t <= endT + 0.0001) {
                samples.push({
                    t: t,
                    pos: pProp.valueAtTime(t, false),
                    rot: rProp.valueAtTime(t, false),
                    sca: sProp.valueAtTime(t, false)
                });
                t += step;
            }

            tempNull.remove();
            layer.parent = null;

            var targetPos = getTGProp(layer, "ADBE Position");
            var targetRot = getTGProp(layer, "ADBE Rotate Z");
            var targetSca = getTGProp(layer, "ADBE Scale");

            clearKeys(targetPos);
            clearKeys(targetRot);
            clearKeys(targetSca);

            for (var i = 0; i < samples.length; i++) {
                var s = samples[i];
                var finalPos = is3D ? [s.pos[0], s.pos[1], s.pos[2]] : [s.pos[0], s.pos[1]];
                try { targetPos.setValueAtTime(s.t, finalPos); } catch(e) {}
                try { targetRot.setValueAtTime(s.t, s.rot); } catch(e) {}
                try { targetSca.setValueAtTime(s.t, [s.sca[0], s.sca[1], 100]); } catch(e) {}
            }

            return true;
        }

        function showDialog(selectedLayers) {
            var dlg = new Window("dialog", "Bake Parents — Opções");
            dlg.orientation   = "column";
            dlg.alignChildren = ["fill", "top"];
            dlg.spacing       = 10;
            dlg.margins       = [16, 16, 16, 16];

            var infoSt = dlg.add("statictext", undefined, selectedLayers.length + " layer(s) selecionada(s).");
            infoSt.graphics.font = ScriptUI.newFont("Arial", "BOLD", 11);

            var semPai = 0;
            for (var i = 0; i < selectedLayers.length; i++) {
                if (!selectedLayers[i].parent) semPai++;
            }
            if (semPai > 0) {
                var warnGrp = dlg.add("group");
                warnGrp.orientation = "row";
                warnGrp.add("statictext", undefined, "⚠");
                var warnSt = warnGrp.add("statictext", undefined, semPai + " layer(s) sem pai — ignoradas.");
                warnSt.graphics.font = ScriptUI.newFont("Arial", "ITALIC", 10);
            }

            var sampPanel = dlg.add("panel", undefined, "Amostragem");
            sampPanel.orientation   = "column";
            sampPanel.alignChildren = ["fill", "top"];
            sampPanel.margins       = [10, 14, 10, 10];
            
            var rbEvery1  = sampPanel.add("radiobutton", undefined, "Todo frame  (máxima precisão)");
            var rbEvery2  = sampPanel.add("radiobutton", undefined, "A cada 2 frames  (mais leve)");
            var rbEvery4  = sampPanel.add("radiobutton", undefined, "A cada 4 frames  (animações lentas)");
            rbEvery1.value = true;

            var btnGrp = dlg.add("group");
            btnGrp.orientation   = "row";
            btnGrp.alignChildren = ["center", "center"];
            btnGrp.alignment     = ["fill", "bottom"];

            var btnCancel = btnGrp.add("button", undefined, "Cancelar");
            var btnOk     = btnGrp.add("button", undefined, "▶  Bake");

            var result = null;
            btnOk.onClick = function () {
                var every = 1;
                if (rbEvery2.value) every = 2;
                if (rbEvery4.value) every = 4;
                result = { sampleEvery: every };
                dlg.close();
            };
            btnCancel.onClick = function () { dlg.close(); };

            dlg.center();
            dlg.show();
            return result;
        }

        var options = showDialog(selected);
        if (!options) return;

        app.beginUndoGroup("MotionTools: Bake Parents");

        var bakedCount  = 0;
        var errorCount  = 0;

        for (var s = 0; s < selected.length; s++) {
            var layer = selected[s];
            if (!layer.parent) continue; 

            try {
                var ok = bakeLayer(layer, comp, options.sampleEvery);
                if (ok) bakedCount++;
            } catch (e) {
                errorCount++;
                alert("Erro na layer '" + layer.name + "':\n" + e.toString());
            }
        }

        app.endUndoGroup();

        if (mtStatus) mtStatus.text = "✔ Bake: " + bakedCount + " layer(s) desparentada(s).";
        if (errorCount > 0) alert(errorCount + " erro(s) — verifique o console.");
    };

    // ==========================================
    // LÓGICA: SMART COPY ALL
    // ==========================================

    btnSmartCopy.onClick = function () {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Abra uma composição primeiro.");
            return;
        }

        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length !== 1) {
            alert("Por favor, selecione EXATAMENTE 1 layer para copiar os atributos.");
            return;
        }

        var layer = selectedLayers[0];

        app.beginUndoGroup("MotionTools: Smart Copy All");

        // 1. Deseleciona todas as propriedades para evitar copiar lixo
        var selProps = layer.selectedProperties;
        for (var p = 0; p < selProps.length; p++) {
            try { selProps[p].selected = false; } catch(e) {}
        }

        var copiedCount = 0;
        var copiedTypes = {
            efeitos: 0,
            animadores: 0,
            mascaras: 0,
            estilos: 0,
            propriedades: 0 // (Position, Scale, Path, etc com keyframes/expressões)
        };

        // 2. Função recursiva que vasculha a layer inteira
        function scanProperties(propGroup) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var child = propGroup.property(i);

                try {
                    // A) Copiar grupos inteiros (Efeitos, Textos, Máscaras, Estilos)
                    if (propGroup.matchName === "ADBE Effect Parade") {
                        child.selected = true;
                        copiedCount++;
                        copiedTypes.efeitos++;
                        continue; // Pula os filhos pra não dar conflito no Ctrl+C
                    }
                    if (propGroup.matchName === "ADBE Text Animators") {
                        child.selected = true;
                        copiedCount++;
                        copiedTypes.animadores++;
                        continue;
                    }
                    if (propGroup.matchName === "ADBE Mask Parade") {
                        child.selected = true;
                        copiedCount++;
                        copiedTypes.mascaras++;
                        continue;
                    }
                    if (propGroup.matchName === "ADBE Layer Styles" && child.matchName !== "ADBE Blend Options Group") {
                        child.selected = true;
                        copiedCount++;
                        copiedTypes.estilos++;
                        continue;
                    }

                    // B) Se for uma propriedade final (Position, Path, Slider, etc)
                    if (child.propertyType === PropertyType.PROPERTY) {
                        var hasKeys = child.numKeys > 0;
                        var hasExpr = child.canSetExpression && child.expression !== "";

                        // Só seleciona se tiver animação ou expressão
                        if (hasKeys || hasExpr) {
                            child.selected = true;
                            copiedCount++;
                            copiedTypes.propriedades++;
                        }
                    }
                    // C) Se for uma "pasta" (Transform, Shape Contents, etc), vasculha dentro dela
                    else if (child.propertyType === PropertyType.INDEXED_GROUP || child.propertyType === PropertyType.NAMED_GROUP) {
                        scanProperties(child);
                    }
                } catch(e) {
                    // Ignora erros silenciosos em propriedades ocultas/bloqueadas do AE
                }
            }
        }

        // Dispara a varredura a partir da raiz da layer
        scanProperties(layer);

        // Verifica se encontrou algo útil para copiar
        if (copiedCount === 0) {
            alert("A layer '" + layer.name + "' não possui Efeitos, Máscaras, Animadores, Keyframes ou Expressões para serem copiados.");
            app.endUndoGroup();
            return;
        }

        // 3. Executa o comando nativo de COPIAR (Ctrl+C)
        app.executeCommand(19);

        app.endUndoGroup();

        // 4. Feedback detalhado do que foi para a área de transferência
        if (mtStatus) mtStatus.text = "✔ Smart Copy: " + copiedCount + " itens copiados da layer.";
        
        var msg = "✔ Cópia realizada com sucesso!\n\n";
        if (copiedTypes.efeitos > 0) msg += "• " + copiedTypes.efeitos + " Efeito(s)\n";
        if (copiedTypes.animadores > 0) msg += "• " + copiedTypes.animadores + " Animador(es) de Texto\n";
        if (copiedTypes.mascaras > 0) msg += "• " + copiedTypes.mascaras + " Máscara(s)\n";
        if (copiedTypes.estilos > 0) msg += "• " + copiedTypes.estilos + " Estilo(s) de Layer\n";
        if (copiedTypes.propriedades > 0) msg += "• " + copiedTypes.propriedades + " Propriedade(s) c/ Keyframes ou Expressões\n";
        msg += "\nAgora selecione a(s) layer(s) de destino e cole (Ctrl+V).";

        alert(msg);
    };
}