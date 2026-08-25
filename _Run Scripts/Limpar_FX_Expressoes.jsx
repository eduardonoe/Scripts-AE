/*
    LIMPAR EFEITOS, EXPRESSÕES E LAYER STYLES
    After Effects JSX
    Version: 1.4.0

    Remove todos os efeitos, todas as expressões e todos os layer styles
    das camadas selecionadas, de uma só vez, 100% silencioso (sem nenhuma
    janela/alerta) quando tudo funciona.

    Keyframes das propriedades padrão (Transform, texto, shape) são
    preservados — só somem keyframes que estavam dentro de um efeito ou
    layer style removido.

    COMO OS LAYER STYLES SÃO REMOVIDOS
    O grupo "Layer Styles" é um NAMED_GROUP com 10 slots fixos, então o AE
    proíbe remove() por script ("parent is not an INDEXED_GROUP"). A única
    remoção real é o comando nativo Layer > Layer Styles > Remove All, que
    não pode ser achado pelo nome porque "Remove All" é exatamente o mesmo
    texto do Effect > Remove All.

    Para resolver, o script descobre o ID do comando assim:
      1. usa o ID já descoberto numa execução anterior (salvo em app.settings);
      2. tenta pelo nome, caso alguma versão resolva corretamente;
      3. sonda poucos IDs vizinhos a comandos que SÓ existem no submenu
         Layer Styles ("Convert to Editable Styles" e "Show All").
    Cada tentativa é verificada e, se não tiver removido os styles, é
    desfeita na hora (Undo). Ao acertar, o ID é salvo e as próximas
    execuções vão direto nele.

    Plano B, se nada funcionar: desliga todos os styles (mesmo resultado
    visual, mas o grupo continua listado) e avisa uma única vez.

    Selecione os layers e execute o script.

    Changelog:
    - 1.4.0: o mapa revelou que os styles individuais formam um bloco
      contíguo em 9000..9008 (Drop Shadow..Stroke), e que "Show All"=3743
      e "Remove All"=2072 pertencem a OUTROS menus — 2072 é o Effect >
      Remove All, origem da ambiguidade. A sondagem passa a partir do fim
      desse bloco (9009+), que é onde o Remove All do submenu deve estar.
    - 1.3.2: aviso de fallback passa a incluir um mapa do submenu Layer
      Styles, obtido só por consulta de nome (sem executar nada), para
      localizar o "Remove All" sem sondagem às cegas.
    - 1.3.1: corrige a verificação da sondagem, que invalidava até o
      comando certo. O grupo "ADBE Layer Styles" existe SEMPRE (10 slots
      fixos), então checar a presença do grupo dava sempre "ainda tem
      style" e o acerto era desfeito pelo Undo. Agora conta os slots com
      .enabled = true, que é o indicador real de style aplicado.
    - 1.3.0: descoberta automática do ID do comando "Remove All" de Layer
      Styles, ancorada em comandos exclusivos daquele submenu, com
      verificação, undo automático em caso de erro e cache do ID.
    - 1.2.0: layer styles passam a ser removidos pelo comando nativo, já
      que remove() por script é proibido nesse grupo.
    - 1.1.1: passa a diagnosticar a falha em vez de engoli-la no try/catch.
    - 1.1.0: remove também os layer styles (Color Overlay, Drop Shadow,
      Stroke, etc.), preservando o Blending Options do grupo.
    - 1.0.1: removido alerta final e alertas de validação (execução silenciosa).
*/
(function limparFxExpressoes() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) return;

    var layers = comp.selectedLayers;
    if (layers.length === 0) return;
    layers = layers.slice(0);

    var UNDO_CMD_ID = 16; // Edit > Undo
    var SETTINGS_SECTION = "LimparFX_Expressoes";
    var SETTINGS_KEY = "layerStylesRemoveAllId";

    // ---------- helpers ----------

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

    // O grupo só existe enquanto houver layer style aplicado na camada.
    function getStylesGroup(layer) {
        try {
            return layer.property("ADBE Layer Styles");
        } catch (e) {
            return null;
        }
    }

    // ATENÇÃO: o grupo "ADBE Layer Styles" existe SEMPRE, com os 10 slots fixos, mesmo em
    // camada sem style nenhum. Então a presença do grupo não diz nada — o que indica style
    // realmente aplicado é o .enabled de cada slot.
    function contarStylesAtivos(layer) {
        var n = 0;
        var styles = getStylesGroup(layer);
        if (!styles) return 0;
        for (var s = 1; s <= styles.numProperties; s++) {
            try {
                var style = styles.property(s);
                if (style.matchName === "ADBE Blend Options Group") continue;
                if (style.enabled) n++;
            } catch (e) {}
        }
        return n;
    }

    function totalStylesAtivos(layerArr) {
        var n = 0;
        for (var i = 0; i < layerArr.length; i++) n += contarStylesAtivos(layerArr[i]);
        return n;
    }

    function selecionar(layerArr) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        for (var j = 0; j < layerArr.length; j++) {
            try { layerArr[j].selected = true; } catch (e) {}
        }
    }

    function getSavedCmdId() {
        try {
            if (app.settings.haveSetting(SETTINGS_SECTION, SETTINGS_KEY)) {
                var v = parseInt(app.settings.getSetting(SETTINGS_SECTION, SETTINGS_KEY), 10);
                if (!isNaN(v) && v > 0) return v;
            }
        } catch (e) {}
        return 0;
    }

    function saveCmdId(id) {
        try { app.settings.saveSetting(SETTINGS_SECTION, SETTINGS_KEY, String(id)); } catch (e) {}
    }

    // Executa um ID candidato e confirma pelo resultado. Se não removeu os
    // styles, desfaz na hora — assim um comando errado não deixa rastro.
    function executarEVerificar(cmdId, alvos) {
        if (!cmdId) return false;
        if (totalStylesAtivos(alvos) === 0) return true;

        try {
            app.executeCommand(cmdId);
        } catch (e) {
            return false;
        }

        if (totalStylesAtivos(alvos) === 0) return true;

        try { app.executeCommand(UNDO_CMD_ID); } catch (e) {}
        return false;
    }

    function removerLayerStyles(alvos, diag) {
        // 1) ID já descoberto antes
        var salvo = getSavedCmdId();
        if (salvo && executarEVerificar(salvo, alvos)) return true;

        // 2) pelo nome (algumas versões podem resolver certo)
        var nomes = ["Remove All", "Remover tudo", "Remover Tudo"];
        for (var n = 0; n < nomes.length; n++) {
            var porNome = app.findMenuCommandId(nomes[n]);
            if (porNome && executarEVerificar(porNome, alvos)) {
                saveCmdId(porNome);
                return true;
            }
        }

        var jaTestados = {};

        function tentar(candidato) {
            if (!candidato || candidato <= 0 || jaTestados[candidato]) return false;
            jaTestados[candidato] = true;
            diag.candidatosTestados++;
            if (executarEVerificar(candidato, alvos)) {
                saveCmdId(candidato);
                return true;
            }
            return false;
        }

        // 3) sondagem ancorada no BLOCO dos styles individuais.
        //    Mapeado na prática: Drop Shadow=9000 ... Stroke=9008, um bloco contíguo.
        //    O "Remove All" do submenu fica logo em seguida (9009/9010), não perto do
        //    "Show All"=3743, que na verdade pertence a outro menu.
        var estilos = [
            "Drop Shadow", "Inner Shadow", "Outer Glow", "Inner Glow",
            "Bevel and Emboss", "Satin", "Color Overlay", "Gradient Overlay", "Stroke"
        ];
        var min = 0, max = 0;
        for (var s = 0; s < estilos.length; s++) {
            var id = app.findMenuCommandId(estilos[s]);
            if (!id) continue;
            if (!min || id < min) min = id;
            if (id > max) max = id;
        }
        if (max) {
            diag.ancorasAchadas.push("bloco styles=" + min + ".." + max);
            var aposBloco = [max + 1, max + 2, max + 3, max + 4, min - 1, min - 2];
            for (var b = 0; b < aposBloco.length; b++) {
                if (tentar(aposBloco[b])) return true;
            }
        }

        // 4) por último, a vizinhança do submenu "Layer Styles" / "Convert to Editable Styles"
        var ancoras = ["Layer Styles", "Convert to Editable Styles", "Converter em Estilos Editáveis"];
        var offsets = [1, 2, 3, 4, 5, -1, -2];
        for (var a = 0; a < ancoras.length; a++) {
            var base = app.findMenuCommandId(ancoras[a]);
            if (!base) continue;
            diag.ancorasAchadas.push(ancoras[a] + "=" + base);
            for (var o = 0; o < offsets.length; o++) {
                if (tentar(base + offsets[o])) return true;
            }
        }

        return false;
    }

    // Só CONSULTA os IDs pelo nome (não executa nada) para mapear onde fica o submenu
    // Layer Styles. Vários desses nomes são exclusivos desse submenu, então o mapa revela
    // a vizinhança exata do "Remove All" sem precisar sondar às cegas.
    function mapearSubmenuLayerStyles() {
        var nomes = [
            "Drop Shadow", "Inner Shadow", "Outer Glow", "Inner Glow",
            "Bevel and Emboss", "Satin", "Color Overlay", "Gradient Overlay", "Stroke",
            "Show All", "Remove All", "Convert to Editable Styles", "Layer Styles"
        ];
        var linhas = [];
        for (var i = 0; i < nomes.length; i++) {
            var id = 0;
            try { id = app.findMenuCommandId(nomes[i]); } catch (e) {}
            linhas.push(nomes[i] + " = " + (id ? id : "-"));
        }
        return linhas.join("\n");
    }

    // Plano B: desliga cada style (o grupo continua listado, mas nada renderiza).
    function desligarStyles(layer) {
        var n = 0;
        var styles = getStylesGroup(layer);
        if (!styles) return n;
        for (var s = 1; s <= styles.numProperties; s++) {
            try {
                var style = styles.property(s);
                if (style.matchName === "ADBE Blend Options Group") continue;
                if (style.enabled) {
                    style.enabled = false;
                    n++;
                }
            } catch (e) {}
        }
        return n;
    }

    // ---------- 1) efeitos e expressões ----------

    app.beginUndoGroup("Limpar Efeitos e Expressões");

    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];

        removeExpressionsRecursive(layer);

        try {
            var fx = layer.property("ADBE Effect Parade");
            if (fx) {
                for (var e = fx.numProperties; e >= 1; e--) {
                    try { fx.property(e).remove(); } catch (err) {}
                }
            }
        } catch (err) {}
    }

    app.endUndoGroup();

    // ---------- 2) layer styles ----------
    // Fora de undo group próprio: a sondagem precisa poder chamar Undo.

    var comStyles = [];
    for (var i = 0; i < layers.length; i++) {
        if (contarStylesAtivos(layers[i]) > 0) comStyles.push(layers[i]);
    }

    var stylesRemovidos = false;
    var desligadosFallback = 0;
    var diag = { ancorasAchadas: [], candidatosTestados: 0 };

    if (comStyles.length > 0) {
        selecionar(comStyles);
        stylesRemovidos = removerLayerStyles(comStyles, diag);

        if (!stylesRemovidos) {
            app.beginUndoGroup("Desligar Layer Styles");
            for (var c = 0; c < comStyles.length; c++) {
                desligadosFallback += desligarStyles(comStyles[c]);
            }
            app.endUndoGroup();
        }

        selecionar(layers);
    }

    // Silencioso quando a remoção real acontece. Só avisa se caiu no plano B.
    if (comStyles.length > 0 && !stylesRemovidos) {
        alert(
            "Efeitos e expressões limpos.\n\n" +
            "Não foi possível localizar o comando nativo de remoção dos layer styles nesta " +
            "versão do After Effects.\n\n" +
            "Como alternativa, todos os styles foram DESLIGADOS: " + desligadosFallback + " style(s) " +
            "em " + comStyles.length + " camada(s). Nada deles renderiza mais, mas o grupo " +
            "continua listado na timeline.\n\n" +
            "[diagnóstico]\n" +
            "Âncoras encontradas: " + (diag.ancorasAchadas.length ? diag.ancorasAchadas.join(", ") : "nenhuma") + "\n" +
            "IDs testados: " + diag.candidatosTestados + "\n\n" +
            "[mapa do submenu Layer Styles]\n" + mapearSubmenuLayerStyles()
        );
    }
})();
