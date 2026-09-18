(function(thisObj) {
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Varredor de Layers", undefined, {resizeable: true});
        win.spacing = 10;
        win.margins = 15;

        // --- BUSCA E FILTROS ---
        var searchGroup = win.add("panel", undefined, "Busca e Filtros");
        searchGroup.alignment = "fill";
        searchGroup.alignChildren = "left";
        
        var nameRow = searchGroup.add("group");
        nameRow.add("statictext", undefined, "Nome da Layer (Deixe em branco para todos):");
        var keywordInput = nameRow.add("edittext", undefined, "");
        keywordInput.characters = 20;

        var filterRow = searchGroup.add("group");
        filterRow.add("statictext", undefined, "Tipo:");
        var typeDropdown = filterRow.add("dropdownlist", undefined, ["Todas", "Shape Layers", "Null Objects", "Text Layers", "Solids", "Pre-comps"]);
        typeDropdown.selection = 0;

        var matchRow = searchGroup.add("group");
        var matchExact = matchRow.add("radiobutton", undefined, "Exato");
        var matchContains = matchRow.add("radiobutton", undefined, "Contém");
        matchContains.value = true;

        // --- AÇÃO FATAL ---
        var fatalGroup = win.add("panel", undefined, "Ação Principal");
        fatalGroup.alignment = "fill";
        var deleteLayerChk = fatalGroup.add("checkbox", undefined, "DELETAR LAYER ENCONTRADA");
        deleteLayerChk.graphics.foregroundColor = fatalGroup.graphics.newPen(fatalGroup.graphics.PenType.SOLID_COLOR, [1, 0, 0], 1);

        // --- TRANSFORMAÇÕES ---
        var transGroup = win.add("panel", undefined, "Transformações");
        transGroup.alignment = "fill";
        transGroup.alignChildren = "left";

        var btnGetTrans = transGroup.add("button", undefined, "Copiar Valores da Layer Selecionada (Timeline)");
        btnGetTrans.alignment = "fill";

        function addTransformRow(parent, label, hasY) {
            var g = parent.add("group");
            var chk = g.add("checkbox", undefined, label);
            chk.preferredSize.width = 100;
            var valX = g.add("edittext", undefined, "0");
            valX.characters = 5;
            var valY = null;
            if (hasY) {
                g.add("statictext", undefined, ",");
                valY = g.add("edittext", undefined, "0");
                valY.characters = 5;
            }
            return {chk: chk, x: valX, y: valY};
        }

        var apUI = addTransformRow(transGroup, "Anchor Point", true);
        var posUI = addTransformRow(transGroup, "Position", true);
        var scaleUI = addTransformRow(transGroup, "Scale", true);
        var rotUI = addTransformRow(transGroup, "Rotation", false);
        var opUI = addTransformRow(transGroup, "Opacity", false);

        btnGetTrans.onClick = function() {
            var activeComp = app.project.activeItem;
            if (activeComp != null && activeComp instanceof CompItem && activeComp.selectedLayers.length > 0) {
                var selLayer = activeComp.selectedLayers[0];
                function formatNum(num) { return parseFloat(num.toFixed(2)).toString(); }
                var apVal = selLayer.property("Anchor Point").value;
                var posVal = selLayer.property("Position").value;
                var scaleVal = selLayer.property("Scale").value;
                var rotVal = selLayer.property("Rotation").value;
                var opVal = selLayer.property("Opacity").value;
                apUI.x.text = formatNum(apVal[0]); apUI.y.text = formatNum(apVal[1]);
                posUI.x.text = formatNum(posVal[0]); posUI.y.text = formatNum(posVal[1]);
                scaleUI.x.text = formatNum(scaleVal[0]); scaleUI.y.text = formatNum(scaleVal[1]);
                rotUI.x.text = formatNum(rotVal); opUI.x.text = formatNum(opVal);
                apUI.chk.value = posUI.chk.value = scaleUI.chk.value = rotUI.chk.value = opUI.chk.value = true;
            } else { alert("Selecione uma layer na timeline para copiar os valores."); }
        };

        // --- EFEITOS ---
        var fxGroup = win.add("panel", undefined, "Efeitos");
        fxGroup.alignment = "fill";
        fxGroup.alignChildren = "left";

        var delAllFx = fxGroup.add("checkbox", undefined, "Deletar Todos os Efeitos");
        var delSpecFx = fxGroup.add("checkbox", undefined, "Deletar Efeito por Nome:");
        var specFxName = fxGroup.add("edittext", undefined, "");
        specFxName.alignment = "fill";
        var muteRow = fxGroup.add("group");
        var muteFx = muteRow.add("checkbox", undefined, "Desabilitar (Mute)");
        var unmuteFx = muteRow.add("checkbox", undefined, "Habilitar (Unmute)");
        muteFx.onClick = function() { if (this.value) unmuteFx.value = false; };
        unmuteFx.onClick = function() { if (this.value) muteFx.value = false; };

        // --- TEXTOS ---
        var textSettings = {
            applyFont: false, fontName: "Arial-MT",
            applySize: false, fontSize: "100",
            applyAlign: false, alignIndex: 0,
            applyFillColor: false, fillColorStr: "255, 255, 255",
            applyLeading: false, leading: "120",
            applyTracking: false, tracking: "0"
            // allCaps removido por ser readOnly no After Effects
        };

        var textGroup = win.add("panel", undefined, "Textos");
        textGroup.alignment = "fill";
        var btnTextOpts = textGroup.add("button", undefined, "Opções Avançadas de Texto...");
        btnTextOpts.alignment = "fill";

        btnTextOpts.onClick = function() {
            var textDlg = new Window("dialog", "Configurações de Estilo de Texto");
            textDlg.spacing = 10; textDlg.margins = 20; textDlg.alignChildren = "fill";
            var topBtnGroup = textDlg.add("group");
            var btnGetStyle = topBtnGroup.add("button", undefined, "Copiar Estilo do Texto Selecionado (Timeline)");
            btnGetStyle.alignment = "fill";
            var grid = textDlg.add("group"); grid.orientation = "column"; grid.alignChildren = "left"; grid.spacing = 8;

            function addInputRow(parent, label, settingApplyKey, settingValueKey, inputType, dropOptions) {
                var resGroup = parent.add("group");
                var chk = resGroup.add("checkbox", undefined, label); chk.preferredSize.width = 160;
                chk.value = textSettings[settingApplyKey];
                var inp;
                if (inputType === "edittext") { inp = resGroup.add("edittext", undefined, textSettings[settingValueKey]); inp.characters = 15; }
                else if (inputType === "dropdown") { inp = resGroup.add("dropdownlist", undefined, dropOptions); inp.selection = textSettings[settingValueKey]; }
                return {chk: chk, inp: inp};
            }

            var rowFont = addInputRow(grid, "Alterar Fonte:", "applyFont", "fontName", "edittext");
            var rowSize = addInputRow(grid, "Alterar Tamanho:", "applySize", "fontSize", "edittext");
            var rowColor = addInputRow(grid, "Alterar Cor (R,G,B):", "applyFillColor", "fillColorStr", "edittext");
            var rowLeading = addInputRow(grid, "Alterar Leading:", "applyLeading", "leading", "edittext");
            var rowTracking = addInputRow(grid, "Alterar Tracking:", "applyTracking", "tracking", "edittext");
            var rowAlign = addInputRow(grid, "Alterar Alinhamento:", "applyAlign", "alignIndex", "dropdown", ["Esquerda", "Centro", "Direita"]);

            btnGetStyle.onClick = function() {
                var activeComp = app.project.activeItem;
                if (activeComp != null && activeComp instanceof CompItem && activeComp.selectedLayers.length > 0) {
                    var selLayer = activeComp.selectedLayers[0];
                    if (selLayer instanceof TextLayer) {
                        var textDoc = selLayer.property("Source Text").value;
                        rowFont.inp.text = textDoc.font; rowSize.inp.text = textDoc.fontSize.toString();
                        rowColor.inp.text = Math.round(textDoc.fillColor[0]*255) + ", " + Math.round(textDoc.fillColor[1]*255) + ", " + Math.round(textDoc.fillColor[2]*255);
                        rowLeading.inp.text = textDoc.leading.toString(); rowTracking.inp.text = textDoc.tracking.toString();
                        var j = textDoc.justification;
                        if (j == ParagraphJustification.LEFT_JUSTIFY) rowAlign.inp.selection = 0;
                        else if (j == ParagraphJustification.CENTER_JUSTIFY) rowAlign.inp.selection = 1;
                        else if (j == ParagraphJustification.RIGHT_JUSTIFY) rowAlign.inp.selection = 2;
                        
                        rowFont.chk.value = rowSize.chk.value = rowColor.chk.value = rowLeading.chk.value = rowTracking.chk.value = rowAlign.chk.value = true;
                    } else { alert("Selecione uma Text Layer."); }
                } else { alert("Selecione uma layer de texto na timeline."); }
            };

            var dlgBtns = textDlg.add("group"); dlgBtns.alignment = "center";
            var btnSave = dlgBtns.add("button", undefined, "Salvar"); var btnCancel = dlgBtns.add("button", undefined, "Cancelar");
            btnSave.onClick = function() {
                textSettings.applyFont = rowFont.chk.value; textSettings.fontName = rowFont.inp.text;
                textSettings.applySize = rowSize.chk.value; textSettings.fontSize = rowSize.inp.text;
                textSettings.applyFillColor = rowColor.chk.value; textSettings.fillColorStr = rowColor.inp.text;
                textSettings.applyLeading = rowLeading.chk.value; textSettings.leading = rowLeading.inp.text;
                textSettings.applyTracking = rowTracking.chk.value; textSettings.tracking = rowTracking.inp.text;
                textSettings.applyAlign = rowAlign.chk.value; textSettings.alignIndex = rowAlign.inp.selection.index;
                textDlg.close();
            };
            btnCancel.onClick = function() { textDlg.close(); };
            textDlg.show();
        };

        deleteLayerChk.onClick = function() { var state = !this.value; transGroup.enabled = fxGroup.enabled = textGroup.enabled = state; };

        // --- BOTÃO EXECUTAR (PROCESSAMENTO EM LOTE) ---
        var btnProcessar = win.add("button", undefined, "PROCESSAR");
        btnProcessar.alignment = "fill"; btnProcessar.preferredSize.height = 40;

        btnProcessar.onClick = function() {
            var proj = app.project;
            var tempSelection = proj.selection;
            var selectedItems = [];
            
            // Garantindo que a lista de composições seja capturada de forma estável
            for (var s = 0; s < tempSelection.length; s++) {
                if (tempSelection[s] instanceof CompItem) {
                    selectedItems.push(tempSelection[s]);
                }
            }

            if (selectedItems.length === 0) {
                alert("Selecione as composições no painel Project antes de processar.");
                return;
            }

            app.beginUndoGroup("Varredor de Layers");
            var compsContagem = 0;
            var layersAfetadasTotal = 0;

            try {
                for (var i = 0; i < selectedItems.length; i++) {
                    var comp = selectedItems[i];
                    compsContagem++;

                    for (var j = comp.numLayers; j >= 1; j--) {
                        var curLayer = comp.layer(j);
                        var match = false;
                        
                        // Lógica de Busca por Nome
                        var layerNameLower = curLayer.name.toLowerCase();
                        var searchStrLower = keywordInput.text.toLowerCase();
                        
                        if (searchStrLower === "") {
                            match = true;
                        } else {
                            if (matchExact.value) {
                                if (layerNameLower === searchStrLower) match = true;
                            } else {
                                if (layerNameLower.indexOf(searchStrLower) !== -1) match = true;
                            }
                        }

                        // Lógica de Busca por Tipo
                        if (match) {
                            var typeIdx = typeDropdown.selection.index;
                            if (typeIdx === 1 && !(curLayer instanceof ShapeLayer)) match = false;
                            if (typeIdx === 2 && !curLayer.nullLayer) match = false;
                            if (typeIdx === 3 && !(curLayer instanceof TextLayer)) match = false;
                            if (typeIdx === 4 && !(curLayer.source != null && curLayer.source.mainSource instanceof SolidSource)) match = false;
                            if (typeIdx === 5 && !(curLayer.source != null && curLayer.source instanceof CompItem)) match = false;
                        }

                        if (match) {
                            layersAfetadasTotal++;
                            
                            // Ação Principal: Deletar
                            if (deleteLayerChk.value) {
                                curLayer.remove();
                                continue;
                            }

                            // Transformações
                            if (apUI.chk.value) {
                                var nAP = [parseFloat(apUI.x.text), parseFloat(apUI.y.text)];
                                var oAP = curLayer.property("Anchor Point").value;
                                var oPos = curLayer.property("Position").value;
                                curLayer.property("Anchor Point").setValue(nAP);
                                var diff = [nAP[0] - oAP[0], nAP[1] - oAP[1]];
                                var s = curLayer.property("Scale").value;
                                var cPos = [oPos[0] + (diff[0] * (s[0]/100)), oPos[1] + (diff[1] * (s[1]/100))];
                                curLayer.property("Position").setValue(cPos);
                            }
                            if (posUI.chk.value) curLayer.property("Position").setValue([parseFloat(posUI.x.text), parseFloat(posUI.y.text)]);
                            if (scaleUI.chk.value) curLayer.property("Scale").setValue([parseFloat(scaleUI.x.text), parseFloat(scaleUI.y.text)]);
                            if (rotUI.chk.value) curLayer.property("Rotation").setValue(parseFloat(rotUI.x.text));
                            if (opUI.chk.value) curLayer.property("Opacity").setValue(parseFloat(opUI.x.text));

                            // Efeitos
                            var effects = curLayer.property("Effects");
                            if (effects !== null) {
                                if (delAllFx.value) { for (var k = effects.numProperties; k >= 1; k--) effects.property(k).remove(); }
                                else if (delSpecFx.value && specFxName.text !== "") {
                                    for (var k = effects.numProperties; k >= 1; k--) {
                                        if (effects.property(k).name.toLowerCase().indexOf(specFxName.text.toLowerCase()) !== -1) effects.property(k).remove();
                                    }
                                }
                                if (muteFx.value) curLayer.effectsActive = false; else if (unmuteFx.value) curLayer.effectsActive = true;
                            }

                            // Texto (Aplicação em Lote)
                            if (curLayer instanceof TextLayer) {
                                var sourceTextProp = curLayer.property("Source Text");
                                var textDoc = sourceTextProp.value;
                                var modify = false;

                                if (textSettings.applyFont && textSettings.fontName !== "") { textDoc.font = textSettings.fontName; modify = true; }
                                if (textSettings.applySize && textSettings.fontSize !== "") { textDoc.fontSize = parseFloat(textSettings.fontSize); modify = true; }
                                if (textSettings.applyFillColor && textSettings.fillColorStr !== "") {
                                    var rgbArr = textSettings.fillColorStr.split(",");
                                    if (rgbArr.length >= 3) {
                                        textDoc.applyFill = true;
                                        textDoc.fillColor = [parseFloat(rgbArr[0])/255, parseFloat(rgbArr[1])/255, parseFloat(rgbArr[2])/255];
                                        modify = true;
                                    }
                                }
                                if (textSettings.applyLeading && textSettings.leading !== "") { textDoc.leading = parseFloat(textSettings.leading); modify = true; }
                                if (textSettings.applyTracking && textSettings.tracking !== "") { textDoc.tracking = parseFloat(textSettings.tracking); modify = true; }
                                
                                if (textSettings.applyAlign) {
                                    if (textSettings.alignIndex === 0) textDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
                                    else if (textSettings.alignIndex === 1) textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
                                    else if (textSettings.alignIndex === 2) textDoc.justification = ParagraphJustification.RIGHT_JUSTIFY;
                                    modify = true;
                                }
                                if (modify) sourceTextProp.setValue(textDoc);
                            }
                        }
                    }
                }
            } catch (err) {
                alert("Ocorreu um erro durante o processamento:\n" + err.toString());
            } finally {
                app.endUndoGroup();
                alert("Concluído!\n\nComposições Processadas: " + compsContagem + "\nLayers Afetadas: " + layersAfetadasTotal);
            }
        };

        win.onResizing = win.onResize = function() { this.layout.resize(); };
        if (win instanceof Window) win.show();
    }
    buildUI(thisObj);
})(this);