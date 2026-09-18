// ============================================================
// MOTION TOOLS WIGGLE PRO - Módulo Integrado
// ============================================================

function buildWiggleProUI(secWiggle, mtStatus) {
    
    // -------------------------------------------------------
    // LÓGICA — Helpers de Criação de Efeito
    // -------------------------------------------------------
    function getOrCreateCheck(fx, name, defaultVal) {
        for (var i = 1; i <= fx.numProperties; i++) {
            if (fx.property(i).name === name) return fx.property(i);
        }
        var cb = fx.addProperty("ADBE Checkbox Control");
        cb.name = name; cb.property(1).setValue(defaultVal); return cb;
    }

    function getOrCreateSlider(fx, name, defaultVal) {
        for (var i = 1; i <= fx.numProperties; i++) {
            if (fx.property(i).name === name) return fx.property(i);
        }
        var sl = fx.addProperty("ADBE Slider Control");
        sl.name = name; sl.property(1).setValue(defaultVal); return sl;
    }

    // -------------------------------------------------------
    // LÓGICA — ensureGlobalSliders
    // -------------------------------------------------------
    function ensureGlobalSliders(layer, p, seedValue) {
        var fx = layer.property("ADBE Effect Parade");
        getOrCreateCheck(fx, "Wig Enable", 1);
        getOrCreateSlider(fx, "Wig Freq", p.freq);
        getOrCreateSlider(fx, "Wig Loop (s)", p.loop);

        var seedSlider = getOrCreateSlider(fx, "Wig Seed", seedValue);
        seedSlider.property(1).setValue(seedValue);
    }

    // -------------------------------------------------------
    // LÓGICA — ensureAmpSliders (Suporte a Z)
    // -------------------------------------------------------
    function ensureAmpSliders(layer, dims, params) {
        var fx = layer.property("ADBE Effect Parade");
        var ampNames = {};

        if (dims === 1) {
            var name = "Wig Amp";
            getOrCreateSlider(fx, name, params.ampX);
            ampNames.x = name;
        } else {
            var nameX = "Wig Amp X";
            var nameY = "Wig Amp Y";
            var linkName = "Wig Link X/Y/Z";

            getOrCreateSlider(fx, nameX, params.ampX);
            getOrCreateSlider(fx, nameY, params.ampY);
            ampNames.x = nameX;
            ampNames.y = nameY;

            if (dims >= 3) {
                var nameZ = "Wig Amp Z";
                getOrCreateSlider(fx, nameZ, params.ampZ);
                ampNames.z = nameZ;
            }

            getOrCreateCheck(fx, linkName, params.link ? 1 : 0);
            ampNames.link = linkName;
        }
        return ampNames;
    }

    // -------------------------------------------------------
    // LÓGICA — getPropDims
    // -------------------------------------------------------
    function getPropDims(prop, layer) {
        try { 
            var v = prop.value; 
            if (typeof v === "number") return 1; 
            if (v.length) {
                if (layer && !layer.threeDLayer) {
                    var pGrp = prop.parentProperty;
                    if (pGrp && pGrp.matchName === "ADBE Transform Group") {
                        return 2;
                    }
                }
                return v.length; 
            } 
        } catch(e) {}
        return 1;
    }

    function getPropPath(prop) {
        var path = [];
        while (prop != null && prop.parentProperty != null) {
            path.unshift(prop.propertyIndex);
            prop = prop.parentProperty;
        }
        return path;
    }

    function getPropFromPath(layer, path) {
        var p = layer;
        for(var i = 0; i < path.length; i++) { p = p.property(path[i]); }
        return p;
    }

    // -------------------------------------------------------
    // LÓGICA — buildExpression
    // -------------------------------------------------------
    function buildExpression(refName, dims, ampNames, seedOffset) {
        var ref = refName ? "thisComp.layer(\"" + refName + "\")" : "thisLayer";

        var exp = "var _on = " + ref + ".effect(\"Wig Enable\")(1);\n" +
            "if (_on == 0) { value; } else {\n" +
            "  var _freq = " + ref + ".effect(\"Wig Freq\")(1);\n";

        if (dims === 1) {
            exp += "  var _ampX = " + ref + ".effect(\"" + ampNames.x + "\")(1);\n" +
                   "  var _link = false;\n";
        } else {
            exp += "  var _link = " + ref + ".effect(\"" + ampNames.link + "\")(1) == 1;\n" +
                   "  var _ampX = " + ref + ".effect(\"" + ampNames.x + "\")(1);\n" +
                   "  var _ampY = " + ref + ".effect(\"" + ampNames.y + "\")(1);\n";
            if (ampNames.z) {
                exp += "  var _ampZ = " + ref + ".effect(\"" + ampNames.z + "\")(1);\n";
            }
        }

        var offsetStr = seedOffset ? " + " + seedOffset : "";
        exp += 
            "  var _seed = " + ref + ".effect(\"Wig Seed\")(1)" + offsetStr + ";\n" +
            "  var _loop = " + ref + ".effect(\"Wig Loop (s)\")(1);\n" +
            "\n  function nz(tx, sid) { return (noise([tx + sid*3.7, sid*2.3]) - 0.5) * 2; }\n" +
            "  function ax(amp,sid){\n" +
            "    if(amp===0) return 0;\n" +
            "    if(_loop<=0) return nz(time*_freq,sid)*amp;\n" +
            "    var tt=time%_loop;\n" +
            "    return linear(tt,0,_loop,nz(tt*_freq,sid),nz((tt-_loop)*_freq,sid))*amp;\n" +
            "  }\n\n" +
            "  var _wX = ax(_ampX, _seed);\n";

        if (dims === 1) {
            exp += "  value + _wX;\n}";
        } else if (dims === 2) {
            exp += "  var _wY = _link ? _wX : ax(_ampY, _seed + 100);\n" +
                   "  if (value.length === 2) { [value[0] + _wX, value[1] + _wY]; } else { [value[0] + _wX, value[1] + _wY, value[2]]; }\n}";
        } else if (dims >= 3) {
            exp += "  var _wY = _link ? _wX : ax(_ampY, _seed + 100);\n" +
                   "  var _wZ = _link ? _wX : ax(_ampZ, _seed + 200);\n" +
                   "  if (value.length === 2) { [value[0] + _wX, value[1] + _wY]; } else { [value[0] + _wX, value[1] + _wY, value[2] + _wZ]; }\n}";
        }
        return exp;
    }

    // -------------------------------------------------------
    // LÓGICA — Ações Principais
    // -------------------------------------------------------
    function applyWiggle(useShared, params, statusEl) {
        var comp = app.project.activeItem;
        if (!comp) return;
        var selectedLayers = comp.selectedLayers;
        if (selectedLayers.length === 0) { alert("Selecione uma ou mais layers."); return; }

        var hasPropertySelected = false;
        for (var s = 0; s < selectedLayers.length; s++) {
            if (selectedLayers[s].selectedProperties.length > 0) {
                hasPropertySelected = true; break;
            }
        }
        var fallbackToPosition = !hasPropertySelected;

        app.beginUndoGroup("MotionTools: Aplicar Wiggle");
        try {
            var ctrlLayer = useShared ? selectedLayers[0] : null;
            var sharedSeed = Math.floor(Math.random() * 51);

            if (useShared) ensureGlobalSliders(ctrlLayer, params, sharedSeed);

            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                var layerSeed = Math.floor(Math.random() * 10000) + (i * 137); 
                var propsData = [];

                if (fallbackToPosition) {
                    try {
                        var posProp = layer.property("ADBE Transform Group").property("ADBE Position");
                        if (posProp && posProp.canSetExpression) propsData.push({ path: getPropPath(posProp), dims: getPropDims(posProp, layer) });
                    } catch(e) {}
                } else {
                    for (var sp = 0; sp < layer.selectedProperties.length; sp++) {
                        var prop = layer.selectedProperties[sp];
                        if (prop.canSetExpression) propsData.push({ path: getPropPath(prop), dims: getPropDims(prop, layer) });
                    }
                }

                if (propsData.length > 0) {
                    if (!useShared) ensureGlobalSliders(layer, params, layerSeed);
                    for (var j = 0; j < propsData.length; j++) {
                        var dims = propsData[j].dims;
                        var targetControlLayer = useShared ? ctrlLayer : layer;
                        var ampNames = ensureAmpSliders(targetControlLayer, dims, params);
                        var safeProp = getPropFromPath(layer, propsData[j].path);

                        if (safeProp && safeProp.canSetExpression) {
                            var offset = useShared ? layerSeed : 0;
                            safeProp.expression = buildExpression(useShared ? ctrlLayer.name : null, dims, ampNames, offset);
                        }
                    }
                }
            }
            if (statusEl) statusEl.text = "\u2714 Wiggle aplicado (" + selectedLayers.length + " layer(s))!";
        } catch (e) { alert("Erro ao aplicar: " + e.toString()); }
        app.endUndoGroup();
    }

    function clearWiggle() {
        app.beginUndoGroup("MotionTools: Limpar Wiggle");
        var comp = app.project.activeItem;
        if (!comp || comp.selectedLayers.length === 0) return;
        var count = 0;
        try {
            for (var i = 0; i < comp.selectedLayers.length; i++) {
                var layer = comp.selectedLayers[i];
                
                function clearExp(propGroup) {
                    for (var p = 1; p <= propGroup.numProperties; p++) {
                        var prop = propGroup.property(p);
                        if (prop.propertyType === PropertyType.PROPERTY && prop.canSetExpression && prop.expression && prop.expression.indexOf("Wig Enable") !== -1) {
                            prop.expression = "";
                            count++;
                        } else if (prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP) {
                            clearExp(prop);
                        }
                    }
                }
                clearExp(layer);

                var fx = layer.property("ADBE Effect Parade");
                if (fx) {
                    for (var e = fx.numProperties; e >= 1; e--) {
                        if (fx.property(e).name.indexOf("Wig ") === 0) fx.property(e).remove();
                    }
                }
            }
            if (mtStatus) mtStatus.text = count > 0 ? "\u2714 Limpo em " + count + " propriedade(s)." : "\u26A0 Nenhum Wiggle encontrado.";
        } catch (e) { alert("Erro ao limpar: " + e); }
        app.endUndoGroup();
    }

    function bakeWiggle() {
        var comp = app.project.activeItem;
        if (!comp || comp.selectedLayers.length === 0) {
            alert("Selecione a(s) propriedade(s) que deseja converter em keyframes.");
            return;
        }

        var hasExprSelected = false;
        for (var i = 0; i < comp.selectedLayers.length; i++) {
            var props = comp.selectedLayers[i].selectedProperties;
            for (var p = 0; p < props.length; p++) {
                if (props[p].canSetExpression && props[p].expression !== "") {
                    hasExprSelected = true;
                    break;
                }
            }
            if (hasExprSelected) break;
        }

        if (!hasExprSelected) {
            alert("\u26A0\uFE0F Seleção Inválida para Bake!\n\nVocê precisa clicar e selecionar a propriedade exata (que contém a expressão do Wiggle) na timeline antes de clicar em Bake.");
            return;
        }

        app.beginUndoGroup("MotionTools: Bake Wiggle");
        try {
            app.executeCommand(2639); 
            
            for (var i = 0; i < comp.selectedLayers.length; i++) {
                var fx = comp.selectedLayers[i].property("ADBE Effect Parade");
                if (fx) {
                    for (var e = fx.numProperties; e >= 1; e--) {
                        if (fx.property(e).name.indexOf("Wig ") === 0) fx.property(e).remove();
                    }
                }
            }
            if (mtStatus) mtStatus.text = "\u2714 Keyframes gerados e painel limpo!";
        } catch (e) {
            alert("Erro no Bake: " + e.toString());
        }
        app.endUndoGroup();
    }

    // -------------------------------------------------------
    // UI — Construção Injetada
    // -------------------------------------------------------
    var wGrpPreset = secWiggle.add("group");
    wGrpPreset.orientation = "row";
    wGrpPreset.add("statictext", undefined, "Preset:");
    var wListPreset = wGrpPreset.add("dropdownlist", undefined, ["Customizado...", "Terremoto / Tremor", "Flutuação Suave", "Flicker (Opacidade)"]);
    wListPreset.selection = 0;

    var wRow1 = secWiggle.add("group");
    wRow1.orientation = "row";
    wRow1.alignChildren = ["center", "center"];
    wRow1.alignment = ["fill", "center"];
    
    wRow1.add("statictext", undefined, "Freq:");
    var wInFreq = wRow1.add("edittext", undefined, "2");
    wInFreq.preferredSize.width = 40;

    wRow1.add("statictext", undefined, "   Loop:");
    var wInLoop = wRow1.add("edittext", undefined, "0");
    wInLoop.preferredSize.width = 40;

    var wRow2 = secWiggle.add("group");
    wRow2.orientation = "row";
    wRow2.alignChildren = ["center", "center"];
    wRow2.alignment = ["fill", "center"];
    
    var wLblAmp = wRow2.add("statictext", undefined, "Amp:");
    var wInAmp = wRow2.add("edittext", undefined, "50");
    wInAmp.preferredSize.width = 40;

    var wLblAmpX = wRow2.add("statictext", undefined, "X:");
    var wInAmpX = wRow2.add("edittext", undefined, "50");
    wInAmpX.preferredSize.width = 30;
    var wLblAmpY = wRow2.add("statictext", undefined, "Y:");
    var wInAmpY = wRow2.add("edittext", undefined, "50");
    wInAmpY.preferredSize.width = 30;
    var wLblAmpZ = wRow2.add("statictext", undefined, "Z:");
    var wInAmpZ = wRow2.add("edittext", undefined, "50");
    wInAmpZ.preferredSize.width = 30;

    wLblAmpX.visible = false; wInAmpX.visible = false;
    wLblAmpY.visible = false; wInAmpY.visible = false;
    wLblAmpZ.visible = false; wInAmpZ.visible = false;

    var wChkLink = secWiggle.add("checkbox", undefined, "Linkar Dimensões");
    wChkLink.value = true;

    function updateLinkUI() {
        var linked = wChkLink.value;
        wLblAmp.visible = linked; wInAmp.visible = linked;
        wLblAmpX.visible = !linked; wInAmpX.visible = !linked;
        wLblAmpY.visible = !linked; wInAmpY.visible = !linked;
        wLblAmpZ.visible = !linked; wInAmpZ.visible = !linked;
        
        if (!linked) {
            wInAmpX.text = wInAmp.text;
            wInAmpY.text = wInAmp.text;
            wInAmpZ.text = wInAmp.text;
        }
        
        // Força atualização da UI principal
        try {
            var root = secWiggle;
            while (root.parent) root = root.parent;
            if (root.layout) root.layout.layout(true);
        } catch(e){}
    }
    wChkLink.onClick = updateLinkUI;

    wListPreset.onChange = function() {
        if (!wListPreset.selection) return;
        var sel = wListPreset.selection.index;
        if (sel === 1) { wInFreq.text = "15"; wInAmp.text = "80"; wInLoop.text = "0"; wChkLink.value = true; } 
        else if (sel === 2) { wInFreq.text = "0.5"; wInAmp.text = "15"; wInLoop.text = "0"; wChkLink.value = true; } 
        else if (sel === 3) { wInFreq.text = "24"; wInAmp.text = "100"; wInLoop.text = "0"; wChkLink.value = true; }
        updateLinkUI();
    };

    function resetToCustom() { wListPreset.selection = 0; }
    wInFreq.onChanging = resetToCustom;
    wInAmp.onChanging = resetToCustom;
    wInAmpX.onChanging = resetToCustom;
    wInAmpY.onChanging = resetToCustom;
    wInAmpZ.onChanging = resetToCustom;
    wInLoop.onChanging = resetToCustom;

    var wSwitchGrp = secWiggle.add("group");
    wSwitchGrp.orientation = "row";
    wSwitchGrp.alignChildren = ["center", "center"];
    var wRbEach = wSwitchGrp.add("radiobutton", undefined, "Cada layer");
    var wRbShared = wSwitchGrp.add("radiobutton", undefined, "Compartilhada");
    wRbEach.value = true;

    var wGrpBtns = secWiggle.add("group");
    wGrpBtns.orientation = "row";
    wGrpBtns.alignChildren = ["center", "center"];
    
    var btnWiggle = wGrpBtns.add("button", undefined, "Aplicar");
    var btnBake = wGrpBtns.add("button", undefined, "Bake");
    var btnClear = wGrpBtns.add("button", undefined, "Limpar");
    
    btnWiggle.preferredSize.width = 80;
    btnBake.preferredSize.width = 50;
    btnClear.preferredSize.width = 60;

    btnWiggle.onClick = function () {
        var linked = wChkLink.value;
        var valFreq = parseFloat(wInFreq.text) || 2;
        var valLoop = parseFloat(wInLoop.text) || 0;

        var valAmpX, valAmpY, valAmpZ;
        if (linked) {
            valAmpX = parseFloat(wInAmp.text) || 50;
            valAmpY = valAmpX; valAmpZ = valAmpX;
        } else {
            valAmpX = parseFloat(wInAmpX.text) || 50;
            valAmpY = parseFloat(wInAmpY.text) || 50;
            valAmpZ = parseFloat(wInAmpZ.text) || 50;
        }
        var params = { freq: valFreq, ampX: valAmpX, ampY: valAmpY, ampZ: valAmpZ, loop: valLoop, link: linked };
        applyWiggle(wRbShared.value, params, mtStatus);
    };

    btnBake.onClick = bakeWiggle;
    btnClear.onClick = clearWiggle;
}