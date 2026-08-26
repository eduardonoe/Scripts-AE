/*
    FAUX 3D EXTRUSION RIG
    After Effects JSX
    Version: 3.0.0

    Monta o rig de extrusão 3D falsa a partir de uma camada de TEXTO
    selecionada. Técnica do post do contentlab.cc ("How to create Faux 3D
    extrusion in After Effects?"), que originalmente é manual — aqui é
    montada por script.

    PAINEL DE CONTROLES (tudo na camada de TEXTO, um lugar só)
      ANIMAÇÃO
      - "Progresso"    : 0 a 100. É ESTE o controle que você anima. Cada
                         letra extruda no seu tempo conforme ele avança.
      - "Profundidade" : nº de cópias do repeater = altura da extrusão.
      - "Direcao"      : ângulo de crescimento. 0° = para cima.
      - "Distancia"    : passo em px por cópia.
      - "Stagger"      : atraso entre uma letra e a seguinte.
      COR
      - "Cor Face"     : cor da face frontal (via efeito Fill).
      - "Cor Extrusao" : cor do corpo.
      - "Stroke"       : liga/desliga o contorno do corpo. Só é criado
                         quando o texto realmente tem stroke.

    Nada é "assado" em keyframes por letra: o Copies e o offset de cada
    glifo são EXPRESSÕES que leem esses controles. Mudar ritmo, direção ou
    profundidade é mexer num slider, não reeditar letra por letra.

    DOIS MODOS (constante MODO)
      - "caractere" (padrão): um Repeater DENTRO de cada glifo, cada um com
        seu atraso. Cada letra ganha sua própria TAMPA (um subgrupo "Cap"
        dentro dela mesma, com a geometria duplicada), empurrada pela
        extrusão DAQUELA letra — nunca pela de outra. É por isso que cada
        letra sobe exatamente na medida do que já extrudou, sem depender de
        nenhuma "líder": não existe face compartilhada para travar todas na
        mesma altura. O texto original (camada de TEXTO) fica apenas como
        suporte dos controles — quem renderiza é só o shape layer.
      - "palavra": um Repeater único para o texto todo, com o texto
        funcionando como face de verdade (compensada por expressão) e o
        corpo seguindo ele. A palavra inteira extruda junta, sem
        escalonamento.

    SOBRE A DIREÇÃO: no After Effects o eixo Y é invertido (Y positivo é
    para BAIXO). O ângulo aqui já corrige isso: 0° cresce para cima, 90°
    para a direita, 180° para baixo.

    SOBRE A COR DA FACE: é controlada por um efeito Fill aplicado no texto.
    Isso pinta a face inteira de uma cor só — se o seu texto tiver stroke de
    cor diferente na FACE, desligue (ou apague) esse efeito Fill e defina a
    cor no próprio texto. A extrusão não é afetada por isso.

    SOBRE O STROKE: o "Create Shapes from Text" já traz fill e stroke do
    texto. Desligar o stroke deixa o corpo mais FINO que a face, porque o
    stroke engrossa a silhueta — a extrusão aparece encolhida sob o texto.
    Por isso o padrão é manter o stroke, recolorido na cor da extrusão.

    O post também mostra um "Method 2 (Quick)" que usa ferramentas pagas de
    terceiros (o script Explode_Text e o painel Morpheus, com ADD EXTRUSION
    e animação do Radius de um efeito Extrusion Depth). Este script replica
    o Method 1, sem depender delas.

    Selecione a(s) camada(s) de texto e execute o script.

    Changelog:
    - 3.0.0: corrige o modo "caractere" de vez. A correção anterior (2.2.0)
      empurrava a face inteira (uma única camada de texto) pela extrusão de
      UMA letra "líder" — mas como todas as letras compartilhavam essa
      mesma face rígida, as que ainda não tinham extrudado nada subiam
      junto com as demais, ficando suspensas com um vão vazio embaixo
      (exatamente o bug relatado). Correção real: a face deixa de ser a
      camada de texto e passa a ser uma TAMPA por letra, dentro do próprio
      shape layer — cada uma lida com o repeater DELA MESMA, então cada
      letra só sobe na medida exata do que já extrudou. A camada de texto
      vira só um suporte para os controles, sem renderizar nada.
    - 2.2.0: (revertido) tentativa de empurrar a face inteira via letra líder.
    - 2.1.0: "Profundidade" aceita valor negativo, para inverter o sentido
      da extrusão sem mexer em "Direcao" — permite tanto um objeto que
      cresce "para o ar" (positiva) quanto um que parece emergir do chão
      (negativa). O Copies do Repeater nunca aceita negativo (o AE trava
      em 0), então a quantidade de cópias usa |Profundidade| e é o offset
      quem aplica o sinal, invertendo a direção do crescimento.
    - 2.0.0: a animação deixa de ser keyframes assados no Copies de cada
      letra (que não davam controle nenhum: mudar o ritmo exigia reeditar
      letra por letra) e passa a ser dirigida por controles no Effect
      Controls, lidos por expressão. Direção agora é um ângulo que corrige
      o eixo Y invertido do AE — antes o offset padrão crescia para baixo.
    - 1.3.0: modo "caractere" com Repeater por glifo e stagger.
    - 1.2.0: painel de controles de cor na camada de texto.
    - 1.1.0: cor própria para o corpo da extrusão.
    - 1.0.0: versão inicial, montagem do rig e das duas expressões.
*/
(function fauxExtrusionRig() {
    // ---- ajustes (valores INICIAIS dos controles) ----
    var MODO = "caractere";   // "caractere" ou "palavra"

    var PROFUNDIDADE = 30;    // nº de cópias = altura da extrusão
    var DIRECAO = 0;          // graus: 0 = para cima, 90 = direita, 180 = baixo
    var DISTANCIA = 1.5;      // px por cópia
    var STAGGER = 0.35;       // atraso entre letras (fração da duração de uma letra)

    // Keyframes iniciais no "Progresso", só para já sair animando.
    var ANIMAR = true;
    var INICIO = 0;           // segundos
    var DURACAO = 1.2;        // segundos para o Progresso ir de 0 a 100

    var COR_FACE = null;          // null = mantém a cor atual do texto
    var COR_EXTRUSAO = null;      // null = cor do texto escurecida
    var FATOR_ESCURECER = 0.55;   // 0 = preto, 1 = mesma cor do texto

    var STROKE_INICIAL = true;
    var RECOLORIR_STROKE = true;
    // --------------------------------------------------

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Abra uma composição e selecione a camada de texto.");
        return;
    }

    var selecionadas = comp.selectedLayers;
    if (selecionadas.length === 0) {
        alert("Selecione a camada de texto que vai receber a extrusão.");
        return;
    }
    selecionadas = selecionadas.slice(0);

    // ---------- expressões ----------

    // Offset do repeater a partir de ângulo + distância. O -cos no Y corrige o
    // eixo invertido do AE (0° cresce para cima). O Copies do Repeater NUNCA
    // aceita negativo (o AE trava em 0) — por isso a quantidade de cópias usa
    // sempre |Profundidade|, e é este offset que aplica o SINAL de
    // Profundidade, invertendo o sentido do crescimento sem mexer no ângulo.
    // É o que permite animar tanto "saindo do ar" (Profundidade positiva)
    // quanto "emergindo do chão" (Profundidade negativa, ou o texto
    // posicionado no nível do chão com a extrusão crescendo para trás dele).
    var EXPR_OFFSET =
        'var ctrl = thisComp.layer(index - 1);\n' +
        'var a = degreesToRadians(ctrl.effect("Direcao")("Angle"));\n' +
        'var d = ctrl.effect("Distancia")("Slider");\n' +
        'var s = ctrl.effect("Profundidade")("Slider") < 0 ? -1 : 1;\n' +
        '[Math.sin(a) * d * s, -Math.cos(a) * d * s];';

    // Copies de UM glifo: progresso global escalonado pelo índice da letra.
    function exprCopies(i, n) {
        return '' +
            '// letra ' + (i + 1) + ' de ' + n + '\n' +
            'var ctrl = thisComp.layer(index - 1);\n' +
            'var prof = Math.abs(ctrl.effect("Profundidade")("Slider"));\n' +
            'var stag = ctrl.effect("Stagger")("Slider");\n' +
            'var p = ctrl.effect("Progresso")("Slider") / 100;\n' +
            'var i = ' + i + ';\n' +
            'var n = ' + n + ';\n' +
            '\n' +
            '// o progresso percorre a duracao de uma letra mais todos os atrasos\n' +
            'var total = 1 + stag * Math.max(0, n - 1);\n' +
            'var t = p * total - i * stag;\n' +
            'var local = Math.min(1, Math.max(0, t));\n' +
            'Math.round(local * prof);';
    }

    // Modo "palavra": um repeater só, sem escalonamento.
    var EXPR_COPIES_PALAVRA =
        'var ctrl = thisComp.layer(index - 1);\n' +
        'var prof = Math.abs(ctrl.effect("Profundidade")("Slider"));\n' +
        'var p = ctrl.effect("Progresso")("Slider") / 100;\n' +
        'Math.round(p * prof);';

    var EXPR_TEXTO =
        "// FAUX 3D EXTRUSION - face frontal\n" +
        "// compensa o deslocamento total do repeater do shape layer abaixo\n" +
        "var shapeLayer = thisComp.layer(index + 1);\n" +
        "var rep = shapeLayer.content(\"Repeater 1\");\n" +
        "var qtd = Math.max(0, rep.copies - 1);\n" +
        "var repPos = rep.transform.position;\n" +
        "\n" +
        "// a escala importa: o offset do repeater e medido antes da escala da camada\n" +
        "var scaleX = shapeLayer.transform.scale[0] / 100;\n" +
        "var scaleY = shapeLayer.transform.scale[1] / 100;\n" +
        "\n" +
        "var xOffset = repPos[0] * scaleX * qtd;\n" +
        "var yOffset = repPos[1] * scaleY * qtd;\n" +
        "\n" +
        "value - [xOffset, yOffset];";

    var EXPR_SHAPE =
        "// FAUX 3D EXTRUSION - corpo (modo palavra)\n" +
        "// segue a camada de texto logo acima (mesmo deslocamento, ancora o \"chao\")\n" +
        "thisComp.layer(index - 1).transform.position;";

    var EXPR_COR_CORPO = 'thisComp.layer(index - 1).effect("Cor Extrusao")("Color");';
    var EXPR_COR_FACE_CARACTERE = 'thisComp.layer(index - 1).effect("Cor Face")("Color");';
    var EXPR_STROKE_OP = 'thisComp.layer(index - 1).effect("Stroke")("Checkbox") ? 100 : 0;';

    // Modo "caractere" — posição da TAMPA (cap) de UM glifo: cada letra tem a
    // sua própria tampa, empurrada pela quantidade de cópias do REPEATER
    // DELA MESMA (não de nenhuma "líder"). Isso é o que resolve a letra
    // suspensa/flutuando: cada letra só sobe na medida exata do que já
    // extrudou, nunca antes disso — sem depender de nenhuma outra letra.
    function exprCapPos(nomeGrupo) {
        return '' +
            '// tampa da letra "' + nomeGrupo + '" - sobe so o quanto ELA MESMA ja extrudou\n' +
            'var rep = thisComp.layer(index).content("' + nomeGrupo + '").content("Repeater 1");\n' +
            'var qtd = Math.max(0, rep.copies - 1);\n' +
            'var repPos = rep.transform.position;\n' +
            '\n' +
            'value - [repPos[0] * qtd, repPos[1] * qtd];';
    }

    // ---------- helpers ----------

    function selecionarApenas(layer) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        layer.selected = true;
    }

    function ehGrupo(p) {
        return p.propertyType === PropertyType.NAMED_GROUP ||
               p.propertyType === PropertyType.INDEXED_GROUP;
    }

    function criarContornos(textLayer) {
        selecionarApenas(textLayer);

        var nomes = ["Create Shapes from Text", "Criar Formas a Partir do Texto"];
        var cmdId = 0;
        for (var n = 0; n < nomes.length; n++) {
            cmdId = app.findMenuCommandId(nomes[n]);
            if (cmdId) break;
        }
        if (!cmdId) return null;

        try {
            app.executeCommand(cmdId);
        } catch (e) {
            return null;
        }

        var sel = comp.selectedLayers;
        for (var s = 0; s < sel.length; s++) {
            if (sel[s] instanceof ShapeLayer) return sel[s];
        }
        return null;
    }

    // X mínimo dos vértices — ordena os glifos da esquerda para a direita, já que
    // a ordem dos grupos criados pelo "Create Shapes from Text" não é garantida.
    function minXdoGrupo(group) {
        var min = null;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Shape - Group") {
                try {
                    var verts = p.property("ADBE Vector Shape").value.vertices;
                    for (var v = 0; v < verts.length; v++) {
                        if (min === null || verts[v][0] < min) min = verts[v][0];
                    }
                } catch (e) {}
            } else if (ehGrupo(p)) {
                var sub = minXdoGrupo(p);
                if (sub !== null && (min === null || sub < min)) min = sub;
            }
        }
        return min;
    }

    function configurarRepeater(rep, exprCopiesStr) {
        try {
            rep.property("ADBE Vector Repeater Transform")
               .property("ADBE Vector Repeater Position")
               .expression = EXPR_OFFSET;
        } catch (e) {}
        try {
            rep.property("ADBE Vector Repeater Copies").expression = exprCopiesStr;
        } catch (e) {}
        try { rep.name = "Repeater 1"; } catch (e) {}
    }

    // Duplica a geometria (e a cor original) do glifo dentro de um subgrupo
    // "Cap", que fica visualmente por cima do corpo/repeater sem ser afetado
    // por ele — porque é adicionado DEPOIS na lista de Contents, e o Repeater
    // só repete o que está ACIMA dele na mesma lista.
    function criarTampa(gc, pathOriginal, fillOriginal, strokeOriginal, nomeGrupo) {
        var cap;
        try { cap = gc.addProperty("ADBE Vector Group"); } catch (e) { return; }
        if (!cap) return;
        cap.name = "Cap";
        var capContents = cap.property("ADBE Vectors Group");
        if (!capContents) return;

        try {
            var capPath = capContents.addProperty("ADBE Vector Shape - Group");
            capPath.property("ADBE Vector Shape").setValue(pathOriginal.property("ADBE Vector Shape").value);
        } catch (e) {}

        if (strokeOriginal) {
            try {
                var capStroke = capContents.addProperty("ADBE Vector Graphic - Stroke");
                capStroke.property("ADBE Vector Stroke Color").setValue(
                    strokeOriginal.property("ADBE Vector Stroke Color").value
                );
                capStroke.property("ADBE Vector Stroke Width").setValue(
                    strokeOriginal.property("ADBE Vector Stroke Width").value
                );
            } catch (e) {}
        }

        try {
            var capFill = capContents.addProperty("ADBE Vector Graphic - Fill");
            capFill.property("ADBE Vector Fill Color").expression = EXPR_COR_FACE_CARACTERE;
        } catch (e) {}

        try {
            cap.property("ADBE Vector Transform Group")
               .property("ADBE Vector Position")
               .expression = exprCapPos(nomeGrupo);
        } catch (e) {}
    }

    function repeaterPorCaractere(shapeLayer) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return 0;

        var grupos = [];
        for (var i = 1; i <= contents.numProperties; i++) {
            var g = contents.property(i);
            if (g.matchName !== "ADBE Vector Group") continue;
            grupos.push({ grupo: g, x: minXdoGrupo(g) });
        }
        grupos.sort(function (a, b) {
            if (a.x === null) return 1;
            if (b.x === null) return -1;
            return a.x - b.x;
        });

        var n = grupos.length;
        var criados = 0;
        for (var k = 0; k < n; k++) {
            var grupo = grupos[k].grupo;
            var nomeGrupo = "FauxExt_" + k;
            try { grupo.name = nomeGrupo; } catch (e) {}

            var gc = grupo.property("ADBE Vectors Group");
            if (!gc) continue;

            // captura o path/fill/stroke ORIGINAIS antes de mexer em qualquer coisa —
            // eles vão virar o CORPO (repetido); a tampa é uma cópia deles, à parte.
            var pathOriginal = null, fillOriginal = null, strokeOriginal = null;
            for (var j = 1; j <= gc.numProperties; j++) {
                var pj = gc.property(j);
                if (pj.matchName === "ADBE Vector Shape - Group") pathOriginal = pj;
                else if (pj.matchName === "ADBE Vector Graphic - Fill") fillOriginal = pj;
                else if (pj.matchName === "ADBE Vector Graphic - Stroke") strokeOriginal = pj;
            }
            if (!pathOriginal) continue;

            var rep;
            try { rep = gc.addProperty("ADBE Vector Filter - Repeater"); } catch (e) { continue; }
            if (!rep) continue;
            configurarRepeater(rep, exprCopies(k, n));
            criados++;

            // a tampa entra por último: fica abaixo do Repeater na lista de
            // Contents, então não é afetada por ele.
            criarTampa(gc, pathOriginal, fillOriginal, strokeOriginal, nomeGrupo);
        }
        return criados;
    }

    function repeaterUnico(shapeLayer) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return;
        var rep;
        try { rep = contents.addProperty("ADBE Vector Filter - Repeater"); } catch (e) { return; }
        if (!rep) return;
        configurarRepeater(rep, EXPR_COPIES_PALAVRA);
    }

    function primeiraCorFill(group) {
        if (!group) return null;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Graphic - Fill") {
                try { return p.property("ADBE Vector Fill Color").value; } catch (e) {}
            } else if (ehGrupo(p)) {
                var achado = primeiraCorFill(p);
                if (achado) return achado;
            }
        }
        return null;
    }

    function escurecer(cor, fator) {
        var nova = [cor[0] * fator, cor[1] * fator, cor[2] * fator];
        if (cor.length > 3) nova.push(cor[3]);
        return nova;
    }

    function contarStrokes(group) {
        var n = 0;
        if (!group) return n;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Graphic - Stroke") n++;
            else if (ehGrupo(p)) n += contarStrokes(p);
        }
        return n;
    }

    function ligarCorpoAosControles(group, temCheckbox) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);

            // a tampa (Cap) já tem sua própria cor/expressão — não é corpo, não mexe.
            if (ehGrupo(p) && p.name === "Cap") continue;

            if (p.matchName === "ADBE Vector Graphic - Fill") {
                try {
                    p.property("ADBE Vector Fill Color").expression = EXPR_COR_CORPO;
                } catch (e) {}

            } else if (p.matchName === "ADBE Vector Graphic - Stroke") {
                if (RECOLORIR_STROKE) {
                    try {
                        p.property("ADBE Vector Stroke Color").expression = EXPR_COR_CORPO;
                    } catch (e) {}
                }
                if (temCheckbox) {
                    try {
                        p.property("ADBE Vector Stroke Opacity").expression = EXPR_STROKE_OP;
                    } catch (e) {}
                }

            } else if (ehGrupo(p)) {
                ligarCorpoAosControles(p, temCheckbox);
            }
        }
    }

    function addSlider(fx, nome, valor) {
        try {
            var s = fx.addProperty("ADBE Slider Control");
            s.name = nome;
            s.property(1).setValue(valor);
            return s;
        } catch (e) {
            return null;
        }
    }

    // Painel único no texto: animação primeiro, depois cor.
    function montarControles(textLayer, shapeLayer) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return;

        var fx = textLayer.property("ADBE Effect Parade");
        if (!fx) return;

        // --- animação ---
        var progresso = addSlider(fx, "Progresso", ANIMAR ? 0 : 100);
        addSlider(fx, "Profundidade", PROFUNDIDADE);

        try {
            var ang = fx.addProperty("ADBE Angle Control");
            ang.name = "Direcao";
            ang.property(1).setValue(DIRECAO);
        } catch (e) {}

        addSlider(fx, "Distancia", DISTANCIA);
        addSlider(fx, "Stagger", STAGGER);

        // keyframes só no Progresso — é o único ponto de animação do rig
        if (ANIMAR && progresso) {
            try {
                var p = progresso.property(1);
                p.setValueAtTime(INICIO, 0);
                p.setValueAtTime(INICIO + DURACAO, 100);
            } catch (e) {}
        }

        // --- cor ---
        var corBase = primeiraCorFill(contents);
        var corFace = COR_FACE ? COR_FACE : (corBase ? corBase : [1, 1, 1]);
        var corExtrusao = COR_EXTRUSAO
            ? COR_EXTRUSAO
            : (corBase ? escurecer(corBase, FATOR_ESCURECER) : [0, 0, 0]);

        try {
            var ctlCorpo = fx.addProperty("ADBE Color Control");
            ctlCorpo.name = "Cor Extrusao";
            ctlCorpo.property(1).setValue(corExtrusao);
        } catch (e) {
            return; // sem o controle de cor não há o que ligar no corpo
        }

        var temStroke = contarStrokes(contents) > 0;
        if (temStroke) {
            try {
                var chk = fx.addProperty("ADBE Checkbox Control");
                chk.name = "Stroke";
                chk.property(1).setValue(STROKE_INICIAL ? 1 : 0);
            } catch (e) {
                temStroke = false;
            }
        }

        ligarCorpoAosControles(contents, temStroke);

        // Fill por último: é um efeito que renderiza, e deve vir depois dos controles
        try {
            var ctlFace = fx.addProperty("ADBE Color Control");
            ctlFace.name = "Cor Face";
            ctlFace.property(1).setValue(corFace);

            var fill = fx.addProperty("ADBE Fill");
            var corDoFill = null;
            try { corDoFill = fill.property("Color"); } catch (e) {}
            if (!corDoFill) { try { corDoFill = fill.property("ADBE Fill-0002"); } catch (e) {} }
            if (corDoFill) corDoFill.expression = 'effect("Cor Face")("Color");';
        } catch (e) {}
    }

    function aplicarExpressao(layer, expr) {
        try {
            var pos = layer.property("ADBE Transform Group").property("ADBE Position");
            if (pos && pos.canSetExpression) {
                pos.expression = expr;
                return true;
            }
        } catch (e) {}
        return false;
    }

    // ---------- execução ----------

    var montados = 0;
    var semTexto = 0;
    var falhaContornos = 0;

    for (var i = 0; i < selecionadas.length; i++) {
        var textLayer = selecionadas[i];

        if (!(textLayer instanceof TextLayer)) {
            semTexto++;
            continue;
        }

        app.beginUndoGroup("Faux 3D Extrusion Rig");

        var shapeLayer = criarContornos(textLayer);
        if (!shapeLayer) {
            falhaContornos++;
            app.endUndoGroup();
            continue;
        }

        shapeLayer.name = textLayer.name + " Extrusao";
        try { shapeLayer.moveAfter(textLayer); } catch (e) {}

        // controles primeiro: os repeaters entram já lendo eles por expressão
        montarControles(textLayer, shapeLayer);

        if (MODO === "caractere") {
            // a face vira as "tampas" dentro do próprio shape layer, cada uma
            // empurrada pela extrusão da SUA letra — o texto original só
            // guarda os controles, não precisa mais renderizar nada
            repeaterPorCaractere(shapeLayer);
        } else {
            // o comando desliga o texto original; aqui ele volta a ser a face
            try { textLayer.enabled = true; } catch (e) {}
            repeaterUnico(shapeLayer);
            aplicarExpressao(textLayer, EXPR_TEXTO);
            aplicarExpressao(shapeLayer, EXPR_SHAPE);
        }

        montados++;
        app.endUndoGroup();
    }

    if (montados === 0) {
        var msg = "Nenhum rig foi montado.\n\n";
        if (semTexto > 0) msg += "Camadas selecionadas que não são texto: " + semTexto + "\n";
        if (falhaContornos > 0) msg += "Falhas ao gerar contornos (Create Shapes from Text): " + falhaContornos + "\n";
        alert(msg);
    }
})();
