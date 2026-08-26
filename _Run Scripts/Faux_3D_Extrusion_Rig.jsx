/*
    FAUX 3D EXTRUSION RIG
    After Effects JSX
    Version: 1.3.0

    Monta o rig de extrusão 3D falsa a partir de uma camada de TEXTO
    selecionada. Técnica do post do contentlab.cc ("How to create Faux 3D
    extrusion in After Effects?"), que originalmente é manual — aqui é
    montada por script.

    O que o script faz, para cada camada de texto selecionada:
      1. gera o contorno em shape via "Create Shapes from Text";
      2. posiciona o shape layer exatamente UMA camada abaixo do texto
         (a expressão depende dessa ordem: index + 1 / index - 1);
      3. adiciona um Repeater no shape layer (nome padrão "Repeater 1",
         que é o nome que a expressão procura) com COPIES cópias e
         OFFSET de deslocamento — esse é o "corpo" da extrusão;
      4. aplica a expressão de Position no texto, que compensa o
         deslocamento total do repeater;
      5. aplica a expressão de Position no shape layer, que passa a
         seguir o texto;
      6. cria o painel de controles no Effect Controls do TEXTO.

    A SACADA DA EXPRESSÃO: o offset do Repeater é medido no espaço
    interno da camada, ANTES da escala. Por isso a compensação multiplica
    o offset pela escala do shape layer — sem isso, ao escalar a extrusão
    a face frontal descolaria do corpo. Com isso, dá para mexer em
    copies, offset e escala à vontade que tudo continua registrado.

    PAINEL DE CONTROLES (tudo na camada de TEXTO, um lugar só):
      - "Cor Face"     : cor da face frontal.
      - "Cor Extrusao" : cor do corpo da extrusão.
      - "Stroke"       : liga/desliga o contorno do corpo. Só é criado
                         quando o texto realmente tem stroke.
    O corpo da extrusão lê esses controles por expressão, na camada de
    texto logo acima dele.

    SOBRE A COR DA FACE: é controlada por um efeito Fill aplicado no
    texto. Isso pinta a face inteira de uma cor só — se o seu texto tiver
    stroke de cor diferente na FACE, desligue (ou apague) esse efeito Fill
    e defina a cor no próprio texto. A extrusão não é afetada por isso.

    SOBRE O STROKE: o "Create Shapes from Text" já traz fill e stroke do
    texto, sem precisar detectar nada. Vale saber que desligar o stroke
    deixa o corpo mais FINO que a face frontal, porque o stroke engrossa
    a silhueta — a extrusão aparece encolhida sob o texto. Por isso o
    padrão é manter o stroke, recolorido na cor da extrusão
    (RECOLORIR_STROKE), o que preserva a silhueta.

    Ajuste COPIES e OFFSET abaixo conforme a profundidade e a direção
    desejadas. OFFSET negativo joga a extrusão para o outro lado.

    Selecione a(s) camada(s) de texto e execute o script.

    DOIS MODOS (constante MODO)
      - "caractere" (padrão): um Repeater DENTRO de cada glifo, com o Copies
        animado de 0 até COPIES e um atraso crescente letra a letra. É o que
        a referência mostra ("animate Copies and repeat for every character").
        Aqui a face é o próprio texto, que não se move, então as expressões
        de compensação não são necessárias.
      - "palavra": um Repeater único e as duas expressões do post. Também é
        animável — basta animar o Copies, e a expressão mantém tudo
        registrado — mas a palavra inteira extruda junta, sem escalonamento.

    O post também mostra um "Method 2 (Quick)" que usa ferramentas pagas de
    terceiros (o script Explode_Text e o painel Morpheus, com ADD EXTRUSION
    e animação do Radius de um efeito Extrusion Depth). Este script replica
    o Method 1, sem depender delas.

    Changelog:
    - 1.3.0: modo "caractere" com Repeater por glifo e animação escalonada do
      Copies — antes o rig era estático e extrudava a palavra inteira junta.
      Os glifos são ordenados da esquerda para a direita antes de escalonar,
      já que a ordem dos grupos criados pelo AE não é garantida.
    - 1.2.0: painel único de controles na camada de texto, com "Cor Face"
      (via efeito Fill), "Cor Extrusao" e "Stroke".
    - 1.1.0: cor própria para o corpo da extrusão (antes herdava a cor
      exata do texto e ficava tudo chapado, sem leitura de 3D), derivada
      da cor do texto por escurecimento.
    - 1.0.0: versão inicial, montagem do rig e das duas expressões.
*/
(function fauxExtrusionRig() {
    // ---- ajustes ----
    // "caractere" : um Repeater DENTRO de cada glifo. Permite animar cada letra
    //               separadamente e escalonar (é o que a referência mostra).
    // "palavra"   : um Repeater único para o texto todo, com as expressões de
    //               compensação do post. Também é animável (anime o Copies),
    //               mas a palavra inteira extruda junta, sem stagger.
    var MODO = "caractere";

    var COPIES = 30;          // profundidade da extrusão (nº de cópias do repeater)
    var OFFSET = [1.5, 1.5];  // direção/passo da extrusão, em px por cópia

    // Animação (só no modo "caractere"): o Copies de cada letra cresce de 0 até
    // COPIES, com um atraso crescente letra a letra.
    var ANIMAR = true;
    var INICIO = 0;           // segundos, a partir do início da camada
    var DURACAO = 0.5;        // segundos que cada letra leva para extrudar
    var STAGGER = 0.06;       // atraso entre uma letra e a seguinte

    // Valores INICIAIS dos controles — depois tudo é ajustável ao vivo no
    // Effect Controls. null = deriva da cor do texto.
    var COR_FACE = null;          // null = mantém a cor atual do texto
    var COR_EXTRUSAO = null;      // null = cor do texto escurecida por FATOR_ESCURECER
    var FATOR_ESCURECER = 0.55;   // 0 = preto, 1 = mesma cor do texto

    var STROKE_INICIAL = true;    // estado inicial da caixa "Stroke"
    var RECOLORIR_STROKE = true;  // true: stroke do corpo acompanha "Cor Extrusao"
                                  // false: stroke mantém a cor original do texto
    // -----------------

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

    var EXPR_TEXTO =
        "// FAUX 3D EXTRUSION - face frontal\n" +
        "// compensa o deslocamento total do repeater do shape layer abaixo\n" +
        "var shapeLayer = thisComp.layer(index + 1);\n" +
        "var rep = shapeLayer.content(\"Repeater 1\");\n" +
        "var copies = Math.max(0, rep.copies - 1);\n" +
        "var repPos = rep.transform.position;\n" +
        "\n" +
        "// a escala importa: o offset do repeater e medido antes da escala da camada\n" +
        "var scaleX = shapeLayer.transform.scale[0] / 100;\n" +
        "var scaleY = shapeLayer.transform.scale[1] / 100;\n" +
        "\n" +
        "var xOffset = repPos[0] * scaleX * copies;\n" +
        "var yOffset = repPos[1] * scaleY * copies;\n" +
        "\n" +
        "value - [xOffset, yOffset];";

    var EXPR_SHAPE =
        "// FAUX 3D EXTRUSION - corpo\n" +
        "// segue a camada de texto logo acima\n" +
        "thisComp.layer(index - 1).transform.position;";

    // o corpo lê os controles na camada de texto logo acima
    var EXPR_COR_CORPO = 'thisComp.layer(index - 1).effect("Cor Extrusao")("Color");';
    var EXPR_STROKE_OP = 'thisComp.layer(index - 1).effect("Stroke")("Checkbox") ? 100 : 0;';

    function selecionarApenas(layer) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        layer.selected = true;
    }

    function ehGrupo(p) {
        return p.propertyType === PropertyType.NAMED_GROUP ||
               p.propertyType === PropertyType.INDEXED_GROUP;
    }

    // "Create Shapes from Text" gera o layer de contornos e desliga o texto original.
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

    function adicionarRepeater(shapeLayer) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return;

        var rep = contents.addProperty("ADBE Vector Filter - Repeater");
        if (!rep) return;

        try { rep.property("ADBE Vector Repeater Copies").setValue(COPIES); } catch (e) {}
        try {
            rep.property("ADBE Vector Repeater Transform")
               .property("ADBE Vector Repeater Position")
               .setValue(OFFSET);
        } catch (e) {}

        // a expressão procura o repeater pelo nome "Repeater 1"
        try { rep.name = "Repeater 1"; } catch (e) {}
    }

    // X mínimo dos vértices de um grupo — usado para ordenar os glifos da
    // esquerda para a direita, já que a ordem dos grupos criados pelo
    // "Create Shapes from Text" não é garantida.
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

    // Modo "caractere": um Repeater dentro de cada glifo, com Copies animado e
    // escalonado. É isso que permite cada letra extrudar no seu tempo.
    function repeaterPorCaractere(shapeLayer) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return 0;

        // coleta os grupos de glifo e ordena por posição horizontal
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

        var criados = 0;
        for (var k = 0; k < grupos.length; k++) {
            var gc = grupos[k].grupo.property("ADBE Vectors Group");
            if (!gc) continue;

            var rep;
            try {
                rep = gc.addProperty("ADBE Vector Filter - Repeater");
            } catch (e) {
                continue;
            }
            if (!rep) continue;

            try {
                rep.property("ADBE Vector Repeater Transform")
                   .property("ADBE Vector Repeater Position")
                   .setValue(OFFSET);
            } catch (e) {}

            var copies = null;
            try { copies = rep.property("ADBE Vector Repeater Copies"); } catch (e) {}

            if (copies) {
                if (ANIMAR) {
                    var t0 = INICIO + k * STAGGER;
                    try {
                        copies.setValueAtTime(t0, 0);
                        copies.setValueAtTime(t0 + DURACAO, COPIES);
                    } catch (e) {
                        try { copies.setValue(COPIES); } catch (err) {}
                    }
                } else {
                    try { copies.setValue(COPIES); } catch (e) {}
                }
            }

            criados++;
        }
        return criados;
    }

    // Primeira cor de fill encontrada — base para derivar as cores dos controles.
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

    // Liga fills e strokes do CORPO aos controles que estão na camada de texto.
    function ligarCorpoAosControles(group, temCheckbox) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);

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
                    // opacidade 0 some com o stroke sem alterar a estrutura do shape
                    try {
                        p.property("ADBE Vector Stroke Opacity").expression = EXPR_STROKE_OP;
                    } catch (e) {}
                }

            } else if (ehGrupo(p)) {
                ligarCorpoAosControles(p, temCheckbox);
            }
        }
    }

    // Painel único no texto: Cor Face, Cor Extrusao e Stroke.
    function montarControles(textLayer, shapeLayer) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return;

        var corBase = primeiraCorFill(contents);
        var corFace = COR_FACE ? COR_FACE : (corBase ? corBase : [1, 1, 1]);
        var corExtrusao = COR_EXTRUSAO
            ? COR_EXTRUSAO
            : (corBase ? escurecer(corBase, FATOR_ESCURECER) : [0, 0, 0]);

        var fx = textLayer.property("ADBE Effect Parade");
        if (!fx) return;

        // --- Cor Face: controle + efeito Fill que pinta a face ---
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

        // --- Cor Extrusao ---
        try {
            var ctlCorpo = fx.addProperty("ADBE Color Control");
            ctlCorpo.name = "Cor Extrusao";
            ctlCorpo.property(1).setValue(corExtrusao);
        } catch (e) {
            return; // sem o controle de cor não há o que ligar no corpo
        }

        // --- Stroke: só faz sentido se o texto realmente tiver stroke ---
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

        // o comando desliga o texto original; ele volta a ser a face frontal
        try { textLayer.enabled = true; } catch (e) {}

        shapeLayer.name = textLayer.name + " Extrusao";
        try { shapeLayer.moveAfter(textLayer); } catch (e) {}

        if (MODO === "caractere") {
            // cada glifo ganha o seu Repeater; a face é o próprio texto, que não
            // se move — por isso aqui NÃO entram as expressões de compensação.
            repeaterPorCaractere(shapeLayer);
        } else {
            adicionarRepeater(shapeLayer);
            // ordem importa: as expressões dependem do shape estar logo abaixo do texto
            aplicarExpressao(textLayer, EXPR_TEXTO);
            aplicarExpressao(shapeLayer, EXPR_SHAPE);
        }

        montarControles(textLayer, shapeLayer);

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
