/*
    LAYER ORGANIZER
    (alias: Organize Layers)
    After Effects JSX
    Version: 1.1.0

    Reordena as camadas SELECIONADAS pela posição horizontal do início da
    barra (In point) na timeline:
      - a selecionada mais à DIREITA (In point mais tardio) sobe para a
        vaga mais no topo entre as selecionadas;
      - a mais à ESQUERDA (In point mais cedo) desce para a vaga mais no
        fundo entre as selecionadas.
    Camadas com o mesmo In point (sobrepostas no início) mantêm a ordem
    relativa que já tinham entre si (quem estava em cima continua em cima).

    As camadas NÃO selecionadas não se movem — ficam exatamente nas mesmas
    posições absolutas da timeline. Só as vagas ocupadas pelas selecionadas
    são redistribuídas entre elas mesmas.

    SEM NADA SELECIONADO: reorganiza a timeline INTEIRA (todas as camadas do
    comp), no mesmo critério.

    100% silencioso: nenhuma janela, exceto se não houver composição ativa.

    Selecione as camadas que quer reorganizar (ou nenhuma, para reorganizar
    tudo) e execute o script.

    Changelog:
    - 1.2.0: sem seleção, volta a reorganizar a timeline inteira — o
      comportamento "só selecionados" da 1.1.0 vira restrição apenas quando
      há seleção.
    - 1.1.0: restrito às camadas selecionadas (antes reorganizava a
      composição inteira). As demais camadas não são mais tocadas.
    - 1.0.0: versão inicial, reorganizava todas as camadas do comp.
*/
(function layerOrganizer() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Abra a composição que você quer reorganizar.");
        return;
    }

    var n = comp.numLayers;
    if (n <= 1) return;

    var temSelecao = comp.selectedLayers.length > 0;

    // camadas-alvo, na ordem atual de cima para baixo (por índice, não por
    // comp.selectedLayers — cuja ordem não é garantida): todas, se nada
    // estiver selecionado; só as selecionadas, caso contrário
    var selecionados = [];
    for (var i = 1; i <= n; i++) {
        var layer = comp.layer(i);
        if (!temSelecao || layer.selected) {
            selecionados.push({ layer: layer, inPoint: layer.inPoint, indiceOriginal: i });
        }
    }

    if (selecionados.length <= 1) return;

    // ordem final desejada para as vagas selecionadas, da mais no topo para
    // a mais no fundo: In point mais tardio primeiro; empate resolvido pela
    // ordem atual (quem já estava mais no topo continua no topo)
    var ordenados = selecionados.slice(0);
    ordenados.sort(function (a, b) {
        if (a.inPoint !== b.inPoint) return b.inPoint - a.inPoint;
        return a.indiceOriginal - b.indiceOriginal;
    });

    // reconstroi a ordem completa da timeline: camadas fora do alvo (quando
    // há seleção, as não selecionadas) ficam onde estavam; as vagas do alvo
    // recebem os itens já reordenados, na sequência em que essas vagas
    // aparecem de cima pra baixo
    var fullOrder = [];
    var cursor = 0;
    for (var j = 1; j <= n; j++) {
        var lyr = comp.layer(j);
        if (!temSelecao || lyr.selected) {
            fullOrder.push(ordenados[cursor].layer);
            cursor++;
        } else {
            fullOrder.push(lyr);
        }
    }

    app.beginUndoGroup("Layer Organizer");

    // aplica de trás para frente: cada moveToBeginning() empurra os
    // anteriores para baixo, terminando na ordem exata de "fullOrder"
    for (var k = fullOrder.length - 1; k >= 0; k--) {
        try { fullOrder[k].moveToBeginning(); } catch (e) {}
    }

    app.endUndoGroup();
})();
