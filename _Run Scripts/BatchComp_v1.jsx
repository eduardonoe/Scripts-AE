(function(thisObj) {
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Batch Comp Editor", undefined, {resizeable: true});
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;

        // --- GRUPO: DIMENSÕES ---
        var grpDim = win.add("group");
        grpDim.orientation = "row";
        grpDim.add("statictext", undefined, "Largura (px):");
        var editW = grpDim.add("edittext", undefined, "");
        editW.characters = 5;
        grpDim.add("statictext", undefined, "Altura (px):");
        var editH = grpDim.add("edittext", undefined, "");
        editH.characters = 5;

        // --- GRUPO: DURAÇÃO & FRAMERATE ---
        var grpTime = win.add("group");
        grpTime.orientation = "row";
        grpTime.add("statictext", undefined, "Duração (seg):");
        var editDur = grpTime.add("edittext", undefined, "");
        editDur.characters = 5;
        grpTime.add("statictext", undefined, "FPS:");
        var editFPS = grpTime.add("edittext", undefined, "");
        editFPS.characters = 5;

        // --- GRUPO: MOTION BLUR SAMPLES ---
        var grpBlur = win.add("group");
        grpBlur.orientation = "row";
        grpBlur.add("statictext", undefined, "Samples/Frame:");
        var editSPF = grpBlur.add("edittext", undefined, "");
        editSPF.characters = 4;
        grpBlur.add("statictext", undefined, "Adapt Limit:");
        var editASL = grpBlur.add("edittext", undefined, "");
        editASL.characters = 4;

        // --- GRUPO: COR DE FUNDO ---
        var grpColor = win.add("group");
        grpColor.orientation = "row";
        grpColor.add("statictext", undefined, "Cor de Fundo:");
        var btnColor = grpColor.add("button", undefined, "Escolher Cor...");
        var btnClearColor = grpColor.add("button", undefined, "X");
        btnClearColor.preferredSize.width = 25;
        
        var selectedColor = null; 

        btnColor.onClick = function() {
            var colorDecimal = $.colorPicker();
            if (colorDecimal !== -1) {
                var r = (colorDecimal >> 16) & 0xFF;
                var g = (colorDecimal >> 8) & 0xFF;
                var b = colorDecimal & 0xFF;
                selectedColor = [r / 255, g / 255, b / 255];
                btnColor.text = "Cor Selecionada!";
            }
        };

        btnClearColor.onClick = function() {
            selectedColor = null;
            btnColor.text = "Escolher Cor...";
        };

        // --- BOTÃO APLICAR ---
        // É esta variável aqui que o script não estava achando!
        var btnApply = win.add("button", undefined, "Aplicar nas Selecionadas");

        // --- GRUPO: PROGRESSO ---
        var grpProgress = win.add("group");
        grpProgress.orientation = "column";
        grpProgress.alignChildren = ["fill", "center"];
        grpProgress.spacing = 5;
        var txtProgress = grpProgress.add("statictext", undefined, "Preparando...");
        txtProgress.justify = "center";
        var progressBar = grpProgress.add("progressbar", undefined, 0, 100);
        progressBar.preferredSize.height = 15;
        grpProgress.visible = false;
        
        btnApply.onClick = function() {
            var compsToEdit = [];
            var processedIds = {}; // Para evitar duplicatas

            // 1. Coleta do Painel Project
            var projSel = app.project.selection;
            for (var i = 0; i < projSel.length; i++) {
                if (projSel[i] instanceof CompItem) {
                    compsToEdit.push(projSel[i]);
                    processedIds[projSel[i].id] = true;
                }
            }

            // 2. Coleta da Timeline (Camadas selecionadas na comp ativa)
            var activeComp = app.project.activeItem;
            if (activeComp instanceof CompItem) {
                var layerSel = activeComp.selectedLayers;
                for (var j = 0; j < layerSel.length; j++) {
                    var source = layerSel[j].source;
                    // Verifica se a camada é uma composição e se já não foi adicionada pelo Project Panel
                    if (source instanceof CompItem && !processedIds[source.id]) {
                        compsToEdit.push(source);
                        processedIds[source.id] = true;
                    }
                }
            }

            if (compsToEdit.length === 0) {
                alert("Nenhuma composição selecionada no Project Panel ou na Timeline.");
                return;
            }

            var valW = parseInt(editW.text, 10);
            var valH = parseInt(editH.text, 10);
            var valDur = parseFloat(editDur.text);
            var valFPS = parseFloat(editFPS.text);
            var valSPF = parseInt(editSPF.text, 10);
            var valASL = parseInt(editASL.text, 10);

            // --- NOVA VALIDAÇÃO DE LIMITES DO AFTER EFFECTS ---
            if (!isNaN(valSPF) && (valSPF < 2 || valSPF > 64)) {
                alert("Erro: 'Samples/Frame' deve ser um número entre 2 e 64.");
                return;
            }
            if (!isNaN(valASL) && (valASL < 16 || valASL > 128)) {
                alert("Erro: 'Adapt Limit' deve ser um número entre 16 e 128.");
                return;
            }

            var relatorioMudancas = [];
            if (!isNaN(valW) && valW > 0) relatorioMudancas.push("- Largura: " + valW + "px");
            if (!isNaN(valH) && valH > 0) relatorioMudancas.push("- Altura: " + valH + "px");
            if (!isNaN(valDur) && valDur > 0) relatorioMudancas.push("- Duração: " + valDur + " seg");
            if (!isNaN(valFPS) && valFPS > 0) relatorioMudancas.push("- FPS: " + valFPS);
            if (!isNaN(valSPF)) relatorioMudancas.push("- Samples Per Frame: " + valSPF);
            if (!isNaN(valASL)) relatorioMudancas.push("- Adaptive Sample Limit: " + valASL);
            if (selectedColor !== null) relatorioMudancas.push("- Cor de Fundo");

            if (relatorioMudancas.length === 0) {
                alert("Nenhum valor foi preenchido.");
                return;
            }

            grpProgress.visible = true;
            progressBar.maxvalue = compsToEdit.length;

            app.beginUndoGroup("Batch Edit Comps");

            for (var c = 0; c < compsToEdit.length; c++) {
                var comp = compsToEdit[c];
                txtProgress.text = "Processando " + (c + 1) + " de " + compsToEdit.length + "...";
                progressBar.value = c + 1;
                try { win.update(); } catch(err) {} 

                if (!isNaN(valW) && valW > 0) comp.width = valW;
                if (!isNaN(valH) && valH > 0) comp.height = valH;
                if (!isNaN(valDur) && valDur > 0) comp.duration = valDur;
                if (!isNaN(valFPS) && valFPS > 0) comp.frameRate = valFPS;
                if (!isNaN(valSPF)) comp.motionBlurSamplesPerFrame = valSPF;
                if (!isNaN(valASL)) comp.motionBlurAdaptiveSampleLimit = valASL;
                if (selectedColor !== null) comp.bgColor = selectedColor;
            }

            app.endUndoGroup();
            grpProgress.visible = false;

            alert("Sucesso!\n" + compsToEdit.length + " composição(ões) atualizada(s).\n\nCampos alterados:\n" + relatorioMudancas.join("\n"));
        };

        win.onResizing = win.onResize = function() { this.layout.resize(); };
        return win;
    }

    var myPanel = buildUI(thisObj);
    if ((myPanel != null) && (myPanel instanceof Window)) {
        myPanel.center();
        myPanel.show();
    }
})(this);