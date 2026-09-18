(function pulsarCoracao() {
    app.beginUndoGroup("Pulsar Coracao");

    try {
        var comp = app.project.activeItem;

        if (!(comp instanceof CompItem)) {
            throw new Error("Abra uma composicao e selecione pelo menos uma camada.");
        }

        if (comp.selectedLayers.length === 0) {
            throw new Error("Selecione pelo menos uma camada.");
        }

        var expression =
            "bpm = 55;\n" +
            "intensidade = 4;\n" +
            "variacao = 0.035;\n\n" +
            "ciclo = 60 / bpm;\n" +
            "t = (time - inPoint) % ciclo;\n\n" +
            "function pulso(centro, largura, forca){\n" +
            "    return forca * Math.exp(-Math.pow((t - centro) / largura, 2));\n" +
            "}\n\n" +
            "batida =\n" +
            "    pulso(0.12, 0.075, 1.00) +\n" +
            "    pulso(0.34, 0.095, 0.38) -\n" +
            "    pulso(0.55, 0.140, 0.06);\n\n" +
            "organico = 1 + noise(time * 0.25) * variacao;\n" +
            "fator = 1 + (batida * intensidade * organico / 100);\n\n" +
            "value * fator;";

        for (var i = 0; i < comp.selectedLayers.length; i++) {
            var scale = comp.selectedLayers[i]
                .property("ADBE Transform Group")
                .property("ADBE Scale");

            if (scale && scale.canSetExpression) {
                scale.expression = expression;
            }
        }
    } catch (error) {
        alert("Pulsar Coracao: " + error.message);
    } finally {
        app.endUndoGroup();
    }
}());
