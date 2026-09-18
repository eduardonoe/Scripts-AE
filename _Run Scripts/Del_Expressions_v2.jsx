(function() {
    var comp = app.project.activeItem;

    if (!comp || !(comp instanceof CompItem)) {
        alert("Selecione ou abra uma composição primeiro.");
        return;
    }

    var selLayers = comp.selectedLayers;

    if (selLayers.length === 0) {
        alert("Selecione pelo menos uma camada.");
        return;
    }

    var totalExpressions = 0;
    var layersAffected = 0;

    function removeExpressionsRecursive(propGroup) {
        var count = 0;
        if (propGroup !== null) {
            for (var i = 1; i <= propGroup.numProperties; i++) {
                var prop = propGroup.property(i);
                if (prop.propertyType === PropertyType.PROPERTY) {
                    if (prop.canSetExpression && prop.expression !== "") {
                        prop.expression = "";
                        count++;
                    }
                } else if (
                    prop.propertyType === PropertyType.NAMED_GROUP ||
                    prop.propertyType === PropertyType.INDEXED_GROUP
                ) {
                    count += removeExpressionsRecursive(prop);
                }
            }
        }
        return count;
    }

    app.beginUndoGroup("Remover Expressões");

    for (var i = 0; i < selLayers.length; i++) {
        var removed = removeExpressionsRecursive(selLayers[i]);
        if (removed > 0) {
            layersAffected++;
            totalExpressions += removed;
        }
    }

    app.endUndoGroup();

    if (totalExpressions === 0) {
        alert("Nenhuma expressão encontrada nas camadas selecionadas.");
    } else {
        alert(
            "Expressões removidas com sucesso!\n\n" +
            "Camadas afetadas: " + layersAffected + " de " + selLayers.length + " selecionada(s)\n" +
            "Expressões deletadas: " + totalExpressions
        );
    }
})();
