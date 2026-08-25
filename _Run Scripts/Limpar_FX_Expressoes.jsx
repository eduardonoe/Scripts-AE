/*
    LIMPAR EFEITOS, EXPRESSÕES E LAYER STYLES
    After Effects JSX
    Version: 2.0.0

    Remove todos os efeitos e todas as expressões das camadas selecionadas
    e desliga todos os layer styles. 100% silencioso: nenhuma janela.

    Keyframes das propriedades padrão (Transform, texto, shape) são
    preservados — só somem keyframes que estavam dentro de um efeito
    removido.

    POR QUE OS LAYER STYLES SÃO DESLIGADOS E NÃO REMOVIDOS
    O After Effects não expõe a remoção de layer styles para scripts:

    - O grupo "ADBE Layer Styles" é um NAMED_GROUP com 10 slots fixos e
      existe SEMPRE, mesmo em camada sem style aplicado. Chamar remove()
      num slot lança "Can not remove this property, because parent is not
      an INDEXED_GROUP".
    - A remoção real só existe no menu Layer > Layer Styles > Remove All,
      que não pode ser alcançado por app.findMenuCommandId("Remove All"):
      esse nome resolve para o Effect > Remove All (ID 2072).
    - Busca pelo ID do comando foi tentada e descartada. Mapeamento real
      desta instalação: os styles individuais ocupam um bloco contíguo
      (Drop Shadow=9000 … Stroke=9008), "Show All"=3743 e
      "Convert to Editable Styles"=3740 pertencem a outras faixas. 26 IDs
      vizinhos a esses pontos foram testados, nenhum removeu os styles, e
      a sondagem chegou a disparar o aviso do AE de "segundo script em
      execução". Executar IDs desconhecidos não compensa o ganho.

    Desligar produz o MESMO resultado visual (nenhum style renderiza). A
    única diferença é cosmética: o grupo continua listado na timeline.
    Para sumir com ele de vez, use o menu: Layer > Layer Styles > Remove All.

    Selecione os layers e execute o script.

    Changelog:
    - 2.0.0: encerrada a tentativa de remover layer styles por script
      (impossível de forma confiável, ver acima). Comportamento definitivo:
      desligar todos os styles, silenciosamente, sem sondar IDs de menu.
    - 1.4.0: sondagem a partir do bloco 9000 dos styles.
    - 1.3.x: correções na verificação e diagnóstico da sondagem.
    - 1.2.0: tentativa de remoção via comando nativo.
    - 1.1.0: primeira tentativa de remover layer styles (remove() por script).
    - 1.0.1: execução silenciosa, sem alertas.
*/
(function limparFxExpressoes() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) return;

    var layers = comp.selectedLayers;
    if (layers.length === 0) return;

    app.beginUndoGroup("Limpar Efeitos, Expressões e Layer Styles");

    function removeExpressionsRecursive(propGroup) {
        if (!propGroup) return;
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            if (prop.propertyType === PropertyType.PROPERTY) {
                if (prop.canSetExpression && prop.expression !== "") {
                    try { prop.expression = ""; } catch (e) {}
                }
            } else if (
                prop.propertyType === PropertyType.NAMED_GROUP ||
                prop.propertyType === PropertyType.INDEXED_GROUP
            ) {
                removeExpressionsRecursive(prop);
            }
        }
    }

    function removeEffects(layer) {
        try {
            var fx = layer.property("ADBE Effect Parade");
            if (!fx) return;
            for (var e = fx.numProperties; e >= 1; e--) {
                try { fx.property(e).remove(); } catch (err) {}
            }
        } catch (err) {}
    }

    // Tenta remover o grupo inteiro (barato, quase sempre proibido pelo AE) e,
    // não dando, desliga cada style — mesmo resultado visual.
    function limparLayerStyles(layer) {
        var styles;
        try {
            styles = layer.property("ADBE Layer Styles");
        } catch (e) {
            return;
        }
        if (!styles) return;

        try {
            styles.remove();
            return;
        } catch (e) {}

        for (var s = 1; s <= styles.numProperties; s++) {
            try {
                var style = styles.property(s);
                if (style.matchName === "ADBE Blend Options Group") continue;
                if (style.enabled) style.enabled = false;
            } catch (err) {}
        }
    }

    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        removeExpressionsRecursive(layer);
        removeEffects(layer);
        limparLayerStyles(layer);
    }

    app.endUndoGroup();
})();
