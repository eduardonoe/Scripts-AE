/*
    FAUX 3D EXTRUSION RIG
    After Effects JSX
    Version: 1.0.0

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
         seguir o texto.

    A SACADA DA EXPRESSÃO: o offset do Repeater é medido no espaço
    interno da camada, ANTES da escala. Por isso a compensação multiplica
    o offset pela escala do shape layer — sem isso, ao escalar a extrusão
    a face frontal descolaria do corpo. Com isso, dá para mexer em
    copies, offset e escala à vontade que tudo continua registrado.

    Ajuste COPIES e OFFSET abaixo conforme a profundidade e a direção
    desejadas. OFFSET negativo joga a extrusão para o outro lado.

    Selecione a(s) camada(s) de texto e execute o script.
*/
(function fauxExtrusionRig() {
    // ---- ajustes ----
    var COPIES = 30;          // profundidade da extrusão (nº de cópias do repeater)
    var OFFSET = [1.5, 1.5];  // direção/passo da extrusão, em px por cópia
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

    function selecionarApenas(layer) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        layer.selected = true;
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
        if (!contents) return false;

        var rep = contents.addProperty("ADBE Vector Filter - Repeater");
        if (!rep) return false;

        try { rep.property("ADBE Vector Repeater Copies").setValue(COPIES); } catch (e) {}
        try {
            rep.property("ADBE Vector Repeater Transform")
               .property("ADBE Vector Repeater Position")
               .setValue(OFFSET);
        } catch (e) {}

        // a expressão procura o repeater pelo nome "Repeater 1"
        try { rep.name = "Repeater 1"; } catch (e) {}
        return true;
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

        shapeLayer.name = textLayer.name + " Extrusão";
        try { shapeLayer.moveAfter(textLayer); } catch (e) {}

        adicionarRepeater(shapeLayer);

        // ordem importa: as expressões dependem do shape estar logo abaixo do texto
        aplicarExpressao(textLayer, EXPR_TEXTO);
        aplicarExpressao(shapeLayer, EXPR_SHAPE);

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
