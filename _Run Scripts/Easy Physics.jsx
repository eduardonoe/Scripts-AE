/*
    EASY PHYSICS
    After Effects JSX
    Version: 1.0.0

    Fisica 2D em camada de TEXTO ou SHAPE LAYER, nao destrutiva e sem keyframes.
    Selecione uma ou mais camadas e rode o script.
    Shape layer: cada grupo de nivel 1 em Contents vira uma peca (expressao no
    Transform do grupo; apague as expressoes para voltar ao original).

    O que ele cria:
      - Efeitos de controle na propria camada, todos ao vivo:
          Glyph Merge (Letters / Words / Lines), Direction (Left / Right / Center),
          Delay, Gravity, Bounce, Rotation, Linear Damping, Friction,
          Floor (liga/desliga), Floor Point, Collision Layer,
          Wind Strength, Wind Direction (0 = pra cima, 90 = pra direita),
          Wind Turbulence, Wind Delay, Wind Rotation, Wind Fade (s, 0 = nunca some).
        Gravity, Bounce, Linear Damping, Friction e os Wind Strength/Direction/
        Turbulence podem ter keyframes (a simulacao usa o valor de cada instante).
      - Animators "Easy Physics X/Y/Rot" com Expression Selector.
      - Uma camada guia oculta "<nome> [EP]" que roda a simulacao
        (uma vez por frame) e entrega o resultado pros seletores.
      Apagar os Animators + efeitos + camada [EP] = texto original de volta.

    Collision Layer: aponte para uma shape layer. Paths (Pen, abertos ou
    fechados), Rectangle e Ellipse viram colisores. Pode ter varios.

    Texto editavel: troque o texto a vontade, a simulacao acompanha na hora
    (larguras estimadas pela fonte). Rodar o script de novo = medida exata.
    Os valores dos controles ficam.

    Limites conhecidos:
      - Point text (texto de caixa/paragrafo nao e suportado).
      - Corpos colidem entre si como cadeias de circulos; com o chao, como caixa.
      - Colisores: rotacao de grupos dentro da shape e ignorada; sem keyframes.
      - Cada frame re-simula desde o inicio: textos longos em comps longas pesam.
*/

(function () {
    var TAG = "Easy Physics";

    // ---------- medicao (sempre por letra; o agrupamento e feito ao vivo na expressao) ----------
    function measure(layer, comp) {
        var doc = layer.property("ADBE Text Properties").property("ADBE Text Document").value;
        if (!doc.pointText) throw new Error("\"" + layer.name + "\": use Point Text (texto de caixa nao e suportado).");
        var just = doc.justification;
        var leading = doc.autoLeading ? doc.fontSize * 1.2 : doc.leading;
        var lines = doc.text.split(/\r\n|\r|\n/);

        var dup = layer.duplicate();
        dup.enabled = true;
        var dsrc = dup.property("ADBE Text Properties").property("ADBE Text Document");
        var anims = dup.property("ADBE Text Properties").property("ADBE Text Animators");
        for (var a = anims.numProperties; a >= 1; a--) anims.property(a).remove();
        if (dsrc.expressionEnabled) dsrc.expression = "";

        function rect(s, j) {
            var d = dsrc.value;
            d.text = s;
            d.justification = j;
            dsrc.setValue(d);
            return dup.sourceRectAtTime(comp.time, false);
        }

        var LEFT = ParagraphJustification.LEFT_JUSTIFY;
        var X = [], Y = [], W = [], H = [], WI = [], LI = [], word = -1, J = 0;
        for (var li = 0; li < lines.length; li++) {
            var line = lines[li];
            if (!/\S/.test(line)) continue;
            // quanto a linha real (com a justificacao original) desloca em relacao a mesma linha alinhada a esquerda
            var rl = rect(line, LEFT), ox = rect(line, just).left - rl.left;
            // alinhamento deduzido da propria medida (o enum de texto multi-linha nao e confiavel)
            if (!J) { var fr = rl.width ? -ox / rl.width : 0; J = fr < 0.25 ? 1 : fr < 0.75 ? 2 : 3; }
            var inWord = false;
            for (var c = 0; c < line.length; c++) {
                var ch = line.charAt(c);
                if (/\s/.test(ch)) { inWord = false; continue; }
                if (!inWord) { word++; inWord = true; }
                var pre = rect(line.substring(0, c + 1), LEFT);
                var one = rect(ch, LEFT);
                X.push(r2(pre.left + pre.width - one.width / 2 + ox));
                Y.push(r2(one.top + one.height / 2 + li * leading));
                W.push(r2(Math.max(one.width, 1)));
                H.push(r2(Math.max(one.height, 1)));
                WI.push(word);
                LI.push(li);
            }
        }
        dup.remove();
        if (!X.length) throw new Error("\"" + layer.name + "\": texto vazio.");
        return { X: X, Y: Y, W: W, H: H, WI: WI, LI: LI, lines: lines, J: J || 1, fs: doc.fontSize, lead: leading };
    }

    function r2(v) { return Math.round(v * 100) / 100; }

    // ---------- controles ----------
    function fx(layer, match, name, val) {
        var fxs = layer.property("ADBE Effect Parade");
        var e = fxs.property(name);
        if (e) return e;
        e = fxs.addProperty(match);
        e.name = name;
        if (val !== undefined) e.property(1).setValue(val);
        return e;
    }

    function dropdown(layer, name, items, val) {
        var fxs = layer.property("ADBE Effect Parade");
        if (fxs.property(name)) return;
        var e = fxs.addProperty("ADBE Dropdown Control");
        e.property(1).setPropertyParameters(items);
        // setPropertyParameters recria o efeito e perde o nome
        e = fxs.property(fxs.numProperties);
        e.name = name;
        e.property(1).setValue(val);
    }

    function addControls(layer, comp) {
        dropdown(layer, "Glyph Merge", ["Letters", "Words", "Lines"], 1);
        dropdown(layer, "Direction", ["Left", "Right", "Center"], 1);
        fx(layer, "ADBE Slider Control", "Delay", 0.05);
        fx(layer, "ADBE Slider Control", "Gravity", 100);
        fx(layer, "ADBE Slider Control", "Bounce", 30);
        fx(layer, "ADBE Slider Control", "Rotation", 90);
        fx(layer, "ADBE Slider Control", "Linear Damping", 0);
        fx(layer, "ADBE Slider Control", "Friction", 50);
        fx(layer, "ADBE Checkbox Control", "Floor", 1);
        fx(layer, "ADBE Point Control", "Floor Point", [comp.width / 2, comp.height * 0.9]);
        fx(layer, "ADBE Layer Control", "Collision Layer");
        fx(layer, "ADBE Slider Control", "Wind Strength", 0);
        fx(layer, "ADBE Angle Control", "Wind Direction", 90);
        fx(layer, "ADBE Slider Control", "Wind Turbulence", 30);
        fx(layer, "ADBE Slider Control", "Wind Delay", 0);
        fx(layer, "ADBE Slider Control", "Wind Rotation", 0);
        fx(layer, "ADBE Slider Control", "Wind Fade", 0);
    }

    // ---------- simulacao (roda como expressao; ES3 para o parser do ExtendScript aceitar) ----------
    // ponytail: re-simula do frame 0 a cada frame (expressao nao guarda estado); textos longos/comps longas ficam lentos
    function EP_SIM(D) {
        // Math local: o AE envolve a expressao em with(camada) e cada 'Math' global vira busca lenta
        var MT = Math;
        var M = thisLayer.parent; // parent, nao nome: camada de texto sem nome muda de nome quando o texto muda
        function P(n) { return M.effect(n)(1).value; }
        function rnd(s) { var v = MT.sin(s * 12.9898 + 78.233) * 43758.5453; return v - MT.floor(v); }
        var PI = MT.PI;
        var MODE = P("Glyph Merge"), DIR = P("Direction");
        var fd = thisComp.frameDuration, NF = MT.max(0, MT.round((time - M.inPoint) / fd));
        // controles com keyframe sao amostrados frame a frame: a simulacao usa o valor de cada instante,
        // nao o valor do frame atual para toda a historia (senao animar o vento "reescreve o passado")
        function PA(n) {
            var p = M.effect(n)(1), arr = [], nk = 0;
            try { nk = p.numKeys; } catch (e) {}
            if (!nk) return [p.value];
            for (var f = 0; f <= NF; f++) arr.push(p.valueAtTime(M.inPoint + f * fd));
            return arr;
        }
        function at(arr, f) { return arr[f < arr.length ? f : arr.length - 1]; }
        var DL = MT.max(0, P("Delay"));
        var aG = PA("Gravity"), aE = PA("Bounce"), aDAMP = PA("Linear Damping"), aMU = PA("Friction");
        var aWS = PA("Wind Strength"), aWD = PA("Wind Direction"), aWT = PA("Wind Turbulence");
        var ROT = P("Rotation") * PI / 180;
        var FLOORON = P("Floor") == 1, FLOOR = M.fromComp(P("Floor Point"))[1];
        var WDL = MT.max(0, P("Wind Delay"));
        var WR = P("Wind Rotation") * PI / 180, WF = P("Wind Fade");
        // ultimo frame com vento: dali em diante, parado = parado de vez
        var windEnd = -1;
        for (var f0 = 0; f0 < aWS.length; f0++) if (aWS[f0] != 0) windEnd = aWS.length == 1 ? 1e9 : f0;
        var G, E, DAMP, MU, WS, WX, WY, WT, i, j, k, b;

        // ----- grupos (letras / palavras / linhas) viram corpos rigidos -----
        // layout: medida exata do script se o texto nao mudou; senao estimativa (tabela Helvetica)
        // calibrada pela medida original, para editar o texto sem rodar o script de novo
        var ADV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
        function base(ch) { try { return ch.normalize("NFD").charAt(0); } catch (e) { return ch; } }
        function adv(ch) { var c = base(ch).charCodeAt(0); return c >= 32 && c <= 126 ? ADV[c - 32] : (base(ch) == base(ch).toUpperCase() ? 667 : 556); }
        function vert(ch) { // [altura, centro] em fracao do corpo, baseline = 0
            var c = base(ch);
            if (/[gpqy]/.test(c)) return [0.73, -0.18];
            if (c == "j") return [0.95, -0.27];
            if (/[bdfhiklt]/.test(c)) return [0.74, -0.37];
            if (/[a-z]/.test(c)) return [0.53, -0.265];
            if (/[.,_]/.test(c)) return [0.12, -0.06];
            if (/[-~]/.test(c)) return [0.1, -0.3];
            return [0.72, -0.36];
        }
        function estimate(txt, fs, lead, tr, caps, kx, ky) {
            var o = { X: [], Y: [], W: [], H: [], WI: [], LI: [] }, lines = txt.split(/\r\n|\r|\n/), wd = -1;
            for (var li = 0; li < lines.length; li++) {
                var ln = caps ? lines[li].toUpperCase() : lines[li], tot = 0, c;
                for (c = 0; c < ln.length; c++) tot += adv(ln.charAt(c)) * fs / 1000 * kx + tr;
                tot -= tr;
                var cur = D.J == 2 ? -tot / 2 : D.J == 3 ? -tot : 0, inW = false;
                for (c = 0; c < ln.length; c++) {
                    var ch = ln.charAt(c), aw = adv(ch) * fs / 1000 * kx;
                    if (/\s/.test(ch)) { inW = false; cur += aw + tr; continue; }
                    if (!inW) { wd++; inW = true; }
                    var vv = vert(ch);
                    o.X.push(cur + aw / 2); o.Y.push(vv[1] * fs * ky + li * lead);
                    o.W.push(aw * 0.85); o.H.push(vv[0] * fs * ky); o.WI.push(wd); o.LI.push(li);
                    cur += aw + tr;
                }
            }
            return o;
        }
        var LY = D, TXT = D.shape ? "" : "" + M.text.sourceText, DTXT = D.shape ? "" : D.lines.join("\r");
        if (!D.shape && TXT.split(/\r\n|\r|\n/).join("\r") != DTXT) {
            var SS = M.text.sourceText.style, fs = SS.fontSize || D.fs, caps = false, tr = 0, lead = D.lead / D.fs * fs;
            try { caps = SS.isAllCaps; } catch (e0) {}
            try { tr = SS.tracking / 1000 * fs; } catch (e1) {}
            try { if (!SS.isAutoLeading) lead = SS.leading; } catch (e2) {}
            // calibra largura/altura da fonte real comparando a estimativa do texto original com a medida
            var e0 = estimate(DTXT, D.fs, D.lead, 0, false, 1, 1), sx = 0, ex = 0, shh = 0, ehh = 0, ii;
            for (ii = 1; ii < D.X.length; ii++) if (D.LI[ii] == D.LI[ii - 1]) { sx += D.X[ii] - D.X[ii - 1]; ex += e0.X[ii] - e0.X[ii - 1]; }
            for (ii = 0; ii < D.H.length; ii++) { shh += D.H[ii]; ehh += e0.H[ii]; }
            LY = estimate(TXT, fs, lead, tr, caps, ex > 0 ? sx / ex : 1, ehh > 0 ? shh / ehh : 1);
        }
        var X = LY.X, Y = LY.Y, n = X.length, gOf = [], map = {}, nb = 0;
        var x0 = [], x1 = [], y0 = [], y1 = [];
        for (i = 0; i < n; i++) {
            var key = MODE == 2 ? LY.WI[i] : MODE == 3 ? LY.LI[i] : i;
            if (map[key] === undefined) { map[key] = nb; x0[nb] = 1e9; x1[nb] = -1e9; y0[nb] = 1e9; y1[nb] = -1e9; nb++; }
            b = map[key]; gOf[i] = b;
            x0[b] = MT.min(x0[b], X[i] - LY.W[i] / 2); x1[b] = MT.max(x1[b], X[i] + LY.W[i] / 2);
            y0[b] = MT.min(y0[b], Y[i] - LY.H[i] / 2); y1[b] = MT.max(y1[b], Y[i] + LY.H[i] / 2);
        }
        var x = [], y = [], vx = [], vy = [], a = [], w = [], BW = [], BH = [], im = [], iI = [], BR = [];
        var CX = [], CY = [], CR = [], rel = [], wst = [], zz = [], tgt = [], ptouch = [];
        for (b = 0; b < nb; b++) {
            BW[b] = x1[b] - x0[b]; BH[b] = y1[b] - y0[b];
            x[b] = (x0[b] + x1[b]) / 2; y[b] = (y0[b] + y1[b]) / 2;
            vx[b] = 0; vy[b] = 0; a[b] = 0; w[b] = 0; zz[b] = 0; ptouch[b] = 0;
            var m = BW[b] * BH[b] / 1000;
            im[b] = 1 / m; iI[b] = 12 / (m * (BW[b] * BW[b] + BH[b] * BH[b]));
            BR[b] = MT.sqrt(BW[b] * BW[b] + BH[b] * BH[b]) / 2;
            // cadeia de circulos ao longo do lado maior
            var horiz = BW[b] >= BH[b], r = MT.min(BW[b], BH[b]) / 2, len = MT.max(BW[b], BH[b]);
            var cnt = MT.max(1, MT.round(len / (2 * r)));
            CX[b] = []; CY[b] = []; CR[b] = r;
            for (k = 0; k < cnt; k++) {
                var off = cnt == 1 ? 0 : -len / 2 + r + k * (len - 2 * r) / (cnt - 1);
                CX[b].push(horiz ? off : 0); CY[b].push(horiz ? 0 : off);
            }
        }
        // ordem de soltura
        var ordKey = [], idx = [];
        for (b = 0; b < nb; b++) { ordKey[b] = MODE == 3 ? b : x[b]; idx[b] = b; }
        var mid = 0; for (b = 0; b < nb; b++) mid += ordKey[b]; mid /= nb;
        idx.sort(function (p, q) {
            var kp = ordKey[p], kq = ordKey[q];
            if (DIR == 2) return kq - kp;
            if (DIR == 3) return MT.abs(kp - mid) - MT.abs(kq - mid);
            return kp - kq;
        });
        for (k = 0; k < nb; k++) { b = idx[k]; rel[b] = k * DL; wst[b] = k * WDL; tgt[b] = (rnd(b) * 2 - 1) * ROT; }

        // ----- contato com impulso (i = -1 -> estatico) -----
        var t = 0;
        function dyn(q) { return q >= 0 && t >= rel[q] && zz[q] < 20; }
        function hit(p, q, px, py, nx, ny, pen) { // normal de p para q
            var mp = dyn(p) ? im[p] : 0, mq = dyn(q) ? im[q] : 0;
            var Ip = dyn(p) ? iI[p] : 0, Iq = dyn(q) ? iI[q] : 0;
            if (mp + mq == 0) {
                // corpo dormindo/parado tocado por quem se move: acorda
                if (p >= 0 && t >= rel[p] && q >= 0 && t >= rel[q]) { zz[p] = 0; zz[q] = 0; }
                return;
            }
            var tot = mp + mq;
            pen = MT.max(0, pen - 0.5) * 0.8; // folga evita tremedeira em repouso
            if (p >= 0) touch[p] = 1;
            if (q >= 0) touch[q] = 1;
            if (p >= 0) { x[p] -= nx * pen * mp / tot; y[p] -= ny * pen * mp / tot; }
            if (q >= 0) { x[q] += nx * pen * mq / tot; y[q] += ny * pen * mq / tot; }
            var rpx = p >= 0 ? px - x[p] : 0, rpy = p >= 0 ? py - y[p] : 0;
            var rqx = q >= 0 ? px - x[q] : 0, rqy = q >= 0 ? py - y[q] : 0;
            var vpx = p >= 0 && mp ? vx[p] - w[p] * rpy : 0, vpy = p >= 0 && mp ? vy[p] + w[p] * rpx : 0;
            var vqx = q >= 0 && mq ? vx[q] - w[q] * rqy : 0, vqy = q >= 0 && mq ? vy[q] + w[q] * rqx : 0;
            var rvx = vqx - vpx, rvy = vqy - vpy, vn = rvx * nx + rvy * ny;
            if (vn >= 0) return;
            if (vn < -60) { if (p >= 0 && t >= rel[p]) zz[p] = 0; if (q >= 0 && t >= rel[q]) zz[q] = 0; }
            var rnp = rpx * ny - rpy * nx, rnq = rqx * ny - rqy * nx;
            var e = vn > -40 ? 0 : E;
            var jn = -(1 + e) * vn / (mp + mq + rnp * rnp * Ip + rnq * rnq * Iq);
            var tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
            var rtp = rpx * ty - rpy * tx, rtq = rqx * ty - rqy * tx;
            var jt = -vt / (mp + mq + rtp * rtp * Ip + rtq * rtq * Iq);
            jt = MT.max(-MU * jn, MT.min(MU * jn, jt));
            var ix = jn * nx + jt * tx, iy = jn * ny + jt * ty;
            if (mp) { vx[p] -= ix * mp; vy[p] -= iy * mp; w[p] -= (rpx * iy - rpy * ix) * Ip; }
            if (mq) { vx[q] += ix * mq; vy[q] += iy * mq; w[q] += (rqx * iy - rqy * ix) * Iq; }
        }

        // ----- colisores -> segmentos no espaco da camada de texto -----
        var S = [];
        function toM(L, p) { return M.fromComp(L.toComp(p)); }
        function addPoly(L, pts, closed, tf) {
            var P2 = [], q;
            for (q = 0; q < pts.length; q++) P2.push(toM(L, tf(pts[q])));
            for (q = 0; q < P2.length - 1; q++) S.push([P2[q][0], P2[q][1], P2[q + 1][0], P2[q + 1][1]]);
            if (closed && P2.length > 2) S.push([P2[P2.length - 1][0], P2[P2.length - 1][1], P2[0][0], P2[0][1]]);
        }
        function bez(p0, p1, p2, p3, s) {
            var u = 1 - s;
            return [u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0],
                    u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1]];
        }
        function pathPts(pt, it, ot, closed) {
            var out = [], mm = pt.length, e = closed ? mm : mm - 1;
            for (var q = 0; q < e; q++) {
                var r = (q + 1) % mm;
                var c1 = [pt[q][0] + ot[q][0], pt[q][1] + ot[q][1]], c2 = [pt[r][0] + it[r][0], pt[r][1] + it[r][1]];
                for (var s = 0; s < 8; s++) out.push(bez(pt[q], c1, c2, pt[r], s / 8));
            }
            if (!closed) out.push(pt[mm - 1]);
            return out;
        }
        function grpTf(ps, an, sc, tf) {
            return function (v) { return tf([(v[0] - an[0]) * sc[0] / 100 + ps[0], (v[1] - an[1]) * sc[1] / 100 + ps[1]]); };
        }
        function walk(L, g, tf) {
            var np = 0;
            try { np = g.numProperties; } catch (e0) { return; }
            for (var q = 1; q <= np; q++) {
                var p = g(q);
                try {
                    var tr = p.transform;
                    walk(L, p.content, grpTf(tr.position.value, tr.anchorPoint.value, tr.scale.value, tf));
                    continue;
                } catch (e1) {}
                try {
                    var pa = p.path, cl = pa.isClosed();
                    addPoly(L, pathPts(pa.points(), pa.inTangents(), pa.outTangents(), cl), cl, tf);
                    continue;
                } catch (e2) {}
                try {
                    var sz = p.size.value, c = p.position.value, isR = true, pts = [];
                    try { p.roundness.value; } catch (e3) { isR = false; }
                    if (isR) pts = [[c[0] - sz[0] / 2, c[1] - sz[1] / 2], [c[0] + sz[0] / 2, c[1] - sz[1] / 2], [c[0] + sz[0] / 2, c[1] + sz[1] / 2], [c[0] - sz[0] / 2, c[1] + sz[1] / 2]];
                    else for (var s = 0; s < 32; s++) pts.push([c[0] + MT.cos(s / 16 * PI) * sz[0] / 2, c[1] + MT.sin(s / 16 * PI) * sz[1] / 2]);
                    addPoly(L, pts, true, tf);
                } catch (e4) {}
            }
        }
        try {
            var CL = M.effect("Collision Layer")(1);
            if (CL && CL.index != M.index) walk(CL, CL.content, function (v) { return v; });
        } catch (e5) {}

        // ----- passos -----
        var SUB = 2, dt = fd / SUB, steps = NF * SUB;
        var lastRel = 0, lastWind = 0, awake = [], touch = [], ign = {};
        for (i = 0; i < nb; i++) for (j = i + 1; j < nb; j++) {
            for (var u0 = 0; u0 < CX[i].length; u0++) for (var v0 = 0; v0 < CX[j].length; v0++) {
                var qx0 = x[j] + CX[j][v0] - x[i] - CX[i][u0], qy0 = y[j] + CY[j][v0] - y[i] - CY[i][u0], rr0 = CR[i] + CR[j];
                if (qx0 * qx0 + qy0 * qy0 < rr0 * rr0) ign[i * nb + j] = 1;
            }
        }
        for (b = 0; b < nb; b++) { lastRel = MT.max(lastRel, rel[b]); lastWind = MT.max(lastWind, wst[b] + WF); }
        if (WF <= 0) lastWind = windEnd * fd; else lastWind = MT.min(lastWind, windEnd * fd + WF);
        for (var st = 0; st < steps; st++) {
            t = st * dt;
            var fr = MT.floor(st / SUB);
            G = at(aG, fr) * 10; E = MT.max(0, MT.min(1, at(aE, fr) / 100)); DAMP = MT.max(0, at(aDAMP, fr));
            MU = MT.max(0, at(aMU, fr)) / 100;
            WS = at(aWS, fr) * 10; WT = at(aWT, fr) / 100;
            var wdr = at(aWD, fr) * PI / 180; WX = MT.sin(wdr); WY = -MT.cos(wdr);
            // tudo parado, solto e sem vento ativo: o estado nao muda mais
            var any = false;
            for (b = 0; b < nb; b++) { awake[b] = t >= rel[b] && zz[b] < 20; touch[b] = 0; if (awake[b]) any = true; }
            if (!any && t > lastRel && t > lastWind) break;
            for (b = 0; b < nb; b++) {
                if (!awake[b]) continue;
                var ax = 0, ay = G;
                if (WS && t >= wst[b]) {
                    var wf = WF > 0 ? MT.max(0, 1 - (t - wst[b]) / WF) : 1;
                    var tu = 1 + WT * (MT.sin(t * 2.3 + b * 1.7) + MT.sin(t * 4.1 + b * 2.9)) * 0.5;
                    ax += WX * WS * wf * tu; ay += WY * WS * wf * tu;
                    w[b] += WR * wf * (rnd(b + 7) * 2 - 1) * dt * 4;
                }
                if (!ptouch[b]) w[b] += (tgt[b] - w[b]) * MT.min(1, 1.5 * dt); // giro cresce aos poucos no ar
                vx[b] += ax * dt; vy[b] += ay * dt;
                var dm = 1 / (1 + DAMP * dt);
                vx[b] *= dm; vy[b] *= dm; w[b] *= 1 / (1 + (0.3 + DAMP) * dt);
                x[b] += vx[b] * dt; y[b] += vy[b] * dt; a[b] += w[b] * dt;
            }
            // corpo x corpo
            for (i = 0; i < nb; i++) for (j = i + 1; j < nb; j++) {
                if (!awake[i] && !awake[j]) continue;
                var pk = i * nb + j, ig = ign[pk] === 1, ov = false;
                var ddx = x[j] - x[i], ddy = y[j] - y[i], RR = BR[i] + BR[j];
                if (ddx * ddx + ddy * ddy > RR * RR) { if (ig) ign[pk] = 0; continue; }
                var ci = MT.cos(a[i]), si = MT.sin(a[i]), cj = MT.cos(a[j]), sj = MT.sin(a[j]);
                for (var u = 0; u < CX[i].length; u++) {
                    var pix = x[i] + ci * CX[i][u] - si * CY[i][u], piy = y[i] + si * CX[i][u] + ci * CY[i][u];
                    for (var v = 0; v < CX[j].length; v++) {
                        var pjx = x[j] + cj * CX[j][v] - sj * CY[j][v], pjy = y[j] + sj * CX[j][v] + cj * CY[j][v];
                        var ex = pjx - pix, ey = pjy - piy, rr = CR[i] + CR[j], d2 = ex * ex + ey * ey;
                        if (d2 >= rr * rr || d2 == 0) continue;
                        ov = true;
                        if (ig) continue;
                        var dd = MT.sqrt(d2);
                        hit(i, j, pix + ex / dd * CR[i], piy + ey / dd * CR[i], ex / dd, ey / dd, rr - dd);
                    }
                }
                if (ig && !ov) ign[pk] = 0;
            }
            for (b = 0; b < nb; b++) {
                if (!awake[b]) continue;
                var cb = MT.cos(a[b]), sb = MT.sin(a[b]);
                // colisores (circulos x segmentos)
                for (k = 0; k < S.length; k++) {
                    var sg = S[k], sx = sg[2] - sg[0], sy = sg[3] - sg[1], l2 = sx * sx + sy * sy;
                    for (u = 0; u < CX[b].length; u++) {
                        var cx = x[b] + cb * CX[b][u] - sb * CY[b][u], cy = y[b] + sb * CX[b][u] + cb * CY[b][u];
                        var f = l2 ? MT.max(0, MT.min(1, ((cx - sg[0]) * sx + (cy - sg[1]) * sy) / l2)) : 0;
                        var qx = sg[0] + sx * f, qy = sg[1] + sy * f, gx = cx - qx, gy = cy - qy, gd = MT.sqrt(gx * gx + gy * gy);
                        if (gd >= CR[b] || gd == 0) continue;
                        hit(-1, b, qx, qy, gx / gd, gy / gd, CR[b] - gd);
                    }
                }
                // chao: cantos da caixa
                if (FLOORON) {
                    for (k = 0; k < 4; k++) {
                        var hx = (k & 1 ? 0.5 : -0.5) * BW[b], hy = (k & 2 ? 0.5 : -0.5) * BH[b];
                        var kx = x[b] + cb * hx - sb * hy, ky = y[b] + sb * hx + cb * hy;
                        if (ky > FLOOR) hit(-1, b, kx, FLOOR, 0, -1, ky - FLOOR);
                    }
                }
                ptouch[b] = touch[b];
                // em contato: a friccao tambem amortece o giro e o escorregar (tira a tremedeira)
                if (touch[b]) { var fk = 1 - 0.08 * MU; vx[b] *= fk; vy[b] *= fk; w[b] *= 1 - 0.25 * MU; }
                zz[b] = (touch[b] && MT.abs(vx[b]) + MT.abs(vy[b]) < 30 + 40 * MU && MT.abs(w[b]) < 0.4 + 0.8 * MU && !(WS && t >= wst[b] && (WF <= 0 || t < wst[b] + WF))) ? zz[b] + 1 : 0;
                if (zz[b] >= 20) { vx[b] = 0; vy[b] = 0; w[b] = 0; }
            }
        }

        // ----- saida por letra: dx,dy,rot -----
        var out = [];
        for (i = 0; i < n; i++) {
            b = gOf[i];
            var lx = X[i] - (x0[b] + x1[b]) / 2, ly = Y[i] - (y0[b] + y1[b]) / 2, co = MT.cos(a[b]), sn = MT.sin(a[b]);
            out.push((x[b] + co * lx - sn * ly - X[i]).toFixed(2) + "," + (y[b] + sn * lx + co * ly - Y[i]).toFixed(2) + "," + (a[b] * 180 / PI).toFixed(2));
        }
        return out.join(";");
    }

    function simExpr(d) {
        return "// " + TAG + " - simulacao (gerado pelo script; rode de novo para re-medir)\n" +
            "(" + EP_SIM.toString() + ")(" + d.toSource() + ");";
    }

    function q(s) { return "\"" + s.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\""; }

    function selExpr(helperName, idx) {
        return "var d=(''+thisComp.layer(" + q(helperName) + ").text.sourceText).split(';')[textIndex-1];\n" +
               "d?parseFloat(d.split(',')[" + idx + "])" + (idx === 2 ? "/36" : "/100") + ":0;";
    }

    // ---------- shape layer: cada grupo de nivel 1 em Contents e uma peca ----------
    function shapeGroups(layer) {
        var root = layer.property("ADBE Root Vectors Group"), g = [];
        for (var i = 1; i <= root.numProperties; i++)
            if (root.property(i).matchName == "ADBE Vector Group") g.push(root.property(i));
        return g;
    }

    function measureShape(layer, comp) {
        var g = shapeGroups(layer);
        if (!g.length) throw new Error("\"" + layer.name + "\": a shape layer precisa ter grupos em Contents.");
        var X = [], Y = [], W = [], H = [], WI = [], LI = [], PX = [], PY = [], vis = [];
        for (var i = 0; i < g.length; i++) vis.push(g[i].enabled);
        for (i = 0; i < g.length; i++) {
            for (var k = 0; k < g.length; k++) g[k].enabled = (k == i);
            var r = layer.sourceRectAtTime(comp.time, false);
            var ps = g[i].property("ADBE Vector Transform Group").property("ADBE Vector Position").value;
            X.push(r2(r.left + r.width / 2)); Y.push(r2(r.top + r.height / 2));
            W.push(r2(Math.max(r.width, 1))); H.push(r2(Math.max(r.height, 1)));
            WI.push(i); LI.push(i);
            PX.push(r2(r.left + r.width / 2 - ps[0])); PY.push(r2(r.top + r.height / 2 - ps[1]));
        }
        for (i = 0; i < g.length; i++) g[i].enabled = vis[i];
        return { X: X, Y: Y, W: W, H: H, WI: WI, LI: LI, PX: PX, PY: PY, shape: true, J: 1, fs: 1, lead: 1 };
    }

    // posicao do grupo: offset da simulacao + correcao para girar em torno do centro da peca
    function groupPosExpr(helperName, i, vx, vy) {
        return "var d=(''+thisComp.layer(" + q(helperName) + ").text.sourceText).split(';')[" + i + "];\n" +
               "if(!d){value}else{d=d.split(',');var a=parseFloat(d[2])*Math.PI/180,c=Math.cos(a),s=Math.sin(a),vx=" + vx + ",vy=" + vy + ";\n" +
               "value+[parseFloat(d[0])+vx-(c*vx-s*vy),parseFloat(d[1])+vy-(s*vx+c*vy)]}";
    }

    function groupRotExpr(helperName, i) {
        return "var d=(''+thisComp.layer(" + q(helperName) + ").text.sourceText).split(';')[" + i + "];\n" +
               "d?value+parseFloat(d.split(',')[2]):value;";
    }

    // ---------- montagem ----------
    function apply(layer, comp) {
        var isShape = layer instanceof ShapeLayer;
        var data = isShape ? measureShape(layer, comp) : measure(layer, comp);
        addControls(layer, comp);
        // camada auxiliar: achada pelo parent (o nome da camada de texto pode mudar sozinho)
        var helper = null;
        for (var h = 1; h <= comp.numLayers; h++)
            if (comp.layer(h).parent === layer && / \[EP\]$/.test(comp.layer(h).name)) helper = comp.layer(h);
        if (!helper) {
            helper = comp.layers.addText("EP");
            helper.name = layer.name + " [EP]";
            helper.parent = layer;
            helper.guideLayer = true;
            helper.enabled = false;
            helper.shy = true;
            helper.moveAfter(layer);
            helper.inPoint = layer.inPoint;
            helper.outPoint = layer.outPoint;
        }
        helper.locked = false;
        helper.property("ADBE Text Properties").property("ADBE Text Document").expression = simExpr(data);
        helper.locked = true;

        if (isShape) {
            var gs = shapeGroups(layer);
            for (var gi = 0; gi < gs.length; gi++) {
                var tg = gs[gi].property("ADBE Vector Transform Group");
                tg.property("ADBE Vector Position").expression = groupPosExpr(helper.name, gi, data.PX[gi], data.PY[gi]);
                tg.property("ADBE Vector Rotation").expression = groupRotExpr(helper.name, gi);
            }
            return;
        }

        // um animator por canal: o Amount do Expression Selector so aceita escalar
        // e ignora valores fora de +-100%, entao o valor do animator e grande e o Amount e dividido
        var anims = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        var chans = [["X", "ADBE Text Position 3D", [10000, 0, 0]], ["Y", "ADBE Text Position 3D", [0, 10000, 0]], ["Rot", "ADBE Text Rotation", 3600]];
        for (var c = 0; c < chans.length; c++) {
            var nm = TAG + " " + chans[c][0];
            if (anims.property(nm)) anims.property(nm).remove();
            var an = anims.addProperty("ADBE Text Animator");
            an.name = nm;
            an.property("ADBE Text Animator Properties").addProperty(chans[c][1]).setValue(chans[c][2]);
            var sel = an.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
            sel.property("ADBE Text Range Type2").setValue(2); // Characters Excluding Spaces
            sel.property("ADBE Text Expressible Amount").expression = selExpr(helper.name, c);
        }

        // cada letra gira em torno do proprio centro; o agrupamento e composto na simulacao
        var more = layer.property("ADBE Text Properties").property("ADBE Text More Options");
        more.property("ADBE Text Anchor Point Option").setValue(1);
        more.property("ADBE Text Anchor Point Align").setValue([0, -50]);
    }

    // ---------- main ----------
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { alert("Abra uma composicao."); return; }
    var layers = [];
    for (var i = 0; i < comp.selectedLayers.length; i++)
        if ((comp.selectedLayers[i] instanceof TextLayer || comp.selectedLayers[i] instanceof ShapeLayer) && comp.selectedLayers[i].name.indexOf(" [EP]") < 0)
            layers.push(comp.selectedLayers[i]);
    if (!layers.length) { alert("Selecione uma camada de texto ou shape layer."); return; }

    app.beginUndoGroup(TAG);
    try {
        for (var l = 0; l < layers.length; l++) apply(layers[l], comp);
    } catch (e) {
        alert(TAG + ": " + e.message);
    }
    app.endUndoGroup();
})();
