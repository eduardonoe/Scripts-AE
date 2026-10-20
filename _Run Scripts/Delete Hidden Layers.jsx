// Delete Hidden Layers.jsx: apaga os layers com o olho desligado na comp ativa
(function () {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { alert("Abra uma comp."); return; }

    app.beginUndoGroup("Delete Hidden Layers");
    var n = 0;
    for (var i = comp.numLayers; i >= 1; i--) {   // de tras pra frente, pra nao pular indices
        var l = comp.layer(i);
        if (!l.enabled) { l.locked = false; l.remove(); n++; }
    }
    app.endUndoGroup();
    alert(n + " layer(s) apagado(s).");
})();
