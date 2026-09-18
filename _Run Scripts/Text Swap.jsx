/*
    Text Swap
    Version: 0.4.0
    Author: Eduardo Noe

    Troca o estilo de uma layer de texto (TL1) pelo estilo de outra (TL2)
    unidade a unidade (caractere, palavra ou linha), controlado por um slider
    "Swap - Animation" (0-100). Usa estilo por caractere via expressao no
    Source Text (requer After Effects 25.0+ com engine JavaScript).

    Uso:
    1. Crie TL1 (estilo inicial) e TL2 (estilo final) com o mesmo texto.
    2. Deixe TL2 acima de TL1 e selecione as duas (em qualquer ordem),
       ou nao selecione nada se a comp tiver so essas 2 layers de texto.
    3. Rode o script. TL2 vira referencia (oculta) e TL1 recebe o rig.
    4. Rodar com so a TL1 (com rig) selecionada remove o rig.

    Estilos copiados de TL2: fonte, tamanho, faux bold/italic, all caps,
    small caps, tracking, escala H/V, baseline shift, fill e stroke.

    v0.4.0 changelog:
    - Vira script comum (File > Scripts), sem painel. Rodar = Animate com
      padroes; rodar com 1 layer com rig selecionada = Remove.
    v0.3.0 changelog:
    - Detecta TL1/TL2 sozinho: layer com rig ou a de baixo e TL1; sem selecao
      usa as 2 layers de texto da comp.
    v0.2.1 changelog:
    - Nao renomeia mais as layers; o rig depende so do Layer Control.
    v0.2.0 changelog:
    - Primeira implementacao: rig de swap com Based On (Character/Word/Line),
      Order (Left->Right, Right->Left, Center Out, Edges In, Random) e Remove.
    v0.1.0 changelog:
    - Estrutura inicial do script.
*/

(function TextSwap() {
    var SCRIPT_NAME = "Text Swap";
    var SCRIPT_VERSION = "0.4.0";

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

    // Escolhe TL1/TL2 sem depender de ordem de selecao nem de nome:
    // a layer que ja tem o rig e TL1; senao TL1 e a de baixo e TL2 a de cima
    // (mesma arrumacao que o Animate deixa, entao rodar de novo nao inverte).
    function pickLayers(comp) {
        var c = [], i;
        for (i = 0; i < comp.selectedLayers.length; i++) if (isTextLayer(comp.selectedLayers[i])) c.push(comp.selectedLayers[i]);
        if (c.length === 0) for (i = 1; i <= comp.numLayers; i++) if (isTextLayer(comp.layer(i))) c.push(comp.layer(i));
        if (c.length !== 2) return null;
        var fx0 = c[0].property("ADBE Effect Parade").property(FX_TARGET);
        var fx1 = c[1].property("ADBE Effect Parade").property(FX_TARGET);
        if (fx0 && !fx1) return [c[0], c[1]];
        if (fx1 && !fx0) return [c[1], c[0]];
        return c[0].index > c[1].index ? [c[0], c[1]] : [c[1], c[0]];
    }

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
        var pair = pickLayers(comp);
        if (!pair) {
            alert("Selecione 2 layers de texto (ou deixe a comp com so 2 layers de texto).");
            return;
        }
        var tl1 = pair[0], tl2 = pair[1];
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
            tl2.moveBefore(tl1);
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

    // Sem painel: rodar o script ja monta o rig com os padroes
    // (Character, Left > Right, 1s). Based On/Order mudam depois nos efeitos.
    // Uma unica layer com rig selecionada = remove o rig.
    var comp = app.project.activeItem;
    var sel = (comp instanceof CompItem) ? comp.selectedLayers : [];
    if (sel.length === 1 && isTextLayer(sel[0]) && sel[0].property("ADBE Effect Parade").property(FX_TARGET)) remove();
    else animate({ based: 1, order: 1, duration: 1 });
})();

