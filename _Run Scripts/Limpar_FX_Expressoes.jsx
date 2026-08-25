/*
    LIMPAR EFEITOS, EXPRESSÕES E LAYER STYLES
    After Effects JSX
    Version: 1.1.1

    Remove todos os efeitos, todas as expressões e todos os layer styles
    das camadas selecionadas, de uma só vez, 100% silencioso (sem nenhuma
    janela/alerta).

    Keyframes das propriedades padrão (Transform, texto, shape) são
    preservados — só somem keyframes que estavam dentro de um efeito ou
    layer style removido.

    Selecione os layers e execute o script.

    Changelog:
    - 1.1.1: a remoção de layer styles falhava em silêncio (try/catch
      engolia o motivo). Agora, se houver layer style e ele resistir à
      remoção, um aviso único mostra o diagnóstico. Continua silencioso
      quando tudo dá certo.
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

    // remove os layer styles (Color Overlay, Drop Shadow, Stroke, etc.).
    // A propriedade 1 do grupo é "Blending Options", que não é um style e não pode ser
    // removida — só os styles de fato, do fim para o começo para não bagunçar os índices.
    // Se algum style resistir à remoção, o motivo é guardado em diag para o aviso final.
    function removeLayerStyles(layer, diag) {
        var count = 0;
        var styles = null;
        try {
            styles = layer.property("ADBE Layer Styles");
        } catch (err) {
            diag.erroGrupo = err.toString();
            return count;
        }
        if (!styles) return count;

        var encontrados = 0;
        for (var s = styles.numProperties; s >= 1; s--) {
            var style;
            try {
                style = styles.property(s);
            } catch (err) {
                diag.erroAcesso = err.toString();
                continue;
            }
            if (style.matchName === "ADBE Blend Options Group") continue;
            encontrados++;
            try {
                style.remove();
                count++;
            } catch (err) {
                if (!diag.erroRemove) {
                    diag.erroRemove = err.toString();
                    diag.styleNome = style.name;
                    diag.styleMatch = style.matchName;
                }
            }
        }
        diag.encontrados = (diag.encontrados || 0) + encontrados;
        return count;
    }

    var expressionsRemoved = 0;
    var effectsRemoved = 0;
    var stylesRemoved = 0;
    var diag = {};

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

        stylesRemoved += removeLayerStyles(layer, diag);
    }

    app.endUndoGroup();

    // Silencioso quando dá certo. Só avisa se havia layer style e ele resistiu à remoção,
    // para não falhar em silêncio como aconteceu antes.
    if (diag.encontrados > 0 && stylesRemoved === 0) {
        alert(
            "Efeitos e expressões foram limpos, mas os layer styles não puderam ser removidos.\n\n" +
            "[diagnóstico]\n" +
            "Layer styles encontrados: " + diag.encontrados + "\n" +
            "Style: " + (diag.styleNome || "?") + " [" + (diag.styleMatch || "?") + "]\n" +
            "Erro: " + (diag.erroRemove || diag.erroAcesso || diag.erroGrupo || "remove() não lançou erro, mas nada saiu")
        );
    }
})();
