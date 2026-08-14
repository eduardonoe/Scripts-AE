// Version: 1.0
(function (thisObj) {
    function buildUI(thisObj) {
        var panel = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Text Splitter", undefined, { resizeable: true });
        panel.orientation = "column";
        panel.alignChildren = ["fill", "fill"];
        panel.spacing = 4;
        panel.margins = 6;
        var optsGroup = panel.add("group");
        optsGroup.orientation = "row";

        // Preferencias persistem entre sessoes via app.settings.
        var PREF = "TextSplitterPrefs";
        function prefGet(key, def) {
            try {
                if (app.settings.haveSetting(PREF, key)) {
                    return app.settings.getSetting(PREF, key) === "1";
                }
            } catch (e) {}
            return def;
        }
        function prefSet(key, val) {
            try { app.settings.saveSetting(PREF, key, val ? "1" : "0"); } catch (e) {}
        }

        var centerAnchorChk = optsGroup.add("checkbox", undefined, "Center Anchor");
        var addNullChk = optsGroup.add("checkbox", undefined, "Add Null");
        var colorLabelsChk = optsGroup.add("checkbox", undefined, "Colors");
        var deleteOriginalChk = optsGroup.add("checkbox", undefined, "Delete Original");
        deleteOriginalChk.helpTip = "Apaga a camada original apos dividir. Desmarcado, ela apenas fica desligada.";

        // carrega estado salvo (Colors marcado por padrao na 1a vez)
        centerAnchorChk.value = prefGet("centerAnchor", false);
        addNullChk.value = prefGet("addNull", false);
        colorLabelsChk.value = prefGet("colors", true);
        deleteOriginalChk.value = prefGet("deleteOriginal", false);

        // salva ao alterar
        centerAnchorChk.onClick = function () { prefSet("centerAnchor", centerAnchorChk.value); };
        addNullChk.onClick = function () { prefSet("addNull", addNullChk.value); };
        colorLabelsChk.onClick = function () { prefSet("colors", colorLabelsChk.value); };
        deleteOriginalChk.onClick = function () { prefSet("deleteOriginal", deleteOriginalChk.value); };
        var btnGroup = panel.add("group");
        btnGroup.orientation = "row";
        btnGroup.alignChildren = ["fill", "fill"];
        var letterBtn = btnGroup.add("button", undefined, "Letters");
        var wordBtn = btnGroup.add("button", undefined, "Words");
        var lineBtn = btnGroup.add("button", undefined, "Lines");
        letterBtn.minimumSize.width = wordBtn.minimumSize.width = lineBtn.minimumSize.width = 55;
        letterBtn.onClick = function () { runSplit("letters", centerAnchorChk.value, addNullChk.value, colorLabelsChk.value, deleteOriginalChk.value); };
        wordBtn.onClick = function () { runSplit("words", centerAnchorChk.value, addNullChk.value, colorLabelsChk.value, deleteOriginalChk.value); };
        lineBtn.onClick = function () { runSplit("lines", centerAnchorChk.value, addNullChk.value, colorLabelsChk.value, deleteOriginalChk.value); };
        var joinGroup = panel.add("group");
        joinGroup.orientation = "row";
        joinGroup.alignChildren = ["fill", "fill"];
        var joinBtn = joinGroup.add("button", undefined, "Join Selected");
        joinBtn.onClick = function () { runJoin(); };
        panel.onResizing = panel.onResize = function () {
            this.layout.resize();
        };
        panel.layout.layout(true);
        panel.layout.resize();
        if (panel instanceof Window) {
            panel.onShow = function () {
                this.layout.layout(true);
                this.layout.resize();
            };
        }
        return panel;
    }

    // Preserva estilo por caractere: escreve o texto do pedaco (zera estilo)
    // e reaplica, char a char, as propriedades lidas do original.
    var CHAR_STYLE_PROPS = [
        "font", "fontSize", "fillColor", "applyFill",
        "applyStroke", "strokeColor", "strokeWidth",
        "tracking", "baselineShift",
        "fauxBold", "fauxItalic", "allCaps", "smallCaps",
        "horizontalScale", "verticalScale"
    ];

    function docHasCharRange(doc) {
        try { return (typeof doc.characterRange === "function"); } catch (e) { return false; }
    }

    // Copia estilo de [srcStart, srcStart+count) para [destStart, +count).
    function applyCharStyles(srcDoc, srcStart, destDoc, count, destStart) {
        if (destStart === undefined) destStart = 0;
        for (var k = 0; k < count; k++) {
            var sRange, dRange;
            try { sRange = srcDoc.characterRange(srcStart + k, srcStart + k + 1); } catch (e) { continue; }
            try { dRange = destDoc.characterRange(destStart + k, destStart + k + 1); } catch (e) { continue; }
            for (var p = 0; p < CHAR_STYLE_PROPS.length; p++) {
                var name = CHAR_STYLE_PROPS[p];
                var val;
                try { val = sRange[name]; } catch (e) { continue; }
                if (val === undefined) continue;
                try { dRange[name] = val; } catch (e) {}
            }
        }
        return destDoc;
    }

    // Mede a base de um bloco com um caractere-guarda ("H", tamanho do
    // ultimo char da linha) para cancelar overshoot variavel entre medicoes.
    function measureLineBaseline(sourceLayer, comp, srcDoc, text, styleStart, count, J) {
        var GUARD = "H";
        var L = sourceLayer.duplicate();
        try {
            var d = L.property("Source Text").value;
            d.text = (text.length ? text : "") + GUARD;
            d.justification = J;
            L.property("Source Text").setValue(d);
            if (docHasCharRange(d)) {
                d = L.property("Source Text").value;
                if (count > 0 && srcDoc !== undefined) {
                    applyCharStyles(srcDoc, styleStart, d, count, 0);
                }
                // guarda no tamanho do ultimo char real: nao distorce autoLeading
                try {
                    var refSize = srcDoc.fontSize;
                    if (count > 0 && srcDoc !== undefined) {
                        try { refSize = srcDoc.characterRange(styleStart + count - 1, styleStart + count).fontSize; } catch (e2) {}
                    }
                    var gRange = d.characterRange(text.length, text.length + 1);
                    gRange.fontSize = refSize;
                    gRange.baselineShift = 0;
                    gRange.tracking = 0;
                } catch (e) {}
                L.property("Source Text").setValue(d);
            }
            var r = L.sourceRectAtTime(comp.time, false);
            return r.top + r.height; // base (bottom) da tinta, no tamanho real
        } finally {
            L.remove();
        }
    }

    // Mede rect de um texto herdando a camada original (Position/Anchor/
    // Scale/Rotation), justificacao J, estilo do trecho reaplicado.
    function measureRectInherited(sourceLayer, comp, srcDoc, text, styleStart, count, J) {
        var L = sourceLayer.duplicate();
        try {
            var d = L.property("Source Text").value;
            d.text = (text.length ? text : " ");
            d.justification = J;
            L.property("Source Text").setValue(d);
            if (docHasCharRange(d) && count > 0 && srcDoc !== undefined) {
                d = L.property("Source Text").value;
                applyCharStyles(srcDoc, styleStart, d, count, 0);
                L.property("Source Text").setValue(d);
            }
            var r = L.sourceRectAtTime(comp.time, false);
            return { left: r.left, right: r.left + r.width, width: r.width, top: r.top, height: r.height };
        } finally {
            L.remove();
        }
    }

    var JUST_TAG = "TS_JUST=";
    var FP_TAG = "TS_FP=";   // impressao digital para reconstrucao idem no Join

    // Cada grupo de quebra recebe um ID unico; cada pedaco guarda o groupId,
    // o texto original, a justificacao e o intervalo [start,end) que ocupa,
    // permitindo ao Join reconstruir o texto identico.
    function makeGroupId() {
        return "g" + (new Date().getTime()) + "_" + Math.floor(Math.random() * 100000);
    }

    // Serializa a impressao digital no comment (texto codificado p/ sobreviver
    // a quebras de linha: \r->\u0001, \n->\u0002, \u0003->\u0004).
    function writeFingerprint(layer, groupId, fullText, start, end, justStr, basePos, baseAnchor, breaks) {
        var enc = fullText.replace(/\r/g, "\u0001").replace(/\n/g, "\u0002").replace(/\u0003/g, "\u0004");
        var posStr = (basePos && basePos.length >= 2) ? (basePos[0] + "," + basePos[1] + "," + (basePos.length === 3 ? basePos[2] : 0)) : "";
        var ancStr = (baseAnchor && baseAnchor.length >= 2) ? (baseAnchor[0] + "," + baseAnchor[1] + "," + (baseAnchor.length === 3 ? baseAnchor[2] : 0)) : "";
        var brk = breaks ? breaks : "";
        var fp = FP_TAG + groupId + "\u241F" + start + "\u241F" + end + "\u241F" + justStr + "\u241F" + posStr + "\u241F" + ancStr + "\u241F" + brk + "\u241F" + enc;
        layer.comment = JUST_TAG + justStr + " " + fp;
    }

    function readFingerprint(layer) {
        var c = layer.comment;
        if (!c) return null;
        var idx = c.indexOf(FP_TAG);
        if (idx < 0) return null;
        var raw = c.substring(idx + FP_TAG.length);
        var parts = raw.split("\u241F");
        if (parts.length < 8) return null;
        var fullText = parts[7].replace(/\u0001/g, "\r").replace(/\u0002/g, "\n").replace(/\u0004/g, "\u0003");
        var basePos = null;
        if (parts[4].length > 0) {
            var pv = parts[4].split(",");
            basePos = [parseFloat(pv[0]), parseFloat(pv[1]), pv.length > 2 ? parseFloat(pv[2]) : 0];
        }
        var baseAnchor = null;
        if (parts[5].length > 0) {
            var av = parts[5].split(",");
            baseAnchor = [parseFloat(av[0]), parseFloat(av[1]), av.length > 2 ? parseFloat(av[2]) : 0];
        }
        var breaks = [];
        if (parts[6].length > 0) {
            var bvs = parts[6].split(".");
            for (var bi = 0; bi < bvs.length; bi++) breaks.push(parseInt(bvs[bi], 10));
        }
        return {
            groupId: parts[0],
            start: parseInt(parts[1], 10),
            end: parseInt(parts[2], 10),
            justStr: parts[3],
            basePos: basePos,
            baseAnchor: baseAnchor,
            breaks: breaks,
            fullText: fullText
        };
    }

    function justificationToString(just) {
        if (just === ParagraphJustification.CENTER_JUSTIFY) return "center";
        if (just === ParagraphJustification.RIGHT_JUSTIFY) return "right";
        return "left";
    }

    function stringToJustification(str) {
        if (str === "center") return ParagraphJustification.CENTER_JUSTIFY;
        if (str === "right") return ParagraphJustification.RIGHT_JUSTIFY;
        return ParagraphJustification.LEFT_JUSTIFY;
    }

    function unitLayerName(unitText) {
        var trimmed = unitText.replace(/^\s+|\s+$/g, "");
        return (trimmed.length > 0) ? trimmed : "(espaço)";
    }

    function transformOffset(dx, dy, scaleX, scaleY, rotationDeg) {
        var sx = dx * (scaleX / 100.0);
        var sy = dy * (scaleY / 100.0);
        var r = rotationDeg * Math.PI / 180.0;
        var cos = Math.cos(r);
        var sin = Math.sin(r);
        return [sx * cos - sy * sin, sx * sin + sy * cos];
    }

    function createUnitLayer(sourceLayer, unitText, xOffset, yOffset, centerAnchor, addNull, comp, forceLeftJustify, label, srcDoc, srcStart, isTargetLeft, fp) {
        var newLayer = sourceLayer.duplicate();
        var newDoc = newLayer.property("Source Text").value;
        var originalJust = newDoc.justification;
        newDoc.text = unitText;
        if (forceLeftJustify) {
            newDoc.justification = ParagraphJustification.LEFT_JUSTIFY;
        }
        newLayer.property("Source Text").setValue(newDoc);

        // Reaplica estilo char a char (tamanhos, cor, italico, sobrescrito,
        // tracking, small caps, escalas).
        if (srcDoc !== undefined && srcStart !== undefined) {
            var applied = newLayer.property("Source Text").value;
            if (docHasCharRange(applied) && docHasCharRange(srcDoc)) {
                applyCharStyles(srcDoc, srcStart, applied, unitText.length);
                newLayer.property("Source Text").setValue(applied);
            }
        }

        newLayer.name = unitLayerName(unitText);
        newLayer.label = (label !== undefined) ? label : 8;
        // alinhamento (compat) + impressao digital p/ Join, quando houver
        if (fp !== undefined && fp !== null) {
            writeFingerprint(newLayer, fp.groupId, fp.fullText, fp.start, fp.end, justificationToString(originalJust), sourceLayer.property("Position").value, sourceLayer.property("Anchor Point").value, fp.breaks);
        } else {
            newLayer.comment = JUST_TAG + justificationToString(originalJust);
        }
        var scaleVal = sourceLayer.property("Scale").value;
        var scaleX = scaleVal[0];
        var scaleY = scaleVal[1];
        var rotationDeg = sourceLayer.property("Rotation").value;

        var posProp = newLayer.property("Position");
        var basePos = sourceLayer.property("Position").value;
        var alignedPos;

        if (isTargetLeft) {
            // xOffset = coluna-alvo absoluta da borda esq da tinta; yOffset =
            // deslocamento de linha sobre a linha de base herdada.
            var gr = newLayer.sourceRectAtTime(comp.time, false);
            var dx = xOffset - gr.left;
            var off = transformOffset(dx, yOffset, scaleX, scaleY, rotationDeg);
            alignedPos = (basePos.length === 3)
                ? [basePos[0] + off[0], basePos[1] + off[1], basePos[2]]
                : [basePos[0] + off[0], basePos[1] + off[1]];
        } else {
            var off2 = transformOffset(xOffset, yOffset, scaleX, scaleY, rotationDeg);
            alignedPos = (basePos.length === 3)
                ? [basePos[0] + off2[0], basePos[1] + off2[1], basePos[2]]
                : [basePos[0] + off2[0], basePos[1] + off2[1]];
        }
        posProp.setValue(alignedPos);
        if (centerAnchor) {
            var anchorProp = newLayer.property("Anchor Point");
            var oldAnchor = anchorProp.value;
            var rect = newLayer.sourceRectAtTime(comp.time, false);
            var centerX = rect.left + rect.width / 2;
            var centerY = rect.top + rect.height / 2;
            var newAnchor = (oldAnchor.length === 3) ? [centerX, centerY, oldAnchor[2]] : [centerX, centerY];
            var anchorDelta = transformOffset(
                newAnchor[0] - oldAnchor[0],
                newAnchor[1] - oldAnchor[1],
                scaleX, scaleY, rotationDeg
            );
            anchorProp.setValue(newAnchor);
            alignedPos = (alignedPos.length === 3)
                ? [alignedPos[0] + anchorDelta[0], alignedPos[1] + anchorDelta[1], alignedPos[2]]
                : [alignedPos[0] + anchorDelta[0], alignedPos[1] + anchorDelta[1]];
            posProp.setValue(alignedPos);
        }
        if (addNull) {
            var nullLayer = comp.layers.addNull();
            nullLayer.name = "NULL - " + newLayer.name;
            nullLayer.label = 9;
            var nullPosProp = nullLayer.property("Position");
            var nullPosValue = (nullPosProp.value.length === 3)
                ? [alignedPos[0], alignedPos[1], (alignedPos.length === 3 ? alignedPos[2] : nullPosProp.value[2])]
                : [alignedPos[0], alignedPos[1]];
            nullPosProp.setValue(nullPosValue);
            newLayer.parent = nullLayer;
            var zeroPos = (posProp.value.length === 3) ? [0, 0, 0] : [0, 0];
            posProp.setValue(zeroPos);
        }
        return { unit: newLayer, nul: (addNull ? nullLayer : null) };
    }

    function splitTextLayer(layer, mode, comp, centerAnchor, addNull, useColors, deleteOriginal) {
        var textProp = layer.property("Source Text");
        var doc = textProp.value;
        var fullText = doc.text;
        var lineHeight = (!doc.autoLeading && doc.leading > 0) ? doc.leading : doc.fontSize * 1.2;
        var styled = docHasCharRange(doc);
        var pairs = [];
        var colorIndex = 0;

        // Impressao digital do grupo: permite ao Join reconstruir o texto
        // original identico (mesmos espacos, quebras, alinhamento e estilos).
        var groupId = makeGroupId();

        // Detecta linhas com indices reais (robusto a \r, \n, \r\n, \u0003).
        var lineList = [];
        (function () {
            var start = 0, i = 0;
            while (i < fullText.length) {
                var c = fullText.charAt(i);
                if (c === "\r" || c === "\n" || c === "\u0003") {
                    lineList.push({ text: fullText.substring(start, i), start: start });
                    if (c === "\r" && fullText.charAt(i + 1) === "\n") i++; // \r\n conta como 1
                    i++;
                    start = i;
                } else {
                    i++;
                }
            }
            lineList.push({ text: fullText.substring(start, i), start: start });
        })();

        // Posicoes das quebras (compacto, sobrevive a truncamento do comment).
        var breakPositions = [];
        for (var bl2 = 1; bl2 < lineList.length; bl2++) {
            breakPositions.push(lineList[bl2].start);
        }
        var breaksStr = breakPositions.join(".");

        // Y de cada linha medido com caractere-guarda (preciso ao pixel).
        var lineYOffsets = [];
        (function () {
            var firstBase = null;
            for (var q = 0; q < lineList.length; q++) {
                var endQ = lineList[q].start + lineList[q].text.length;
                var baseQ = measureLineBaseline(layer, comp, doc,
                    fullText.substring(0, endQ), 0, endQ, doc.justification);
                if (firstBase === null) firstBase = baseQ;
                lineYOffsets[q] = baseQ - firstBase;
            }
        })();

        for (var li = 0; li < lineList.length; li++) {
            var lineText = lineList[li].text;
            var absLine = lineList[li].start;
            var yOffset = lineYOffsets[li];

            if (mode === "lines") {
                if (lineText.length === 0) continue;
                var lineLabel = useColors ? (colorIndex % 16) + 1 : 8;
                colorIndex++;
                pairs.push(createUnitLayer(layer, lineText, 0, yOffset, centerAnchor, addNull, comp, false, lineLabel,
                    styled ? doc : undefined, styled ? absLine : undefined, false,
                    { groupId: groupId, fullText: fullText, breaks: breaksStr, start: absLine, end: absLine + lineText.length }));
                continue;
            }

            // X: justShift (LEFT->justif original) + avanco medido em LEFT.
            var origJust = doc.justification;
            var lineLeftReal = measureRectInherited(layer, comp, doc, lineText, absLine, lineText.length, origJust).left;
            var lineLeftInLeft = measureRectInherited(layer, comp, doc, lineText, absLine, lineText.length, ParagraphJustification.LEFT_JUSTIFY).left;
            var justShift = lineLeftReal - lineLeftInLeft;

            if (mode === "words") {
                var tokens = lineText.split(/(\s+)/);
                var cursor = 0;
                for (var wi = 0; wi < tokens.length; wi++) {
                    var token = tokens[wi];
                    if (token.length > 0 && !/^\s+$/.test(token)) {
                        var prefixEnd = measureRectInherited(layer, comp, doc,
                            lineText.substring(0, cursor + token.length), absLine, cursor + token.length,
                            ParagraphJustification.LEFT_JUSTIFY).right;
                        var wordW = measureRectInherited(layer, comp, doc, token, absLine + cursor, token.length,
                            ParagraphJustification.LEFT_JUSTIFY).width;
                        var targetLeft = (prefixEnd - wordW) + justShift;

                        var wordLabel = useColors ? (colorIndex % 16) + 1 : 8;
                        colorIndex++;
                        pairs.push(createUnitLayer(layer, token, targetLeft, yOffset, centerAnchor, addNull, comp, true, wordLabel,
                            styled ? doc : undefined, styled ? (absLine + cursor) : undefined, true,
                            { groupId: groupId, fullText: fullText, breaks: breaksStr, start: absLine + cursor, end: absLine + cursor + token.length }));
                    }
                    cursor += token.length;
                }
                continue;
            }

            if (mode === "letters") {
                var wordRanges = [];
                var ci2 = 0;
                while (ci2 < lineText.length) {
                    if (!/\s/.test(lineText.charAt(ci2))) {
                        var wStart = ci2;
                        while (ci2 < lineText.length && !/\s/.test(lineText.charAt(ci2))) ci2++;
                        var wLabel = useColors ? (colorIndex % 16) + 1 : 8;
                        colorIndex++;
                        wordRanges.push({ start: wStart, end: ci2 - 1, label: wLabel });
                    } else {
                        ci2++;
                    }
                }
                for (var ci = 0; ci < lineText.length; ci++) {
                    var ch = lineText.charAt(ci);
                    if (/\s/.test(ch)) continue;
                    var prefixEnd2 = measureRectInherited(layer, comp, doc,
                        lineText.substring(0, ci + 1), absLine, ci + 1,
                        ParagraphJustification.LEFT_JUSTIFY).right;
                    var charW = measureRectInherited(layer, comp, doc, ch, absLine + ci, 1,
                        ParagraphJustification.LEFT_JUSTIFY).width;
                    var targetLeft2 = (prefixEnd2 - charW) + justShift;
                    var charLabel = 1;
                    for (var wr = 0; wr < wordRanges.length; wr++) {
                        if (ci >= wordRanges[wr].start && ci <= wordRanges[wr].end) {
                            charLabel = wordRanges[wr].label;
                            break;
                        }
                    }
                    pairs.push(createUnitLayer(layer, ch, targetLeft2, yOffset, centerAnchor, addNull, comp, true, charLabel,
                        styled ? doc : undefined, styled ? (absLine + ci) : undefined, true,
                        { groupId: groupId, fullText: fullText, breaks: breaksStr, start: absLine + ci, end: absLine + ci + 1 }));
                }
                continue;
            }
        }
        reorderPairs(pairs);
        if (deleteOriginal) {
            layer.remove();
        } else {
            layer.enabled = false;
        }
    }

    function reorderPairs(pairs) {
        for (var i = 0; i < pairs.length; i++) {
            var p = pairs[i];
            p.unit.moveToBeginning();
            if (p.nul) {
                p.nul.moveToBeginning();
            }
        }
    }

    // Reconstroi o texto original identico a partir dos pedacos que carregam
    // a mesma impressao digital, reaplicando estilos por caractere e
    // restaurando alinhamento e posicao.
    function reconstructFromFingerprints(comp, fps) {
        try {
            fps.sort(function (a, b) { return a.fp.start - b.fp.start; }); // por posicao no texto

            var justStr = fps[0].fp.justStr;
            var restoredJust = stringToJustification(justStr);

            // Reconstroi o texto a partir dos pedacos (nao do fullText, que
            // pode truncar no comment). Buracos viram espaco ou quebra.
            var totalLen = 0;
            for (var t = 0; t < fps.length; t++) {
                if (fps[t].fp.end > totalLen) totalLen = fps[t].fp.end;
            }
            var chars = [];
            for (var c0 = 0; c0 < totalLen; c0++) {
                chars[c0] = " ";
            }
            // sobrescreve com o texto real de cada pedaco
            for (var pz = 0; pz < fps.length; pz++) {
                var pTxt = fps[pz].layer.property("Source Text").value.text;
                var pStart = fps[pz].fp.start;
                for (var kk = 0; kk < pTxt.length && (pStart + kk) < totalLen; kk++) {
                    chars[pStart + kk] = pTxt.charAt(kk);
                }
            }
            // Restaura quebras de linha (caractere antes de cada start vira \r)
            var brks = fps[0].fp.breaks || [];
            for (var bx = 0; bx < brks.length; bx++) {
                var bpos = brks[bx] - 1;
                if (bpos >= 0 && bpos < totalLen) chars[bpos] = "\r";
            }
            var fullText = chars.join("");

            var base = fps[0].layer;
            var merged = base.duplicate();

            var d = merged.property("Source Text").value;
            d.text = fullText;
            d.justification = restoredJust;
            merged.property("Source Text").setValue(d);

            // reaplica estilos por caractere de cada pedaco no texto reconstruido
            if (docHasCharRange(merged.property("Source Text").value)) {
                for (var p = 0; p < fps.length; p++) {
                    var pieceLayer = fps[p].layer;
                    var pieceStart = fps[p].fp.start;
                    var pieceEnd = fps[p].fp.end;
                    var pieceDoc = pieceLayer.property("Source Text").value;
                    if (!docHasCharRange(pieceDoc)) continue;
                    var count = pieceEnd - pieceStart;
                    var pieceLen = pieceDoc.text.length;
                    var n = Math.min(count, pieceLen);
                    var appliedDoc = merged.property("Source Text").value;
                    for (var k = 0; k < n; k++) {
                        var sRange, dRange;
                        try { sRange = pieceDoc.characterRange(k, k + 1); } catch (e) { continue; }
                        try { dRange = appliedDoc.characterRange(pieceStart + k, pieceStart + k + 1); } catch (e) { continue; }
                        for (var pp = 0; pp < CHAR_STYLE_PROPS.length; pp++) {
                            var nm = CHAR_STYLE_PROPS[pp];
                            var v;
                            try { v = sRange[nm]; } catch (e) { continue; }
                            if (v === undefined) continue;
                            try { dRange[nm] = v; } catch (e) {}
                        }
                    }
                    merged.property("Source Text").setValue(appliedDoc);
                }
            }

            merged.name = fullText.length > 30 ? (fullText.substring(0, 30) + "...") : fullText;
            merged.label = base.label;
            merged.enabled = true;
            merged.comment = "";

            // Restaura Anchor Point e Position originais: tinta cai exata.
            var baseAnchor = fps[0].fp.baseAnchor;
            if (baseAnchor !== null) {
                var aProp = merged.property("Anchor Point");
                var av = aProp.value;
                aProp.setValue((av.length === 3)
                    ? [baseAnchor[0], baseAnchor[1], (baseAnchor.length === 3 ? baseAnchor[2] : av[2])]
                    : [baseAnchor[0], baseAnchor[1]]);
            }
            var basePos = fps[0].fp.basePos;
            if (basePos !== null) {
                var mPosProp = merged.property("Position");
                var cur = mPosProp.value;
                var newP = (cur.length === 3)
                    ? [basePos[0], basePos[1], (basePos.length === 3 ? basePos[2] : cur[2])]
                    : [basePos[0], basePos[1]];
                mPosProp.setValue(newP);
            }

            return merged;
        } catch (e) {
            return null;
        }
    }

    // Reconstroi via impressao digital (pedacos do mesmo groupId).
    function joinTextLayers(comp, textLayers) {
        var fps = [];
        var groupId0 = null;
        for (var fi = 0; fi < textLayers.length; fi++) {
            var fpr = readFingerprint(textLayers[fi]);
            if (fpr === null || (groupId0 !== null && fpr.groupId !== groupId0)) return null;
            if (groupId0 === null) groupId0 = fpr.groupId;
            fps.push({ layer: textLayers[fi], fp: fpr });
        }
        var merged = reconstructFromFingerprints(comp, fps);
        if (merged === null) return null;
        for (var ri = 0; ri < textLayers.length; ri++) {
            var pN = textLayers[ri].parent;
            try { textLayers[ri].remove(); } catch (e) {}
            if (pN !== null) { try { pN.remove(); } catch (e) {} }
        }
        return merged;
    }

    function runJoin() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Abra uma composição antes de rodar o script.");
            return;
        }
        var sel = comp.selectedLayers;
        var textLayers = [];
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof TextLayer) textLayers.push(sel[i]);
        }
        if (textLayers.length < 2) {
            alert("Selecione ao menos duas camadas de texto para unir.");
            return;
        }
        app.beginUndoGroup("Join Text Layers");
        try {
            var merged = joinTextLayers(comp, textLayers);
            if (merged === null) {
                alert("Não foi possível unir: selecione apenas peças geradas pela quebra (mesmo grupo).");
            }
        } catch (e) {
            alert("Erro: " + e.toString());
        } finally {
            app.endUndoGroup();
        }
    }

    function runSplit(mode, centerAnchor, addNull, useColors, deleteOriginal) {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Abra uma composição antes de rodar o script.");
            return;
        }
        var sel = comp.selectedLayers;
        var textLayers = [];
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] instanceof TextLayer) textLayers.push(sel[i]);
        }
        if (textLayers.length === 0) {
            alert("Selecione ao menos uma camada de texto.");
            return;
        }
        app.beginUndoGroup("Split Text (" + mode + ")");
        try {
            for (var j = 0; j < textLayers.length; j++) {
                splitTextLayer(textLayers[j], mode, comp, centerAnchor, addNull, useColors, deleteOriginal);
            }
        } catch (e) {
            alert("Erro: " + e.toString());
        } finally {
            app.endUndoGroup();
        }
    }

    var myPanel = buildUI(thisObj);
    if (myPanel instanceof Window) {
        myPanel.center();
        myPanel.show();
    }
})(this);
