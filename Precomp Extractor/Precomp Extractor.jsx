// Precomp Extractor.jsx
// Traz todos os layers de uma precomp selecionada (e das precomps aninhadas dentro dela)
// para a comp atual, respeitando a ordem original (topo -> base).
// Uso: selecione uma ou mais camadas de precomp na comp ativa e rode o script.

(function precompExtractor() {

    function findCmdId(name) {
        var id = app.findMenuCommandId(name);
        if (!id) throw new Error("Comando de menu não encontrado: " + name);
        return id;
    }

    var CMD_COPY = findCmdId("Copy");
    var CMD_PASTE = findCmdId("Paste");
    var CMD_CLOSE = findCmdId("Close");

    // Expande recursivamente um layer de precomp na sua própria comp (in-place).
    // Copia todos os layers da comp fonte e cola acima do layer de precomp,
    // depois remove o layer de precomp original.
    function flattenLayer(layer, comp) {
        if (!(layer instanceof AVLayer) || !layer.source || !(layer.source instanceof CompItem)) {
            return;
        }

        var source = layer.source;

        // Abre a comp fonte, seleciona todos os layers e copia
        source.openInViewer();
        for (var i = 1; i <= source.numLayers; i++) {
            source.layer(i).selected = true;
        }
        var hasLayers = source.numLayers > 0;
        if (hasLayers) {
            app.executeCommand(CMD_COPY);
        }

        // Fecha a aba da comp fonte assim que terminou de copiar dela
        app.executeCommand(CMD_CLOSE);

        if (!hasLayers) {
            layer.remove();
            return;
        }

        // Volta para a comp destino, seleciona só o layer-âncora e cola
        comp.openInViewer();
        for (var j = 1; j <= comp.numLayers; j++) {
            comp.layer(j).selected = false;
        }
        layer.selected = true;
        app.executeCommand(CMD_PASTE);

        var pasted = comp.selectedLayers.slice(); // layers recém-colados, ordem preservada

        layer.remove();

        // Recorre nos layers colados, caso alguns também sejam precomps
        for (var k = 0; k < pasted.length; k++) {
            flattenLayer(pasted[k], comp);
        }
    }

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Selecione uma composição ativa.");
        return;
    }

    var selected = comp.selectedLayers.slice();
    if (selected.length === 0) {
        alert("Selecione uma ou mais camadas de precomp na composição ativa.");
        return;
    }

    app.beginUndoGroup("Precomp Extractor");
    try {
        for (var i = 0; i < selected.length; i++) {
            flattenLayer(selected[i], comp);
        }
    } finally {
        app.endUndoGroup();
    }

    comp.openInViewer();

})();
