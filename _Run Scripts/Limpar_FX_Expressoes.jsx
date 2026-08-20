/*
    LIMPAR EFEITOS E EXPRESSÕES
    After Effects JSX
    Version: 1.0.0

    Remove todos os efeitos e todas as expressões das camadas selecionadas,
    de uma só vez, silenciosamente (sem alertas de progresso).

    Selecione os layers e execute o script.
*/
(function limparFxExpressoes() {
    app.beginUndoGroup("Limpar Efeitos e Expressões");

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Abra uma composição e selecione os layers.");
        app.endUndoGroup();
        return;
    }

    var layers = comp.selectedLayers;
    if (layers.length === 0) {
        alert("Selecione as camadas que deseja limpar.");
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

    app.endUndoGroup();

    alert(
        "Limpeza concluída!\n\n" +
        "Camadas processadas: " + layers.length + "\n" +
        "Expressões removidas: " + expressionsRemoved + "\n" +
        "Efeitos removidos: " + effectsRemoved
    );
})();
