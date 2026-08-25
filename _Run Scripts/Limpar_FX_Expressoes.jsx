/*
    LIMPAR EFEITOS, EXPRESSÕES E LAYER STYLES
    After Effects JSX
    Version: 1.2.0

    Remove todos os efeitos, todas as expressões e todos os layer styles
    das camadas selecionadas, de uma só vez, 100% silencioso (sem nenhuma
    janela/alerta).

    Keyframes das propriedades padrão (Transform, texto, shape) são
    preservados — só somem keyframes que estavam dentro de um efeito ou
    layer style removido.

    NOTA SOBRE LAYER STYLES: o grupo "Layer Styles" é um NAMED_GROUP com
    10 slots fixos, então o AE NÃO permite remover um style pelo script
    (remove() lança "parent is not an INDEXED_GROUP"). A única remoção
    real é o comando nativo Layer > Layer Styles > Remove All, usado aqui
    com a seleção montada por código. Se esse comando não puder ser
    resolvido, o script desliga todos os styles como plano B — o
    resultado visual é o mesmo, mas o grupo continua listado.

    Selecione os layers e execute o script.

    Changelog:
    - 1.2.0: layer styles passam a ser removidos pelo comando nativo
      "Remove All" (com verificação), já que remove() por script é
      proibido nesse grupo. Plano B: desligar todos os styles.
    - 1.1.1: a remoção de layer styles falhava em silêncio (try/catch
      engolia o motivo). Passa a diagnosticar o erro.
    - 1.1.0: remove também os layer styles (Color Overlay, Drop Shadow,
      Stroke, etc.), preservando o Blending Options do grupo.
    - 1.0.1: removido alerta final e alertas de validação (execução silenciosa).
*/
(function limparFxExpressoes() {
    app.beginUndoGroup("Limpar Efeitos, Expressões e Layer Styles");

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        app.endUndoGroup();
        return;
    }

    var layers = comp.selectedLayers;
    if (layers.length === 0) {
        app.endUndoGroup();
        return;
    }

    function removeExpressionsRecursive(propGroup) {
        var count = 0;
        if (!propGroup) return count;
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            if (prop.propertyType === PropertyType.PROPERTY) {
                if (prop.canSetExpression && prop.expression !== "") {
                    try {
                        prop.expression = "";
                        count++;
                    } catch (e) {}
                }
            } else if (
                prop.propertyType === PropertyType.NAMED_GROUP ||
                prop.propertyType === PropertyType.INDEXED_GROUP
            ) {
                count += removeExpressionsRecursive(prop);
            }
        }
        return count;
    }

    // O grupo só existe enquanto houver layer style aplicado na camada.
    function getStylesGroup(layer) {
        try {
            return layer.property("ADBE Layer Styles");
        } catch (e) {
            return null;
        }
    }

    function selecionar(layerArr) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        for (var j = 0; j < layerArr.length; j++) {
            try { layerArr[j].selected = true; } catch (e) {}
        }
    }

    // Plano B: desliga cada style (o grupo continua listado, mas nada renderiza).
    function desligarStyles(layer) {
        var n = 0;
        var styles = getStylesGroup(layer);
        if (!styles) return n;
        for (var s = 1; s <= styles.numProperties; s++) {
            try {
                var style = styles.property(s);
                if (style.matchName === "ADBE Blend Options Group") continue;
                if (style.enabled) {
                    style.enabled = false;
                    n++;
                }
            } catch (e) {}
        }
        return n;
    }

    var expressionsRemoved = 0;
    var effectsRemoved = 0;

    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];

        expressionsRemoved += removeExpressionsRecursive(layer);

        try {
            var fx = layer.property("ADBE Effect Parade");
            if (fx) {
                for (var e = fx.numProperties; e >= 1; e--) {
                    try {
                        fx.property(e).remove();
                        effectsRemoved++;
                    } catch (err) {}
                }
            }
        } catch (err) {}
    }

    // --- layer styles: só o comando nativo remove de verdade ---
    var comStyles = [];
    for (var i = 0; i < layers.length; i++) {
        if (getStylesGroup(layers[i])) comStyles.push(layers[i]);
    }

    var stylesRemovidos = false;
    var desligadosFallback = 0;

    if (comStyles.length > 0) {
        var selecaoOriginal = layers.slice(0);
        selecionar(comStyles);

        var nomes = ["Remove All", "Remover tudo", "Remover Tudo"];
        for (var n = 0; n < nomes.length; n++) {
            var cmdId = app.findMenuCommandId(nomes[n]);
            if (!cmdId) continue;
            try {
                app.executeCommand(cmdId);
            } catch (e) {
                continue;
            }
            var aindaTem = false;
            for (var c = 0; c < comStyles.length; c++) {
                if (getStylesGroup(comStyles[c])) { aindaTem = true; break; }
            }
            if (!aindaTem) { stylesRemovidos = true; break; }
        }

        if (!stylesRemovidos) {
            for (var c = 0; c < comStyles.length; c++) {
                desligadosFallback += desligarStyles(comStyles[c]);
            }
        }

        selecionar(selecaoOriginal);
    }

    app.endUndoGroup();

    // Silencioso quando a remoção real acontece. Só avisa se caiu no plano B.
    if (comStyles.length > 0 && !stylesRemovidos) {
        alert(
            "Efeitos e expressões limpos.\n\n" +
            "Os layer styles não puderam ser REMOVIDOS (o After Effects não permite isso via " +
            "script; só pelo menu Layer > Layer Styles > Remove All, que não foi possível " +
            "acionar aqui).\n\n" +
            "Como alternativa, todos os styles foram DESLIGADOS: " + desligadosFallback + " style(s) " +
            "em " + comStyles.length + " camada(s). Nada deles renderiza mais, mas o grupo " +
            "continua listado na timeline."
        );
    }
})();
