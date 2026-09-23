/*
    Text Swap
    Version: 1.1.0
    Author: Eduardo Noe

    Encadeia N layers de texto (textos e fontes diferentes) numa unica layer
    "Text Swap", trocando texto + estilo unidade a unidade (caractere, palavra
    ou linha). A ordem das layers na timeline e a ordem da troca: a de cima e
    o primeiro estado, a de baixo o ultimo.

    Sem pulos: a largura de cada letra e medida pelo script e, na transicao,
    cada letra vai da largura antiga pra nova de forma continua (via escala
    horizontal), junto com tamanho, tracking,
    baseline e escala vertical. Cor, contorno e fonte trocam em corte seco.
    Letras que sobram encolhem ate sumir; letras novas crescem do zero.
    Smoothness 0 = troca totalmente seca, sem transicao de largura.

    Requer After Effects 25.0+ (characterRange no script e estilo por
    caractere via expressao, engine JavaScript).

    Uso:
    1. Crie as layers de texto na ordem desejada (de cima pra baixo).
    2. Selecione todas (ou nenhuma, pra usar todas as layers de texto da comp).
    3. Rode o script. Surge a layer "Text Swap" no topo; as originais ficam
       ocultas como referencia. O slider "Swap - Animation" vai de 0 ate N-1
       (0>1 = primeira troca, 1>2 = segunda...), com keyframes ja criados.
    4. Editou algum texto/fonte das originais? Selecione so a "Text Swap" e
       rode de novo: ela remede tudo mantendo efeitos e keyframes.

    Controles (efeitos na layer Text Swap):
    - Swap - Animation: -1 = vazio, 0 = primeiro texto, N-1 = ultimo.
      De -1 a 0 as letras surgem (mesma ordem/modo da troca); apague o
      keyframe -1 se nao quiser o surgimento.
    - Swap - Based On: Character / Word / Line.
    - Swap - Order: Left > Right, Right > Left, Center Out, Edges In, Random.
    - Swap - Smoothness: quanto as unidades se sobrepoem na troca (0-100).
    - Swap - Seed: semente do Random.

    Estilo lido por caractere: cores, fontes e tamanhos mistos dentro de uma
    mesma layer sao preservados. Alinhamento/posicao vem da layer Text Swap.

    v1.1.0 changelog:
    - Cor/contorno em corte seco (sem mistura de cores).
    - Surgimento: Swap - Animation comeca em -1 (texto vazio).
    v1.0.2 changelog:
    - Calibra unidade da escala H/V (script x expressao); texto sumia com 1%.
    v1.0.1 changelog:
    - Corrige "Object is invalid": refs dos efeitos pegas depois de criar todos.
    v1.0.0 changelog:
    - Reescrito: cadeia de N layers pela ordem da timeline, troca texto e
      estilo, larguras/tracking/cores interpolados pra evitar pulos.
    v0.4.0 changelog:
    - Vira script comum (File > Scripts), sem painel.
    v0.3.0 changelog:
    - Detecta TL1/TL2 sozinho.
    v0.2.1 changelog:
    - Nao renomeia mais as layers.
    v0.2.0 changelog:
    - Primeira implementacao: rig de swap entre 2 layers (so estilo).
    v0.1.0 changelog:
    - Estrutura inicial do script.
*/

(function TextSwap() {
    var SCRIPT_NAME = "Text Swap";
    var RIG_NAME = "Text Swap";
    var TAG = "TextSwap:"; // no comment da layer rig, seguido dos IDs das origens

    var FX_ANIM = "Swap - Animation";
    var FX_BASED = "Swap - Based On";
    var FX_ORDER = "Swap - Order";
    var FX_SMOOTH = "Swap - Smoothness";
    var FX_SEED = "Swap - Seed";
    var DUR = 1; // segundos por troca

    function isText(l) { return l && l instanceof TextLayer; }
    function isRig(l) { return isText(l) && l.comment.indexOf(TAG) === 0; }
    function srcText(l) { return l.property("ADBE Text Properties").property("ADBE Text Document"); }

    function get(doc, key, def) { try { var v = doc[key]; return (v === undefined) ? def : v; } catch (e) { return def; } }

    // Propriedades de estilo copiadas por caractere: [chave curta, nome no CharacterRange, padrao]
    var PROPS = [
        ["f", "font", "ArialMT"], ["fs", "fontSize", 72], ["tr", "tracking", 0],
        ["bs", "baselineShift", 0], ["hs", "horizontalScale", 1], ["vs", "verticalScale", 1],
        ["fb", "fauxBold", false], ["fi", "fauxItalic", false], ["ac", "allCaps", false],
        ["smc", "smallCaps", false], ["af", "applyFill", true], ["as", "applyStroke", false],
        ["fc", "fillColor", [1, 1, 1]], ["sc", "strokeColor", [0, 0, 0]], ["sw", "strokeWidth", 0]
    ];
    var SHAPE = ["font", "fontSize", "horizontalScale", "fauxBold", "fauxItalic", "allCaps", "smallCaps"];

    // Le o estilo de CADA caractere (cores/fontes mistas preservadas) e mede
    // a largura de cada um com o proprio estilo, em px.
    function bake(layer, comp) {
        var doc = srcText(layer).value, t = doc.text, d = { t: t, c: [], w: [] }, i, j;
        for (i = 0; i < t.length; i++) {
            var r = doc.characterRange(i, i + 1), o = {};
            for (j = 0; j < PROPS.length; j++) o[PROPS[j][0]] = get(r, PROPS[j][1], get(doc, PROPS[j][1], PROPS[j][2]));
            d.c.push(o);
        }

        // mede numa copia temporaria: largura("|c|") - largura("||"), com o estilo do caractere
        var tmp = layer.duplicate();
        tmp.enabled = true;
        var p = srcText(tmp);
        if (p.expression !== "") p.expression = "";
        if (p.numKeys > 0) for (i = p.numKeys; i >= 1; i--) p.removeKey(i);
        function width(s, st) {
            var md = p.value;
            md.text = s;
            var rr = md.characterRange(0, s.length);
            for (var k = 0; k < SHAPE.length; k++) try { rr[SHAPE[k]] = st[SHAPE[k]]; } catch (e) {}
            try { rr.tracking = 0; } catch (e) {} // tracking e interpolado a parte
            p.setValue(md);
            return tmp.sourceRectAtTime(comp.time, false).width;
        }
        var cache = {};
        for (i = 0; i < t.length; i++) {
            var ch = t.charAt(i), code = t.charCodeAt(i);
            if (ch === "\r" || ch === "\n" || code === 3) { d.w.push(0); continue; }
            var st = {}, key = "";
            for (j = 0; j < SHAPE.length; j++) { st[SHAPE[j]] = doc.characterRange(i, i + 1)[SHAPE[j]]; key += st[SHAPE[j]] + "|"; }
            if (cache[key] === undefined) cache[key] = { base: width("||", st) };
            if (cache[key][code] === undefined) cache[key][code] = Math.max(0, width("|" + ch + "|", st) - cache[key].base);
            d.w.push(cache[key][code]);
        }
        tmp.remove();
        return d;
    }

    function buildExpression(data) {
        var e = [];
        e.push("// TEXT SWAP RIG - dados gerados pelo script; rode de novo pra atualizar");
        e.push("var D = " + data.toSource() + ";");
        e.push('var v = effect("' + FX_ANIM + '")(1).value;');
        e.push('var mode = effect("' + FX_BASED + '")(1).value;');
        e.push('var order = effect("' + FX_ORDER + '")(1).value;');
        e.push('var sm = effect("' + FX_SMOOTH + '")(1).value / 100;');
        e.push('var seed = effect("' + FX_SEED + '")(1).value;');
        e.push([
            'function L(a, b, q) { return a + (b - a) * q; }',
            'function LA(a, b, q) { return [L(a[0], b[0], q), L(a[1], b[1], q), L(a[2], b[2], q)]; }',
            'function units(t) {',
            '  var u = [], m, re;',
            '  if (mode == 1) { for (var i = 0; i < t.length; i++) u.push({ s: i, b: i, e: i + 1 }); return u; }',
            '  re = (mode == 2) ? /(\\s*)(\\S+)/g : /([\\r\\n\\u0003]*)([^\\r\\n\\u0003]+)/g;',
            '  while ((m = re.exec(t)) != null) u.push({ s: m.index, b: m.index, e: m.index + m[0].length }); // separador morfa junto',
            '  return u;',
            '}',
            // estado vazio na frente: v de -1 a 0 = surgimento do primeiro texto
            'var z0 = D[0].c[0];',
            'D = [{ t: "", c: [], w: [] }].concat(D);',
            'var N = D.length;',
            'v = Math.max(0, Math.min(N - 1, v + 1));',
            'var st = Math.max(0, Math.min(N - 2, Math.floor(v)));',
            'var P = v - st;',
            'var A = D[st], B = D[Math.min(st + 1, N - 1)];',
            'var ua = units(A.t), ub = units(B.t), n = Math.max(ua.length, ub.length);',
            // ordem de cada unidade -> posicao 0..1
            'var rk = [];',
            'for (var i = 0; i < n; i++) {',
            '  var c = (n - 1) / 2;',
            '  if (order == 1) rk.push(i);',
            '  else if (order == 2) rk.push(n - 1 - i);',
            '  else if (order == 3) rk.push(Math.abs(i - c));',
            '  else if (order == 4) rk.push(c - Math.abs(i - c));',
            '  else { seedRandom(seed * 1000 + i, true); rk.push(random()); }',
            '}',
            'var idx = []; for (var i = 0; i < n; i++) idx.push(i);',
            'idx.sort(function (a, b) { return (rk[a] - rk[b]) || (a - b); });',
            'var pos = []; for (var j = 0; j < n; j++) pos[idx[j]] = (n > 1) ? j / (n - 1) : 0;',
            'var w = Math.max(0.001, Math.min(1, sm));',
            // monta texto e estilo por caractere
            'var out = "", C = [];',
            'function push(ch, src, o) { out += ch; o.src = src; C.push(o); }',
            'for (var k = 0; k < n; k++) {',
            '  var a = ua[k], b = ub[k];',
            '  var q = Math.max(0, Math.min(1, (P - pos[k] * (1 - w)) / w));',
            '  q = q * q * (3 - 2 * q);',
            '  var useB = b && (q >= 0.5 || !a);',
            '  var su = useB ? b : a, sd = useB ? B : A;',
            '  for (var i = su.s; i < su.b; i++) { var z = sd.c[i]; push(sd.t.charAt(i), z, { fs: z.fs, hs: z.hs, vs: z.vs, tr: z.tr, bs: z.bs, fc: z.fc, sc: z.sc, sw: z.sw }); }',
            '  var la = a ? a.e - a.b : 0, lb = b ? b.e - b.b : 0, M = Math.max(la, lb);',
            '  for (var i = 0; i < M; i++) {',
            '    var ca = (i < la) ? a.b + i : -1, cb = (i < lb) ? b.b + i : -1;',
            '    if ((cb < 0 && q >= 1) || (ca < 0 && q <= 0)) continue;',
            // estilo de cada lado; lado ausente usa o estilo do outro (so a largura vai a zero)
            '    var za = (ca >= 0) ? A.c[ca] : B.c[cb], zb = (cb >= 0) ? B.c[cb] : A.c[ca];',
            '    var showB = cb >= 0 && (q >= 0.5 || ca < 0);',
            '    var src = showB ? zb : za, sw_ = showB ? B.w[cb] : A.w[ca];',
            '    var wa = (ca >= 0) ? A.w[ca] : 0, wb = (cb >= 0) ? B.w[cb] : 0;',
            '    var fs = L(za.fs, zb.fs, q);',
            '    var nat = sw_ * fs / src.fs;',
            '    var want = L(wa, wb, q);',
            '    var hs = (nat > 0) ? src.hs * want / nat : src.hs;',
            '    hs = Math.max(src.hs * 0.01, hs);',
            '    var vs = L((ca >= 0) ? za.vs : zb.vs * 0.01, (cb >= 0) ? zb.vs : za.vs * 0.01, q);',
            '    var tr = L((ca >= 0) ? za.tr : 0, (cb >= 0) ? zb.tr : 0, q);',
            '    push(showB ? B.t.charAt(cb) : A.t.charAt(ca), src, { fs: fs, hs: hs, vs: vs, tr: tr, bs: L(za.bs, zb.bs, q),',
            '      fc: src.fc, sc: src.sc, sw: src.sw });', // cor e contorno trocam seco, junto com a fonte
            '  }',
            '}',
            // script e expressao podem usar unidades diferentes na escala (1 vs 100%): calibra pela propria layer
            'var s0 = text.sourceText.style;',
            'var KH = (z0 && z0.hs) ? s0.horizontalScaling / z0.hs : 1, KV = (z0 && z0.vs) ? s0.verticalScaling / z0.vs : 1;',
            'var s = s0.setText(out);',
            'for (var i = 0; i < C.length; i++) {',
            '  var o = C[i], r = o.src;',
            '  s = s.setFont(r.f, i, 1).setFontSize(o.fs, i, 1)',
            '       .setFauxBold(r.fb, i, 1).setFauxItalic(r.fi, i, 1)',
            '       .setAllCaps(r.ac, i, 1).setSmallCaps(r.smc, i, 1)',
            '       .setTracking(o.tr, i, 1).setBaselineShift(o.bs, i, 1)',
            '       .setHorizontalScaling(o.hs * KH, i, 1).setVerticalScaling(o.vs * KV, i, 1)',
            '       .setApplyFill(r.af, i, 1).setFillColor(o.fc, i, 1)',
            '       .setApplyStroke(r.as, i, 1).setStrokeColor(o.sc, i, 1)',
            '       .setStrokeWidth(o.sw, i, 1);',
            '}',
            's;'
        ].join("\n"));
        return e.join("\n");
    }

    function addFx(layer, match, name) {
        var fx = layer.property("ADBE Effect Parade");
        var e = fx.property(name);
        if (e) return e;
        fx.addProperty(match).name = name;
        return fx.property(name);
    }

    function addDropdown(layer, name, items, val) {
        if (layer.property("ADBE Effect Parade").property(name)) return;
        var e = addFx(layer, "ADBE Dropdown Control", name);
        var menu = e.property(1).setPropertyParameters(items);
        menu.propertyGroup(1).name = name; // setPropertyParameters invalida a referencia
        layer.property("ADBE Effect Parade").property(name).property(1).setValue(val);
    }

    // Origens: selecao (sem rigs), senao todas as layers de texto da comp; ordem da timeline.
    function pickSources(comp) {
        var list = [], i, sel = comp.selectedLayers;
        for (i = 0; i < sel.length; i++) if (isText(sel[i]) && !isRig(sel[i])) list.push(sel[i]);
        if (list.length === 0 && sel.length === 0)
            for (i = 1; i <= comp.numLayers; i++) if (isText(comp.layer(i)) && !isRig(comp.layer(i))) list.push(comp.layer(i));
        list.sort(function (a, b) { return a.index - b.index; });
        return list;
    }

    function sourcesFromRig(rig) {
        var ids = rig.comment.substring(TAG.length).split(","), list = [];
        for (var i = 0; i < ids.length; i++) {
            var l = null;
            try { l = app.project.layerByID(parseInt(ids[i], 10)); } catch (e) {}
            if (isText(l)) list.push(l);
        }
        list.sort(function (a, b) { return a.index - b.index; });
        return list;
    }

    function run() {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) { alert("Abra uma composicao."); return; }
        var sel = comp.selectedLayers;
        var rig = (sel.length === 1 && isRig(sel[0])) ? sel[0] : null;
        var srcs = rig ? sourcesFromRig(rig) : pickSources(comp);
        if (srcs.length < 2) {
            alert(rig ? "A layer Text Swap perdeu as layers de origem (menos de 2 encontradas)."
                      : "Selecione 2 ou mais layers de texto (ou nenhuma, pra usar todas as da comp).");
            return;
        }

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            var data = [], ids = [], i;
            for (i = 0; i < srcs.length; i++) { data.push(bake(srcs[i], comp)); ids.push(srcs[i].id); }

            var fresh = !rig;
            if (fresh) {
                rig = srcs[0].duplicate();
                rig.name = RIG_NAME;
                rig.moveToBeginning();
                var fx = rig.property("ADBE Effect Parade");
                for (i = fx.numProperties; i >= 1; i--) fx.property(i).remove();
                var p0 = srcText(rig);
                if (p0.numKeys > 0) for (i = p0.numKeys; i >= 1; i--) p0.removeKey(i);
            }
            rig.comment = TAG + ids.join(",");

            // cria tudo antes de guardar referencias: adicionar efeito invalida as anteriores
            addFx(rig, "ADBE Slider Control", FX_ANIM);
            addDropdown(rig, FX_BASED, ["Character", "Word", "Line"], 1);
            addDropdown(rig, FX_ORDER, ["Left > Right", "Right > Left", "Center Out", "Edges In", "Random"], 1);
            addFx(rig, "ADBE Slider Control", FX_SMOOTH);
            addFx(rig, "ADBE Slider Control", FX_SEED);
            var fxp = rig.property("ADBE Effect Parade");
            var anim = fxp.property(FX_ANIM).property(1);
            var smooth = fxp.property(FX_SMOOTH).property(1);
            var seed = fxp.property(FX_SEED).property(1);

            if (fresh) {
                smooth.setValue(30);
                seed.setValue(1);
                for (i = -1; i < srcs.length; i++) anim.setValueAtTime(comp.time + (i + 1) * DUR, i);
                var ease = [new KeyframeEase(0, 33.33)];
                for (i = 1; i <= anim.numKeys; i++) anim.setTemporalEaseAtKey(i, ease, ease);
            }

            srcText(rig).expression = buildExpression(data);
            for (i = 0; i < srcs.length; i++) srcs[i].enabled = false;
            rig.enabled = true;
        } catch (err) {
            alert(SCRIPT_NAME + " erro: " + err.toString() + (err.line ? " (linha " + err.line + ")" : ""));
        }
        app.endUndoGroup();
    }

    run();
})();
