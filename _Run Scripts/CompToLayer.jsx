(function fitCompToSelectedLayersAdvanced() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Por favor, selecione ou abra uma composição primeiro.");
        return;
    }

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length === 0) {
        alert("Por favor, selecione pelo menos uma camada.");
        return;
    }

    app.beginUndoGroup("Fit Comp to Layers (Expand/Crop)");

    var minIn = Infinity;
    var maxOut = -Infinity;
    var layersToExpandOut = [];
    var layersToExpandIn = [];

    // 1. Descobre os limites reais das camadas selecionadas
    for (var i = 0; i < selectedLayers.length; i++) {
        var layer = selectedLayers[i];
        var lIn = layer.inPoint;
        var lOut = layer.outPoint;

        // Se a camada tiver uma "fonte" (vídeo, áudio, precomp, sólido), checamos seu tamanho real
        if (layer.source != null) {
            var stretchRatio = Math.abs(layer.stretch) / 100;
            var sourceEnd = layer.startTime + (layer.source.duration * stretchRatio);

            // Se o final da mídia for maior que a comp atual e estava sendo cortado, marcamos para expandir
            if (sourceEnd > lOut && Math.abs(lOut - comp.duration) <= 0.05) {
                lOut = sourceEnd;
                layersToExpandOut.push(layer);
            }

            // Se o início da mídia foi arrastado para trás do tempo 0, marcamos para revelar
            if (layer.startTime < lIn && Math.abs(lIn - comp.displayStartTime) <= 0.05) {
                lIn = layer.startTime;
                layersToExpandIn.push(layer);
            }
        }

        if (lIn < minIn) minIn = lIn;
        if (lOut > maxOut) maxOut = lOut;
    }

    var newDuration = maxOut - minIn;
    if (newDuration <= 0) {
        alert("Duração inválida detectada.");
        app.endUndoGroup();
        return;
    }

    // Calcula o quanto precisamos empurrar todas as camadas para que a seleção comece no tempo zero
    var shiftAmount = comp.displayStartTime - minIn;

    // 2. Aumenta a duração da comp temporariamente para evitar que algo seja deletado ao mover
    comp.duration = Math.max(comp.duration, newDuration + Math.abs(shiftAmount));

    // 3. Move TODAS as camadas da composição para manter a sincronia
    if (shiftAmount !== 0) {
        for (var j = 1; j <= comp.numLayers; j++) {
            var currentLayer = comp.layer(j);
            // Desbloqueia a camada temporariamente se ela estiver trancada com cadeado
            var isLocked = currentLayer.locked;
            if (isLocked) currentLayer.locked = false;

            currentLayer.startTime += shiftAmount;

            if (isLocked) currentLayer.locked = true;
        }
    }

    // 4. Crava a duração da composição no tamanho exato calculado
    comp.duration = newDuration;

    // 5. Estica as "pontas" das camadas que antes estavam limitadas pela parede da composição
    for (var k = 0; k < layersToExpandOut.length; k++) {
        var extLayer = layersToExpandOut[k];
        var sRatio = Math.abs(extLayer.stretch) / 100;
        extLayer.outPoint = extLayer.startTime + (extLayer.source.duration * sRatio);
    }

    for (var m = 0; m < layersToExpandIn.length; m++) {
        var incLayer = layersToExpandIn[m];
        incLayer.inPoint = incLayer.startTime;
    }

    // 6. Ajusta a Work Area para abraçar tudo perfeitamente
    comp.workAreaStart = comp.displayStartTime;
    comp.workAreaDuration = comp.duration;

    app.endUndoGroup();
})();