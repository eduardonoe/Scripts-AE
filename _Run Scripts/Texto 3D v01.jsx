/**
 * Texto 3D v01
 *
 * Rig de entrada letra-a-letra para camada de texto 3D com extrusao.
 * Cada letra entra com mola amortecida (spring) em Position e Rotation,
 * com a opacidade em corte duro, tudo controlado por sliders na propria camada.
 *
 * Como usar: selecione uma ou mais camadas de TEXTO e rode o script.
 * A comp precisa estar no renderer "Advanced 3D" para a extrusao aparecer.
 *
 * Controles criados na camada (Effect Controls):
 *   Atraso Por Letra (frames) - stagger entre as letras (compartilhado)
 *   Inicio (frames)           - atraso antes da primeira letra (compartilhado)
 *   Freq POSITION (Hz)        - velocidade da oscilacao do Position
 *   Amort POSITION            - quanto maior, menos overshoot no Position
 *   Freq ROTATION (Hz)        - velocidade da oscilacao do Rotation
 *   Amort ROTATION            - quanto maior, menos overshoot no Rotation
 *   Anchor Z (profundidade)   - desloca o pivo no eixo Z (metade da extrusao)
 */

(function textoTresDeV01() {

    var RIG = "Texto 3D v01";

    // ------------------------------------------------------------------
    // Configuracao
    // ------------------------------------------------------------------
    var SLIDERS = [
        ["Atraso Por Letra (frames)", 1.25],
        ["Inicio (frames)",           0],
        ["Freq POSITION (Hz)",        1.5],
        ["Amort POSITION",            4],
        ["Freq ROTATION (Hz)",        1],
        ["Amort ROTATION",            6],
        ["Anchor Z (profundidade)",   100]
    ];

    var GEO = {
        bevelStyle:     1,
        bevelDirection: 1,
        bevelDepth:     2,
        holeBevelDepth: 100,
        extrusionDepth: 200
    };

    var GROUPING_ALIGNMENT = [0, -50];   // anchor no centro vertical de cada letra

    var VAL = {
        skew:      6,
        sideColor: [0, 0.14901961386204, 0.75686281919479, 1],
        rotationX: -360,
        position:  [0, -320, 0],
        opacity:   0
    };

    // nomes dos animadores criados (usados tambem para limpar re-execucoes)
    var NOMES = ["ANCHOR Z", "SKEW", "CORES", "ROTATION X", "POSITION", "OPACIDADE"];

    // ------------------------------------------------------------------
    // Expressoes
    // ------------------------------------------------------------------
    function molaExpr(nomeFreq, nomeAmort) {
        return [
            "// stagger compartilhado + mola propria deste animador",
            "var delayF = effect(\"Atraso Por Letra (frames)\")(\"Slider\");",
            "var startF = effect(\"Inicio (frames)\")(\"Slider\");",
            "var freq   = effect(\"" + nomeFreq + "\")(\"Slider\");",
            "var damp   = effect(\"" + nomeAmort + "\")(\"Slider\");",
            "var fd = thisComp.frameDuration;",
            "var idx = (typeof textIndex !== \"undefined\") ? (textIndex - 1) : 0;",
            "var t0 = (startF * fd) + idx * (delayF * fd);",
            "var u = time - t0;",
            "var amt;",
            "if (u <= 0) {",
            "  amt = 100;",
            "} else {",
            "  amt = 100 * Math.exp(-damp * u) * Math.cos(2 * Math.PI * freq * u);",
            "}",
            "amt;"
        ].join("\n");
    }

    function corteDuroExpr() {
        return [
            "// corte duro, sem fade - sincronizado com o stagger da mola",
            "var delayF = effect(\"Atraso Por Letra (frames)\")(\"Slider\");",
            "var startF = effect(\"Inicio (frames)\")(\"Slider\");",
            "var fd = thisComp.frameDuration;",
            "var idx = (typeof textIndex !== \"undefined\") ? (textIndex - 1) : 0;",
            "var t0 = (startF * fd) + idx * (delayF * fd);",
            "var amt;",
            "if (time < t0) { amt = 100; } else { amt = 0; }",
            "amt;"
        ].join("\n");
    }

    var ANCHOR_Z_EXPR = "[0, 0, effect(\"Anchor Z (profundidade)\")(\"Slider\")];";

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    function ehTexto(layer) {
        try { return layer.property("Source Text") !== null; } catch (e) { return false; }
    }

    function limparAntigos(layer) {
        var anim = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        for (var i = anim.numProperties; i >= 1; i--) {
            var nome = anim.property(i).name;
            for (var n = 0; n < NOMES.length; n++) {
                if (nome === NOMES[n]) { anim.property(i).remove(); break; }
            }
        }
        var fx = layer.property("ADBE Effect Parade");
        for (var f = fx.numProperties; f >= 1; f--) {
            var nf = fx.property(f).name;
            for (var s = 0; s < SLIDERS.length; s++) {
                if (nf === SLIDERS[s][0]) { fx.property(f).remove(); break; }
            }
        }
    }

    function criarSliders(layer) {
        var fx = layer.property("ADBE Effect Parade");
        for (var i = 0; i < SLIDERS.length; i++) {
            var sl = fx.addProperty("ADBE Slider Control");
            sl.name = SLIDERS[i][0];
            sl.property(1).setValue(SLIDERS[i][1]);
        }
    }

    function novoAnimador(layer, nome) {
        var anim = layer.property("ADBE Text Properties").property("ADBE Text Animators");
        var an = anim.addProperty("ADBE Text Animator");
        an.name = nome;
        return an;
    }

    function selectorRange(an) {
        var sel = an.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
        sel.property("ADBE Text Percent Start").setValue(0);
        sel.property("ADBE Text Percent End").setValue(100);
        sel.property("ADBE Text Percent Offset").setValue(0);
        return sel;
    }

    function selectorExpr(an, expr) {
        var sel = an.property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
        sel.property("ADBE Text Expressible Amount").expression = expr;
        return sel;
    }

    function novaProp(an, matchName) {
        return an.property("ADBE Text Animator Properties").addProperty(matchName);
    }

    // Algumas propriedades ficam ocultas conforme o contexto (ex.: Bevel Depth some
    // quando Bevel Style = None) e o AE recusa o setValue. Nesses casos so ignoramos.
    function setSeguro(grupo, matchName, valor) {
        try {
            grupo.property(matchName).setValue(valor);
            return true;
        } catch (e) {
            return false;
        }
    }

    // ------------------------------------------------------------------
    // Aplicacao
    // ------------------------------------------------------------------
    function aplicar(layer) {
        layer.threeDLayer = true;
        layer.threeDPerChar = true;

        var geo = layer.property("ADBE Extrsn Options Group");
        setSeguro(geo, "ADBE Bevel Styles", GEO.bevelStyle);
        setSeguro(geo, "ADBE Bevel Direction", GEO.bevelDirection);
        setSeguro(geo, "ADBE Bevel Depth", GEO.bevelDepth);
        setSeguro(geo, "ADBE Hole Bevel Depth", GEO.holeBevelDepth);
        if (!setSeguro(geo, "ADBE Extrsn Depth", GEO.extrusionDepth)) {
            throw new Error("nao foi possivel definir a extrusao (a comp esta no renderer Advanced 3D?)");
        }

        var mo = layer.property("ADBE Text Properties").property("ADBE Text More Options");
        setSeguro(mo, "ADBE Text Anchor Point Option", 1);                 // Character
        setSeguro(mo, "ADBE Text Anchor Point Align", GROUPING_ALIGNMENT);

        limparAntigos(layer);
        criarSliders(layer);

        // 1) pivo em profundidade (constante, fora do stagger)
        var anAnchor = novoAnimador(layer, "ANCHOR Z");
        selectorRange(anAnchor);
        novaProp(anAnchor, "ADBE Text Anchor Point 3D").expression = ANCHOR_Z_EXPR;

        // 2) skew constante
        var anSkew = novoAnimador(layer, "SKEW");
        selectorRange(anSkew);
        novaProp(anSkew, "ADBE Text Skew").setValue(VAL.skew);

        // 3) cor da lateral da extrusao, constante
        var anCor = novoAnimador(layer, "CORES");
        selectorRange(anCor);
        novaProp(anCor, "ADBE 3DText Side RGB").setValue(VAL.sideColor);

        // 4) rotacao com mola
        var anRot = novoAnimador(layer, "ROTATION X");
        selectorExpr(anRot, molaExpr("Freq ROTATION (Hz)", "Amort ROTATION"));
        novaProp(anRot, "ADBE Text Rotation X").setValue(VAL.rotationX);

        // 5) posicao com mola
        var anPos = novoAnimador(layer, "POSITION");
        selectorExpr(anPos, molaExpr("Freq POSITION (Hz)", "Amort POSITION"));
        novaProp(anPos, "ADBE Text Position 3D").setValue(VAL.position);

        // 6) opacidade em corte duro, no mesmo tempo do stagger
        var anOp = novoAnimador(layer, "OPACIDADE");
        selectorExpr(anOp, corteDuroExpr());
        novaProp(anOp, "ADBE Text Opacity").setValue(VAL.opacity);
    }

    // ------------------------------------------------------------------
    // Main
    // ------------------------------------------------------------------
    var comp = app.project ? app.project.activeItem : null;
    if (!(comp && comp instanceof CompItem)) {
        alert("Abra uma composicao antes de rodar o " + RIG + ".");
        return;
    }

    var sel = comp.selectedLayers;
    var alvos = [];
    for (var i = 0; i < sel.length; i++) {
        if (ehTexto(sel[i])) { alvos.push(sel[i]); }
    }

    if (alvos.length === 0) {
        alert("Selecione ao menos uma camada de TEXTO.\n\n" + RIG);
        return;
    }

    app.beginUndoGroup(RIG);
    var erros = [];
    for (var a = 0; a < alvos.length; a++) {
        try {
            aplicar(alvos[a]);
        } catch (e) {
            erros.push(alvos[a].name + ": " + e.toString());
        }
    }
    app.endUndoGroup();

    var msg = RIG + "\n\nAplicado em " + (alvos.length - erros.length) + " camada(s).";
    if (comp.renderer !== "ADBE Calder") {
        msg += "\n\nATENCAO: o renderer desta comp nao e o Advanced 3D." +
               "\nSem ele a extrusao nao aparece." +
               "\nComposition > Composition Settings > 3D Renderer.";
    }
    if (erros.length > 0) { msg += "\n\nErros:\n" + erros.join("\n"); }
    alert(msg);

})();
