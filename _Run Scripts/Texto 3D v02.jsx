/*
    TEXTO 3D
    (rig de entrada letra-a-letra para texto 3D extrudado)
    After Effects JSX
    Version: 2.0.0

    Monta em uma camada de TEXTO um rig de entrada onde cada letra surge em
    sequencia, com mola amortecida (spring) em Position, Rotation e Scale, e
    opacidade em corte duro. Tudo dirigido por controles na propria camada,
    sem nenhum keyframe.

    Como usar: selecione uma ou mais camadas de TEXTO e rode o script.
    A comp precisa estar no renderer "Advanced 3D" para a extrusao aparecer.

    COMO FUNCIONA

    O stagger e a mola vivem no Amount de um Expression Selector, que e o
    unico lugar do animador de texto onde "textIndex" existe. Amount abaixo
    de zero faz o After Effects extrapolar o offset no sentido contrario, e
    e dai que sai o overshoot -- Range Selector sozinho nunca passa do ponto,
    so vai de 0% a 100%.

    Disparo de cada propriedade:
      t0 = Inicio Geral + Inicio da propriedade + (indice da letra x Atraso Por Letra)

    Mola, normalizada pela duracao (p = tempo desde o disparo / duracao):
      amount = 100 * e^(-amortecimento * p) * cos(PI/2 * p)
    Em p = 1 o cosseno zera: a letra pousa no valor final exatamente no frame
    definido em "Dur ...". O balanco depois disso e o amortecimento:
      0 = oscila sem parar | 0.7 = ~26% de overshoot
      1.5 = ~5%            | 3   = praticamente sem balanco

    O anchor de cada letra fica no centro dela: Grouping Alignment em 0,-50%
    resolve o eixo vertical, e o animador ANCHOR Z desloca o pivo para o meio
    da extrusao (o Grouping Alignment e 2D e nao alcanca o Z).

    CHANGELOG

    2.0.0
      - a mola passa a ser controlada por DURACAO em frames, no lugar de
        frequencia em Hz (a frequencia era a duracao disfarcada: o tempo de
        chegada era 1/(4*freq), entao os dois controles brigavam pelo mesmo
        parametro).
      - cada propriedade ganhou atraso de entrada proprio ("Inicio ...").
      - checkbox "Sincronizar Inicios": as expressoes ignoram os atrasos
        individuais sem apagar os valores, disparando tudo junto.
      - animadores SCALE e TRACKING incluidos, prontos para uso.

    1.0.0
      - versao inicial: stagger com mola em Position e Rotation por
        frequencia/amortecimento, opacidade em corte duro, anchor centralizado
        e extrusao configurada.
*/

(function textoTresDeV02() {

    var RIG = "Texto 3D v02";

    // ------------------------------------------------------------------
    // Controles (nome, valor, tipo)
    // ------------------------------------------------------------------
    var CONTROLES = [
        ["Atraso Por Letra (frames)", 1,   "slider"],
        ["Inicio Geral (frames)",     0,   "slider"],
        ["Sincronizar Inicios",       0,   "checkbox"],
        ["Inicio POSITION (frames)",  0,   "slider"],
        ["Dur POSITION (frames)",     5,   "slider"],
        ["Amort POSITION",            0.8, "slider"],
        ["Inicio ROTATION (frames)",  2,   "slider"],
        ["Dur ROTATION (frames)",     8,   "slider"],
        ["Amort ROTATION",            1.5, "slider"],
        ["Inicio SCALE (frames)",     5,   "slider"],
        ["Dur SCALE (frames)",        8,   "slider"],
        ["Amort SCALE",               2,   "slider"],
        ["Anchor Z (profundidade)",   100, "slider"]
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
        position:  [0, -500, 0],
        scale:     [100, 100, 100],      // neutro: defina abaixo de 100 para as letras crescerem
        opacity:   0,
        tracking:  0                     // neutro: slot pronto para uso
    };

    var NOMES = ["ANCHOR Z", "SKEW", "CORES", "ROTATION X", "POSITION", "SCALE", "OPACIDADE", "TRACKING"];

    // ------------------------------------------------------------------
    // Expressoes
    // ------------------------------------------------------------------
    function molaExpr(nomeInicio, nomeDur, nomeAmort) {
        return [
            "// duracao + mola amortecida, por letra",
            "// disparo = Inicio Geral + Inicio desta propriedade + (indice da letra x Atraso Por Letra)",
            "// com 'Sincronizar Inicios' marcado, o inicio individual e ignorado (valor preservado)",
            "var atrasoLetra = effect(\"Atraso Por Letra (frames)\")(\"Slider\");",
            "var inicioGeral = effect(\"Inicio Geral (frames)\")(\"Slider\");",
            "var sincronizar = effect(\"Sincronizar Inicios\")(\"Checkbox\");",
            "var inicioProp  = (sincronizar == 1) ? 0 : effect(\"" + nomeInicio + "\")(\"Slider\");",
            "var durF = effect(\"" + nomeDur + "\")(\"Slider\");",
            "var damp = effect(\"" + nomeAmort + "\")(\"Slider\");",
            "var fd = thisComp.frameDuration;",
            "var idx = (typeof textIndex !== \"undefined\") ? (textIndex - 1) : 0;",
            "var t0 = (inicioGeral + inicioProp) * fd + idx * (atrasoLetra * fd);",
            "var u = time - t0;",
            "var amt;",
            "if (u <= 0) {",
            "  amt = 100;",
            "} else {",
            "  var p = u / Math.max(0.0001, durF * fd);",
            "  amt = 100 * Math.exp(-damp * p) * Math.cos(Math.PI / 2 * p);",
            "}",
            "amt;"
        ].join("\n");
    }

    function corteDuroExpr() {
        return [
            "// corte duro, sem fade - segue apenas o inicio geral e o stagger",
            "var atrasoLetra = effect(\"Atraso Por Letra (frames)\")(\"Slider\");",
            "var inicioGeral = effect(\"Inicio Geral (frames)\")(\"Slider\");",
            "var fd = thisComp.frameDuration;",
            "var idx = (typeof textIndex !== \"undefined\") ? (textIndex - 1) : 0;",
            "var t0 = inicioGeral * fd + idx * (atrasoLetra * fd);",
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
            for (var s = 0; s < CONTROLES.length; s++) {
                if (nf === CONTROLES[s][0]) { fx.property(f).remove(); break; }
            }
        }
    }

    function criarControles(layer) {
        var fx = layer.property("ADBE Effect Parade");
        for (var i = 0; i < CONTROLES.length; i++) {
            var tipo = (CONTROLES[i][2] === "checkbox") ? "ADBE Checkbox Control" : "ADBE Slider Control";
            var ctl = fx.addProperty(tipo);
            ctl.name = CONTROLES[i][0];
            ctl.property(1).setValue(CONTROLES[i][1]);
        }
    }

    function novoAnimador(layer, nome) {
        var an = layer.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
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
        criarControles(layer);

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
        selectorExpr(anRot, molaExpr("Inicio ROTATION (frames)", "Dur ROTATION (frames)", "Amort ROTATION"));
        novaProp(anRot, "ADBE Text Rotation X").setValue(VAL.rotationX);

        // 5) posicao com mola
        var anPos = novoAnimador(layer, "POSITION");
        selectorExpr(anPos, molaExpr("Inicio POSITION (frames)", "Dur POSITION (frames)", "Amort POSITION"));
        novaProp(anPos, "ADBE Text Position 3D").setValue(VAL.position);

        // 6) escala com mola (neutra por padrao)
        var anScale = novoAnimador(layer, "SCALE");
        selectorExpr(anScale, molaExpr("Inicio SCALE (frames)", "Dur SCALE (frames)", "Amort SCALE"));
        novaProp(anScale, "ADBE Text Scale 3D").setValue(VAL.scale);

        // 7) opacidade em corte duro, no mesmo tempo do stagger
        var anOp = novoAnimador(layer, "OPACIDADE");
        selectorExpr(anOp, corteDuroExpr());
        novaProp(anOp, "ADBE Text Opacity").setValue(VAL.opacity);

        // 8) tracking constante (slot pronto)
        var anTrack = novoAnimador(layer, "TRACKING");
        selectorRange(anTrack);
        novaProp(anTrack, "ADBE Text Tracking Amount").setValue(VAL.tracking);
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
