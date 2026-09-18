// ============================================================
// MOTION TOOLS CORE A - Nulls, Loop e Dynamics
// ============================================================

function buildCoreA_UI(parentPanel, buildSectionHelper, COLORS, mtStatus) {
    
    // ==========================================
    // UI: NULLS
    // ==========================================
    var secNulls = buildSectionHelper(parentPanel, "Nulls", COLORS.nulls[0], COLORS.nulls[1], COLORS.nulls[2]);
    var nullTypeGrp = secNulls.add("group"); nullTypeGrp.orientation = "row"; nullTypeGrp.alignChildren = ["center", "center"]; nullTypeGrp.alignment = ["fill", "center"]; nullTypeGrp.spacing = 6;
    var rbShape = nullTypeGrp.add("radiobutton", undefined, "Shape Layer"); var rbNull = nullTypeGrp.add("radiobutton", undefined, "Null"); rbShape.value = true;
    var nullPosGrp = secNulls.add("group"); nullPosGrp.orientation = "row"; nullPosGrp.alignChildren = ["center", "center"]; nullPosGrp.alignment = ["fill", "center"]; nullPosGrp.spacing = 6;
    var rbPosLayers = nullPosGrp.add("radiobutton", undefined, "Centro das layers"); var rbPosComp = nullPosGrp.add("radiobutton", undefined, "Centro da comp"); rbPosLayers.value = true;
    var btnNull1 = secNulls.add("button", undefined, "◈  NULL PARA TODAS AS LAYERS"); btnNull1.preferredSize[1] = 24;
    var btnNull2 = secNulls.add("button", undefined, "◈  NULL POR LAYER"); btnNull2.preferredSize[1] = 24;

    btnNull1.onClick = function () { runNullAction("one_for_all", rbNull.value, rbPosComp.value, mtStatus); };
    btnNull2.onClick = function () { runNullAction("one_per_layer", rbNull.value, rbPosComp.value, mtStatus); };

    // ==========================================
    // UI: LOOP
    // ==========================================
    var secLoop = buildSectionHelper(parentPanel, "Loop", COLORS.loop[0], COLORS.loop[1], COLORS.loop[2]);
    var loopGrid = secLoop.add("group"); loopGrid.orientation = "row"; loopGrid.alignChildren = ["fill", "center"]; loopGrid.spacing = 4;
    var loopColL = loopGrid.add("group"); loopColL.orientation = "column"; loopColL.alignChildren = ["fill", "top"]; loopColL.spacing = 4;
    var loopColR = loopGrid.add("group"); loopColR.orientation = "column"; loopColR.alignChildren = ["fill", "top"]; loopColR.spacing = 4;
    var btnCycle = loopColL.add("button", undefined, "⟳  Cycle"); var btnOffset = loopColL.add("button", undefined, "⟳  Offset");
    var btnPingPong = loopColR.add("button", undefined, "⟳  Ping-Pong"); var btnCont = loopColR.add("button", undefined, "⟳  Continue");
    btnCycle.preferredSize[1] = 24; btnOffset.preferredSize[1] = 24; btnPingPong.preferredSize[1] = 24; btnCont.preferredSize[1] = 24;
    btnCycle.onClick = function(){ applyLoopExpression("cycle", mtStatus); };
    btnPingPong.onClick = function(){ applyLoopExpression("pingpong", mtStatus); };
    btnOffset.onClick = function(){ applyLoopExpression("offset", mtStatus); };
    btnCont.onClick = function(){ applyLoopExpression("cont", mtStatus); };

    // ==========================================
    // UI: DYNAMICS
    // ==========================================
    var secDyn = buildSectionHelper(parentPanel, "Dynamics", COLORS.dynamics[0], COLORS.dynamics[1], COLORS.dynamics[2], true);
    
    var btnElastic = secDyn.add("button", undefined, "〰  ELASTIC + ANTICIPATION"); 
    btnElastic.preferredSize[1] = 24;
    btnElastic.onClick = function(){ applyElasticExpression(mtStatus); };

    var btnBounce = secDyn.add("button", undefined, "⚽  BOUNCE (QUIQUE)"); 
    btnBounce.preferredSize[1] = 24;
    btnBounce.onClick = function(){ applyBounceExpression(mtStatus); };

    var btnOverlap = secDyn.add("button", undefined, "🌊  SMART OVERLAP"); 
    btnOverlap.preferredSize[1] = 24;
    btnOverlap.onClick = function(){ runSmartOverlap(mtStatus); };


    // =======================================================
    // LÓGICA: NULLS
    // =======================================================
    function getWorldPosition(layer) {
        var ap = layer.anchorPoint.value;
        try { return layer.toWorld(ap); } catch(e) { return layer.position.value; }
    }

    function getLayerWorldBounds(comp, layer) {
        var rect;
        try { rect = layer.sourceRectAtTime(comp.time, false); } catch(e) { return null; }
        if (!rect) return null;
        var l = rect.left, t = rect.top, w = rect.width, h = rect.height;
        var corners = [[l, t], [l + w, t], [l + w, t + h], [l, t + h]];
        var minX =  Infinity, minY =  Infinity;
        var maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < corners.length; i++) {
            var wpt;
            try { wpt = layer.toWorld(corners[i]); } catch(e) { return null; }
            if (wpt[0] < minX) minX = wpt[0]; if (wpt[0] > maxX) maxX = wpt[0];
            if (wpt[1] < minY) minY = wpt[1]; if (wpt[1] > maxY) maxY = wpt[1];
        }
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, cx: (minX + maxX) * 0.5, cy: (minY + maxY) * 0.5, w: maxX - minX, h: maxY - minY };
    }

    function createNullLayer(comp, name, pos, size, is3D, inPoint, outPoint) {
        var nullLayer = comp.layers.addNull(); nullLayer.name = name; nullLayer.label = 1;
        if (is3D) nullLayer.threeDLayer = true;
        nullLayer.anchorPoint.setValue(is3D ? [50, 50, 0] : [50, 50]); nullLayer.position.setValue(pos);
        if (inPoint !== undefined) nullLayer.inPoint = inPoint; if (outPoint !== undefined) nullLayer.outPoint = outPoint;
        return nullLayer;
    }

    function createShapeNull(comp, name, pos, size, is3D, inPoint, outPoint) {
        var shapeLayer = comp.layers.addShape(); shapeLayer.name = name; shapeLayer.guideLayer = true; shapeLayer.label = 1;
        var shapeGroup = shapeLayer.property("ADBE Root Vectors Group");
        var rect = shapeGroup.addProperty("ADBE Vector Shape - Rect"); rect.property("ADBE Vector Rect Size").setValue([100, 100]);
        var stroke = shapeGroup.addProperty("ADBE Vector Graphic - Stroke"); stroke.property("ADBE Vector Stroke Color").setValue([1, 0, 0, 1]); stroke.property("ADBE Vector Stroke Width").setValue(2);
        if (is3D) shapeLayer.threeDLayer = true;
        shapeLayer.anchorPoint.setValue(is3D ? [0, 0, 0] : [0, 0]); shapeLayer.position.setValue(pos);
        if (inPoint !== undefined) shapeLayer.inPoint = inPoint; if (outPoint !== undefined) shapeLayer.outPoint = outPoint;
        return shapeLayer;
    }

    function createControlLayer(comp, name, pos, size, is3D, useRealNull, inPoint, outPoint) {
        if (useRealNull) return createNullLayer(comp, name, pos, size, is3D, inPoint, outPoint);
        return createShapeNull(comp, name, pos, size, is3D, inPoint, outPoint);
    }

    function nullOneForAll(comp, selectedLayers, useRealNull, forceCompCenter) {
        var nullPos, is3D, minIn, maxOut;
        if (forceCompCenter) {
            is3D = false; minIn = Infinity; maxOut = -Infinity;

            nullPos = [comp.width / 2, comp.height / 2];
            if (selectedLayers.length > 0) {
                for (var ti = 0; ti < selectedLayers.length; ti++) {
                    if (selectedLayers[ti].inPoint  < minIn)  minIn  = selectedLayers[ti].inPoint;
                    if (selectedLayers[ti].outPoint > maxOut) maxOut = selectedLayers[ti].outPoint;
                }
            } else {
                minIn  = comp.workAreaStart;
                maxOut = comp.workAreaStart + comp.workAreaDuration;
            }
        } else {
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            is3D = false; var sumZ = 0, countZ = 0; minIn = Infinity; maxOut = -Infinity;
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                if (layer.threeDLayer) is3D = true;
                if (layer.inPoint < minIn) minIn = layer.inPoint;
                if (layer.outPoint > maxOut) maxOut = layer.outPoint;
                var bounds = getLayerWorldBounds(comp, layer);
                if (bounds) {
                    if (bounds.minX < minX) minX = bounds.minX; if (bounds.minY < minY) minY = bounds.minY;
                    if (bounds.maxX > maxX) maxX = bounds.maxX; if (bounds.maxY > maxY) maxY = bounds.maxY;
                } else {
                    var wp = getWorldPosition(layer);
                    if (wp[0] < minX) minX = wp[0]; if (wp[0] > maxX) maxX = wp[0];
                    if (wp[1] < minY) minY = wp[1]; if (wp[1] > maxY) maxY = wp[1];
                }
                if (layer.threeDLayer) { sumZ += layer.position.value[2]; countZ++; }
            }
            var cx = (minX + maxX) * 0.5, cy = (minY + maxY) * 0.5;
            var cz = countZ > 0 ? sumZ / countZ : 0; nullPos = is3D ? [cx, cy, cz] : [cx, cy];
        }
        var nullSize = [0, 0];
        var nullLayer = createControlLayer(comp, "NULL", nullPos, nullSize, is3D, useRealNull, minIn, maxOut);
        if (selectedLayers.length > 0) {
            var topIndex = selectedLayers[0].index;
            for (var j = 1; j < selectedLayers.length; j++) { if (selectedLayers[j].index < topIndex) topIndex = selectedLayers[j].index; }
            nullLayer.moveBefore(comp.layer(topIndex));
            for (var k = 0; k < selectedLayers.length; k++) { selectedLayers[k].parent = nullLayer; }
        }
        return nullLayer;
    }

    function nullOnePerLayer(comp, selectedLayers, useRealNull, forceCompCenter) {
        for (var i = selectedLayers.length - 1; i >= 0; i--) {
            var layer = selectedLayers[i]; var is3D = layer.threeDLayer; var nullPos, nullSize;
            if (forceCompCenter) {
                nullPos = is3D ? [comp.width / 2, comp.height / 2, 0] : [comp.width / 2, comp.height / 2]; nullSize = null;
            } else {
                var bounds = getLayerWorldBounds(comp, layer);
                if (bounds) {
                    nullPos = is3D ? [bounds.cx, bounds.cy, layer.position.value[2]] : [bounds.cx, bounds.cy]; nullSize = [bounds.w, bounds.h];
                } else {
                    var wp = getWorldPosition(layer); nullPos = is3D ? wp : [wp[0], wp[1]]; nullSize = null;
                }
            }
            var nullLayer = createControlLayer(comp, "NULL_" + layer.name, nullPos, nullSize, is3D, useRealNull, layer.inPoint, layer.outPoint);
            nullLayer.moveBefore(layer); layer.parent = nullLayer;
        }
    }

    function runNullAction(mode, useRealNull, forceCompCenter, statusText) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) { alert("Abra uma composição primeiro."); return; }
        var selected = [];
        for (var i = 1; i <= comp.numLayers; i++) { if (comp.layer(i).selected) selected.push(comp.layer(i)); }
        var useCompCenter = forceCompCenter || (selected.length === 0);
        if (selected.length === 0) mode = "one_for_all";
        var typeLabel = useRealNull ? "Null" : "Shape";
        app.beginUndoGroup("MotionTools: Create " + typeLabel);
        if (mode === "one_for_all") {
            nullOneForAll(comp, selected, useRealNull, useCompCenter);
            if (statusText) statusText.text = selected.length === 0 ? "✔ " + typeLabel + " no centro da comp." : "✔ " + typeLabel + " criado e layers parentadas.";
        } else {
            nullOnePerLayer(comp, selected, useRealNull, useCompCenter);
            if (statusText) statusText.text = "✔ " + selected.length + " " + typeLabel + "(s) criado(s).";
        }
        app.endUndoGroup();
    }

    // =======================================================
    // LÓGICA: LOOP
    // =======================================================
    var LOOP_EXPRESSIONS = { cycle: 'loopIn("cycle") + loopOut("cycle") - value', pingpong: 'loopIn("pingpong") + loopOut("pingpong") - value', offset: 'loopIn("offset") + loopOut("offset") - value', cont: 'loopIn("continue") + loopOut("continue") - value' };

    function collectSelectedProps(propGroup, result) {
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            if (prop.propertyType === PropertyType.PROPERTY) {
                if (prop.selected && prop.canSetExpression) result.push(prop);
            } else if (prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP) {
                collectSelectedProps(prop, result);
            }
        }
    }

    function applyLoopExpression(loopType, statusText) {
        var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) return;
        var expr = LOOP_EXPRESSIONS[loopType]; var props = [], warnings = 0;
        for (var i = 1; i <= comp.numLayers; i++) { var layer = comp.layer(i); if (!layer.selected) continue; collectSelectedProps(layer, props); }
        if (props.length === 0) return;
        app.beginUndoGroup("MotionTools: Loop");
        for (var j = 0; j < props.length; j++) {
            if (props[j].numKeys < 1) { warnings++; continue; }
            try { props[j].expression = expr; } catch(e) { warnings++; }
        }
        app.endUndoGroup();
        var applied = props.length - warnings;
        if (statusText) statusText.text = "✔ Loop " + loopType + ": " + applied + " prop(s).";
    }

    // =======================================================
    // LÓGICA: DYNAMICS (ELASTIC & BOUNCE)
    // =======================================================
    function applyElasticExpression(statusText) {
        var comp = app.project.activeItem; if (!comp || !(comp instanceof CompItem)) return;
        var selectedProps = comp.selectedProperties; if (selectedProps.length === 0) return;
        app.beginUndoGroup("MotionTools: Elastic");
        var appliedCount = 0;
        try {
            for (var i = 0; i < selectedProps.length; i++) {
                var prop = selectedProps[i];
                if (prop.canSetExpression) {
                    var layer = prop.propertyGroup(prop.propertyDepth); var effectsGroup = layer.property("ADBE Effect Parade");
                    function addSlider(name, value) { var slider = effectsGroup.property(name); if (!slider) { slider = effectsGroup.addProperty("ADBE Slider Control"); slider.name = name; slider.property(1).setValue(value); } }
                    addSlider("Amplitude", 20); addSlider("Frequency", 40); addSlider("Decay", 60); addSlider("Anticipation Amount", 30); addSlider("Anticipation Duration", 6);
                    var expr = "try {\r" + "    var amp = effect('Amplitude')(1) / 200;\r" + "    var freq = effect('Frequency')(1) / 30;\r" + "    var decay = effect('Decay')(1) / 10;\r" + "    var antAmp = effect('Anticipation Amount')(1) / 200;\r" + "    var antDurFrames = effect('Anticipation Duration')(1);\r" + "    var antDur = antDurFrames * thisComp.frameDuration;\r" + "\r" + "    var n = 0;\r" + "    if (numKeys > 0) {\r" + "        n = nearestKey(time).index;\r" + "        if (key(n).time > time) n--;\r" + "    }\r" + "\r" + "    var res = value;\r" + "\r" + "    if (n > 0) {\r" + "        var t = time - key(n).time;\r" + "        var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);\r" + "        res = value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);\r" + "    }\r" + "\r" + "    if (numKeys > 0) {\r" + "        var nextK = null;\r" + "        if (n < numKeys && n > 0) nextK = key(n + 1);\r" + "        else if (n == 0) nextK = key(1);\r" + "\r" + "        if (nextK !== null && time > (nextK.time - antDur) && time < nextK.time) {\r" + "            var tAnt = time - (nextK.time - antDur);\r" + "            var vNext = velocityAtTime(nextK.time + thisComp.frameDuration / 10);\r" + "            var antOffset = (vNext * antAmp) * Math.sin(Math.PI * (tAnt / antDur));\r" + "            res -= antOffset;\r" + "        }\r" + "    }\r" + "    res;\r" + "} catch (e) { value; }";
                    prop.expression = expr; appliedCount++;
                }
            }
        } catch(err) {}
        app.endUndoGroup();
        if (statusText) statusText.text = "✔ Elastic: " + appliedCount + " prop(s).";
    }

    function applyBounceExpression(statusText) {
        var comp = app.project.activeItem; 
        if (!comp || !(comp instanceof CompItem)) return; 

        var selectedProps = comp.selectedProperties; 
        if (selectedProps.length === 0) return;

        app.beginUndoGroup("MotionTools: Bounce");
        var appliedCount = 0;

        try {
            for (var i = 0; i < selectedProps.length; i++) {
                var prop = selectedProps[i];
                if (prop.canSetExpression) {
                    var layer = prop.propertyGroup(prop.propertyDepth); 
                    var effectsGroup = layer.property("ADBE Effect Parade");
                    function addSlider(name, value) { 
                        var slider = effectsGroup.property(name); 
                        if (!slider) { slider = effectsGroup.addProperty("ADBE Slider Control"); slider.name = name; slider.property(1).setValue(value); } 
                    }
                    addSlider("Bounce Elasticity", 70); 
                    addSlider("Bounce Gravity", 5000); 
                    addSlider("Bounce Max", 9);         

                    var expr = "try {\r" +
                        "  var e = effect('Bounce Elasticity')(1) / 100;\r" +
                        "  var g = effect('Bounce Gravity')(1);\r" +
                        "  var nMax = effect('Bounce Max')(1);\r" +
                        "  var n = 0;\r" +
                        "  if (numKeys > 0) {\r" +
                        "    n = nearestKey(time).index;\r" +
                        "    if (key(n).time > time) n--;\r" +
                        "  }\r" +
                        "  var t = (n == 0) ? 0 : time - key(n).time;\r" +
                        "  if (n > 0 && t < 3) {\r" +
                        "    var v = -velocityAtTime(key(n).time - thisComp.frameDuration/10);\r" +
                        "    var vl = length(v);\r" +
                        "    var vu = 0;\r" +
                        "    if (value instanceof Array) {\r" +
                        "      vu = (vl > 0) ? normalize(v) : (value.length == 2 ? [0,1] : [0,1,0]);\r" +
                        "    } else {\r" +
                        "      vu = (v < 0) ? -1 : 1;\r" +
                        "    }\r" +
                        "    var tCur = 0;\r" +
                        "    var segDur = 2 * vl / g;\r" +
                        "    var tNext = segDur;\r" +
                        "    var nb = 1;\r" +
                        "    while (tNext < t && nb <= nMax) {\r" +
                        "      vl *= e;\r" +
                        "      segDur *= e;\r" +
                        "      tCur = tNext;\r" +
                        "      tNext += segDur;\r" +
                        "      nb++;\r" +
                        "    }\r" +
                        "    if (nb <= nMax) {\r" +
                        "      var delta = t - tCur;\r" +
                        "      value + vu * (delta * vl - g * delta * delta / 2);\r" +
                        "    } else {\r" +
                        "      value;\r" +
                        "    }\r" +
                        "  } else {\r" +
                        "    value;\r" +
                        "  }\r" +
                        "} catch(err) { value; }";

                    prop.expression = expr; 
                    appliedCount++;
                }
            }
        } catch(err) {}

        app.endUndoGroup();
        if (statusText) statusText.text = "✔ Bounce aplicado em " + appliedCount + " prop(s).";
    }

    // =======================================================
    // LÓGICA: SMART OVERLAP V6.1 - Auto Separate Dimensions
    // =======================================================
    function runSmartOverlap(statusText) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            alert("Abra uma composição primeiro.");
            return;
        }

        var selLayers = comp.selectedLayers;
        if (selLayers.length < 2) {
            alert("Selecione pelo menos 2 layers.\n\nA layer do topo será a MASTER.");
            return;
        }

        var master = selLayers[0];
        var followers = [];
        for (var i = 1; i < selLayers.length; i++) {
            followers.push(selLayers[i]);
        }

        // 1. Mapeia propriedades animadas na Master
        var animatedProps = [];
        function findAnimated(propGroup) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var p = propGroup.property(i);
                if (p.propertyType === PropertyType.PROPERTY) {
                    if (p.parentProperty && p.parentProperty.name === "Overlap Offset") continue;
                    
                    var hasKeys = p.numKeys > 0;
                    var hasExpr = p.canSetExpression && p.expression !== "";
                    if (hasKeys || hasExpr) {
                        animatedProps.push(p);
                    }
                } else if (p.propertyType === PropertyType.INDEXED_GROUP || p.propertyType === PropertyType.NAMED_GROUP) {
                    findAnimated(p);
                }
            }
        }
        findAnimated(master);

        if (animatedProps.length === 0) {
            alert("A layer Master '" + master.name + "' não possui Keyframes ou Expressões para serem seguidas.");
            return; 
        }

        // 2. Janela de Interface Gráfica
        var dialog = new Window("dialog", "Smart Overlap - Opções");
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 10;
        dialog.margins = 16;

        dialog.add("statictext", undefined, "Selecione o que as seguidoras devem seguir:");
        
        var panel = dialog.add("panel", undefined, "Propriedades Animadas na Master");
        panel.orientation = "column";
        panel.alignChildren = ["left", "top"];
        panel.margins = 15;
        panel.spacing = 8;

        var checkboxes = [];
        for (var a = 0; a < animatedProps.length; a++) {
            var prop = animatedProps[a];
            var propLabel = prop.name;
            if (prop.parentProperty && prop.parentProperty.name !== "Root" && prop.parentProperty.name !== "ADBE Transform Group") {
                propLabel = prop.parentProperty.name + " > " + propLabel;
            }
            var cb = panel.add("checkbox", undefined, propLabel);
            cb.value = true;
            checkboxes.push({ cb: cb, prop: prop });
        }

        var btnGroup = dialog.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignChildren = ["center", "center"];
        btnGroup.margins = [0, 10, 0, 0];
        
        var btnCancel = btnGroup.add("button", undefined, "Cancelar");
        var btnOk = btnGroup.add("button", undefined, "Aplicar Overlap");

        var proceed = false;
        btnOk.onClick = function() { proceed = true; dialog.close(); };
        btnCancel.onClick = function() { dialog.close(); };

        dialog.center();
        dialog.show();

        if (!proceed) return;

        // Funções de Caminho
        function getExtendScriptPath(prop) {
            var path = [];
            var p = prop;
            while (p != null && p.propertyDepth > 0) {
                if (p.parentProperty && p.parentProperty.matchName === "ADBE Effect Parade") {
                    path.unshift(p.name);
                } else {
                    path.unshift(p.matchName);
                }
                p = p.parentProperty;
            }
            return path;
        }

        function getExpressionPath(prop) {
            var str = "";
            var p = prop;
            while (p != null && p.propertyDepth > 0) {
                str = '("' + p.name.replace(/"/g, '\\"') + '")' + str;
                p = p.parentProperty;
            }
            return str;
        }

        function getEquivalentProperty(targetLayer, pathArray) {
            var target = targetLayer;
            for (var i = 0; i < pathArray.length; i++) {
                if (target == null) return null;
                target = target.property(pathArray[i]);
            }
            return target;
        }

        // 3. Cache dos Dados
        var propsToProcess = [];
        for (var c = 0; c < checkboxes.length; c++) {
            if (checkboxes[c].cb.value === true) {
                var selectedProp = checkboxes[c].prop;
                var isEffect = false;
                var effectName = "";
                var topGroup = selectedProp;
                
                while (topGroup.parentProperty != null) {
                    if (topGroup.parentProperty.matchName === "ADBE Effect Parade") {
                        isEffect = true;
                        effectName = topGroup.name;
                        break;
                    }
                    topGroup = topGroup.parentProperty;
                }

                propsToProcess.push({
                    extPath: getExtendScriptPath(selectedProp),
                    exprPath: getExpressionPath(selectedProp),
                    isEffect: isEffect,
                    effectName: effectName
                });
            }
        }

        if (propsToProcess.length === 0) {
            alert("Nenhuma propriedade selecionada.");
            return;
        }

        app.beginUndoGroup("MotionTools: Smart Overlap V6");

        // Cores Aleatórias
        var masterLabel = Math.floor(Math.random() * 16) + 1;
        var followerLabel = Math.floor(Math.random() * 16) + 1;
        while (followerLabel === masterLabel) followerLabel = Math.floor(Math.random() * 16) + 1;
        
        master.label = masterLabel;
        for (var j = 0; j < followers.length; j++) followers[j].label = followerLabel;

        var effectsGroup = master.property("ADBE Effect Parade");
        var sliderEffect = effectsGroup.property("Overlap Offset");
        if (!sliderEffect) {
            sliderEffect = effectsGroup.addProperty("ADBE Slider Control");
            sliderEffect.name = "Overlap Offset";
            sliderEffect.property("ADBE Slider Control-0001").setValue(2);
        }

        function copyPasteEffect(effectToCopy, targetLayer) {
            for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
            master.selected = true;
            
            var selProps = master.selectedProperties;
            for (var p = selProps.length - 1; p >= 0; p--) {
                try { selProps[p].selected = false; } catch(e) {}
            }

            effectToCopy.selected = true;
            app.executeCommand(19);

            master.selected = false;
            targetLayer.selected = true;
            app.executeCommand(20);

            var tProps = targetLayer.selectedProperties;
            for (var tp = tProps.length - 1; tp >= 0; tp--) {
                try { tProps[tp].selected = false; } catch(e) {}
            }
        }

        var propsAppliedCount = 0;
        var autoCopiedEffects = 0;

        for (var f = 0; f < followers.length; f++) {
            var follower = followers[f];
            var multiplier = f + 1;

            for (var pt = 0; pt < propsToProcess.length; pt++) {
                var item = propsToProcess[pt];
                
                // INJEÇÃO DA MELHORIA: Checagem de dimensões separadas (X, Y ou Z)
                var lastPropMatchName = item.extPath[item.extPath.length - 1];
                if (lastPropMatchName === "ADBE Position_0" || lastPropMatchName === "ADBE Position_1" || lastPropMatchName === "ADBE Position_2") {
                    try {
                        var fPos = follower.property("ADBE Transform Group").property("ADBE Position");
                        if (fPos && fPos.dimensionsSeparated === false) {
                            fPos.dimensionsSeparated = true; // Força a separação se o master estiver separado
                        }
                    } catch(e) {}
                }

                if (item.isEffect) {
                    var followerHasEffect = false;
                    var followerEffects = follower.property("ADBE Effect Parade");
                    if (followerEffects) {
                        for (var e = 1; e <= followerEffects.numProperties; e++) {
                            if (followerEffects.property(e).name === item.effectName) {
                                followerHasEffect = true;
                                break;
                            }
                        }
                    }
                    
                    if (!followerHasEffect) {
                        var masterEffect = master.property("ADBE Effect Parade").property(item.effectName);
                        if (masterEffect) {
                            copyPasteEffect(masterEffect, follower);
                            autoCopiedEffects++;
                        }
                    }
                }

                var followerProp = getEquivalentProperty(follower, item.extPath);

                if (followerProp && followerProp.canSetExpression) {
                    var expr = "var master = thisComp.layer(\"" + master.name.replace(/"/g, '\\"') + "\");\n";
                    expr += "var delayFrames = master.effect(\"Overlap Offset\")(\"Slider\");\n";
                    expr += "var delayTime = delayFrames * thisComp.frameDuration * " + multiplier + ";\n";
                    expr += "master" + item.exprPath + ".valueAtTime(time - delayTime);";
                    followerProp.expression = expr;
                    
                    if (f === 0) propsAppliedCount++; 
                }
            }
        }

        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        for (var s = 0; s < selLayers.length; s++) selLayers[s].selected = true;

        app.endUndoGroup();

        if (statusText) statusText.text = "✔ Overlap: " + propsAppliedCount + " prop(s) em " + followers.length + " layers.";
        if (autoCopiedEffects > 0) {
            alert("💡 MÁGICA FEITA:\n" + autoCopiedEffects + " efeito(s) clonados automaticamente da Master para as Seguidoras.");
        }
    }
}