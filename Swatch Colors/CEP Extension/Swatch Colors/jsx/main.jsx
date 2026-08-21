/*
    Swatch Colors — host bridge for After Effects (ExtendScript / ES3).
    Version: 1.0.3

    A extensao CEP e o painel ScriptUI (Swatch Colors.jsx) compartilham o
    mesmo numero de versao. Ao alterar um dos dois, subir a versao nos dois.

    v1.0.3 changelog:
    - Alinha a versao com o painel ScriptUI. Sem mudanca funcional no CEP.

    v1.0.2 changelog:
    - Alinha a versao com o painel ScriptUI. Sem mudanca funcional no CEP.

    v1.0.1 changelog:
    - Expands exact-color discovery and improves nested-composition coverage.
    - Preserves saturated sampled colors with denser, alpha-aware frame analysis.
*/
var SwatchColors = SwatchColors || {};
SwatchColors.MAX_EXACT_COLORS = 64;

SwatchColors.escapeJSON = function (value) {
    return String(value).replace(/\\/g, "\\\\").replace(/\"/g, "\\\"").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
};

SwatchColors.result = function (ok, payload, error) {
    var out = "{\"ok\":" + (ok ? "true" : "false");
    if (payload) out += "," + payload;
    if (error) out += ",\"error\":\"" + SwatchColors.escapeJSON(error) + "\"";
    return out + "}";
};

SwatchColors.colorKey = function (c) {
    return Math.round(c[0] * 255) + "," + Math.round(c[1] * 255) + "," + Math.round(c[2] * 255);
};

SwatchColors.pushColor = function (list, seen, color, source, layerName) {
    if (!color || color.length < 3 || list.length >= SwatchColors.MAX_EXACT_COLORS) return;
    var c = [Math.max(0, Math.min(1, Number(color[0]))), Math.max(0, Math.min(1, Number(color[1]))), Math.max(0, Math.min(1, Number(color[2])))];
    var key = SwatchColors.colorKey(c);
    if (seen[key]) return;
    seen[key] = true;
    list.push({ color: c, source: source, layer: layerName || "" });
};

SwatchColors.getWorkingComp = function () {
    try {
        var viewer = app.activeViewer;
        if (!viewer || viewer.type !== ViewerType.VIEWER_COMPOSITION) return null;
        var item = app.project && app.project.activeItem;
        return (item && item instanceof CompItem) ? item : null;
    } catch (ignore) {
        return null;
    }
};

SwatchColors.exactColorLabel = function (prop) {
    var match = "";
    try { match = prop.matchName || ""; } catch (ignore) {}
    if (match === "ADBE Vector Fill Color") return "Shape fill";
    if (match === "ADBE Vector Stroke Color") return "Shape stroke";
    if (match === "ADBE Fill-0002") return "Fill effect";
    return "";
};

SwatchColors.walkProperties = function (group, time, list, seen, layerName, depth) {
    if (!group || depth > 12 || list.length >= SwatchColors.MAX_EXACT_COLORS) return;
    var count = 0;
    try { count = group.numProperties || 0; } catch (ignore) {}
    for (var i = 1; i <= count && list.length < SwatchColors.MAX_EXACT_COLORS; i++) {
        var prop;
        try { prop = group.property(i); } catch (ignoreProp) { continue; }
        if (!prop) continue;
        try {
            if (prop.propertyType === PropertyType.PROPERTY && prop.propertyValueType === PropertyValueType.COLOR) {
                var exactLabel = SwatchColors.exactColorLabel(prop);
                if (exactLabel) SwatchColors.pushColor(list, seen, prop.valueAtTime(time, false), exactLabel, layerName);
            } else if (prop.numProperties && prop.matchName !== "ADBE Transform Group") {
                SwatchColors.walkProperties(prop, time, list, seen, layerName, depth + 1);
            }
        } catch (ignoreValue) {}
    }
};

SwatchColors.scanCompColors = function (comp, time, list, seen, visited, depth) {
    if (!comp || depth > 6 || list.length >= SwatchColors.MAX_EXACT_COLORS) return;
    var visitKey = String(comp.id || comp.name);
    if (visited[visitKey]) return;
    visited[visitKey] = true;
    for (var i = 1; i <= comp.numLayers && list.length < SwatchColors.MAX_EXACT_COLORS; i++) {
        var layer = comp.layer(i), isActive = true;
        try { isActive = layer.activeAtTime(time); } catch (ignoreActive) {}
        if (!layer.enabled || !isActive || layer.guideLayer) continue;
        try {
            if (layer.source && layer.source.mainSource && layer.source.mainSource instanceof SolidSource) {
                SwatchColors.pushColor(list, seen, layer.source.mainSource.color, "Solid", layer.name);
            }
        } catch (ignoreSolid) {}
        try {
            var sourceText = layer.property("ADBE Text Properties").property("ADBE Text Document");
            var textDocument = sourceText.valueAtTime(time, false);
            if (textDocument.applyFill) SwatchColors.pushColor(list, seen, textDocument.fillColor, "Text fill", layer.name);
            if (textDocument.applyStroke) SwatchColors.pushColor(list, seen, textDocument.strokeColor, "Text stroke", layer.name);
        } catch (ignoreText) {}
        SwatchColors.walkProperties(layer, time, list, seen, layer.name, 0);
        try {
            if (layer.source && layer.source instanceof CompItem) {
                var stretch = Number(layer.stretch) || 100;
                var sourceTime = (time - layer.startTime) * (100 / stretch);
                SwatchColors.scanCompColors(layer.source, sourceTime, list, seen, visited, depth + 1);
            }
        } catch (ignoreNested) {}
    }
    visited[visitKey] = false;
};

SwatchColors.scanExact = function () {
    try {
        var comp = SwatchColors.getWorkingComp();
        if (!comp) return SwatchColors.result(false, null, "Activate a Composition Viewer, then try again.");
        var colors = [], seen = {}, t = comp.time;
        SwatchColors.scanCompColors(comp, t, colors, seen, {}, 0);
        var jsonColors = [];
        for (var c = 0; c < colors.length; c++) {
            jsonColors.push("{\"rgb\":[" + colors[c].color.join(",") + "],\"source\":\"" + SwatchColors.escapeJSON(colors[c].source) + "\",\"layer\":\"" + SwatchColors.escapeJSON(colors[c].layer) + "\"}");
        }
        return SwatchColors.result(true, "\"comp\":\"" + SwatchColors.escapeJSON(comp.name) + "\",\"time\":" + t + ",\"exact\":[" + jsonColors.join(",") + "]");
    } catch (err) {
        return SwatchColors.result(false, null, err.toString());
    }
};

SwatchColors.sampleBatch = function (start, count, cols, rows) {
    var sampler = null;
    try {
        var comp = SwatchColors.getWorkingComp();
        if (!comp) return SwatchColors.result(false, null, "Activate a Composition Viewer, then try again.");
        start = Math.max(0, Math.floor(Number(start) || 0));
        count = Math.max(1, Math.floor(Number(count) || 1));
        cols = Math.max(1, Math.floor(Number(cols) || 10));
        rows = Math.max(1, Math.floor(Number(rows) || 6));
        var end = Math.min(cols * rows, start + count), t = comp.time, pointLiterals = [];
        for (var index = start; index < end; index++) {
            var gx = index % cols, gy = Math.floor(index / cols);
            var px = Math.round((gx + 0.5) * comp.width / cols);
            var py = Math.round((gy + 0.5) * comp.height / rows);
            pointLiterals.push("[" + px + "," + py + "]");
        }
        sampler = comp.layers.addText("");
        sampler.name = "__Swatch Colors Sampler__";
        sampler.guideLayer = true;
        sampler.shy = true;
        sampler.selected = false;
        var sourceTextProp = sampler.property("ADBE Text Properties").property("ADBE Text Document");
        var sampleRadius = 2;
        sourceTextProp.expression = "var pts=[" + pointLiterals.join(",") + "],r=[],o,c,a,L,p;for(var j=0;j<pts.length;j++){o=[0,0,0,0];for(var n=thisComp.numLayers;n>=1;n--){L=thisComp.layer(n);if(L.index!=thisLayer.index&&L.hasVideo&&L.active){try{p=L.fromComp([pts[j][0],pts[j][1],0]);c=L.sampleImage(p,[" + sampleRadius + "," + sampleRadius + "],true,time);a=c[3];o=[c[0]*a+o[0]*(1-a),c[1]*a+o[1]*(1-a),c[2]*a+o[2]*(1-a),a+o[3]*(1-a)];}catch(e){}}}if(o[3]>.001){r.push(o[0]/o[3]);r.push(o[1]/o[3]);r.push(o[2]/o[3]);r.push(o[3]);}else{r.push(0);r.push(0);r.push(0);r.push(0);}}r.join(',');";
        var sampleDocument = sourceTextProp.valueAtTime(t, false), rawSamples = String(sampleDocument.text).split(","), jsonSamples = [];
        for (var rs = 0; rs + 3 < rawSamples.length; rs += 4) jsonSamples.push("[" + Number(rawSamples[rs]) + "," + Number(rawSamples[rs + 1]) + "," + Number(rawSamples[rs + 2]) + "," + Number(rawSamples[rs + 3]) + "]");
        sourceTextProp.expression = "";
        try { sampler.remove(); } catch (ignoreRemove) {}
        sampler = null;
        return SwatchColors.result(true, "\"comp\":\"" + SwatchColors.escapeJSON(comp.name) + "\",\"time\":" + t + ",\"samples\":[" + jsonSamples.join(",") + "]");
    } catch (err) {
        try { if (sampler) sampler.remove(); } catch (ignoreSampler) {}
        return SwatchColors.result(false, null, err.toString());
    }
};

SwatchColors.pickColor = function () {
    var comp = null, helper = null, selected = [];
    try {
        comp = SwatchColors.getWorkingComp();
        if (!comp) return SwatchColors.result(false, null, "Activate a Composition Viewer, then try again.");
        selected = comp.selectedLayers;
        for (var i = 0; i < selected.length; i++) selected[i].selected = false;
        helper = comp.layers.addNull(comp.duration);
        helper.name = "Swatch Color Picker";
        helper.enabled = false;
        helper.selected = true;
        var effect = helper.property("ADBE Effect Parade").addProperty("ADBE Color Control");
        var property = effect.property("ADBE Color Control-0001");
        property.selected = true;
        var command = app.findMenuCommandId("Edit Value...");
        if (!command) command = 2240;
        app.executeCommand(command);
        var color = property.value;
        var hex = "#";
        for (var c = 0; c < 3; c++) {
            var part = Math.max(0, Math.min(255, Math.round(color[c] * 255))).toString(16).toUpperCase();
            hex += part.length < 2 ? "0" + part : part;
        }
        helper.remove();
        helper = null;
        for (i = 0; i < selected.length; i++) selected[i].selected = true;
        return SwatchColors.result(true, "\"hex\":\"" + hex + "\"");
    } catch (err) {
        try { if (helper) helper.remove(); } catch (ignoreHelper) {}
        try { for (var s = 0; s < selected.length; s++) selected[s].selected = true; } catch (ignoreSelection) {}
        return SwatchColors.result(false, null, err.toString());
    }
};

SwatchColors.applyEffectColor = function (hex, mode) {
    try {
        var comp = SwatchColors.getWorkingComp();
        if (!comp) return SwatchColors.result(false, null, "Activate a Composition Viewer, then try again.");
        var clean = String(hex).replace("#", "");
        if (!/^[0-9a-fA-F]{6}$/.test(clean)) return SwatchColors.result(false, null, "Invalid color.");
        var color = [parseInt(clean.substr(0,2),16)/255, parseInt(clean.substr(2,2),16)/255, parseInt(clean.substr(4,2),16)/255];
        mode = String(mode).toLowerCase() === "tint" ? "tint" : "fill";
        var layers = comp.selectedLayers, changed = 0, created = false;
        if (!layers || !layers.length) {
            var label = mode === "tint" ? "Tint" : "Fill";
            app.beginUndoGroup("Create Swatch " + label + " Adjustment Layer");
            var adjustment = comp.layers.addSolid([1,1,1], "Swatch " + label + " " + hex.toUpperCase(), comp.width, comp.height, comp.pixelAspect, comp.duration);
            adjustment.adjustmentLayer = true;
            adjustment.startTime = 0;
            adjustment.inPoint = 0;
            adjustment.outPoint = comp.duration;
            layers = [adjustment];
            created = true;
        } else {
            app.beginUndoGroup(mode === "tint" ? "Apply Swatch Tint" : "Apply Swatch Fill");
        }
        var effectMatch = mode === "tint" ? "ADBE Tint" : "ADBE Fill";
        var colorMatch = mode === "tint" ? "ADBE Tint-0002" : "ADBE Fill-0002";
        for (var i = 0; i < layers.length; i++) {
            try {
                var effects = layers[i].property("ADBE Effect Parade");
                if (!effects) continue;
                var effect = null;
                for (var e = 1; e <= effects.numProperties; e++) {
                    if (effects.property(e).matchName === effectMatch) { effect = effects.property(e); break; }
                }
                if (!effect) effect = effects.addProperty(effectMatch);
                try { effect.enabled = true; } catch (ignoreEnable) {}
                var colorProperty = effect.property(colorMatch);
                if (!colorProperty) colorProperty = effect.property(2);
                if (colorProperty) { colorProperty.setValue(color); changed++; }
            } catch (ignoreLayer) {}
        }
        app.endUndoGroup();
        if (!changed) return SwatchColors.result(false, null, "The selected layer does not support this effect.");
        return SwatchColors.result(true, "\"changed\":" + changed + ",\"created\":" + (created ? "true" : "false"));
    } catch (err) {
        try { app.endUndoGroup(); } catch (ignoreUndo) {}
        return SwatchColors.result(false, null, err.toString());
    }
};
