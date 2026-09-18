// ============================================================
// MOTION TOOLS CORE B - Ease Controls e Anchor Tools
// Atualização: Memória persistente e Anchor Point com Truque de Shape Layer
// ============================================================

function buildCoreB_UI(parentPanel, buildSectionHelper, COLORS, mtStatus, memTools) {
    
    // Funções auxiliares injetadas do painel principal para salvar e ler configurações
    var getSet = memTools ? memTools.get : function(k,f){return f;};
    var saveSet = memTools ? memTools.set : function(k,v){};

    // Resgatando valores da última sessão (ou 0 se não existir)
    var easeOutVal  = parseFloat(getSet("MT_EaseOut", "0")) || 0;
    var easeInVal   = parseFloat(getSet("MT_EaseIn", "0")) || 0;
    var easeBothVal = parseFloat(getSet("MT_EaseBoth", "0")) || 0;

    // ==========================================
    // UI: EASE
    // ==========================================
    var secEase = buildSectionHelper(parentPanel, "Ease Controls", COLORS.ease[0], COLORS.ease[1], COLORS.ease[2]);
    function addEaseRow(iconLabel, shapeLabel, helpTextShape, container) {
        var grp = container.add("group"); grp.orientation = "row"; grp.alignChildren = ["center", "center"];
        var lbl = grp.add("statictext", undefined, iconLabel); lbl.graphics.font = ScriptUI.newFont("Arial", "BOLD", 18); lbl.preferredSize.width = 18; lbl.justify = "center";
        var sld = grp.add("slider", undefined, 0, 0, 100); sld.preferredSize.width = 135;
        var txt = grp.add("edittext", undefined, "0"); txt.preferredSize.width = 30; txt.justify = "center";
        var btn = grp.add("button", undefined, shapeLabel); btn.preferredSize.width = 25; btn.preferredSize.height = 25; btn.helpTip = helpTextShape;
        return {grp: grp, sld: sld, txt: txt, btn: btn};
    }
    
    var rowOut = addEaseRow("‹", "◆", "Keyframes Lineares", secEase); 
    rowOut.sld.value = easeOutVal; 
    rowOut.txt.text = Math.round(easeOutVal).toString();

    var rowIn = addEaseRow("›", "■", "Keyframes Hold", secEase);
    rowIn.sld.value = easeInVal; 
    rowIn.txt.text = Math.round(easeInVal).toString();

    var btnApplySliders = secEase.add("button", undefined, "✔  APPLY SLIDERS"); btnApplySliders.preferredSize[1] = 24;
    
    var rowBoth = addEaseRow("×", "●", "Easy Ease Automático", secEase);
    rowBoth.sld.value = easeBothVal; 
    rowBoth.txt.text = Math.round(easeBothVal).toString();


    // Flags para controle de drag contínuo (undo group aberto apenas uma vez por arraste)
    var _draggingOutIn = false;
    var _draggingBoth  = false;

    function applyBothSliders(skipUndo) { applyCustomEaseValues(Math.max(0.1, Math.min(100, parseFloat(rowOut.sld.value))), Math.max(0.1, Math.min(100, parseFloat(rowIn.sld.value))), mtStatus, skipUndo); }

    rowOut.sld.onChanging = function() {
        rowOut.txt.text = Math.round(this.value);
        if (!_draggingOutIn) { app.beginUndoGroup("Apply Custom Ease"); _draggingOutIn = true; }
        applyBothSliders(true);
    };
    rowOut.sld.onChange = function() {
        rowOut.txt.text = Math.round(this.value);
        saveSet("MT_EaseOut", this.value.toString()); // Salva na memória
        if (_draggingOutIn) { applyBothSliders(true); app.endUndoGroup(); _draggingOutIn = false; }
        else { applyBothSliders(false); }
    };
    rowOut.txt.onChange = function() { 
        var val = Math.max(0, Math.min(100, parseFloat(this.text) || 0)); 
        this.text = Math.round(val); 
        rowOut.sld.value = val; 
        saveSet("MT_EaseOut", val.toString()); // Salva na memória
        applyBothSliders(false); 
    };

    rowIn.sld.onChanging = function() {
        rowIn.txt.text = Math.round(this.value);
        if (!_draggingOutIn) { app.beginUndoGroup("Apply Custom Ease"); _draggingOutIn = true; }
        applyBothSliders(true);
    };
    rowIn.sld.onChange = function() {
        rowIn.txt.text = Math.round(this.value);
        saveSet("MT_EaseIn", this.value.toString()); // Salva na memória
        if (_draggingOutIn) { applyBothSliders(true); app.endUndoGroup(); _draggingOutIn = false; }
        else { applyBothSliders(false); }
    };
    rowIn.txt.onChange = function() { 
        var val = Math.max(0, Math.min(100, parseFloat(this.text) || 0)); 
        this.text = Math.round(val); 
        rowIn.sld.value = val; 
        saveSet("MT_EaseIn", val.toString()); // Salva na memória
        applyBothSliders(false); 
    };

    rowBoth.sld.onChanging = function() {
        rowBoth.txt.text = Math.round(this.value);
        if (!_draggingBoth) { app.beginUndoGroup("Apply Ease Sliders"); _draggingBoth = true; }
        applyEase("both", this.value, true);
    };
    rowBoth.sld.onChange = function() {
        rowBoth.txt.text = Math.round(this.value);
        saveSet("MT_EaseBoth", this.value.toString()); // Salva na memória
        if (_draggingBoth) { applyEase("both", this.value, true); app.endUndoGroup(); _draggingBoth = false; }
        else { applyEase("both", this.value, false); }
    };
    rowBoth.txt.onChange = function() { 
        var val = Math.max(0, Math.min(100, parseFloat(this.text) || 0)); 
        this.text = Math.round(val); 
        rowBoth.sld.value = val; 
        saveSet("MT_EaseBoth", val.toString()); // Salva na memória
        applyEase("both", val, false); 
    };

    btnApplySliders.onClick = function() { applyBothSliders(false); };
    
    rowOut.btn.onClick = function() { 
        setInterp(KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); 
        rowOut.txt.text = "0"; rowOut.sld.value = 0; 
        rowIn.txt.text = "0"; rowIn.sld.value = 0; 
        rowBoth.txt.text = "0"; rowBoth.sld.value = 0; 
        saveSet("MT_EaseOut", "0"); saveSet("MT_EaseIn", "0"); saveSet("MT_EaseBoth", "0");
    };
    
    rowIn.btn.onClick = function() { setInterp(KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD); };
    
    rowBoth.btn.onClick = function() {
        var comp = app.project.activeItem; if (!comp) return; var props = comp.selectedProperties; if (props.length === 0) return;
        app.beginUndoGroup("Auto Bezier Naming");
        for (var p = 0; p < props.length; p++) {
            var prop = props[p]; if (!prop.canVaryOverTime || prop.selectedKeys.length === 0) continue;
            for (var k = 0; k < prop.selectedKeys.length; k++) {
                var keyIdx = prop.selectedKeys[k]; prop.setInterpolationTypeAtKey(keyIdx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER); prop.setTemporalAutoBezierAtKey(keyIdx, true);
                if (prop.isSpatial) prop.setSpatialAutoBezierAtKey(keyIdx, true);
            }
        }
        app.endUndoGroup(); 
        rowBoth.txt.text = "0"; rowBoth.sld.value = 0; 
        rowOut.txt.text = "0"; rowOut.sld.value = 0; 
        rowIn.txt.text = "0"; rowIn.sld.value = 0;
        saveSet("MT_EaseOut", "0"); saveSet("MT_EaseIn", "0"); saveSet("MT_EaseBoth", "0");
    };

    // ==========================================
    // UI: ANCHOR TOOLS
    // ==========================================
    var secAnchor = buildSectionHelper(parentPanel, "Anchor Tools", COLORS.anchor[0], COLORS.anchor[1], COLORS.anchor[2], true);
    var apGrid = [ [ { l:"\u2196", h:"left", v:"top" }, { l:"\u2191", h:"center", v:"top" }, { l:"\u2197", h:"right", v:"top" } ], [ { l:"\u2190", h:"left", v:"center" }, { l:"\u25cf", h:"center", v:"center" }, { l:"\u2192", h:"right", v:"center" } ], [ { l:"\u2199", h:"left", v:"bottom" }, { l:"\u2193", h:"center", v:"bottom" }, { l:"\u2198", h:"right", v:"bottom" } ] ];
    for (var apRow = 0; apRow < 3; apRow++) {
        var apRowGrp = secAnchor.add("group"); apRowGrp.orientation = "row"; apRowGrp.alignChildren = ["center", "center"]; apRowGrp.alignment = ["center", "top"]; apRowGrp.spacing = 4;
        for (var apCol = 0; apCol < 3; apCol++) {
            (function(cell) {
                var btn = apRowGrp.add("button", undefined, cell.l); btn.preferredSize = [36, 36]; btn.helpTip = "Anchor: " + cell.h + " / " + cell.v;
                if (cell.h === "center" && cell.v === "center") { try { btn.graphics.foregroundColor = btn.graphics.newPen(btn.graphics.PenType.SOLID_COLOR, [COLORS.anchor[0], COLORS.anchor[1], COLORS.anchor[2], 1], 1); } catch(e){} }
                btn.onClick = function() { setAnchorPoint(cell.h, cell.v, mtStatus); };
            })(apGrid[apRow][apCol]);
        }
    }
    var btnAnchorToComp = secAnchor.add("button", undefined, "\u25ce  Anchor \u2192 Centro da Comp"); btnAnchorToComp.preferredSize[1] = 28;
    var btnAnchorToNull = secAnchor.add("button", undefined, "\u25c9  Anchor \u2192 Posi\u00e7\u00e3o da Null"); btnAnchorToNull.preferredSize[1] = 28;
    btnAnchorToComp.onClick = function() { anchorToComp(mtStatus); }; btnAnchorToNull.onClick = function() { anchorToNull(mtStatus); };


    // =======================================================
    // LÓGICA: EASE CONTROLS
    // =======================================================
    function applyCustomEaseValues(outInf, inInf, statusEl, skipUndo) {
        var comp = app.project.activeItem; if (!comp) return;
        var props = comp.selectedProperties; if (props.length === 0) return;
        var _outInf = Math.max(0.1, Math.min(100, parseFloat(outInf))); var _inInf  = Math.max(0.1, Math.min(100, parseFloat(inInf)));
        if (!skipUndo) app.beginUndoGroup("Apply Custom Ease");
        for (var p = 0; p < props.length; p++) {
            var prop = props[p]; if (!prop.canVaryOverTime || prop.selectedKeys.length === 0) continue;
            for (var k = 0; k < prop.selectedKeys.length; k++) {
                var keyIdx = prop.selectedKeys[k]; prop.setInterpolationTypeAtKey(keyIdx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                var inEases = prop.keyInTemporalEase(keyIdx); var newIn = [], newOut = [];
                for (var d = 0; d < inEases.length; d++) { newIn.push(new KeyframeEase(0, _inInf)); newOut.push(new KeyframeEase(0, _outInf)); }
                prop.setTemporalEaseAtKey(keyIdx, newIn, newOut);
            }
        }
        if (!skipUndo) app.endUndoGroup();
        if (statusEl) statusEl.text = "✔ Ease Out: " + Math.round(_outInf) + " | In: " + Math.round(_inInf);
    }

    function applyEase(type, value, skipUndo) {
        var comp = app.project.activeItem; if (!comp) return; var props = comp.selectedProperties; if (props.length === 0) return;
        if (!skipUndo) app.beginUndoGroup("Apply Ease Sliders");
        var inf = Math.max(0.1, Math.min(100, parseFloat(value)));
        for (var p = 0; p < props.length; p++) {
            var prop = props[p]; if (!prop.canVaryOverTime || prop.selectedKeys.length === 0) continue;
            for (var k = 0; k < prop.selectedKeys.length; k++) {
                var keyIdx = prop.selectedKeys[k]; prop.setInterpolationTypeAtKey(keyIdx, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                var inEases = prop.keyInTemporalEase(keyIdx); var outEases = prop.keyOutTemporalEase(keyIdx); var newIn = [], newOut = [];
                for (var d = 0; d < inEases.length; d++) {
                    var inInf  = (type === "in"  || type === "both") ? inf : inEases[d].influence; var outInf = (type === "out" || type === "both") ? inf : outEases[d].influence;
                    newIn.push(new KeyframeEase(0, inInf)); newOut.push(new KeyframeEase(0, outInf));
                }
                prop.setTemporalEaseAtKey(keyIdx, newIn, newOut);
            }
        }
        if (!skipUndo) app.endUndoGroup();
    }

    function setInterp(inType, outType) {
        var comp = app.project.activeItem; if (!comp) return; app.beginUndoGroup("Set Keyframe Interpolation"); var props = comp.selectedProperties;
        for (var p = 0; p < props.length; p++) {
            var prop = props[p]; if (!prop.canVaryOverTime || prop.selectedKeys.length === 0) continue;
            for (var k = 0; k < prop.selectedKeys.length; k++) {
                var keyIdx = prop.selectedKeys[k]; var finalIn = inType !== null ? inType : prop.keyInInterpolationType(keyIdx); var finalOut = outType !== null ? outType : prop.keyOutInterpolationType(keyIdx);
                prop.setInterpolationTypeAtKey(keyIdx, finalIn, finalOut);
            }
        }
        app.endUndoGroup();
    }

    // =======================================================
    // LÓGICA: ANCHOR TOOLS (VERSÃO CORRIGIDA COM TRUQUE DE SHAPE)
    // =======================================================
    function setAnchorPoint(alignH, alignV, statusEl) {
        var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) { alert("Abra uma composição primeiro."); return; }
        var selected = []; for (var i = 1; i <= comp.numLayers; i++) { if (comp.layer(i).selected) selected.push(comp.layer(i)); }
        if (selected.length === 0) { alert("Selecione pelo menos uma camada."); return; }
        
        app.beginUndoGroup("MotionTools: AnchorPoint " + alignH + "-" + alignV);
        var count = 0;
        
        for (var s = 0; s < selected.length; s++) {
            var layer = selected[s]; var rect;
            try { rect = layer.sourceRectAtTime(comp.time, false); } catch (e) { continue; }
            if (!rect) continue;
            
            var left = rect.left, top = rect.top, w = rect.width, h = rect.height;
            var newAX, newAY;
            if (alignH === "left") newAX = left; else if (alignH === "right") newAX = left + w; else newAX = left + w * 0.5;
            if (alignV === "top") newAY = top; else if (alignV === "bottom") newAY = top + h; else newAY = top + h * 0.5;
            
            var is3D = layer.threeDLayer; 
            var currentAP = layer.anchorPoint.value; var apZ = is3D ? currentAP[2] : 0;
            var newAnchor = is3D ? [newAX, newAY, apZ] : [newAX, newAY];
            
            // --- O TRUQUE DO SHAPE TEMPORÁRIO (PRECISÃO ABSOLUTA) ---
            var tempShape = comp.layers.addShape();
            tempShape.name = "Temp_Anchor_Hacker";
            tempShape.enabled = false;
            tempShape.threeDLayer = is3D;
            
            // Parenta o Shape à layer alvo e coloca na coordenada do NOVO Anchor Point
            tempShape.parent = layer;
            tempShape.position.setValue(newAnchor);
            
            // Muda o parentesco para o Parent da layer para obter o valor compensado nativamente pelo AE
            tempShape.parent = layer.parent;
            
            // Salva a nova posição perfeita e calcula o delta
            var targetPos = tempShape.position.value;
            var currentPos = layer.position.valueAtTime(comp.time, false);
            
            var posDX = targetPos[0] - currentPos[0];
            var posDY = targetPos[1] - currentPos[1];
            var posDZ = is3D ? (targetPos[2] - currentPos[2]) : 0;
            
            // Limpa a sujeira da timeline sem sujar a aba Project
            tempShape.remove();
            
            // Aplica o novo Anchor Point e compensa a Posição nos Keyframes
            layer.anchorPoint.setValue(newAnchor);
            var posProp = layer.property("ADBE Transform Group").property("ADBE Position");
            
            if (posProp.numKeys > 0) { 
                for (var k = 1; k <= posProp.numKeys; k++) { 
                    var kv = posProp.keyValue(k); 
                    if (is3D) { posProp.setValueAtKey(k, [kv[0] + posDX, kv[1] + posDY, kv[2] + posDZ]); } 
                    else { posProp.setValueAtKey(k, [kv[0] + posDX, kv[1] + posDY]); } 
                } 
            } else { 
                var pos = posProp.value; 
                if (is3D) { posProp.setValue([pos[0] + posDX, pos[1] + posDY, pos[2] + posDZ]); } 
                else { posProp.setValue([pos[0] + posDX, pos[1] + posDY]); } 
            }

            // Garante que o foco permaneça no objeto original
            layer.selected = true;
            count++;
        }
        app.endUndoGroup();
        if (statusEl) statusEl.text = count > 0 ? "\u2714 Anchor: " + alignH + " / " + alignV + " (" + count + " layer(s))" : "Nenhuma layer suportada selecionada.";
    }

    function moveAnchorToCompPoint(layer, targetX, targetY) {
        var anchorNow = layer.anchorPoint.value; var compAnchorNow; try { compAnchorNow = layer.toComp(anchorNow); } catch(e) { compAnchorNow = layer.position.value; }
        var deltaCompX = targetX - compAnchorNow[0]; var deltaCompY = targetY - compAnchorNow[1];
        var scaleVal = layer.scale.value; var rotVal = layer.rotation.value; var scaleX = scaleVal[0] / 100; var scaleY = scaleVal[1] / 100; var rad = -rotVal * Math.PI / 180;
        var cosR = Math.cos(rad); var sinR = Math.sin(rad);
        var deltaLocalX = (deltaCompX * cosR - deltaCompY * sinR) / scaleX; var deltaLocalY = (deltaCompX * sinR + deltaCompY * cosR) / scaleY;
        var newAnchorX = anchorNow[0] + deltaLocalX; var newAnchorY = anchorNow[1] + deltaLocalY;
        var posNow = layer.position.value; var compensatedPos;
        if (layer.parent) { try { var parentCompPos = layer.parent.toComp(posNow); compensatedPos = layer.parent.fromComp([parentCompPos[0] + deltaCompX, parentCompPos[1] + deltaCompY]); } catch(e) { compensatedPos = [posNow[0] + deltaCompX, posNow[1] + deltaCompY]; } } else { compensatedPos = [posNow[0] + deltaCompX, posNow[1] + deltaCompY]; }
        layer.anchorPoint.setValue([newAnchorX, newAnchorY]); layer.position.setValue(compensatedPos);
    }

    function anchorToComp(statusEl) {
        var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) { alert("Abra uma composição primeiro."); return; }
        var selected = comp.selectedLayers; if (selected.length === 0) { alert("Selecione pelo menos uma layer."); return; }
        var targetX = comp.width / 2; var targetY = comp.height / 2; var count = 0;
        app.beginUndoGroup("AnchorTools: Anchor \u2192 Centro da Comp");
        for (var i = 0; i < selected.length; i++) { try { if (!selected[i].anchorPoint || !selected[i].position) continue; moveAnchorToCompPoint(selected[i], targetX, targetY); count++; } catch(e) {} }
        app.endUndoGroup(); if (statusEl) statusEl.text = "\u2714 " + count + " layer(s) \u2192 centro da comp.";
    }

    function anchorToNull(statusEl) {
        var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) { alert("Abra uma composição primeiro."); return; }
        var selected = comp.selectedLayers; if (selected.length < 2) { alert("Selecione a Null + as layers alvo (m\u00ednimo 2)."); return; }
        var nullLayer = null; for (var i = 0; i < selected.length; i++) { try { if (selected[i].nullLayer === true) { nullLayer = selected[i]; break; } } catch(e) {} }
        if (!nullLayer) { for (var i = 0; i < selected.length; i++) { try { if (selected[i].name.toLowerCase().indexOf("null") !== -1) { nullLayer = selected[i]; break; } } catch(e) {} } }
        if (!nullLayer) { alert("Nenhuma Null encontrada na sele\u00e7\u00e3o.\nSelecione a Null junto com as outras layers."); return; }
        var nullAnchor = nullLayer.anchorPoint.value; var nullCompPos; try { nullCompPos = nullLayer.toComp(nullAnchor); } catch(e) { nullCompPos = nullLayer.position.value; }
        var count = 0; app.beginUndoGroup("AnchorTools: Anchor \u2192 Null");
        for (var i = 0; i < selected.length; i++) { if (selected[i] === nullLayer) continue; try { if (!selected[i].anchorPoint || !selected[i].position) continue; moveAnchorToCompPoint(selected[i], nullCompPos[0], nullCompPos[1]); count++; } catch(e) {} }
        app.endUndoGroup(); if (statusEl) statusEl.text = "\u2714 " + count + " layer(s) \u2192 " + nullLayer.name + ".";
    }
}