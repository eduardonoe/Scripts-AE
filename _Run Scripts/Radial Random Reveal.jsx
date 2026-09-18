(function radialRandomReveal() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) return;

    var selected = comp.selectedLayers;
    if (!selected || selected.length < 2) return;

    app.beginUndoGroup("Radial Random Reveal");

    var centerX = comp.width / 2;
    var centerY = comp.height / 2;
    var frameDuration = comp.frameDuration;
    var firstTime = comp.time;
    var maxTilt = 6;
    var radialDisorder = 0.20;
    var items = [];
    var selectedMap = {};
    var topIndex = comp.numLayers + 1;

    for (var i = 0; i < selected.length; i++) {
        var layer = selected[i];
        selectedMap[layer.index] = true;
        if (layer.index < topIndex) topIndex = layer.index;

        var transform = layer.property("ADBE Transform Group");
        var positionProp = transform.property("ADBE Position");
        var position = positionProp.value;

        var dx = (position[0] - centerX) / Math.max(1, centerX);
        var dy = (position[1] - centerY) / Math.max(1, centerY);
        var radius = Math.sqrt(dx * dx + dy * dy);

        items.push({
            layer: layer,
            radius: radius,
            score: radius + (Math.random() * 2 - 1) * radialDisorder,
            tie: Math.random(),
            wasLocked: layer.locked
        });
    }

    // Maior distancia do centro aparece primeiro.
    // O score com ruido cria aneis radiais menos organizados.
    items.sort(function (a, b) {
        if (Math.abs(a.score - b.score) < 0.000001) {
            return a.tie - b.tie;
        }
        return b.score - a.score;
    });

    // Rotacao leve e entrada de um frame por layer.
    for (i = 0; i < items.length; i++) {
        var item = items[i];
        layer = item.layer;
        layer.locked = false;

        transform = layer.property("ADBE Transform Group");
        var rotationProp = transform.property("ADBE Rotate Z");

        if (rotationProp &&
            rotationProp.numKeys === 0 &&
            !rotationProp.expressionEnabled) {
            var angle = (Math.random() * 2 - 1) * maxTilt;

            // Evita inclinacoes quase imperceptiveis repetidas.
            if (Math.abs(angle) < 0.7) {
                angle = angle < 0 ? -0.7 : 0.7;
            }

            rotationProp.setValue(angle);
        }

        var revealTime = firstTime + i * frameDuration;
        var maximumIn = Math.max(layer.inPoint, layer.outPoint - frameDuration);

        if (revealTime < layer.outPoint) {
            layer.inPoint = revealTime;
        } else if (maximumIn < layer.outPoint) {
            layer.inPoint = maximumIn;
        }
    }

    // Mantem o bloco das layers selecionadas no mesmo setor da timeline.
    // A ordem de pilha fica inversa a ordem de surgimento:
    // bordas embaixo, centro por cima.
    var boundaryAbove = null;
    for (i = topIndex - 1; i >= 1; i--) {
        if (!selectedMap[i]) {
            boundaryAbove = comp.layer(i);
            break;
        }
    }

    var previous = boundaryAbove;

    // Ordem visual de cima para baixo: ultimo a surgir ate o primeiro.
    for (i = items.length - 1; i >= 0; i--) {
        layer = items[i].layer;

        if (previous) {
            layer.moveAfter(previous);
        } else if (i === items.length - 1) {
            layer.moveToBeginning();
        } else {
            layer.moveAfter(previous);
        }

        previous = layer;
    }

    for (i = 0; i < items.length; i++) {
        items[i].layer.locked = items[i].wasLocked;
    }

    app.endUndoGroup();
})();
