/*
    Swatch Colors — standalone ScriptUI panel for After Effects (ExtendScript / ES3).
    Version: 1.0.3

    A extensao CEP e este painel ScriptUI compartilham o mesmo numero de
    versao. Ao alterar um dos dois, subir a versao nos dois.

    v1.0.3 changelog:
    - Faz a copia do HEX chegar de fato a area de transferencia. No processo
      do After Effects, chamar o powershell direto nao executa e o clip.exe
      nao e encontrado no PATH; a unica rota que funciona e o cmd lancando o
      powershell, que e a usada agora.

    v1.0.2 changelog:
    - Corrige uso de Date.prototype.toISOString, inexistente no ExtendScript (ES3),
      que abortava a releitura da composicao, o salvamento de paletas e a memoria
      de paletas anteriores.
    - Corrige a deteccao de plataforma da copia para a area de transferencia
      (Folder.fs em vez de $.os) e remove o pipeline de shell que travava o painel.
    - Ignora as camadas de ajuste "Swatch Fill/Tint" criadas pelo proprio painel
      durante a leitura, evitando acumulo de cores a cada releitura.

    Standalone counterpart to the "Swatch Colors" CEP extension: reads exact and
    derived palette colors from the active composition, lets you add colors
    manually with the native After Effects color picker, apply them as
    Fill/Tint, and save/load palettes to disk (persisted across sessions).

    Docked or floating panel — run via File > Scripts, or drop into
    Scripts/ScriptUI Panels to dock it like the other panels.
*/

(function (thisObj) {
    var APP_NAME = "Swatch Colors";
    var MAX_EXACT_COLORS = 64;
    var GRID_COLUMNS = 8;
    var SWATCH_SIZE = 22;

    // ---------------------------------------------------------------------
    // Persistence (plain-text, no JSON dependency — ExtendScript is ES3)
    // ---------------------------------------------------------------------

    function dataFolder() {
        var folder = Folder(Folder.userData.fsName + "/Swatch Colors");
        if (!folder.exists) folder.create();
        return folder;
    }

    function dataFile() { return File(dataFolder().fsName + "/palettes.dat"); }
    function activeFile() { return File(dataFolder().fsName + "/active.dat"); }
    function historyFile() { return File(dataFolder().fsName + "/history.dat"); }
    function newId() { return String(new Date().getTime()) + Math.floor(Math.random() * 1000); }

    // ExtendScript is ES3: Date.prototype.toISOString does not exist.
    function pad2(n) { return (n < 10 ? "0" : "") + n; }
    function timestamp(date) {
        var d = date || new Date();
        return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
            " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) + ":" + pad2(d.getSeconds());
    }

    var F1 = "", F2 = "", F3 = ""; // field / entry / subfield separators

    function encodeColors(list) {
        var parts = [];
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            parts.push(c.rgb[0] + "," + c.rgb[1] + "," + c.rgb[2] + F3 + (c.source || "") + F3 + (c.layer || ""));
        }
        return parts.join(F2);
    }

    function decodeColors(raw) {
        var list = [];
        if (!raw) return list;
        var parts = raw.split(F2);
        for (var i = 0; i < parts.length; i++) {
            var sub = parts[i].split(F3);
            var rgb = sub[0].split(",");
            list.push({ rgb: [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])], source: sub[1] || "", layer: sub[2] || "" });
        }
        return list;
    }

    function loadPaletteList(file) {
        var list = [];
        try {
            if (!file.exists) return list;
            file.encoding = "UTF-8";
            file.open("r");
            var content = file.read();
            file.close();
            if (!content) return list;
            var lines = content.split("\n");
            for (var i = 0; i < lines.length; i++) {
                if (!lines[i]) continue;
                var f = lines[i].split(F1);
                list.push({ id: f[0], name: f[1], comp: f[2], created: f[3], exact: decodeColors(f[4]), based: decodeColors(f[5]) });
            }
        } catch (err) {}
        return list;
    }

    function savePaletteList(file, list) {
        try {
            var lines = [];
            for (var i = 0; i < list.length; i++) {
                var p = list[i];
                lines.push([p.id, p.name, p.comp, p.created, encodeColors(p.exact), encodeColors(p.based)].join(F1));
            }
            file.encoding = "UTF-8";
            file.open("w");
            file.write(lines.join("\n"));
            file.close();
        } catch (err) {
            alert("Could not save Swatch Colors data: " + err.toString());
        }
    }

    function loadPalettes() { return loadPaletteList(dataFile()); }
    function savePalettes(list) { savePaletteList(dataFile(), list); }

    // ---------------------------------------------------------------------
    // Color helpers
    // ---------------------------------------------------------------------

    function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

    function rgbHex(rgb255) {
        var hex = "#";
        for (var i = 0; i < 3; i++) {
            var part = clamp255(rgb255[i]).toString(16).toUpperCase();
            hex += part.length < 2 ? "0" + part : part;
        }
        return hex;
    }

    function hexToUnit(hex) {
        var clean = String(hex).replace("#", "");
        return [parseInt(clean.substr(0, 2), 16) / 255, parseInt(clean.substr(2, 2), 16) / 255, parseInt(clean.substr(4, 2), 16) / 255];
    }

    function rgbToHsl(rgb255) {
        var r = rgb255[0] / 255, g = rgb255[1] / 255, b = rgb255[2] / 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2, d = max - min;
        if (d) {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
        }
        return [h, s, l];
    }

    function hslToRgb(hsl) {
        var h = hsl[0], s = hsl[1], l = hsl[2], r, g, b;
        if (!s) { r = g = b = l; }
        else {
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
            var f = function (t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 0.5) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            r = f(h + 1 / 3); g = f(h); b = f(h - 1 / 3);
        }
        return [r * 255, g * 255, b * 255];
    }

    // ---------------------------------------------------------------------
    // Composition engine (mirrors the CEP host bridge, jsx/main.jsx)
    // ---------------------------------------------------------------------

    function getWorkingComp() {
        try {
            var viewer = app.activeViewer;
            if (!viewer || viewer.type !== ViewerType.VIEWER_COMPOSITION) return null;
            var item = app.project && app.project.activeItem;
            return (item && item instanceof CompItem) ? item : null;
        } catch (ignore) { return null; }
    }

    function colorKey(c) { return clamp255(c[0] * 255) + "," + clamp255(c[1] * 255) + "," + clamp255(c[2] * 255); }

    function pushColor(list, seen, color, source, layerName) {
        if (!color || color.length < 3 || list.length >= MAX_EXACT_COLORS) return;
        var c = [Math.max(0, Math.min(1, Number(color[0]))), Math.max(0, Math.min(1, Number(color[1]))), Math.max(0, Math.min(1, Number(color[2])))];
        var key = colorKey(c);
        if (seen[key]) return;
        seen[key] = true;
        list.push({ rgb: [c[0] * 255, c[1] * 255, c[2] * 255], source: source, layer: layerName || "" });
    }

    function exactColorLabel(prop) {
        var match = "";
        try { match = prop.matchName || ""; } catch (ignore) {}
        if (match === "ADBE Vector Fill Color") return "Shape fill";
        if (match === "ADBE Vector Stroke Color") return "Shape stroke";
        if (match === "ADBE Fill-0002") return "Fill effect";
        return "";
    }

    function walkProperties(group, time, list, seen, layerName, depth) {
        if (!group || depth > 12 || list.length >= MAX_EXACT_COLORS) return;
        var count = 0;
        try { count = group.numProperties || 0; } catch (ignore) {}
        for (var i = 1; i <= count && list.length < MAX_EXACT_COLORS; i++) {
            var prop;
            try { prop = group.property(i); } catch (ignoreProp) { continue; }
            if (!prop) continue;
            try {
                if (prop.propertyType === PropertyType.PROPERTY && prop.propertyValueType === PropertyValueType.COLOR) {
                    var label = exactColorLabel(prop);
                    if (label) pushColor(list, seen, prop.valueAtTime(time, false), label, layerName);
                } else if (prop.numProperties && prop.matchName !== "ADBE Transform Group") {
                    walkProperties(prop, time, list, seen, layerName, depth + 1);
                }
            } catch (ignoreValue) {}
        }
    }

    function scanCompColors(comp, time, list, seen, visited, depth) {
        if (!comp || depth > 6 || list.length >= MAX_EXACT_COLORS) return;
        var visitKey = String(comp.id || comp.name);
        if (visited[visitKey]) return;
        visited[visitKey] = true;
        for (var i = 1; i <= comp.numLayers && list.length < MAX_EXACT_COLORS; i++) {
            var layer = comp.layer(i), isActive = true;
            try { isActive = layer.activeAtTime(time); } catch (ignoreActive) {}
            if (!layer.enabled || !isActive || layer.guideLayer) continue;
            if (layer.name && (layer.name.indexOf("Swatch Fill ") === 0 || layer.name.indexOf("Swatch Tint ") === 0)) continue;
            try {
                if (layer.source && layer.source.mainSource && layer.source.mainSource instanceof SolidSource) {
                    pushColor(list, seen, layer.source.mainSource.color, "Solid", layer.name);
                }
            } catch (ignoreSolid) {}
            try {
                var sourceText = layer.property("ADBE Text Properties").property("ADBE Text Document");
                var textDocument = sourceText.valueAtTime(time, false);
                if (textDocument.applyFill) pushColor(list, seen, textDocument.fillColor, "Text fill", layer.name);
                if (textDocument.applyStroke) pushColor(list, seen, textDocument.strokeColor, "Text stroke", layer.name);
            } catch (ignoreText) {}
            walkProperties(layer, time, list, seen, layer.name, 0);
            try {
                if (layer.source && layer.source instanceof CompItem) {
                    var stretch = Number(layer.stretch) || 100;
                    var sourceTime = (time - layer.startTime) * (100 / stretch);
                    scanCompColors(layer.source, sourceTime, list, seen, visited, depth + 1);
                }
            } catch (ignoreNested) {}
        }
        visited[visitKey] = false;
    }

    function scanExact(comp) {
        var list = [], seen = {};
        scanCompColors(comp, comp.time, list, seen, {}, 0);
        return list;
    }

    function sampleDerived(comp, cols, rows) {
        var sampler = null;
        try {
            var t = comp.time, points = [], gx, gy, index;
            for (index = 0; index < cols * rows; index++) {
                gx = index % cols; gy = Math.floor(index / cols);
                points.push([Math.round((gx + 0.5) * comp.width / cols), Math.round((gy + 0.5) * comp.height / rows)]);
            }
            sampler = comp.layers.addText("");
            sampler.name = "__Swatch Colors Sampler__";
            sampler.guideLayer = true;
            sampler.shy = true;
            sampler.selected = false;
            var sourceTextProp = sampler.property("ADBE Text Properties").property("ADBE Text Document");
            var pointLiterals = [];
            for (index = 0; index < points.length; index++) pointLiterals.push("[" + points[index][0] + "," + points[index][1] + "]");
            var sampleRadius = 2;
            sourceTextProp.expression = "var pts=[" + pointLiterals.join(",") + "],r=[],o,c,a,L,p;for(var j=0;j<pts.length;j++){o=[0,0,0,0];for(var n=thisComp.numLayers;n>=1;n--){L=thisComp.layer(n);if(L.index!=thisLayer.index&&L.hasVideo&&L.active){try{p=L.fromComp([pts[j][0],pts[j][1],0]);c=L.sampleImage(p,[" + sampleRadius + "," + sampleRadius + "],true,time);a=c[3];o=[c[0]*a+o[0]*(1-a),c[1]*a+o[1]*(1-a),c[2]*a+o[2]*(1-a),a+o[3]*(1-a)];}catch(e){}}}if(o[3]>.001){r.push(o[0]/o[3]);r.push(o[1]/o[3]);r.push(o[2]/o[3]);r.push(o[3]);}else{r.push(0);r.push(0);r.push(0);r.push(0);}}r.join(',');";
            var sampleDocument = sourceTextProp.valueAtTime(t, false);
            var rawSamples = String(sampleDocument.text).split(",");
            var samples = [];
            for (var rs = 0; rs + 3 < rawSamples.length; rs += 4) samples.push([Number(rawSamples[rs]), Number(rawSamples[rs + 1]), Number(rawSamples[rs + 2]), Number(rawSamples[rs + 3])]);
            sourceTextProp.expression = "";
            try { sampler.remove(); } catch (ignoreRemove) {}
            sampler = null;
            return samples;
        } catch (err) {
            try { if (sampler) sampler.remove(); } catch (ignoreSampler) {}
            throw err;
        }
    }

    function distanceSquared(a, b) { var x = a[0] - b[0], y = a[1] - b[1], z = a[2] - b[2]; return x * x + y * y + z * z; }
    function distance(a, b) { return Math.sqrt(distanceSquared(a, b)); }

    function paletteFromSamples(samples, count) {
        var bins = {}, points = [], i;
        for (i = 0; i < samples.length; i++) {
            if (samples[i].length > 3 && samples[i][3] < 0.05) continue;
            var rgb = [clamp255(samples[i][0] * 255), clamp255(samples[i][1] * 255), clamp255(samples[i][2] * 255)];
            var key = Math.floor(rgb[0] / 12) + "," + Math.floor(rgb[1] / 12) + "," + Math.floor(rgb[2] / 12);
            var bin = bins[key];
            if (!bin) bin = bins[key] = { rgb: [0, 0, 0], weight: 0 };
            bin.rgb[0] += rgb[0]; bin.rgb[1] += rgb[1]; bin.rgb[2] += rgb[2]; bin.weight++;
        }
        for (var key2 in bins) {
            if (!bins.hasOwnProperty(key2)) continue;
            var b2 = bins[key2];
            b2.rgb = [b2.rgb[0] / b2.weight, b2.rgb[1] / b2.weight, b2.rgb[2] / b2.weight];
            points.push(b2);
        }
        if (count <= 0 || !points.length) return [];
        count = Math.min(count, points.length);
        points.sort(function (a, b) { return b.weight - a.weight; });
        var cent = [points[0].rgb.slice()];
        while (cent.length < count) {
            var next = null, nextScore = -1;
            for (i = 0; i < points.length; i++) {
                var point = points[i], nearest = Infinity;
                for (var c = 0; c < cent.length; c++) nearest = Math.min(nearest, distanceSquared(point.rgb, cent[c]));
                var hsl = rgbToHsl(point.rgb), score = nearest * Math.sqrt(point.weight) * (1 + hsl[1] * 0.35);
                if (score > nextScore) { nextScore = score; next = point; }
            }
            cent.push(next.rgb.slice());
        }
        var assign = new Array(points.length), rounds = 10;
        while (rounds--) {
            var sums = [];
            for (i = 0; i < count; i++) sums.push([0, 0, 0, 0]);
            for (var p = 0; p < points.length; p++) {
                var pt = points[p], best = 0, bestDistance = Infinity;
                for (var cc = 0; cc < count; cc++) { var d = distanceSquared(pt.rgb, cent[cc]); if (d < bestDistance) { bestDistance = d; best = cc; } }
                assign[p] = best;
                sums[best][0] += pt.rgb[0] * pt.weight; sums[best][1] += pt.rgb[1] * pt.weight; sums[best][2] += pt.rgb[2] * pt.weight; sums[best][3] += pt.weight;
            }
            for (i = 0; i < count; i++) if (sums[i][3]) cent[i] = [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]];
        }
        var clusters = [];
        for (i = 0; i < count; i++) clusters.push({ center: cent[i], weight: 0, members: [] });
        for (var p2 = 0; p2 < points.length; p2++) { clusters[assign[p2]].weight += points[p2].weight; clusters[assign[p2]].members.push(points[p2]); }
        var results = [];
        for (i = 0; i < clusters.length; i++) {
            var cluster = clusters[i];
            if (!cluster.weight) continue;
            var representative = null, bestScore = Infinity;
            for (var m = 0; m < cluster.members.length; m++) {
                var mem = cluster.members[m], saturation = rgbToHsl(mem.rgb)[1], score = distanceSquared(mem.rgb, cluster.center) / (1 + saturation * 0.45);
                if (score < bestScore) { bestScore = score; representative = mem.rgb; }
            }
            results.push({ rgb: representative.slice(), source: "Dominant sampled color", weight: cluster.weight });
        }
        results.sort(function (a, b) { return b.weight - a.weight; });
        var filtered = [];
        for (i = 0; i < results.length; i++) {
            var ok = true;
            for (var j = 0; j < filtered.length; j++) if (distance(results[i].rgb, filtered[j].rgb) <= 22) { ok = false; break; }
            if (ok) filtered.push(results[i]);
        }
        return filtered.slice(0, count);
    }

    // Copies to the OS clipboard.
    //
    // Measured on AE 26.3 with the Tools/clipboard-diagnostic.jsx probe:
    //   - launching powershell directly through system.callSystem does
    //     nothing at all;
    //   - clip.exe is not resolvable on the PATH of the AE process
    //     ("where clip" comes back empty), so every clip-based route fails;
    //   - cmd.exe runs, and powershell launched *by cmd* runs too.
    // That last combination is the only one that works here, so it is what
    // this uses. The value is single-quoted for PowerShell, which keeps the
    // leading "#" literal instead of starting a comment.
    function copyToClipboard(text) {
        var value = String(text);
        try {
            if (Folder.fs === "Windows") {
                var safe = value.replace(/'/g, "''");
                system.callSystem('cmd.exe /c powershell -NoProfile -Command "Set-Clipboard -Value \'' + safe + '\'"');
            } else {
                var safeMac = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
                system.callSystem('osascript -e "set the clipboard to \\"' + safeMac + '\\""');
            }
            return true;
        } catch (err) {
            return false;
        }
    }

    function nativeColorPicker() {
        var comp = getWorkingComp();
        if (!comp) { alert("Activate a Composition Viewer, then try again."); return null; }
        var helper = null, selected = comp.selectedLayers, i;
        try {
            for (i = 0; i < selected.length; i++) selected[i].selected = false;
            helper = comp.layers.addNull(comp.duration);
            helper.name = "Swatch Color Picker";
            helper.enabled = false;
            helper.selected = true;
            var effect = helper.property("ADBE Effect Parade").addProperty("ADBE Color Control");
            var prop = effect.property("ADBE Color Control-0001");
            prop.selected = true;
            var cmd = app.findMenuCommandId("Edit Value...");
            if (!cmd) cmd = 2240;
            app.executeCommand(cmd);
            var color = prop.value;
            helper.remove(); helper = null;
            for (i = 0; i < selected.length; i++) selected[i].selected = true;
            return { rgb: [color[0] * 255, color[1] * 255, color[2] * 255], source: "Manual", layer: "" };
        } catch (err) {
            try { if (helper) helper.remove(); } catch (ignoreHelper) {}
            try { for (i = 0; i < selected.length; i++) selected[i].selected = true; } catch (ignoreSelection) {}
            alert("Could not open the color picker: " + err.toString());
            return null;
        }
    }

    function applyEffectColor(hex, mode) {
        var comp = getWorkingComp();
        if (!comp) { alert("Activate a Composition Viewer, then try again."); return 0; }
        var unit = hexToUnit(hex);
        mode = String(mode).toLowerCase() === "tint" ? "tint" : "fill";
        var layers = comp.selectedLayers, changed = 0, created = false;
        app.beginUndoGroup(mode === "tint" ? "Apply Swatch Tint" : "Apply Swatch Fill");
        try {
            if (!layers || !layers.length) {
                var label = mode === "tint" ? "Tint" : "Fill";
                var adjustment = comp.layers.addSolid([1, 1, 1], "Swatch " + label + " " + hex.toUpperCase(), comp.width, comp.height, comp.pixelAspect, comp.duration);
                adjustment.adjustmentLayer = true;
                adjustment.startTime = 0; adjustment.inPoint = 0; adjustment.outPoint = comp.duration;
                layers = [adjustment];
                created = true;
            }
            var effectMatch = mode === "tint" ? "ADBE Tint" : "ADBE Fill";
            var colorMatch = mode === "tint" ? "ADBE Tint-0002" : "ADBE Fill-0002";
            for (var i = 0; i < layers.length; i++) {
                try {
                    var effects = layers[i].property("ADBE Effect Parade");
                    if (!effects) continue;
                    var effect = null;
                    for (var e = 1; e <= effects.numProperties; e++) if (effects.property(e).matchName === effectMatch) { effect = effects.property(e); break; }
                    if (!effect) effect = effects.addProperty(effectMatch);
                    try { effect.enabled = true; } catch (ignoreEnable) {}
                    var colorProperty = effect.property(colorMatch);
                    if (!colorProperty) colorProperty = effect.property(2);
                    if (colorProperty) { colorProperty.setValue(unit); changed++; }
                } catch (ignoreLayer) {}
            }
        } finally {
            app.endUndoGroup();
        }
        return changed;
    }

    // ---------------------------------------------------------------------
    // UI
    // ---------------------------------------------------------------------

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", APP_NAME + " 1.0.3", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 10;

        var state = { exact: [], based: [], compName: "", activeName: "", variation: 0, saved: loadPalettes(), history: loadPaletteList(historyFile()).slice(0, 2) };

        // status
        var statusText = win.add("statictext", undefined, "Ready to analyze");
        statusText.alignment = ["fill", "top"];

        var lastColorText = win.add("edittext", undefined, "");
        lastColorText.alignment = ["fill", "top"];
        lastColorText.helpTip = "Last color used (select and copy)";

        // tabs
        var tabs = win.add("tabbedpanel");
        tabs.alignChildren = ["fill", "fill"];
        tabs.alignment = ["fill", "fill"];
        var compTab = tabs.add("tab", undefined, "Composition");
        compTab.orientation = "column"; compTab.alignChildren = ["fill", "top"]; compTab.spacing = 6; compTab.margins = 8;
        var libTab = tabs.add("tab", undefined, "Saved Palettes");
        libTab.orientation = "column"; libTab.alignChildren = ["fill", "fill"]; libTab.spacing = 6; libTab.margins = 8;
        tabs.selection = compTab;

        // --- Composition tab ---
        var scanBtn = compTab.add("button", undefined, "READ COMPOSITION");

        var exactHeader = compTab.add("group");
        exactHeader.add("statictext", undefined, "Exact colors");
        var exactCount = exactHeader.add("statictext", undefined, "0");
        var exactGrid = compTab.add("group"); exactGrid.orientation = "column"; exactGrid.alignChildren = ["left", "top"]; exactGrid.spacing = 2;
        var addExactBtn = compTab.add("button", undefined, "+ ADD COLOR");

        compTab.add("panel", [0, 0, 300, 1]); // divider

        var basedHeader = compTab.add("group");
        basedHeader.add("statictext", undefined, "Derived palette");
        var basedCount = basedHeader.add("statictext", undefined, "0");
        var basedGrid = compTab.add("group"); basedGrid.orientation = "column"; basedGrid.alignChildren = ["left", "top"]; basedGrid.spacing = 2;
        var basedRow = compTab.add("group");
        var addBasedBtn = basedRow.add("button", undefined, "+ ADD COLOR");
        var variationsBtn = basedRow.add("button", undefined, "VARIATIONS");

        compTab.add("panel", [0, 0, 300, 1]); // divider

        var saveRow = compTab.add("group");
        saveRow.alignment = ["fill", "top"];
        var nameField = saveRow.add("edittext", undefined, "");
        nameField.alignment = ["fill", "top"];
        nameField.helpTip = "Palette name";
        var saveBtn = saveRow.add("button", undefined, "SAVE");

        var memoryHeader = compTab.add("group");
        memoryHeader.add("statictext", undefined, "Palette memory");
        var memoryEmpty = compTab.add("statictext", undefined, "Previous palettes appear here after the next read or manual load.");
        var memoryList = compTab.add("group"); memoryList.orientation = "column"; memoryList.alignChildren = ["fill", "top"]; memoryList.spacing = 2;

        // --- Saved Palettes tab ---
        var savedList = libTab.add("listbox", undefined, [], { multiselect: false });
        savedList.alignment = ["fill", "fill"];
        var libRow = libTab.add("group");
        var loadBtn = libRow.add("button", undefined, "Load");
        var deleteBtn = libRow.add("button", undefined, "Delete");

        // --- render helpers ---

        function setStatus(text) { statusText.text = text; }

        function buildGrid(container, list) {
            while (container.children.length) container.remove(container.children[0]);
            var row = null;
            for (var i = 0; i < list.length; i++) {
                if (i % GRID_COLUMNS === 0) { row = container.add("group"); row.spacing = 2; }
                (function (item) {
                    var hex = rgbHex(item.rgb);
                    // Plain custom-drawn panel (not a native "button") so mousedown
                    // reliably reports the real button (0/1/2) and modifiers on
                    // every platform — native OS buttons only ever surface left click.
                    var btn = row.add("panel");
                    btn.preferredSize = [SWATCH_SIZE, SWATCH_SIZE];
                    btn.margins = 0;
                    btn.helpTip = hex + " — " + item.source + (item.layer ? " · " + item.layer : "") + "\nClick: Fill · Shift-click: Tint · Right-click: Copy HEX";
                    btn.onDraw = function () {
                        var g = this.graphics;
                        var brush = g.newBrush(g.BrushType.SOLID_COLOR, [item.rgb[0] / 255, item.rgb[1] / 255, item.rgb[2] / 255, 1]);
                        g.rectPath(0, 0, this.size.width, this.size.height);
                        g.fillPath(brush);
                    };
                    btn.addEventListener("mousedown", function (ev) {
                        if (ev.button === 2) {
                            var copied = copyToClipboard(hex);
                            lastColorText.text = hex;
                            lastColorText.active = true;
                            try { lastColorText.textselection = hex; } catch (ignoreSel) {}
                            setStatus(copied ? (hex + " copied to clipboard") : (hex + " \u2014 press Ctrl+C to copy"));
                        } else {
                            var mode = ev.shiftKey ? "tint" : "fill";
                            var changed = applyEffectColor(hex, mode);
                            lastColorText.text = hex;
                            setStatus((mode === "tint" ? "Tint" : "Fill") + " " + hex + " applied to " + changed + " layer(s)");
                        }
                    });
                })(list[i]);
            }
            win.layout.layout(true);
        }

        function renderAll() {
            exactCount.text = String(state.exact.length);
            basedCount.text = String(state.based.length);
            buildGrid(exactGrid, state.exact);
            buildGrid(basedGrid, state.based);
        }

        function renderSaved() {
            savedList.removeAll();
            for (var i = 0; i < state.saved.length; i++) {
                var p = state.saved[i];
                var item = savedList.add("item", p.name + "  (" + (p.exact.length + p.based.length) + " colors)");
                item.paletteId = p.id;
            }
        }

        function renderMemory() {
            while (memoryList.children.length) memoryList.remove(memoryList.children[0]);
            memoryEmpty.visible = state.history.length === 0;
            for (var i = 0; i < state.history.length; i++) {
                (function (entry) {
                    var row = memoryList.add("button", undefined, entry.name + "  (" + (entry.exact.length + entry.based.length) + " colors)");
                    // onClick (not addEventListener) so the left mouse button
                    // triggers the load, matching the swatch buttons.
                    row.onClick = function () { restoreSnapshot(entry, true); };
                })(state.history[i]);
            }
            win.layout.layout(true);
        }

        function snapshot() {
            return { id: newId(), name: state.activeName || state.compName || "Untitled palette", comp: state.compName, created: timestamp(), exact: state.exact, based: state.based };
        }

        function paletteFingerprint(entry) {
            var parts = [entry.comp || ""];
            var all = (entry.exact || []).concat(entry.based || []);
            for (var i = 0; i < all.length; i++) parts.push(rgbHex(all[i].rgb));
            return parts.join(",");
        }

        function persistActive() {
            if (state.exact.length || state.based.length) savePaletteList(activeFile(), [snapshot()]);
            savePaletteList(historyFile(), state.history.slice(0, 2));
            renderMemory();
        }

        // Switches the working palette to `entry`. When addPrevious is true the
        // current working palette (if different) is pushed into the 2-slot
        // history before switching, mirroring the CEP "Palette Memory" behavior.
        function restoreSnapshot(entry, addPrevious) {
            if (addPrevious && (state.exact.length || state.based.length)) {
                var previous = snapshot();
                if (paletteFingerprint(previous) !== paletteFingerprint(entry)) {
                    var nextHistory = [previous];
                    for (var i = 0; i < state.history.length; i++) {
                        if (paletteFingerprint(state.history[i]) !== paletteFingerprint(previous) && paletteFingerprint(state.history[i]) !== paletteFingerprint(entry)) nextHistory.push(state.history[i]);
                    }
                    state.history = nextHistory.slice(0, 2);
                }
            }
            state.exact = (entry.exact || []).slice();
            state.based = (entry.based || []).slice();
            state.compName = entry.comp || "";
            state.activeName = entry.name || entry.comp || "Untitled palette";
            nameField.text = state.activeName;
            renderAll();
            persistActive();
        }

        function restoreOnOpen() {
            var activeList = loadPaletteList(activeFile());
            if (activeList.length) {
                var entry = activeList[0];
                state.exact = (entry.exact || []).slice();
                state.based = (entry.based || []).slice();
                state.compName = entry.comp || "";
                state.activeName = entry.name || entry.comp || "";
                nameField.text = state.activeName;
                setStatus((state.exact.length + state.based.length) + " colors restored from last session");
            }
            renderAll();
            renderMemory();
        }

        // --- actions ---

        scanBtn.onClick = function () {
            var comp = getWorkingComp();
            if (!comp) { setStatus("Activate a Composition Viewer, then try again."); return; }
            setStatus("Analyzing properties and pixels…");
            win.layout.layout(true);
            try {
                var exact = scanExact(comp);
                var samples = sampleDerived(comp, 20, 12);
                var based = paletteFromSamples(samples, 12);
                var filteredBased = [];
                for (var i = 0; i < based.length; i++) {
                    var overlaps = false;
                    for (var j = 0; j < exact.length; j++) if (distance(based[i].rgb, exact[j].rgb) <= 10) { overlaps = true; break; }
                    if (!overlaps) filteredBased.push(based[i]);
                }
                restoreSnapshot({ name: comp.name, comp: comp.name, exact: exact.slice(0, MAX_EXACT_COLORS), based: filteredBased }, true);
                var stamp = new Date();
                var hh = ("0" + stamp.getHours()).slice(-2), mm = ("0" + stamp.getMinutes()).slice(-2), ss = ("0" + stamp.getSeconds()).slice(-2);
                setStatus((state.exact.length + state.based.length) + " colors found in \"" + comp.name + "\" at " + hh + ":" + mm + ":" + ss);
            } catch (err) {
                alert("Read composition failed: " + err.toString());
                setStatus("Error: " + err.toString());
            }
        };

        addExactBtn.onClick = function () {
            var color = nativeColorPicker();
            if (!color) return;
            state.exact.push(color);
            if (state.exact.length > MAX_EXACT_COLORS) state.exact.shift();
            renderAll();
            persistActive();
            setStatus("Color added manually");
        };

        addBasedBtn.onClick = function () {
            var color = nativeColorPicker();
            if (!color) return;
            color.source = "Manual";
            state.based.push(color);
            renderAll();
            persistActive();
            setStatus("Color added manually");
        };

        variationsBtn.onClick = function () {
            if (!state.based.length) { setStatus("Read a composition first"); return; }
            state.variation = (state.variation + 1) % 3;
            var labels = ["Balanced", "Vibrant", "Soft"], mode = state.variation;
            for (var i = 0; i < state.based.length; i++) {
                var hsl = rgbToHsl(state.based[i].rgb);
                if (mode === 0) { hsl[0] = (hsl[0] + (i % 2 ? -0.035 : 0.035) + 1) % 1; hsl[1] = Math.min(1, hsl[1] * 1.08); }
                else if (mode === 1) { hsl[1] = Math.min(1, hsl[1] * 1.4 + 0.08); hsl[2] = Math.max(0.12, Math.min(0.82, hsl[2] + (i % 2 ? -0.05 : 0.05))); }
                else { hsl[1] *= 0.68; hsl[2] = hsl[2] * 0.82 + 0.09; }
                state.based[i] = { rgb: hslToRgb(hsl), source: labels[mode] + " variation", layer: "" };
            }
            renderAll();
            persistActive();
            setStatus(labels[mode] + " variation applied");
        };

        saveBtn.onClick = function () {
            try {
                var name = nameField.text.replace(/^\s+|\s+$/g, "");
                if (!name) { setStatus("Enter a palette name"); nameField.active = true; return; }
                if (!state.exact.length && !state.based.length) { setStatus("Read a composition first"); return; }
                var item = { id: newId(), name: name, comp: state.compName, created: timestamp(), exact: state.exact, based: state.based };
                var replaced = false;
                for (var i = 0; i < state.saved.length; i++) {
                    if (state.saved[i].name.toLowerCase() === name.toLowerCase()) { item.id = state.saved[i].id; state.saved[i] = item; replaced = true; break; }
                }
                if (!replaced) state.saved.unshift(item);
                savePalettes(state.saved);
                var verify = loadPalettes();
                renderSaved();
                state.activeName = name;
                persistActive();
                tabs.selection = libTab;
                setStatus((replaced ? "Palette updated" : "Palette saved") + " (" + verify.length + " total on disk)");
            } catch (err) {
                alert("Save failed: " + err.toString());
            }
        };

        loadBtn.onClick = function () {
            var sel = savedList.selection;
            if (!sel) { setStatus("Select a palette first"); return; }
            for (var i = 0; i < state.saved.length; i++) {
                if (state.saved[i].id === sel.paletteId) {
                    restoreSnapshot(state.saved[i], true);
                    tabs.selection = compTab;
                    setStatus("Palette \"" + state.saved[i].name + "\" loaded");
                    return;
                }
            }
        };

        deleteBtn.onClick = function () {
            var sel = savedList.selection;
            if (!sel) { setStatus("Select a palette first"); return; }
            if (!confirm("Delete this saved palette?")) return;
            var next = [];
            for (var i = 0; i < state.saved.length; i++) if (state.saved[i].id !== sel.paletteId) next.push(state.saved[i]);
            state.saved = next;
            savePalettes(state.saved);
            renderSaved();
            setStatus("Palette deleted");
        };

        renderSaved();
        restoreOnOpen();

        win.layout.layout(true);
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    var swatchColorsPanel = buildUI(thisObj);
    if (swatchColorsPanel instanceof Window) {
        swatchColorsPanel.center();
        swatchColorsPanel.show();
    } else {
        swatchColorsPanel.layout.layout(true);
    }
})(this);
