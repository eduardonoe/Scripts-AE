// ============================================================
// MOTION TOOLS PROJECT - Organize & Batch Comp
// ============================================================

function buildProject_UI(parentPanel, buildSectionHelper, COLORS, mtStatus) {

    // ==========================================
    // UI: ORGANIZE
    // ==========================================
    var secOrg = buildSectionHelper(parentPanel, "Organize", COLORS.organize[0], COLORS.organize[1], COLORS.organize[2]);

    var orgDesc = secOrg.add("statictext", undefined, "Organiza footages, comps e pastas do projeto por categoria, aplica cores por uso.", { multiline: true });
    orgDesc.alignment = ["fill", "top"];

    var btnOrganize = secOrg.add("button", undefined, "🗂  ORGANIZAR PROJETO");
    btnOrganize.preferredSize[1] = 28;
    btnOrganize.onClick = function () { organizeProject(mtStatus); };

    // ==========================================
    // UI: BATCH COMP
    // ==========================================
    var secBatch = buildSectionHelper(parentPanel, "Batch Comp", COLORS.batchComp[0], COLORS.batchComp[1], COLORS.batchComp[2], true);

    var grpDim = secBatch.add("group"); grpDim.orientation = "row"; grpDim.alignChildren = ["left", "center"]; grpDim.spacing = 4;
    grpDim.add("statictext", undefined, "W:"); var editW = grpDim.add("edittext", undefined, ""); editW.preferredSize.width = 50; editW.helpTip = "Largura em px (aceita cálculos, ex: +100, /2)";
    grpDim.add("statictext", undefined, "H:"); var editH = grpDim.add("edittext", undefined, ""); editH.preferredSize.width = 50; editH.helpTip = "Altura em px (aceita cálculos, ex: +100, /2)";

    var grpTime = secBatch.add("group"); grpTime.orientation = "row"; grpTime.alignChildren = ["left", "center"]; grpTime.spacing = 4;
    grpTime.add("statictext", undefined, "Dur(s):"); var editDur = grpTime.add("edittext", undefined, ""); editDur.preferredSize.width = 46; editDur.helpTip = "Duração em seg ou frames (ex: +1:15, +15f, +1s, *2)";
    grpTime.add("statictext", undefined, "FPS:"); var editFPS = grpTime.add("edittext", undefined, ""); editFPS.preferredSize.width = 46; editFPS.helpTip = "Frame rate";
    
    var grpOptions = secBatch.add("group"); grpOptions.orientation = "row"; grpOptions.alignChildren = ["left", "center"]; grpOptions.spacing = 15;
    var chkExtend = grpOptions.add("checkbox", undefined, "Estender Layers"); chkExtend.value = true; chkExtend.helpTip = "Ajusta as layers para a nova duração";
    var chkExtendPrecomps = grpOptions.add("checkbox", undefined, "Estender Precomps"); chkExtendPrecomps.value = false; chkExtendPrecomps.helpTip = "Estende a duração interna das precomps recursivamente";

    var grpBlur = secBatch.add("group"); grpBlur.orientation = "row"; grpBlur.alignChildren = ["left", "center"]; grpBlur.spacing = 4;
    grpBlur.add("statictext", undefined, "SPF:"); var editSPF = grpBlur.add("edittext", undefined, ""); editSPF.preferredSize.width = 40; editSPF.helpTip = "Samples Per Frame (2–64)";
    grpBlur.add("statictext", undefined, "ASL:"); var editASL = grpBlur.add("edittext", undefined, ""); editASL.preferredSize.width = 40; editASL.helpTip = "Adaptive Sample Limit (16–128)";

    var grpColor = secBatch.add("group"); grpColor.orientation = "row"; grpColor.alignChildren = ["left", "center"]; grpColor.spacing = 4;
    grpColor.add("statictext", undefined, "BG:");
    var btnColor = grpColor.add("button", undefined, "Escolher Cor..."); btnColor.preferredSize.width = 110;
    var btnClearColor = grpColor.add("button", undefined, "✕"); btnClearColor.preferredSize.width = 24;

    var selectedColor = null;

    btnColor.onClick = function () {
        var colorDecimal = $.colorPicker();
        if (colorDecimal !== -1) {
            var r = (colorDecimal >> 16) & 0xFF;
            var g = (colorDecimal >> 8) & 0xFF;
            var b = colorDecimal & 0xFF;
            selectedColor = [r / 255, g / 255, b / 255];
            btnColor.text = "Cor Selecionada!";
        }
    };
    btnClearColor.onClick = function () { selectedColor = null; btnColor.text = "Escolher Cor..."; };

    var btnApply = secBatch.add("button", undefined, "✔  APLICAR NAS SELECIONADAS");
    btnApply.preferredSize[1] = 26;

    var grpProgress = secBatch.add("group"); grpProgress.orientation = "column"; grpProgress.alignChildren = ["fill", "center"]; grpProgress.spacing = 3;
    var txtProgress = grpProgress.add("statictext", undefined, ""); txtProgress.alignment = ["fill", "center"];
    var progressBar = grpProgress.add("progressbar", undefined, 0, 100); progressBar.preferredSize.height = 10;
    grpProgress.visible = false;

    function solveMath(expr, currVal) {
        if (typeof expr !== "string") return null;
        var s = expr.replace(/\s/g, ""); if (s === "") return null;
        if (s.charAt(0) === '+' || s.charAt(0) === '-' || s.charAt(0) === '*' || s.charAt(0) === '/') {
            s = String(currVal) + s;
        }
        s = s.replace(/,/g, ".");
        try { var res = eval(s); return isNaN(res) ? null : Number(res); } catch (e) { return null; }
    }

    function parseTimeExpr(expr, currVal, fps) {
        if (typeof expr !== "string") return null;
        var s = expr.replace(/\s/g, "").toLowerCase();
        if (s === "") return null;

        var isRelative = false;
        var sign = 1;
        if (s.charAt(0) === '+') { isRelative = true; sign = 1; s = s.substring(1); }
        else if (s.charAt(0) === '-') { isRelative = true; sign = -1; s = s.substring(1); }

        if (s.charAt(0) === '*' || s.charAt(0) === '/') {
            try {
                var res = eval(String(currVal) + expr.replace(/\s/g, "").replace(/,/g, "."));
                return isNaN(res) ? null : Number(res);
            } catch(e) { return null; }
        }

        var totalSeconds = 0;
        var matched = false;

        var tcMatch = s.match(/^(\d+):(\d+)$/);
        if (tcMatch) {
            totalSeconds = parseInt(tcMatch[1], 10) + (parseInt(tcMatch[2], 10) / fps);
            matched = true;
        } else {
            var sMatch = s.match(/(\d+(?:\.\d+)?)s/);
            var fMatch = s.match(/(\d+(?:\.\d+)?)f/);
            
            if (sMatch || fMatch) {
                var secs = sMatch ? parseFloat(sMatch[1]) : 0;
                var frames = fMatch ? parseFloat(fMatch[1]) : 0;
                totalSeconds = secs + (frames / fps);
                matched = true;
            }
        }

        if (matched) {
            if (isRelative) {
                return currVal + (sign * totalSeconds);
            } else {
                return sign * totalSeconds;
            }
        }

        var fbExpr = expr.replace(/\s/g, "").replace(/,/g, ".");
        if (fbExpr.charAt(0) === '+' || fbExpr.charAt(0) === '-' || fbExpr.charAt(0) === '*' || fbExpr.charAt(0) === '/') {
            fbExpr = String(currVal) + fbExpr;
        }
        try {
            var resFb = eval(fbExpr);
            return isNaN(resFb) ? null : Number(resFb);
        } catch(e) { return null; }
    }

    btnApply.onClick = function () {
        function processDurationChange(targetComp, targetNewDur, extL, extP, pIds) {
            // Se já processou essa comp com uma duração maior ou igual, não precisa reprocessar
            if (pIds[targetComp.id] !== undefined && pIds[targetComp.id] >= targetNewDur) return;
            pIds[targetComp.id] = targetNewDur;

            targetComp.duration = targetNewDur;
            
            if (extL || extP) {
                for (var L = 1; L <= targetComp.numLayers; L++) {
                    var lr = targetComp.layer(L);
                    var isPrecomp = (lr.source instanceof CompItem);
                    
                    if (isPrecomp && extP) {
                        var stretch = (lr.stretch !== undefined) ? (lr.stretch / 100) : 1;
                        var reqInternalDur = (targetNewDur - lr.startTime) / stretch;
                        if (reqInternalDur > lr.source.duration) {
                            processDurationChange(lr.source, reqInternalDur, extL, extP, pIds);
                        }
                    }
                    if (extL) {
                        try { lr.outPoint = targetNewDur; } catch(err) {}
                    }
                }
            }
        }

        var compsToEdit = [];
        var processedIds = {};

        var projSel = app.project.selection;
        for (var i = 0; i < projSel.length; i++) {
            if (projSel[i] instanceof CompItem) { compsToEdit.push(projSel[i]); processedIds[projSel[i].id] = true; }
        }

        var activeComp = app.project.activeItem;
        if (activeComp instanceof CompItem) {
            var layerSel = activeComp.selectedLayers;
            for (var j = 0; j < layerSel.length; j++) {
                var source = layerSel[j].source;
                if (source instanceof CompItem && !processedIds[source.id]) { compsToEdit.push(source); processedIds[source.id] = true; }
            }
        }

        if (compsToEdit.length === 0) { alert("Nenhuma composição selecionada no Project Panel ou na Timeline."); return; }

        var rawW   = editW.text;
        var rawH   = editH.text;
        var rawDur = editDur.text;
        var valFPS = parseFloat(editFPS.text);
        var valSPF = parseInt(editSPF.text, 10);
        var valASL = parseInt(editASL.text, 10);

        if (!isNaN(valSPF) && editSPF.text !== "" && (valSPF < 2 || valSPF > 64))   { alert("'Samples/Frame' deve ser entre 2 e 64."); return; }
        if (!isNaN(valASL) && editASL.text !== "" && (valASL < 16 || valASL > 128)) { alert("'Adapt Limit' deve ser entre 16 e 128."); return; }

        var mudancas = [];
        if (rawW.replace(/\s/g, "") !== "")         mudancas.push("Largura");
        if (rawH.replace(/\s/g, "") !== "")         mudancas.push("Altura");
        if (rawDur.replace(/\s/g, "") !== "")       mudancas.push("Duração");
        if (!isNaN(valFPS) && valFPS > 0)           mudancas.push("FPS: " + valFPS);
        if (!isNaN(valSPF) && editSPF.text !== "")  mudancas.push("SPF: " + valSPF);
        if (!isNaN(valASL) && editASL.text !== "")  mudancas.push("ASL: " + valASL);
        if (selectedColor !== null)                 mudancas.push("Cor de Fundo");

        if (mudancas.length === 0) { alert("Nenhum valor preenchido."); return; }

        grpProgress.visible = true;
        progressBar.maxvalue = compsToEdit.length;

        var globalDurProcessed = {};
        app.beginUndoGroup("Batch Edit Comps");
        for (var c = 0; c < compsToEdit.length; c++) {
            var comp = compsToEdit[c];
            txtProgress.text = "Processando " + (c + 1) + " de " + compsToEdit.length + "...";
            progressBar.value = c + 1;
            try { parentPanel.layout.layout(true); } catch(e) {}

            var newW = solveMath(rawW, comp.width);
            if (newW !== null && newW > 0) comp.width = Math.round(newW);

            var newH = solveMath(rawH, comp.height);
            if (newH !== null && newH > 0) comp.height = Math.round(newH);

            var newDur = parseTimeExpr(rawDur, comp.duration, comp.frameRate);
            if (newDur !== null && newDur > 0) {
                processDurationChange(comp, newDur, chkExtend.value, chkExtendPrecomps.value, globalDurProcessed);
            }

            if (!isNaN(valFPS) && valFPS > 0)           comp.frameRate  = valFPS;
            if (!isNaN(valSPF) && editSPF.text !== "")  comp.motionBlurSamplesPerFrame       = valSPF;
            if (!isNaN(valASL) && editASL.text !== "")  comp.motionBlurAdaptiveSampleLimit   = valASL;
            if (selectedColor !== null)                 comp.bgColor = selectedColor;
        }
        app.endUndoGroup();

        grpProgress.visible = false;
        if (mtStatus) mtStatus.text = "✔ BatchComp: " + compsToEdit.length + " comp(s) | " + mudancas.join(", ");
    };


    // =======================================================
    // LÓGICA: ORGANIZE (extraída do Organize_v7)
    // =======================================================
    function organizeProject(statusEl) {
        var project = app.project;
        if (!project || project.numItems === 0) { alert("Nenhum projeto aberto ou projeto vazio!"); return; }

        var OCOL = {
            MAIN_COMP: 1, PRE_COMP: 8, SHARED_PRE_COMP: 9, MISSING: 13,
            UNUSED: 0, USED_ONCE: 11, USED_MULTIPLE: 4, USED_MORE_THAN_THREE: 10, FOLDER: 2
        };

        var OCATS = {
            COMPOSITIONS:     { name: "_Compositions",     extensions: [], subName: null },
            PRE_COMPOSITIONS: { name: "_Pre-Compositions", extensions: [], subName: null },
            IMAGES:           { name: "Images",            extensions: [".jpg",".jpeg",".png",".webp",".gif",".tif",".tiff",".bmp",".exr",".hdr",".dpx"], subName: "imagens_sem categoria" },
            VIDEOS:           { name: "Videos",            extensions: [".mov",".mp4",".avi",".mxf",".wmv",".mkv",".m4v",".webm",".r3d",".braw"], subName: "videos_sem categoria" },
            AUDIO:            { name: "Audio",             extensions: [".mp3",".wav",".aif",".aiff",".m4a",".ogg",".flac"], subName: "audios_sem categoria" },
            AI_FILES:         { name: "Ai Files",          extensions: [".ai",".eps"], subName: "illustrator_sem categoria" },
            PSD_FILES:        { name: "Psd Files",         extensions: [".psd",".psb"], subName: "psds_sem categoria" },
            OTHERS:           { name: "Others",            extensions: [], subName: "outros_sem categoria" },
            MISSING_FILES:    { name: "Missing Files",     extensions: [], subName: null },
            AEP_FILES:        { name: "AEP_Files",         extensions: [], subName: null }
        };

        function safeIndexOf(arr, el) { for (var i = 0; i < arr.length; i++) { if (arr[i] === el) return i; } return -1; }

        function getExt(item) {
            try { if (item.file && item.file.name) { var m = item.file.name.toLowerCase().match(/\.[^\.]+$/); return m ? m[0] : ""; } } catch(e) {}
            return "";
        }

        function findOrCreate(parent, name) {
            for (var i = 1; i <= parent.numItems; i++) { var it = parent.item(i); if (it instanceof FolderItem && it.name === name) return it; }
            var f = app.project.items.addFolder(name); f.parentFolder = parent; return f;
        }

        function needsSub(parentFolder, subName) {
            for (var i = 1; i <= parentFolder.numItems; i++) { var it = parentFolder.item(i); if (it instanceof FolderItem && it.name !== subName) return true; }
            return false;
        }

        function detectLayerFolder(folder) {
            var nl = folder.name.toLowerCase(); var suf = " layers";
            if (nl.length <= suf.length || nl.substring(nl.length - suf.length) !== suf) return null;
            for (var i = 1; i <= folder.numItems; i++) {
                var it = folder.item(i); if (!(it instanceof FootageItem)) continue;
                var ex = getExt(it);
                if (ex === ".psd" || ex === ".psb") return "PSD_FILES";
                if (ex === ".ai"  || ex === ".eps") return "AI_FILES";
            }
            return "PSD_FILES";
        }

        function detectVideoFolder(folder) {
            var vexts = OCATS.VIDEOS.extensions;
            if (folder.numItems === 0) return false;
            for (var i = 1; i <= folder.numItems; i++) {
                var it = folder.item(i);
                if (it instanceof FolderItem) return false;
                if (!(it instanceof FootageItem)) return false;
                if (it.mainSource instanceof SolidSource) return false;
                if (it.footageMissing) return false;
                if (safeIndexOf(vexts, getExt(it)) === -1) return false;
            }
            return true;
        }

        function buildData(proj) {
            var usageCache = {};
            for (var i = 1; i <= proj.numItems; i++) {
                var it = proj.item(i); if (!(it instanceof CompItem)) continue;
                for (var j = 1; j <= it.layers.length; j++) {
                    try { var src = it.layer(j).source; if (src && src.id !== undefined) usageCache[src.id] = (usageCache[src.id] || 0) + 1; } catch(e) {}
                }
            }
            var rootItems = []; var rf = proj.rootFolder;
            for (var r = 1; r <= rf.numItems; r++) rootItems.push(rf.item(r));
            var rootCompIds = {};
            for (var rc = 0; rc < rootItems.length; rc++) { if (rootItems[rc] instanceof CompItem) rootCompIds[rootItems[rc].id] = true; }
            var rootUsage = {};
            for (var ri = 0; ri < rootItems.length; ri++) {
                var comp = rootItems[ri]; if (!(comp instanceof CompItem)) continue;
                for (var rj = 1; rj <= comp.layers.length; rj++) {
                    try { var rs = comp.layer(rj).source; if (rs && rs.id !== undefined && rootCompIds[rs.id]) rootUsage[rs.id] = (rootUsage[rs.id] || 0) + 1; } catch(e) {}
                }
            }
            var topComps = [], preComps = [];
            for (var c = 0; c < rootItems.length; c++) {
                if (!(rootItems[c] instanceof CompItem)) continue;
                if ((rootUsage[rootItems[c].id] || 0) === 0) topComps.push(rootItems[c]); else preComps.push(rootItems[c]);
            }
            return { usageCache: usageCache, rootItems: rootItems, topLevelComps: topComps, preComps: preComps };
        }

        function moveFootage(item, folders) {
            if (item.mainSource instanceof SolidSource) { var tgt = folders.OTHERS; if (OCATS.OTHERS.subName && needsSub(tgt, OCATS.OTHERS.subName)) tgt = findOrCreate(tgt, OCATS.OTHERS.subName); item.parentFolder = tgt; return; }
            if (item.footageMissing) { item.parentFolder = folders.MISSING_FILES; item.label = OCOL.MISSING; return; }
            var ext = getExt(item); var catKey = null;
            for (var k in OCATS) { if (!OCATS.hasOwnProperty(k)) continue; if (safeIndexOf(OCATS[k].extensions, ext) !== -1) { catKey = k; break; } }
            if (!catKey) catKey = "OTHERS";
            var tgt2 = folders[catKey]; var ci = OCATS[catKey];
            if (ci && ci.subName && needsSub(tgt2, ci.subName)) tgt2 = findOrCreate(tgt2, ci.subName);
            item.parentFolder = tgt2;
        }

        function moveComp(item, folders, topComps, usageCache) {
            if (item.name.indexOf("@") !== -1) { item.parentFolder = app.project.rootFolder; item.label = OCOL.MAIN_COMP; return; }
            if (safeIndexOf(topComps, item) > -1) { item.parentFolder = folders.COMPOSITIONS; item.label = OCOL.MAIN_COMP; }
            else { item.parentFolder = folders.PRE_COMPOSITIONS; item.label = (usageCache[item.id] || 0) > 1 ? OCOL.SHARED_PRE_COMP : OCOL.PRE_COMP; }
        }

        function applyColor(item, usageCache) {
            if (!(item instanceof FootageItem)) return;
            var u = usageCache[item.id] || 0;
            if (u === 0) { if (item.label !== OCOL.MISSING) item.label = OCOL.UNUSED; }
            else if (u === 1) item.label = OCOL.USED_ONCE;
            else if (u <= 3) item.label = OCOL.USED_MULTIPLE;
            else item.label = OCOL.USED_MORE_THAN_THREE;
        }

        function consolidate(folders) {
            for (var key in OCATS) {
                if (!OCATS.hasOwnProperty(key)) continue;
                var ci = OCATS[key]; if (!ci.subName) continue;
                var tf = folders[key];
                if (needsSub(tf, ci.subName)) {
                    var sf = findOrCreate(tf, ci.subName);
                    for (var i = tf.numItems; i >= 1; i--) { var it = tf.item(i); if (!(it instanceof FolderItem)) it.parentFolder = sf; }
                }
            }
        }

        function cleanEmpty(rootFolder) {
            for (var i = rootFolder.numItems; i >= 1; i--) { var it = rootFolder.item(i); if (it instanceof FolderItem && it.numItems === 0) it.remove(); }
        }

        function buildReport(data) {
            var uc = data.usageCache; var top = data.topLevelComps; var pre = data.preComps;
            var cc = { IMAGES:{t:0,u:0}, VIDEOS:{t:0,u:0}, AUDIO:{t:0,u:0}, AI_FILES:{t:0,u:0}, PSD_FILES:{t:0,u:0}, OTHERS:{t:0,u:0} };
            var miss = 0, sols = 0;
            for (var i = 1; i <= project.numItems; i++) {
                var it = project.item(i); if (!(it instanceof FootageItem)) continue;
                if (it.footageMissing) { miss++; continue; }
                if (it.mainSource instanceof SolidSource) { sols++; continue; }
                var ext = getExt(it); var fcat = "OTHERS";
                for (var k in OCATS) { if (!OCATS.hasOwnProperty(k)) continue; if (safeIndexOf(OCATS[k].extensions, ext) !== -1) { fcat = k; break; } }
                if (cc[fcat]) { cc[fcat].t++; if ((uc[it.id]||0)===0) cc[fcat].u++; }
                else { cc.OTHERS.t++; if ((uc[it.id]||0)===0) cc.OTHERS.u++; }
            }
            var shared = 0; for (var p = 0; p < pre.length; p++) if ((uc[pre[p].id]||0)>1) shared++;
            var totalUnused = 0; for (var cat in cc) if (cc.hasOwnProperty(cat)) totalUnused += cc[cat].u;
            var lbl = { IMAGES:"Imagens", VIDEOS:"Videos", AUDIO:"Audio", AI_FILES:"Ai Files", PSD_FILES:"Psd Files", OTHERS:"Others/Solids" };
            var lines = ["=== Organize v7 ===","","COMPOSIÇÕES","  Principais: "+top.length,"  Pre-comps: "+pre.length+(shared>0?" ("+shared+" compartilhadas)":""),"","FOOTAGES"];
            var anyFoot = false;
            for (var ck in cc) { if (!cc.hasOwnProperty(ck)) continue; var disp = (ck==="OTHERS")?cc[ck].t+sols:cc[ck].t; if (disp===0) continue; anyFoot=true; lines.push("  "+lbl[ck]+": "+disp+(cc[ck].u>0?"  ! "+cc[ck].u+" sem uso":"")); }
            if (!anyFoot) lines.push("  (nenhum footage)");
            lines.push("","ATENÇÃO");
            lines.push(totalUnused>0?"  ! "+totalUnused+" footage(s) sem uso":"  ✔ Nenhum footage sem uso");
            lines.push(miss>0?"  ✗ "+miss+" arquivo(s) ausente(s)":"  ✔ Nenhum ausente");
            lines.push("","Projeto organizado!");
            return lines.join("\n");
        }

        app.beginUndoGroup("Organizar Projeto");
        var rootFolder = project.rootFolder;
        var folders = {};
        for (var key in OCATS) { if (!OCATS.hasOwnProperty(key)) continue; folders[key] = findOrCreate(rootFolder, OCATS[key].name); folders[key].label = OCOL.FOLDER; }

        for (var m = 1; m <= project.numItems; m++) {
            var mItem = project.item(m);
            if (mItem instanceof CompItem && mItem.name.indexOf("@") !== -1 && mItem.parentFolder !== rootFolder) mItem.parentFolder = rootFolder;
        }

        var scriptFolderIds = {};
        for (var sk in folders) { if (folders.hasOwnProperty(sk)) scriptFolderIds[folders[sk].id] = true; }

        var snapshot = [];
        for (var i = 1; i <= rootFolder.numItems; i++) { var it = rootFolder.item(i); if (!scriptFolderIds[it.id]) snapshot.push(it); }

        for (var b = 0; b < snapshot.length; b++) {
            var folder = snapshot[b]; if (!(folder instanceof FolderItem)) continue;
            var nl = folder.name.toLowerCase();
            if (nl.indexOf(".aep") !== -1) { folder.parentFolder = folders.AEP_FILES; continue; }
            var lc = detectLayerFolder(folder); if (lc) { folder.parentFolder = folders[lc]; continue; }
            if (detectVideoFolder(folder)) { folder.parentFolder = folders.VIDEOS; continue; }
        }

        var data = buildData(project);
        for (var j = 0; j < snapshot.length; j++) {
            var ri = snapshot[j];
            if (ri instanceof FootageItem) moveFootage(ri, folders);
            else if (ri instanceof CompItem) moveComp(ri, folders, data.topLevelComps, data.usageCache);
        }

        for (var kk = 1; kk <= project.numItems; kk++) applyColor(project.item(kk), data.usageCache);

        consolidate(folders);
        var report = buildReport(data);
        cleanEmpty(rootFolder);

        app.endUndoGroup();
        if (statusEl) statusEl.text = "✔ Projeto organizado!";
        alert(report);
    }

}