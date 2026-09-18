/*
    Text Swap
    Version: 0.2.0
    Author: Eduardo Noe

    Troca o estilo de uma layer de texto (TL1) pelo estilo de outra (TL2)
    unidade a unidade (caractere, palavra ou linha), controlado por um slider
    "Swap - Animation" (0-100). Usa estilo por caractere via expressao no
    Source Text (requer After Effects 25.0+ com engine JavaScript).

    Uso:
    1. Crie TL1 (estilo inicial) e TL2 (estilo final) com o mesmo texto.
    2. Selecione TL1 e depois TL2 (ordem de selecao importa).
    3. Clique Animate. TL2 vira referencia (oculta) e TL1 recebe o rig.

    Estilos copiados de TL2: fonte, tamanho, faux bold/italic, all caps,
    small caps, tracking, escala H/V, baseline shift, fill e stroke.

    v0.2.0 changelog:
    - Primeira implementacao: rig de swap com Based On (Character/Word/Line),
      Order (Left->Right, Right->Left, Center Out, Edges In, Random) e Remove.
    v0.1.0 changelog:
    - Estrutura inicial do script.
*/

(function TextSwap(thisObj) {
    var SCRIPT_NAME = "Text Swap";
    var SCRIPT_VERSION = "0.2.0";

    var FX_TARGET = "Swap - Target";
    var FX_ANIM = "Swap - Animation";
    var FX_BASED = "Swap - Based On";
    var FX_ORDER = "Swap - Order";
    var FX_SEED = "Swap - Seed";
    var ALL_FX = [FX_TARGET, FX_ANIM, FX_BASED, FX_ORDER, FX_SEED];
    var EXPR_TAG = "// TEXT SWAP RIG";

    function buildExpression() {
        var e = [];
        e.push(EXPR_TAG);
        e.push('var tgt = effect("' + FX_TARGET + '")(1);');
        e.push('var p = effect("' + FX_ANIM + '")(1) / 100;');
        e.push('var mode = effect("' + FX_BASED + '")(1).value;');
        e.push('var order = effect("' + FX_ORDER + '")(1).value;');
        e.push('var seed = effect("' + FX_SEED + '")(1).value;');
        e.push('var s = text.sourceText.style;');
        e.push('var txt = text.sourceText.value;');
        e.push('if (tgt == null || tgt.index == index || p <= 0) { s; } else {');
        e.push('  var t = tgt.text.sourceText.style;');
        // monta as unidades [inicio, tamanho]
        e.push('  var u = [];');
        e.push('  if (mode == 1) { for (var i = 0; i < txt.length; i++) { if (!/\\s/.test(txt.charAt(i))) u.push([i, 1]); } }');
        e.push('  else { var re = (mode == 2) ? /\\S+/g : /[^\\r\\n\\u0003]+/g; var m; while ((m = re.exec(txt)) != null) u.push([m.index, m[0].length]); }');
        e.push('  var n = u.length;');
        // ranking de cada unidade conforme a ordem
        e.push('  var rk = [];');
        e.push('  for (var i = 0; i < n; i++) {');
        e.push('    var c = (n - 1) / 2;');
        e.push('    if (order == 1) rk.push(i);');
        e.push('    else if (order == 2) rk.push(n - 1 - i);');
        e.push('    else if (order == 3) rk.push(Math.abs(i - c));');
        e.push('    else if (order == 4) rk.push(c - Math.abs(i - c));');
        e.push('    else { seedRandom(seed * 1000 + i, true); rk.push(random()); }');
        e.push('  }');
        e.push('  var idx = []; for (var i = 0; i < n; i++) idx.push(i);');
        e.push('  idx.sort(function (a, b) { return (rk[a] - rk[b]) || (a - b); });');
        e.push('  var k = Math.round(p * n);');
        e.push('  for (var j = 0; j < k && j < n; j++) {');
        e.push('    var a = u[idx[j]][0], l = u[idx[j]][1];');
        e.push('    s = s.setFont(t.font, a, l).setFontSize(t.fontSize, a, l)');
        e.push('         .setFauxBold(t.isFauxBold, a, l).setFauxItalic(t.isFauxItalic, a, l)');
        e.push('         .setAllCaps(t.isAllCaps, a, l).setSmallCaps(t.isSmallCaps, a, l)');
        e.push('         .setTracking(t.tracking, a, l).setHorizontalScaling(t.horizontalScaling, a, l)');
        e.push('         .setVerticalScaling(t.verticalScaling, a, l).setBaselineShift(t.baselineShift, a, l)');
        e.push('         .setApplyFill(t.applyFill, a, l).setFillColor(t.fillColor, a, l)');
        e.push('         .setApplyStroke(t.applyStroke, a, l).setStrokeColor(t.strokeColor, a, l)');
        e.push('         .setStrokeWidth(t.strokeWidth, a, l);');
        e.push('  }');
        e.push('  s;');
        e.push('}');
        return e.join("\n");
    }

    function isTextLayer(l) { return l && l instanceof TextLayer; }

    function removeRig(layer) {
        var fx = layer.property("ADBE Effect Parade");
        for (var i = fx.numProperties; i >= 1; i--) {
            var nm = fx.property(i).name;
            for (var j = 0; j < ALL_FX.length; j++) {
                if (nm === ALL_FX[j]) { fx.property(i).remove(); break; }
            }
        }
        var st = layer.property("ADBE Text Properties").property("ADBE Text Document");
        if (st.expression.indexOf(EXPR_TAG) === 0) st.expression = "";
    }

    function addFx(layer, match, name) {
        var e = layer.property("ADBE Effect Parade").addProperty(match);
        e.name = name;
        return layer.property("ADBE Effect Parade").property(name);
    }

    function addDropdown(layer, name, items) {
        var e = addFx(layer, "ADBE Dropdown Control", name);
        var menu = e.property(1).setPropertyParameters(items);
        menu.propertyGroup(1).name = name; // setPropertyParameters invalida a referencia
        return layer.property("ADBE Effect Parade").property(name);
    }

    function animate(opts) {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) { alert("Abra uma composicao."); return; }
        var sel = comp.selectedLayers;
        if (sel.length !== 2 || !isTextLayer(sel[0]) || !isTextLayer(sel[1])) {
            alert("Selecione 2 layers de texto: primeiro TL1 (estilo inicial), depois TL2 (estilo final).");
            return;
        }
        var tl1 = sel[0], tl2 = sel[1];
        var v1 = tl1.property("ADBE Text Properties").property("ADBE Text Document").value.text;
        var v2 = tl2.property("ADBE Text Properties").property("ADBE Text Document").value.text;

        app.beginUndoGroup(SCRIPT_NAME + ": Animate");
        try {
            removeRig(tl1);

            var target = addFx(tl1, "ADBE Layer Control", FX_TARGET);
            target.property(1).setValue(tl2.index);

            var anim = addFx(tl1, "ADBE Slider Control", FX_ANIM);
            var based = addDropdown(tl1, FX_BASED, ["Character", "Word", "Line"]);
            based.property(1).setValue(opts.based);
            var order = addDropdown(tl1, FX_ORDER, ["Left > Right", "Right > Left", "Center Out", "Edges In", "Random"]);
            order.property(1).setValue(opts.order);
            var seed = addFx(tl1, "ADBE Slider Control", FX_SEED);
            seed.property(1).setValue(1);

            // keyframes 0 -> 100 no CTI, com Easy Ease
            var sl = tl1.property("ADBE Effect Parade").property(FX_ANIM).property(1);
            var t0 = comp.time, t1 = comp.time + opts.duration;
            sl.setValueAtTime(t0, 0);
            sl.setValueAtTime(t1, 100);
            var ease = [new KeyframeEase(0, 33.33)];
            for (var k = 1; k <= sl.numKeys; k++) sl.setTemporalEaseAtKey(k, ease, ease);

            tl1.property("ADBE Text Properties").property("ADBE Text Document").expression = buildExpression();

            tl2.enabled = false;
            tl2.moveBefore(tl1) ;
            if (tl1.name.indexOf("TL1") !== 0) tl1.name = "TL1 - " + tl1.name;
            if (tl2.name.indexOf("TL2") !== 0) tl2.name = "TL2 - " + tl2.name;
        } catch (err) {
            alert(SCRIPT_NAME + " erro: " + err.toString());
        }
        app.endUndoGroup();

        if (v1 !== v2) alert("Aviso: TL1 e TL2 tem textos diferentes. O swap usa o texto de TL1 e so o estilo de TL2.");
    }

    function remove() {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) return;
        app.beginUndoGroup(SCRIPT_NAME + ": Remove");
        var sel = comp.selectedLayers;
        for (var i = 0; i < sel.length; i++) if (isTextLayer(sel[i])) removeRig(sel[i]);
        app.endUndoGroup();
    }

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME + " v" + SCRIPT_VERSION, undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 10;

        win.add("statictext", undefined, "Selecione TL1 e depois TL2.");

        var g1 = win.add("group");
        g1.add("statictext", undefined, "Based On:").preferredSize.width = 70;
        var ddBased = g1.add("dropdownlist", undefined, ["Character", "Word", "Line"]);
        ddBased.selection = 0; ddBased.alignment = ["fill", "center"];

        var g2 = win.add("group");
        g2.add("statictext", undefined, "Order:").preferredSize.width = 70;
        var ddOrder = g2.add("dropdownlist", undefined, ["Left > Right", "Right > Left", "Center Out", "Edges In", "Random"]);
        ddOrder.selection = 0; ddOrder.alignment = ["fill", "center"];

        var g3 = win.add("group");
        g3.add("statictext", undefined, "Duracao (s):").preferredSize.width = 70;
        var etDur = g3.add("edittext", undefined, "1");
        etDur.characters = 5;

        var bAnim = win.add("button", undefined, "Animate");
        var bRem = win.add("button", undefined, "Remove Rig");

        bAnim.onClick = function () {
            var d = parseFloat(etDur.text);
            if (isNaN(d) || d <= 0) d = 1;
            animate({ based: ddBased.selection.index + 1, order: ddOrder.selection.index + 1, duration: d });
        };
        bRem.onClick = remove;

        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    var ui = buildUI(thisObj);
    if (ui instanceof Window) { ui.center(); ui.show(); }
    else { ui.layout.layout(true); }
})(this);
