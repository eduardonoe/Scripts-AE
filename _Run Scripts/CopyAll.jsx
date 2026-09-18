// ============================================================
// MOTION TOOLS — SMART COPY ALL
// Varre qualquer tipo de layer e copia tudo o que importar:
// Efeitos, Animadores, Máscaras, Estilos e qualquer propriedade
// que contenha Keyframes ou Expressões.
// ============================================================

(function() {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Abra uma composição primeiro.");
        return;
    }

    var selectedLayers = comp.selectedLayers;
    if (selectedLayers.length !== 1) {
        alert("Por favor, selecione EXATAMENTE 1 layer para copiar os atributos.");
        return;
    }

    var layer = selectedLayers[0];

    app.beginUndoGroup("MotionTools: Smart Copy All");

    // 1. Deseleciona todas as propriedades para evitar copiar lixo
    var selProps = layer.selectedProperties;
    for (var p = 0; p < selProps.length; p++) {
        try { selProps[p].selected = false; } catch(e) {}
    }

    var copiedCount = 0;
    var copiedTypes = {
        efeitos: 0,
        animadores: 0,
        mascaras: 0,
        estilos: 0,
        propriedades: 0 // (Position, Scale, Path, etc com keyframes/expressões)
    };

    // 2. Função recursiva que vasculha a layer inteira
    function scanProperties(propGroup) {
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var child = propGroup.property(i);

            try {
                // A) Copiar grupos inteiros (Efeitos, Textos, Máscaras, Estilos)
                if (propGroup.matchName === "ADBE Effect Parade") {
                    child.selected = true;
                    copiedCount++;
                    copiedTypes.efeitos++;
                    continue; // Pula os filhos pra não dar conflito no Ctrl+C
                }
                if (propGroup.matchName === "ADBE Text Animators") {
                    child.selected = true;
                    copiedCount++;
                    copiedTypes.animadores++;
                    continue;
                }
                if (propGroup.matchName === "ADBE Mask Parade") {
                    child.selected = true;
                    copiedCount++;
                    copiedTypes.mascaras++;
                    continue;
                }
                if (propGroup.matchName === "ADBE Layer Styles" && child.matchName !== "ADBE Blend Options Group") {
                    child.selected = true;
                    copiedCount++;
                    copiedTypes.estilos++;
                    continue;
                }

                // B) Se for uma propriedade final (Position, Path, Slider, etc)
                if (child.propertyType === PropertyType.PROPERTY) {
                    var hasKeys = child.numKeys > 0;
                    var hasExpr = child.canSetExpression && child.expression !== "";

                    // Só seleciona se tiver animação ou expressão
                    if (hasKeys || hasExpr) {
                        child.selected = true;
                        copiedCount++;
                        copiedTypes.propriedades++;
                    }
                }
                // C) Se for uma "pasta" (Transform, Shape Contents, etc), vasculha dentro dela
                else if (child.propertyType === PropertyType.INDEXED_GROUP || child.propertyType === PropertyType.NAMED_GROUP) {
                    scanProperties(child);
                }
            } catch(e) {
                // Ignora erros silenciosos em propriedades ocultas/bloqueadas do AE
            }
        }
    }

    // Dispara a varredura a partir da raiz da layer
    scanProperties(layer);

    // Verifica se encontrou algo útil para copiar
    if (copiedCount === 0) {
        alert("A layer '" + layer.name + "' não possui Efeitos, Máscaras, Animadores, Keyframes ou Expressões para serem copiados.");
        app.endUndoGroup();
        return;
    }

    // 3. Executa o comando nativo de COPIAR (Ctrl+C)
    app.executeCommand(19);

    app.endUndoGroup();

    // 4. Feedback detalhado do que foi para a área de transferência
    var msg = "✔ Cópia realizada com sucesso!\n\n";
    if (copiedTypes.efeitos > 0) msg += "• " + copiedTypes.efeitos + " Efeito(s)\n";
    if (copiedTypes.animadores > 0) msg += "• " + copiedTypes.animadores + " Animador(es) de Texto\n";
    if (copiedTypes.mascaras > 0) msg += "• " + copiedTypes.mascaras + " Máscara(s)\n";
    if (copiedTypes.estilos > 0) msg += "• " + copiedTypes.estilos + " Estilo(s) de Layer\n";
    if (copiedTypes.propriedades > 0) msg += "• " + copiedTypes.propriedades + " Propriedade(s) c/ Keyframes ou Expressões\n";
    msg += "\nAgora selecione a(s) layer(s) de destino e cole (Ctrl+V).";

    alert(msg);
})();