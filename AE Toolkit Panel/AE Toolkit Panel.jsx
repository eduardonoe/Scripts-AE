/*
    AE TOOLKIT PANEL
    After Effects JSX (ScriptUI Panel)
    Version: 1.0.1

    Painel único com um conjunto de ferramentas do dia a dia, centralizando
    scripts que antes eram avulsos. Tudo nesse arquivo é autocontido —
    nenhum botão chama outro .jsx externo.

    Pode ser executado como script comum (abre uma janela flutuante) ou
    instalado em Scripts/ScriptUI Panels para abrir como painel encaixável
    (Window > nome do arquivo). Instalação automatizada via
    Install_AE_Toolkit_Panel_ScriptUI.bat, na mesma pasta deste arquivo.

    GRUPOS
      Project    : Tidy (organiza o Project Panel em _Comps/_PreComps,
                   Assets/Audio-Images-AI-PSD-Footage, Solids — só cria
                   pastas para tipos de arquivo realmente presentes no
                   projeto), Edit Structure (editor das categorias do Tidy),
                   Reduce Project, Remove Unused Footage
      Cleanup    : Clear Expressions, Reset Layer (efeitos/expressões/layer
                   styles removidos, Transform volta aos padrões)
      Time Remap : Hold Time Remap (cria hold no CTI e apaga o último
                   keyframe), Hold Keyframe (converte qualquer keyframe
                   selecionado, em qualquer propriedade, em hold)
      Curves     : Copy Curve, Paste Curve (interpolação/ease dos keyframes)
      Layers     : Layer Normalize, Split Shapes (shape layer existente:
                   ordem de criação invertida — mais antigo por último;
                   PSD/vetor convertido: ordem espacial, linhas de baixo
                   pra cima e direita pra esquerda dentro da linha),
                   Precomp Extractor (com checkbox "Extract nested precomps
                   too" — desmarcado, desempacota só o primeiro nível),
                   Layer Organizer

    Este arquivo cresce com o tempo — novos botões entram nos grupos
    existentes ou em grupos novos, mantendo o mesmo padrão.

    Changelog:
    - 1.0.1: Tidy deixava itens mal organizados sem correção quando já
      estavam dentro de uma das pastas que ele mesmo administra (ex.: um
      vídeo dentro de "_PreComps", que deveria conter só comps, ficava
      preso lá pra sempre porque a regra "não mexe em item já organizado"
      também protegia itens fora de lugar dentro das próprias pastas do
      Tidy) — corrigido: qualquer item já dentro de uma pasta gerenciada
      pelo Tidy é reauditado e corrigido se estiver na categoria errada;
      pastas criadas à mão pelo usuário em outro lugar do projeto continuam
      intocadas. Além disso, novo checkbox "Reorganize entire project" no
      grupo Project: desligado (padrão) mantém esse comportamento
      conservador; ligado, reclassifica TODO item do projeto, não importa
      a profundidade/pasta atual, e apaga qualquer pasta que fique vazia
      depois — útil pra achatar de vez um projeto legado bagunçado (ex.:
      pastas soltas com estrutura de .aep importado, sem valor de manter).
*/
(function (thisObj) {

    // ============================================================
    // ESTADO COMPARTILHADO (clipboard de curva em memória, não em arquivo)
    // ============================================================
    var easyCurveClipboard = null;
    var precompExtractorRecursivo = true; // checkbox "Extract nested precomps" na UI
    var tidyVarrerProjetoInteiro = false; // checkbox "Reorganize entire project" na UI
    var TOOLKIT_VERSION = "1.0.1"; // mantido em sincronia com o "Version:" do cabeçalho

    // ============================================================
    // HELPERS GERAIS
    // ============================================================

    function comp() {
        return app.project.activeItem instanceof CompItem ? app.project.activeItem : null;
    }

    function ehGrupo(p) {
        return p.propertyType === PropertyType.NAMED_GROUP ||
               p.propertyType === PropertyType.INDEXED_GROUP;
    }

    function acharComando(nomes) {
        for (var i = 0; i < nomes.length; i++) {
            var id = app.findMenuCommandId(nomes[i]);
            if (id) return id;
        }
        return 0;
    }

    function selecionarApenas(c, layer) {
        for (var i = 1; i <= c.numLayers; i++) c.layer(i).selected = false;
        layer.selected = true;
    }

    // ============================================================
    // PROJETO — Declutter (organiza o Project Panel em pastas por tipo,
    // com estrutura de categorias editável, por extensão de arquivo)
    // ============================================================

    var DECLUTTER_SETTINGS_SECTION = "AEToolkit_Declutter";
    var DECLUTTER_SETTINGS_KEY = "categorias";

    // Estrutura padrão replica o layout do Declutter original:
    //   _Comps            (comps que não são usadas como fonte em nenhuma outra comp)
    //     _PreComps       (comps usadas como camada dentro de outra comp)
    //   Assets
    //     Audio / Images / AI / PSD / Footage
    //   Solids            (fora de Assets, como no original)
    // "pasta" indica a pasta-mãe (nome, sempre na raiz); ausente = raiz.
    // "especial" identifica categorias com classificação própria (comps e
    // solids), independente do nome que o usuário der a elas no editor.
    function categoriasPadrao() {
        return [
            { nome: "_Comps", exts: [], especial: "comps_top" },
            { nome: "_PreComps", exts: [], especial: "comps_pre", pasta: "_Comps" },
            { nome: "Solids", exts: [], especial: "solids" },
            { nome: "Audio", exts: ["mp3", "wav", "aac", "m4a", "aif", "aiff"], pasta: "Assets" },
            { nome: "Images", exts: ["jpg", "jpeg", "png", "tif", "tiff", "svg", "eps", "gif", "webp"], pasta: "Assets" },
            { nome: "AI", exts: ["ai"], pasta: "Assets" },
            { nome: "PSD", exts: ["psd"], pasta: "Assets" },
            { nome: "Footage", exts: ["mp4", "mov", "avi", "mxf", "mkv", "webm", "prores", "m4v"], pasta: "Assets" }
        ];
    }

    // Reconhece se as categorias salvas já são do formato atual (com
    // _Comps/_PreComps). Configurações de versões antigas (categoria única
    // "Comps") são substituídas pela estrutura padrão nova automaticamente.
    function categoriasEmFormatoAtual(data) {
        for (var i = 0; i < data.length; i++) {
            if (data[i].especial === "comps_pre") return true;
        }
        return false;
    }

    function carregarCategorias() {
        try {
            if (app.settings.haveSetting(DECLUTTER_SETTINGS_SECTION, DECLUTTER_SETTINGS_KEY)) {
                var raw = app.settings.getSetting(DECLUTTER_SETTINGS_SECTION, DECLUTTER_SETTINGS_KEY);
                var data = eval("(" + raw + ")");
                if (data && data.length > 0 && categoriasEmFormatoAtual(data)) return data;
            }
        } catch (e) {}
        return categoriasPadrao();
    }

    function salvarCategorias(categorias) {
        try {
            app.settings.saveSetting(DECLUTTER_SETTINGS_SECTION, DECLUTTER_SETTINGS_KEY, categorias.toSource());
        } catch (e) {}
    }

    function acharOuCriarPastaEm(nome, parentFolder) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.parentFolder === parentFolder && it.name === nome) {
                return it;
            }
        }
        var novo = app.project.items.addFolder(nome);
        novo.parentFolder = parentFolder;
        return novo;
    }

    // pastaPaiNome, quando presente, é criada/encontrada na raiz primeiro.
    function acharOuCriarPasta(nome, pastaPaiNome) {
        var parent = app.project.rootFolder;
        if (pastaPaiNome) parent = acharOuCriarPastaEm(pastaPaiNome, app.project.rootFolder);
        return acharOuCriarPastaEm(nome, parent);
    }

    function extensaoDoItem(item) {
        try {
            var src = item.mainSource;
            if (src && src.file) {
                var nome = src.file.name;
                var pontoIdx = nome.lastIndexOf(".");
                if (pontoIdx >= 0) return nome.substring(pontoIdx + 1).toLowerCase();
            }
        } catch (e) {}
        return null;
    }

    function acharCategoriaEspecial(categorias, tipo) {
        for (var i = 0; i < categorias.length; i++) {
            if (categorias[i].especial === tipo) return categorias[i];
        }
        return null;
    }

    // Uma comp é "precomp" se aparecer como fonte de alguma camada em
    // qualquer outra comp do projeto; senão é uma comp "de saída" (solta).
    function usadaComoPrecomp(compItem) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && it !== compItem) {
                for (var L = 1; L <= it.numLayers; L++) {
                    try {
                        if (it.layer(L).source === compItem) return true;
                    } catch (e) {}
                }
            }
        }
        return false;
    }

    // Retorna a categoria (objeto {nome, pasta, ...}) deste item, ou null se
    // ele deve ficar de fora (pastas, ou nenhuma categoria bate).
    function categoriaDoItem(item, categorias) {
        if (item instanceof FolderItem) return null;

        if (item instanceof CompItem) {
            var tipo = usadaComoPrecomp(item) ? "comps_pre" : "comps_top";
            return acharCategoriaEspecial(categorias, tipo);
        }

        if (item instanceof FootageItem) {
            var mainSource;
            try { mainSource = item.mainSource; } catch (e) { mainSource = null; }

            if (mainSource instanceof SolidSource) {
                return acharCategoriaEspecial(categorias, "solids");
            }

            var ext = extensaoDoItem(item);
            if (ext) {
                for (var i = 0; i < categorias.length; i++) {
                    var exts = categorias[i].exts;
                    for (var e = 0; e < exts.length; e++) {
                        if (exts[e].toLowerCase() === ext) return categorias[i];
                    }
                }
            }

            // sem extensão reconhecida: usa vídeo/áudio como fallback
            var somenteAudio = false;
            try { somenteAudio = item.hasAudio && !item.hasVideo; } catch (e2) {}
            if (somenteAudio) {
                for (var a = 0; a < categorias.length; a++) {
                    if (categorias[a].nome === "Audio") return categorias[a];
                }
            }
            for (var f = 0; f < categorias.length; f++) {
                if (categorias[f].nome === "Footage") return categorias[f];
            }
        }

        return { nome: "Others" };
    }

    function acharPastaExistente(nome, pastaPaiNome) {
        var parent = app.project.rootFolder;
        if (pastaPaiNome) {
            var pai = null;
            for (var i = 1; i <= app.project.numItems; i++) {
                var it = app.project.item(i);
                if (it instanceof FolderItem && it.parentFolder === app.project.rootFolder && it.name === pastaPaiNome) {
                    pai = it;
                    break;
                }
            }
            if (!pai) return null;
            parent = pai;
        }
        for (var j = 1; j <= app.project.numItems; j++) {
            var it2 = app.project.item(j);
            if (it2 instanceof FolderItem && it2.parentFolder === parent && it2.name === nome) return it2;
        }
        return null;
    }

    // Pastas (já existentes) que o Tidy administra: as categorias
    // configuradas + "Others". Usado para permitir corrigir um item que
    // esteja numa dessas pastas mas na categoria ERRADA (ex.: um vídeo
    // dentro de "_PreComps" por engano/versão antiga) sem mexer em pastas
    // que o usuário criou por conta própria em outro lugar do projeto.
    function pastasGerenciadasPeloTidy(categorias) {
        var pastas = [];
        for (var i = 0; i < categorias.length; i++) {
            var f = acharPastaExistente(categorias[i].nome, categorias[i].pasta);
            if (f) pastas.push(f);
        }
        var others = acharPastaExistente("Others", null);
        if (others) pastas.push(others);
        return pastas;
    }

    function estaEmPastaGerenciada(item, pastasGerenciadas) {
        for (var i = 0; i < pastasGerenciadas.length; i++) {
            if (item.parentFolder === pastasGerenciadas[i]) return true;
        }
        return false;
    }

    // Apaga pastas de categoria que ficaram sem nenhum item — cobre tanto
    // categorias sem arquivo daquele tipo no projeto quanto pastas vazias
    // deixadas por uma execução anterior com arquivos que já foram
    // removidos/movidos. Duas passadas: a segunda pega containers (Assets,
    // _Comps) que só esvaziam depois que suas subpastas somem na primeira.
    // varrerTudo=true (opção "Reorganize entire project"): remove QUALQUER
    // pasta que fique vazia no projeto, não só as de nome conhecido — é o
    // que faz sobras antigas (ex.: uma pasta "Nome do Projeto.aep" que só
    // continha bagunça já redistribuída) desaparecerem sozinhas.
    function removerPastasVaziasDeCategorias(categorias, varrerTudo) {
        // "Precomps"/"Comps" (sem underscore): nomes usados por versões
        // antigas do Tidy, antes da estrutura aninhada atual. Ficam vazias
        // depois que as comps saem de lá, e são removidas junto.
        var nomes = { "Others": true, "Precomps": true, "Comps": true };
        for (var i = 0; i < categorias.length; i++) {
            nomes[categorias[i].nome] = true;
            if (categorias[i].pasta) nomes[categorias[i].pasta] = true;
        }

        for (var pass = 0; pass < 3; pass++) {
            for (var idx = app.project.numItems; idx >= 1; idx--) {
                var it = app.project.item(idx);
                if (it instanceof FolderItem && it.numItems === 0 && (varrerTudo || nomes[it.name])) {
                    try { it.remove(); } catch (e) {}
                }
            }
        }
    }

    function declutter() {
        var categorias = carregarCategorias();

        app.beginUndoGroup("Tidy");
        try {
            var pastas = {};
            var falhas = 0;

            // Junta os itens num array ANTES de mover qualquer um: mover um
            // item para dentro de uma pasta muda a ordem/índice de exibição
            // dos itens seguintes no Project Panel (app.project.item(i) é
            // por ORDEM DE EXIBIÇÃO, não por ID estável de criação). Iterar
            // por índice enquanto move itens faz pular ou reprocessar itens
            // no meio do caminho — era a causa de arquivos ficarem de fora
            // aparentemente ao acaso. Referências de objeto no array não são
            // afetadas por essa reordenação.
            var itens = [];
            var total = app.project.numItems;
            for (var t = 1; t <= total; t++) itens.push(app.project.item(t));

            // Pastas gerenciadas pelo Tidy, calculadas ANTES de mover
            // qualquer item — permite reauditar itens que já estão dentro
            // delas (mesmo na categoria errada) sem tocar em pastas que o
            // usuário criou por conta própria em outro lugar do projeto.
            var pastasGerenciadas = pastasGerenciadasPeloTidy(categorias);

            var varrerTudo = tidyVarrerProjetoInteiro;

            for (var i = 0; i < itens.length; i++) {
                try {
                    var item = itens[i];
                    // Comps são sempre reclassificadas (mesmo já estando em
                    // alguma pasta) porque "precomp ou não" pode mudar de uma
                    // execução pra outra. Com "Reorganize entire project"
                    // ligado, TODO item é reclassificado não importa onde
                    // esteja. Sem isso, os demais tipos só são tocados se
                    // ainda estiverem soltos na raiz OU já dentro de uma
                    // pasta que o próprio Tidy administra (ex.: um vídeo que
                    // ficou dentro de "_PreComps" por engano/versão antiga é
                    // corrigido; um item numa pasta criada à mão pelo
                    // usuário em outro lugar do projeto não é mexido).
                    if (!varrerTudo) {
                        var jaOrganizado = item.parentFolder !== app.project.rootFolder;
                        var emPastaGerenciada = jaOrganizado && estaEmPastaGerenciada(item, pastasGerenciadas);
                        if (jaOrganizado && !(item instanceof CompItem) && !emPastaGerenciada) continue;
                    }

                    var categoria = categoriaDoItem(item, categorias);
                    if (!categoria) continue;

                    var chave = (categoria.pasta ? categoria.pasta + "/" : "") + categoria.nome;
                    if (!pastas[chave]) pastas[chave] = acharOuCriarPasta(categoria.nome, categoria.pasta);
                    if (item.parentFolder !== pastas[chave]) item.parentFolder = pastas[chave];
                } catch (itemErr) {
                    // um item problemático (offline, corrompido, etc.) não pode
                    // travar a organização do resto do projeto
                    falhas++;
                }
            }
            removerPastasVaziasDeCategorias(categorias, varrerTudo);
            if (falhas > 0) {
                alert("Tidy: " + falhas + " item(s) could not be organized (left where they were).");
            }
        } catch (e) {
            alert("Tidy — error: " + e.toString());
        } finally {
            app.endUndoGroup();
        }
    }

    // --- editor da estrutura de pastas (nome + extensões por categoria) ---
    function editarEstruturaDeclutter() {
        var categorias = carregarCategorias();

        var dlg = new Window("dialog", "Edit Folder Structure");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 6;
        dlg.margins = 12;

        dlg.add("statictext", undefined,
            "Each row becomes a folder. Special rows (Comps/PreComps/Solids) have no extension.\n" +
            "For the others, list extensions separated by commas (e.g.: mp4, mov, mxf).");

        var linhasGroup = dlg.add("group");
        linhasGroup.orientation = "column";
        linhasGroup.alignChildren = ["fill", "top"];
        linhasGroup.spacing = 3;

        var linhas = []; // { row, nomeField, extField, original }

        function addLinha(nome, exts, original) {
            var especial = !!(original && original.especial);
            var row = linhasGroup.add("group");
            row.orientation = "row";
            row.alignChildren = ["fill", "center"];

            var nomeField = row.add("edittext", undefined, nome);
            nomeField.characters = 12;

            var extField = row.add("edittext", undefined, exts.join(", "));
            extField.characters = 30;
            extField.enabled = !especial;

            var btnRemover = row.add("button", undefined, "✕");
            btnRemover.preferredSize = [24, 22];
            btnRemover.onClick = function () {
                linhasGroup.remove(row);
                for (var li = 0; li < linhas.length; li++) {
                    if (linhas[li].row === row) { linhas.splice(li, 1); break; }
                }
                dlg.layout.layout(true);
            };

            linhas.push({ row: row, nomeField: nomeField, extField: extField, original: original || null });
        }

        for (var i = 0; i < categorias.length; i++) addLinha(categorias[i].nome, categorias[i].exts, categorias[i]);

        var btnAdd = dlg.add("button", undefined, "+ New Category");
        btnAdd.alignment = ["left", "top"];
        btnAdd.onClick = function () {
            addLinha("New", [], null);
            dlg.layout.layout(true);
        };

        var botoes = dlg.add("group");
        botoes.alignment = "right";
        var btnCancelar = botoes.add("button", undefined, "Cancel", { name: "cancel" });
        var btnSalvar = botoes.add("button", undefined, "Save", { name: "ok" });

        btnSalvar.onClick = function () {
            var novasCategorias = [];
            for (var li = 0; li < linhas.length; li++) {
                var nome = linhas[li].nomeField.text.replace(/^\s+|\s+$/g, "");
                if (!nome) continue;
                var original = linhas[li].original;
                var especial = !!(original && original.especial);
                var exts = [];
                if (!especial) {
                    var raw = linhas[li].extField.text;
                    var partes = raw.split(",");
                    for (var p = 0; p < partes.length; p++) {
                        var v = partes[p].replace(/^\s+|\s+$/g, "").replace(/^\./, "").toLowerCase();
                        if (v) exts.push(v);
                    }
                }
                var cat = { nome: nome, exts: exts };
                if (original && original.pasta) cat.pasta = original.pasta;
                if (original && original.especial) cat.especial = original.especial;
                novasCategorias.push(cat);
            }
            salvarCategorias(novasCategorias);
            dlg.close(1);
        };
        btnCancelar.onClick = function () { dlg.close(0); };

        dlg.center();
        dlg.show();
    }

    // ============================================================
    // PROJETO — Reduce Project / Remove Unused Footage
    // ============================================================

    function fecharAbasOrfas() {
        // Depois de reduzir o projeto, itens deletados podem deixar abas de
        // comp "fantasma" abertas (comum após restaurar um workspace salvo).
        // Não há API para enumerar abas abertas — a única forma de garantir
        // que nenhuma fique órfã é fechar todas e reabrir a atual.
        var atual = app.project.activeItem;
        var nomes = ["Close All"];
        var id = acharComando(nomes);
        if (id) {
            try { app.executeCommand(id); } catch (e) {}
        }
        if (atual && atual instanceof CompItem) {
            try { atual.openInViewer(); } catch (e) {}
        }
    }

    function reduceProject() {
        var alvos = [];
        var painelSel = app.project.selection;
        for (var i = 0; i < painelSel.length; i++) {
            if (painelSel[i] instanceof CompItem) alvos.push(painelSel[i]);
        }
        if (alvos.length === 0) {
            var ativa = comp();
            if (ativa) alvos.push(ativa);
        }
        if (alvos.length === 0) {
            alert("Select one or more comps in the Project Panel, or open the comp you want to keep.");
            return;
        }

        app.beginUndoGroup("Reduce Project");
        try {
            app.project.reduceProject(alvos);
        } catch (e) {
            alert("Reduce Project — error: " + e.toString());
        } finally {
            app.endUndoGroup();
        }

        fecharAbasOrfas();
    }

    function removeUnusedFootage() {
        app.beginUndoGroup("Remove Unused Footage");
        try {
            app.project.removeUnusedFootage();
        } catch (e) {
            alert("Remove Unused Footage — error: " + e.toString());
        } finally {
            app.endUndoGroup();
        }
    }

    // ============================================================
    // LIMPEZA — Limpar Expressões / Reset Layer
    // ============================================================

    function removeExpressoesRecursivo(propGroup) {
        if (!propGroup) return;
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop = propGroup.property(i);
            if (prop.propertyType === PropertyType.PROPERTY) {
                if (prop.canSetExpression && prop.expression !== "") {
                    try { prop.expression = ""; } catch (e) {}
                }
            } else if (ehGrupo(prop)) {
                removeExpressoesRecursivo(prop);
            }
        }
    }

    function limparExpressoes() {
        var c = comp();
        if (!c) return;
        var layers = c.selectedLayers;
        if (layers.length === 0) return;

        app.beginUndoGroup("Clear Expressions");
        for (var i = 0; i < layers.length; i++) {
            removeExpressoesRecursivo(layers[i]);
        }
        app.endUndoGroup();
    }

    function removeEfeitos(layer) {
        try {
            var fx = layer.property("ADBE Effect Parade");
            if (!fx) return;
            for (var e = fx.numProperties; e >= 1; e--) {
                try { fx.property(e).remove(); } catch (err) {}
            }
        } catch (err) {}
    }

    // Layer styles: o grupo é NAMED_GROUP com 10 slots fixos, sempre presente.
    // remove() num slot é proibido pelo AE ("parent is not an INDEXED_GROUP").
    // Desligar cada style dá o mesmo resultado visual — é a única via confiável.
    function limparLayerStyles(layer) {
        var styles;
        try { styles = layer.property("ADBE Layer Styles"); } catch (e) { return; }
        if (!styles) return;
        try { styles.remove(); return; } catch (e) {}
        for (var s = 1; s <= styles.numProperties; s++) {
            try {
                var style = styles.property(s);
                if (style.matchName === "ADBE Blend Options Group") continue;
                if (style.enabled) style.enabled = false;
            } catch (err) {}
        }
    }

    // Centraliza o anchor point no objeto, compensando a posição para nada se mover.
    function centralizarAnchor(layer) {
        try {
            var transform = layer.property("ADBE Transform Group");
            var anchorProp = transform.property("ADBE Anchor Point");
            var posProp = transform.property("ADBE Position");
            var rect = layer.sourceRectAtTime(0, false);
            var novoAnchor = [rect.left + rect.width / 2, rect.top + rect.height / 2];
            var anchorAtual = anchorProp.value;
            var posAtual = posProp.value;
            var escala = transform.property("ADBE Scale").value;
            var dx = (novoAnchor[0] - anchorAtual[0]) * (escala[0] / 100);
            var dy = (novoAnchor[1] - anchorAtual[1]) * (escala[1] / 100);
            if (anchorAtual.length > 2) {
                anchorProp.setValue([novoAnchor[0], novoAnchor[1], anchorAtual[2]]);
                posProp.setValue([posAtual[0] + dx, posAtual[1] + dy, posAtual[2]]);
            } else {
                anchorProp.setValue(novoAnchor);
                posProp.setValue([posAtual[0] + dx, posAtual[1] + dy]);
            }
        } catch (e) {}
    }

    // Reset completo: remove fx/expressões/styles e volta Transform aos
    // valores padrão de uma camada recém-criada (âncora no centro do
    // conteúdo, posição no centro da comp, escala 100, rotação 0, opacidade 100).
    function resetarLayer() {
        var c = comp();
        if (!c) return;
        var layers = c.selectedLayers;
        if (layers.length === 0) return;

        app.beginUndoGroup("Reset Layer");
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];

            removeExpressoesRecursivo(layer);
            removeEfeitos(layer);
            limparLayerStyles(layer);

            var t = layer.property("ADBE Transform Group");
            var props = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Opacity"];
            for (var p = 0; p < props.length; p++) {
                try {
                    var prop = t.property(props[p]);
                    while (prop.numKeys > 0) prop.removeKey(1);
                    prop.expression = "";
                } catch (e) {}
            }

            try {
                var rot = t.property("ADBE Rotation");
                while (rot.numKeys > 0) rot.removeKey(1);
                rot.expression = "";
                rot.setValue(0);
            } catch (e) {}

            try { t.property("ADBE Scale").setValue(layer.threeDLayer ? [100, 100, 100] : [100, 100]); } catch (e) {}
            try { t.property("ADBE Opacity").setValue(100); } catch (e) {}

            try {
                var pos = t.property("ADBE Position");
                pos.setValue(layer.threeDLayer ? [c.width / 2, c.height / 2, 0] : [c.width / 2, c.height / 2]);
            } catch (e) {}

            centralizarAnchor(layer);
        }
        app.endUndoGroup();
    }

    // ============================================================
    // TIME REMAP — Hold Time Remap (com apagar último keyframe)
    // ============================================================

    function holdTimeRemap() {
        var c = comp();
        if (!c) return;
        var layers = c.selectedLayers;
        if (!layers || layers.length === 0) return;

        app.beginUndoGroup("Hold Time Remap");
        var t = c.time;

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            try {
                if (!(layer instanceof AVLayer) || !layer.canSetTimeRemapEnabled) continue;
                if (!layer.timeRemapEnabled) layer.timeRemapEnabled = true;

                var tr = layer.property("ADBE Time Remapping");
                if (!tr) continue;

                var remapValue = tr.valueAtTime(t, false);
                var epsilon = c.frameDuration / 100.0;
                var keyIndex = 0;

                for (var k = 1; k <= tr.numKeys; k++) {
                    if (Math.abs(tr.keyTime(k) - t) <= epsilon) { keyIndex = k; break; }
                }
                if (keyIndex === 0) keyIndex = tr.addKey(t);

                tr.setValueAtKey(keyIndex, remapValue);
                tr.setInterpolationTypeAtKey(
                    keyIndex,
                    KeyframeInterpolationType.LINEAR,
                    KeyframeInterpolationType.HOLD
                );

                // apaga o último keyframe da propriedade, se ele vier DEPOIS do
                // hold recém-criado (normalmente o keyframe final que o AE cria
                // sozinho ao ligar o Time Remap) — sem isso o remap "puxava" de
                // volta para aquele valor no fim, quebrando o congelamento
                if (tr.numKeys > keyIndex) {
                    try { tr.removeKey(tr.numKeys); } catch (e) {}
                }
            } catch (layerErr) {}
        }
        app.endUndoGroup();
    }

    // ============================================================
    // CURVAS — Easy Curve Copy / Paste (clipboard em memória)
    // ============================================================

    function coletarAnimadas(group, result) {
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.propertyType === PropertyType.PROPERTY) {
                if (p.numKeys > 0) result.push(p);
            } else {
                coletarAnimadas(p, result);
            }
        }
    }

    function keysSelecionadasOuTodas(prop) {
        var keys = prop.selectedKeys;
        if (keys && keys.length > 0) return keys;
        keys = [];
        for (var i = 1; i <= prop.numKeys; i++) keys.push(i);
        return keys;
    }

    function nomeInterpolacao(value) {
        if (value === KeyframeInterpolationType.HOLD) return "HOLD";
        if (value === KeyframeInterpolationType.LINEAR) return "LINEAR";
        return "BEZIER";
    }

    function valorInterpolacao(name) {
        if (name === "HOLD") return KeyframeInterpolationType.HOLD;
        if (name === "LINEAR") return KeyframeInterpolationType.LINEAR;
        return KeyframeInterpolationType.BEZIER;
    }

    function easeParaDados(eases) {
        var result = [];
        for (var i = 0; i < eases.length; i++) {
            result.push({ speed: eases[i].speed, influence: eases[i].influence });
        }
        return result;
    }

    function propriedadesAlvo(c) {
        var props = [];
        var selecionadas = c.selectedProperties;
        for (var i = 0; i < selecionadas.length; i++) {
            var sp = selecionadas[i];
            if (sp.propertyType === PropertyType.PROPERTY && sp.numKeys > 0) props.push(sp);
        }
        if (props.length === 0) {
            var layers = c.selectedLayers;
            for (i = 0; i < layers.length; i++) coletarAnimadas(layers[i], props);
        }
        return props;
    }

    function copiarCurva() {
        var c = comp();
        if (!c) return;

        var props = propriedadesAlvo(c);
        if (props.length === 0) return;

        var data = { properties: [] };
        for (var i = 0; i < props.length; i++) {
            var prop = props[i];
            var keyIndexes = keysSelecionadasOuTodas(prop);
            var propData = { matchName: prop.matchName, keys: [] };

            for (var k = 0; k < keyIndexes.length; k++) {
                var ki = keyIndexes[k];
                try {
                    propData.keys.push({
                        inType: nomeInterpolacao(prop.keyInInterpolationType(ki)),
                        outType: nomeInterpolacao(prop.keyOutInterpolationType(ki)),
                        inEase: easeParaDados(prop.keyInTemporalEase(ki)),
                        outEase: easeParaDados(prop.keyOutTemporalEase(ki)),
                        continuous: prop.keyTemporalContinuous(ki),
                        autoBezier: prop.keyTemporalAutoBezier(ki)
                    });
                } catch (e) {}
            }
            if (propData.keys.length > 0) data.properties.push(propData);
        }

        if (data.properties.length === 0) return;
        easyCurveClipboard = data;
    }

    function fazerEaseArray(sourceEase, count) {
        var result = [];
        var fallback = sourceEase.length > 0 ? sourceEase[0] : { speed: 0, influence: 33.333 };
        for (var i = 0; i < count; i++) {
            var item = sourceEase[i] || fallback;
            var influence = Math.max(0.1, Math.min(100, item.influence));
            result.push(new KeyframeEase(item.speed, influence));
        }
        return result;
    }

    function colarCurva() {
        var c = comp();
        if (!c) return;
        if (!easyCurveClipboard || !easyCurveClipboard.properties || easyCurveClipboard.properties.length === 0) return;

        var props = propriedadesAlvo(c);
        if (props.length === 0) return;

        app.beginUndoGroup("Paste Curve");
        var n = Math.min(easyCurveClipboard.properties.length, props.length);

        for (var i = 0; i < n; i++) {
            var sourceProp = easyCurveClipboard.properties[i];
            var targetProp = props[i];
            var targetKeys = keysSelecionadasOuTodas(targetProp);
            var keyCount = Math.min(sourceProp.keys.length, targetKeys.length);

            for (var k = 0; k < keyCount; k++) {
                var sourceKey = sourceProp.keys[k];
                var targetKey = targetKeys[k];
                try {
                    targetProp.setInterpolationTypeAtKey(
                        targetKey,
                        valorInterpolacao(sourceKey.inType),
                        valorInterpolacao(sourceKey.outType)
                    );

                    var inLen = targetProp.keyInTemporalEase(targetKey).length;
                    var outLen = targetProp.keyOutTemporalEase(targetKey).length;
                    targetProp.setTemporalEaseAtKey(
                        targetKey,
                        fazerEaseArray(sourceKey.inEase, inLen),
                        fazerEaseArray(sourceKey.outEase, outLen)
                    );

                    if (!sourceKey.autoBezier) {
                        targetProp.setTemporalContinuousAtKey(targetKey, sourceKey.continuous);
                    }
                    targetProp.setTemporalAutoBezierAtKey(targetKey, sourceKey.autoBezier);
                } catch (e) {}
            }
        }
        app.endUndoGroup();
    }

    // ============================================================
    // CAMADAS — Layer Normalize
    // ============================================================

    function layerNormalize() {
        var c = comp();
        if (!c) return;
        var layers = c.selectedLayers;
        if (!layers || layers.length === 0) return;

        app.beginUndoGroup("Layer Normalize");
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var textGroup = layer.property("ADBE Text Properties");
            if (!textGroup) continue;

            var sourceText = textGroup.property("ADBE Text Document");
            var transform = layer.property("ADBE Transform Group");
            var scaleProp = transform.property("ADBE Scale");
            var anchorProp = transform.property("ADBE Anchor Point");

            if (layer.threeDLayer) continue;
            if (scaleProp.numKeys > 0 || scaleProp.expressionEnabled) continue;
            if (sourceText.numKeys > 0 || sourceText.expressionEnabled) continue;

            var scale = scaleProp.value;
            var sx = scale[0] / 100;
            var sy = scale[1] / 100;
            if (sx <= 0 || sy <= 0) continue;

            var wasLocked = layer.locked;
            layer.locked = false;

            try {
                var doc = sourceText.value;
                doc.fontSize = doc.fontSize * sy;
                try { doc.horizontalScale = doc.horizontalScale * (sx / sy); } catch (e1) {}
                try { if (!doc.autoLeading) doc.leading = doc.leading * sy; } catch (e2) {}
                try { doc.strokeWidth = doc.strokeWidth * sy; } catch (e3) {}
                try { doc.baselineShift = doc.baselineShift * sy; } catch (e4) {}
                try {
                    if (doc.boxText) {
                        var box = doc.boxTextSize;
                        doc.boxTextSize = [box[0] * sx, box[1] * sy];
                    }
                } catch (e5) {}

                sourceText.setValue(doc);

                var anchor = anchorProp.value;
                anchorProp.setValue([anchor[0] * sx, anchor[1] * sy]);
                scaleProp.setValue([100, 100]);
            } catch (err) {}

            layer.locked = wasLocked;
        }
        app.endUndoGroup();
    }

    // ============================================================
    // CAMADAS — Quebrar Shapes (mesma lógica do Quebrar Shapes PSD)
    // ============================================================

    // modo "criacao" (padrão): inverte a ordem de criação dos grupos de
    // vetor — o mais antigo (criado primeiro pelo usuário) fica por último
    // (mais embaixo) na timeline. Usado ao quebrar um shape layer que já
    // existia como tal.
    // modo "espacial": ordena por posição, esquerda→direita e topo→baixo
    // (como leitura de texto), sem inverter. Usado no resultado de
    // PSD/vetor convertido (Auto-trace/Create Shapes from Vector Layer),
    // onde não existe uma "ordem de criação" que faça sentido — os grupos
    // saem numa ordem arbitrária do próprio comando de conversão.
    function splitShapeLayerCore(c, layer, modo) {
        var contents = layer.property("ADBE Root Vectors Group");
        if (!contents) return [layer];

        var n = contents.numProperties;
        if (n <= 1) return [layer];

        var names = [];
        for (var i = 1; i <= n; i++) names.push(contents.property(i).name);

        var novas = [];
        for (var idx = n; idx >= 2; idx--) {
            var dup = layer.duplicate();
            var dupContents = dup.property("ADBE Root Vectors Group");
            for (var j = dupContents.numProperties; j >= 1; j--) {
                if (j !== idx) { try { dupContents.property(j).remove(); } catch (e) {} }
            }
            dup.name = names[idx - 1];
            novas.push(dup);
        }
        for (var j2 = contents.numProperties; j2 >= 1; j2--) {
            if (j2 !== 1) { try { contents.property(j2).remove(); } catch (e) {} }
        }
        layer.name = names[0];
        novas.push(layer);

        for (var k = 0; k < novas.length; k++) centralizarAnchor(novas[k]);

        // novas está em ordem de criação: [grupo mais novo, ..., grupo mais
        // antigo] — o grupo mais antigo (criado primeiro pelo usuário) sai
        // naturalmente no TOPO do stack (layer 1). O pedido é o oposto: o
        // primeiro criado deve ficar por ÚLTIMO (mais embaixo). Basta
        // inverter a ordem de criação — nada a ver com posição espacial.
        if (modo === "espacial") {
            organizarPorPosicao(c, novas);
        } else {
            var ordemFinal = novas.slice().reverse();
            for (var m = 1; m < ordemFinal.length; m++) {
                try { ordemFinal[m].moveAfter(ordemFinal[m - 1]); } catch (e) {}
            }
        }

        return novas;
    }

    function centroDaCamada(c, layer) {
        var transform = layer.property("ADBE Transform Group");
        var pos = transform.property("ADBE Position").value;
        try {
            var rect = layer.sourceRectAtTime(c.time, false);
            var anchor = transform.property("ADBE Anchor Point").value;
            return {
                x: pos[0] + (rect.left + rect.width / 2 - anchor[0]),
                y: pos[1] + (rect.top + rect.height / 2 - anchor[1])
            };
        } catch (e) {
            return { x: pos[0], y: pos[1] };
        }
    }

    // Esquerda→direita, topo→baixo — como leitura de texto. O primeiro da
    // leitura vira layer 1 (topo do stack); sem inversão.
    function organizarPorPosicao(c, layerArr) {
        if (layerArr.length <= 1) return;
        var comPos = [];
        for (var i = 0; i < layerArr.length; i++) {
            var ctr = centroDaCamada(c, layerArr[i]);
            comPos.push({ layer: layerArr[i], x: ctr.x, y: ctr.y });
        }
        var TOL = 40;
        comPos.sort(function (a, b) {
            // Y decrescente: linha mais embaixo na tela vira layer 1 (topo
            // do stack), subindo linha por linha. X decrescente dentro da
            // mesma linha: direita para esquerda (confirmado letra por
            // letra pelo usuário num teste real com 25 caracteres em 3
            // linhas — é o oposto de "esquerda pra direita").
            if (Math.abs(a.y - b.y) > TOL) return b.y - a.y;
            return b.x - a.x;
        });
        for (var j = 1; j < comPos.length; j++) {
            try { comPos[j].layer.moveAfter(comPos[j - 1].layer); } catch (e) {}
        }
    }

    function tentarCriarShapesDoVetor(c, layer) {
        selecionarApenas(c, layer);
        var cmdId = acharComando(["Create Shapes from Vector Layer"]);
        if (!cmdId) return null;
        try { app.executeCommand(cmdId); } catch (e) { return null; }
        var sel = c.selectedLayers;
        for (var s = 0; s < sel.length; s++) {
            if (sel[s] instanceof ShapeLayer) return sel[s];
        }
        return null;
    }

    function dispararAutoTrace(c, layer) {
        selecionarApenas(c, layer);
        var cmdId = acharComando(["Auto-trace...", "Auto-trace…"]);
        if (!cmdId) return false;
        try { app.executeCommand(cmdId); return true; } catch (e) { return false; }
    }

    function getBBox(verts) {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < verts.length; i++) {
            var x = verts[i][0], y = verts[i][1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    function bboxArea(b) { return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY); }

    function bboxContains(outer, inner) {
        var pad = 0.5;
        return inner.minX >= outer.minX - pad && inner.maxX <= outer.maxX + pad &&
               inner.minY >= outer.minY - pad && inner.maxY <= outer.maxY + pad;
    }

    function pointInPoly(pt, verts) {
        var inside = false;
        for (var i = 0, j = verts.length - 1; i < verts.length; j = i++) {
            var xi = verts[i][0], yi = verts[i][1];
            var xj = verts[j][0], yj = verts[j][1];
            var intersecta = ((yi > pt[1]) !== (yj > pt[1])) &&
                (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
            if (intersecta) inside = !inside;
        }
        return inside;
    }

    function polyContains(outerVerts, outerBBox, innerVerts, innerBBox) {
        if (!bboxContains(outerBBox, innerBBox)) return false;
        var dentro = 0;
        for (var i = 0; i < innerVerts.length; i++) {
            if (pointInPoly(innerVerts[i], outerVerts)) dentro++;
        }
        return innerVerts.length > 0 && (dentro / innerVerts.length) >= 0.7;
    }

    function agruparMascarasPorContencao(maskGroup) {
        var masks = [];
        for (var i = 1; i <= maskGroup.numProperties; i++) {
            var m = maskGroup.property(i);
            var v = m.property("ADBE Mask Shape").value.vertices;
            masks.push({ mask: m, verts: v, bbox: getBBox(v) });
        }

        var parentIndex = [];
        for (var a = 0; a < masks.length; a++) {
            var best = -1, bestArea = Infinity;
            for (var b = 0; b < masks.length; b++) {
                if (a === b) continue;
                if (polyContains(masks[b].verts, masks[b].bbox, masks[a].verts, masks[a].bbox)) {
                    var area = bboxArea(masks[b].bbox);
                    if (area < bestArea) { bestArea = area; best = b; }
                }
            }
            parentIndex.push(best);
        }

        function topAncestor(idx) {
            var visited = {};
            while (parentIndex[idx] !== -1 && !visited[idx]) { visited[idx] = true; idx = parentIndex[idx]; }
            return idx;
        }

        var groupsByRoot = {}, rootOrder = [];
        for (var c2 = 0; c2 < masks.length; c2++) {
            var root = topAncestor(c2);
            if (!groupsByRoot[root]) { groupsByRoot[root] = []; rootOrder.push(root); }
            groupsByRoot[root].push(masks[c2].mask);
        }

        var groups = [];
        for (var r = 0; r < rootOrder.length; r++) {
            var rootIdx = rootOrder[r];
            var rootMask = masks[rootIdx].mask;
            var arr = groupsByRoot[rootIdx];
            var ordenado = [rootMask];
            for (var k2 = 0; k2 < arr.length; k2++) if (arr[k2] !== rootMask) ordenado.push(arr[k2]);
            groups.push({ masks: ordenado, bbox: masks[rootIdx].bbox });
        }

        var TOL = 40;
        groups.sort(function (x, y) {
            var xy = (x.bbox.minY + x.bbox.maxY) / 2, yy = (y.bbox.minY + y.bbox.maxY) / 2;
            if (Math.abs(xy - yy) > TOL) return xy - yy;
            return x.bbox.minX - y.bbox.minX;
        });

        var resultado = [];
        for (var g = 0; g < groups.length; g++) resultado.push(groups[g].masks);
        return resultado;
    }

    function copiarTransform(fromLayer, toLayer) {
        var fromT = fromLayer.property("ADBE Transform Group");
        var toT = toLayer.property("ADBE Transform Group");
        var props = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotation", "ADBE Opacity"];
        for (var p = 0; p < props.length; p++) {
            try {
                var fp = fromT.property(props[p]);
                var tp = toT.property(props[p]);
                if (fp && tp) tp.setValue(fp.value);
            } catch (e) {}
        }
    }

    function mascarasParaShapeLayer(c, sourceLayer) {
        var maskGroup = sourceLayer.property("ADBE Mask Parade");
        if (!maskGroup || maskGroup.numProperties === 0) return null;

        var shapeLayer = c.layers.addShape();
        shapeLayer.name = sourceLayer.name + " Shapes";
        copiarTransform(sourceLayer, shapeLayer);

        var rootContents = shapeLayer.property("ADBE Root Vectors Group");
        var objetos = agruparMascarasPorContencao(maskGroup);

        for (var g = 0; g < objetos.length; g++) {
            var masksDoObjeto = objetos[g];
            var group = rootContents.addProperty("ADBE Vector Group");
            group.name = masksDoObjeto[0].name;
            var gc = group.property("ADBE Vectors Group");

            for (var i = 0; i < masksDoObjeto.length; i++) {
                var pathGroup = gc.addProperty("ADBE Vector Shape - Group");
                pathGroup.property("ADBE Vector Shape").setValue(masksDoObjeto[i].property("ADBE Mask Shape").value);
            }

            var fill = gc.addProperty("ADBE Vector Graphic - Fill");
            if (masksDoObjeto.length > 1) {
                var regra = fill.property("ADBE Vector Fill Rule");
                if (!regra) { try { regra = fill.property(2); } catch (e) {} }
                if (regra) { try { regra.setValue(2); } catch (e) {} } // Even-Odd
            }
        }

        for (var j = maskGroup.numProperties; j >= 1; j--) {
            try { maskGroup.property(j).remove(); } catch (e) {}
        }
        return shapeLayer;
    }

    function converterRasterParaShapes(c, layer, dbg) {
        var maskGroup = layer.property("ADBE Mask Parade");
        var camadaComMascaras = (maskGroup && maskGroup.numProperties > 0) ? layer : null;

        if (!camadaComMascaras) {
            var ok = dispararAutoTrace(c, layer);
            if (!ok) { dbg.semComando = true; return null; }
            var sel = c.selectedLayers;
            for (var s = 0; s < sel.length; s++) {
                var mg = sel[s].property("ADBE Mask Parade");
                if (mg && mg.numProperties > 0) { camadaComMascaras = sel[s]; break; }
            }
        }
        if (!camadaComMascaras) { dbg.semMascaras = true; return null; }
        return mascarasParaShapeLayer(c, camadaComMascaras);
    }

    function quebrarShapes() {
        var c = comp();
        if (!c) { alert("Open a composition and select the layers."); return; }

        var alvo = c.selectedLayers;
        if (alvo.length === 0) { alert("Select the layers (shape layers and/or PSD layers)."); return; }
        alvo = alvo.slice(0);

        var quebrados = 0, gruposSeparados = 0, psdConvertidos = 0, falhas = 0;

        for (var i = 0; i < alvo.length; i++) {
            var layer = alvo[i];
            try {
                if (layer instanceof ShapeLayer) {
                    var novas = splitShapeLayerCore(c, layer, "criacao");
                    if (novas.length > 1) { quebrados++; gruposSeparados += novas.length; }
                } else if (layer instanceof AVLayer && layer.source) {
                    var novoShape = tentarCriarShapesDoVetor(c, layer);
                    var dbg = {};
                    if (!novoShape) novoShape = converterRasterParaShapes(c, layer, dbg);
                    if (novoShape) {
                        psdConvertidos++;
                        var novas2 = splitShapeLayerCore(c, novoShape, "espacial");
                        if (novas2.length > 1) gruposSeparados += novas2.length;
                    } else {
                        falhas++;
                    }
                }
            } catch (e) { falhas++; }
        }

        if (quebrados === 0 && psdConvertidos === 0 && falhas > 0) {
            alert("No successful conversion. Failures: " + falhas +
                "\n(the layer may be missing vector data, or Auto-trace needs to be confirmed in its dialog)");
        }
    }

    // ============================================================
    // CAMADAS — Precomp Extractor
    // ============================================================

    function flattenLayer(layer, c, cmdCopy, cmdPaste, cmdClose, recursivo) {
        if (!(layer instanceof AVLayer) || !layer.source || !(layer.source instanceof CompItem)) return;

        var source = layer.source;

        // Copy/Paste traz os layers com os valores de tempo BRUTOS da comp de
        // origem — ignora startTime/stretch/trim que a própria camada de
        // precomp tinha na comp de destino. Sem reaplicar isso, qualquer
        // conteúdo animado sai fora de sincronia (só passa despercebido
        // quando nada se move). Guardamos os valores da camada-wrapper antes
        // de mexer nela.
        var wrapperStartTime = layer.startTime;
        var wrapperStretch = layer.stretch;
        var wrapperInPoint = layer.inPoint;
        var wrapperOutPoint = layer.outPoint;

        // Parenting, track matte e blend mode aplicados diretamente na
        // camada de precomp (não no conteúdo interno dela) também eram
        // perdidos: a camada some (layer.remove()) e nada assumia o lugar
        // dela nessas relações. Guardamos antes de mexer.
        var wrapperParent = null;
        try { wrapperParent = layer.parent; } catch (e) {}
        var wrapperTrackMatteLayer = null;
        var wrapperTrackMatteType = null;
        try {
            if (layer.trackMatteType !== TrackMatteType.NO_TRACK_MATTE) {
                wrapperTrackMatteLayer = layer.trackMatteLayer;
                wrapperTrackMatteType = layer.trackMatteType;
            }
        } catch (e) {}
        var wrapperBlendingMode = null;
        try { wrapperBlendingMode = layer.blendingMode; } catch (e) {}

        source.openInViewer();
        for (var i = 1; i <= source.numLayers; i++) source.layer(i).selected = true;
        var hasLayers = source.numLayers > 0;
        if (hasLayers) {
            // O comando Copy do AE recusa copiar uma camada com pai (parent)
            // ou com expressão vinculando outra camada ENQUANTO um Undo
            // Group do script está aberto ("Can't copy a layer with a
            // parent or with a linked expression, while an Undo Group is
            // open") — restrição da própria API, não bug nosso. precomps
            // com null/parenting ou expressões entre camadas (bem comuns)
            // sempre falhavam por causa disso. Fecha o Undo Group só durante
            // o Copy e reabre logo depois, com o mesmo nome — o resultado
            // aparece como mais de uma entrada no Undo em vez de uma só,
            // mas a extração passa a funcionar nesses casos.
            app.endUndoGroup();
            try {
                app.executeCommand(cmdCopy);
            } finally {
                app.beginUndoGroup("Precomp Extractor");
            }
        }
        app.executeCommand(cmdClose);

        if (!hasLayers) { layer.remove(); return; }

        c.openInViewer();
        for (var j = 1; j <= c.numLayers; j++) c.layer(j).selected = false;
        layer.selected = true;
        app.executeCommand(cmdPaste);

        var pasted = c.selectedLayers.slice();

        // Reaplica a velocidade e o deslocamento no tempo que a camada de
        // precomp tinha, para que o conteúdo extraído caia no mesmo instante
        // e na mesma velocidade que tinha dentro da precomp. Ordem importa:
        // stretch primeiro (reescala tudo em torno do inPoint atual), depois
        // startTime (desloca o layer já reescalado para o lugar certo).
        for (var p = 0; p < pasted.length; p++) {
            try {
                pasted[p].stretch = wrapperStretch;
                pasted[p].startTime = wrapperStartTime;
            } catch (e) {}
        }

        // Recorta pra bater com o trim (in/out) que a camada de precomp tinha.
        for (var q = 0; q < pasted.length; q++) {
            try {
                if (pasted[q].inPoint < wrapperInPoint) pasted[q].inPoint = wrapperInPoint;
                if (pasted[q].outPoint > wrapperOutPoint) pasted[q].outPoint = wrapperOutPoint;
            } catch (e) {}
        }

        // Reaplica parenting/track matte/blend mode da camada-wrapper nas
        // camadas extraídas que não tinham pai dentro da própria precomp —
        // essas são as que, de fora, ocupavam o "lugar" da camada removida
        // nessas relações. Uma camada que já tinha pai internamente
        // (ex.: parentada a um Null que também veio da precomp) fica como
        // estava, preservando a hierarquia interna.
        for (var r = 0; r < pasted.length; r++) {
            var pl = pasted[r];
            var temPaiInterno = false;
            try { temPaiInterno = !!pl.parent; } catch (e) {}
            if (temPaiInterno) continue;

            try { if (wrapperParent) pl.parent = wrapperParent; } catch (e) {}
            try {
                if (wrapperTrackMatteLayer) pl.setTrackMatte(wrapperTrackMatteLayer, wrapperTrackMatteType);
            } catch (e) {}
            try { if (wrapperBlendingMode !== null) pl.blendingMode = wrapperBlendingMode; } catch (e) {}
        }

        layer.remove();

        if (recursivo) {
            for (var k = 0; k < pasted.length; k++) flattenLayer(pasted[k], c, cmdCopy, cmdPaste, cmdClose, recursivo);
        }
    }

    function precompExtractor() {
        var c = comp();
        if (!c) { alert("Select an active composition."); return; }

        var selected = c.selectedLayers.slice();
        if (selected.length === 0) { alert("Select one or more precomp layers."); return; }

        var cmdCopy = acharComando(["Copy"]);
        var cmdPaste = acharComando(["Paste"]);
        var cmdClose = acharComando(["Close"]);
        if (!cmdCopy || !cmdPaste || !cmdClose) {
            alert("Copy/Paste/Close menu commands not found.");
            return;
        }

        var recursivo = precompExtractorRecursivo;
        app.beginUndoGroup("Precomp Extractor");
        try {
            for (var i = 0; i < selected.length; i++) flattenLayer(selected[i], c, cmdCopy, cmdPaste, cmdClose, recursivo);
        } finally {
            app.endUndoGroup();
        }
        c.openInViewer();
    }

    // ============================================================
    // CAMADAS — Layer Organizer
    // ============================================================

    function layerOrganizer() {
        var c = comp();
        if (!c) { alert("Open the composition you want to reorganize."); return; }

        var n = c.numLayers;
        if (n <= 1) return;

        var temSelecao = c.selectedLayers.length > 0;
        var alvo = [];
        for (var i = 1; i <= n; i++) {
            var layer = c.layer(i);
            if (!temSelecao || layer.selected) {
                alvo.push({ layer: layer, inPoint: layer.inPoint, indiceOriginal: i });
            }
        }
        if (alvo.length <= 1) return;

        var ordenados = alvo.slice(0);
        ordenados.sort(function (a, b) {
            if (a.inPoint !== b.inPoint) return b.inPoint - a.inPoint;
            return a.indiceOriginal - b.indiceOriginal;
        });

        var fullOrder = [];
        var cursor = 0;
        for (var j = 1; j <= n; j++) {
            var lyr = c.layer(j);
            if (!temSelecao || lyr.selected) {
                fullOrder.push(ordenados[cursor].layer);
                cursor++;
            } else {
                fullOrder.push(lyr);
            }
        }

        app.beginUndoGroup("Layer Organizer");
        for (var k = fullOrder.length - 1; k >= 0; k--) {
            try { fullOrder[k].moveToBeginning(); } catch (e) {}
        }
        app.endUndoGroup();
    }

    // ============================================================
    // TIME REMAP — Hold Keyframe (converte qualquer keyframe selecionado
    // em hold, em qualquer propriedade)
    // ============================================================

    function holdKeyframes() {
        var c = comp();
        if (!c) return;

        var props = c.selectedProperties;
        var aplicado = false;

        app.beginUndoGroup("Hold Keyframe");
        for (var i = 0; i < props.length; i++) {
            var p = props[i];
            if (p.propertyType !== PropertyType.PROPERTY || p.numKeys === 0) continue;
            var keys = p.selectedKeys;
            if (!keys || keys.length === 0) continue;
            for (var k = 0; k < keys.length; k++) {
                try {
                    p.setInterpolationTypeAtKey(
                        keys[k],
                        KeyframeInterpolationType.HOLD,
                        KeyframeInterpolationType.HOLD
                    );
                    aplicado = true;
                } catch (e) {}
            }
        }
        app.endUndoGroup();

        if (!aplicado) alert("Select one or more keyframes in the Timeline.");
    }

    // ============================================================
    // UI
    // ============================================================

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "AE Toolkit", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "fill"];
        win.spacing = 0;
        win.margins = 0;

        // ATUALIZAR sempre que adicionar/remover grupo ou linha de botão
        // (addGrupo/addLinha) neste buildUI: são os únicos números usados
        // para estimar a altura do conteúdo e calibrar a Scrollbar abaixo.
        // NUNCA calcule isso lendo o tamanho real dos controles em tempo de
        // execução (.size/.preferredSize) — isso já quebrou o painel
        // inteiro numa tentativa anterior. É melhor sobrar um pouco de
        // espaço vazio no fim do scroll do que arriscar quebrar de novo.
        var NUM_GRUPOS = 5;  // Project, Cleanup, Time Remap, Curves, Layers
        var NUM_LINHAS = 7;  // total de addLinha(...) chamadas, somando todos os grupos

        // Estimativa estática da altura total do conteúdo: título+margens
        // de cada painel de grupo, altura de cada linha de botão (26px +
        // 4px de espaçamento), espaço entre grupos (8px) e margens do
        // container de scroll (10px em cima/embaixo).
        var ALTURA_LINHA = 26 + 4;
        var ALTURA_EXTRA_POR_GRUPO = 40; // título + margens do panel
        var ESPACO_ENTRE_GRUPOS = 8;
        var ALTURA_CONTEUDO_ESTIMADA =
            NUM_GRUPOS * ALTURA_EXTRA_POR_GRUPO +
            NUM_LINHAS * ALTURA_LINHA +
            (NUM_GRUPOS - 1) * ESPACO_ENTRE_GRUPOS +
            20; // margens do scroll

        // O limite da Scrollbar não é a altura total do conteúdo — é o
        // quanto ainda falta rolar depois que o viewport (área visível) já
        // mostrou sua parte. Como não podemos ler a altura real do viewport
        // (é isso que quebrou o painel antes), assumimos um viewport mínimo
        // razoável e descontamos daqui. Se sobrar espaço vazio no fim do
        // scroll numa dock bem pequena, reduza ALTURA_VIEWPORT_ASSUMIDA.
        var ALTURA_VIEWPORT_ASSUMIDA = 220;
        var MAX_SCROLL = Math.max(40, ALTURA_CONTEUDO_ESTIMADA - ALTURA_VIEWPORT_ASSUMIDA);

        // Estrutura de scroll manual (o host do AE não suporta contêiner com
        // scroll nativo): "viewport" (stack) recorta por clipping nativo um
        // "scroll" maior que ele, deslocado via .location; uma Scrollbar
        // fina ao lado controla esse deslocamento — arrastando ou pela roda
        // do mouse. O limite da barra é a estimativa estática acima, NUNCA
        // lida em tempo real (ver comentário lá em cima).
        var scrollRow = win.add("group");
        scrollRow.orientation = "row";
        scrollRow.alignChildren = ["fill", "fill"];
        scrollRow.spacing = 2;
        scrollRow.margins = 0;

        var viewport = scrollRow.add("group");
        viewport.orientation = "stack";
        viewport.alignment = ["fill", "fill"];

        var scroll = viewport.add("group");
        scroll.orientation = "column";
        scroll.alignChildren = ["fill", "top"];
        scroll.alignment = ["fill", "top"];
        scroll.spacing = 8;
        scroll.margins = 10;

        var sbar = scrollRow.add("scrollbar", undefined, 0, 0, MAX_SCROLL);
        sbar.preferredSize.width = 9;
        sbar.alignment = ["right", "fill"];
        sbar.stepdelta = 25;
        sbar.jumpdelta = 120;
        sbar.onChanging = sbar.onChange = function () {
            scroll.location = [0, -sbar.value];
        };

        function rolar(passos) {
            var novo = sbar.value + passos * sbar.stepdelta;
            if (novo < sbar.minvalue) novo = sbar.minvalue;
            if (novo > sbar.maxvalue) novo = sbar.maxvalue;
            sbar.value = novo;
            scroll.location = [0, -sbar.value];
        }

        // wheelDelta positivo (Windows) = roda pra cima = ver conteúdo
        // acima = diminui o scroll. Não lê tamanho de nada em tempo real —
        // só usa os valores já fixos da Scrollbar. Tenta os dois nomes de
        // evento (hosts variam) e é chamada em CADA controle (painel de
        // grupo, linha, botão) porque a roda pode não borbulhar dos filhos
        // até os pais nesse host.
        function handlerRoda(ev) {
            var delta = (ev.wheelDelta !== undefined) ? ev.wheelDelta : -(ev.detail || 0) * 40;
            rolar(delta > 0 ? -1 : 1);
            if (ev.preventDefault) ev.preventDefault();
        }
        function ligarRoda(el) {
            try { el.addEventListener("mousewheel", handlerRoda); } catch (e) {}
            try { el.addEventListener("wheel", handlerRoda); } catch (e) {}
        }
        ligarRoda(win);
        ligarRoda(viewport);
        ligarRoda(scroll);

        function addGrupo(titulo) {
            var p = scroll.add("panel", undefined, titulo);
            p.orientation = "column";
            p.alignChildren = ["fill", "top"];
            p.margins = [10, 16, 10, 10];
            p.spacing = 4;
            ligarRoda(p);
            return p;
        }

        function addLinha(parent) {
            var g = parent.add("group");
            g.orientation = "row";
            g.alignChildren = ["fill", "center"];
            g.spacing = 4;
            ligarRoda(g);
            return g;
        }

        function addBtn(linha, label, tip, fn) {
            var b = linha.add("button", undefined, label);
            b.preferredSize = [128, 26];
            if (tip) b.helpTip = tip;
            ligarRoda(b);
            b.onClick = function () {
                try { fn(); } catch (e) { alert(label + " — error:\n" + e.toString()); }
            };
            return b;
        }

        var versaoLabel = scroll.add("statictext", undefined, "AE Toolkit Panel v" + TOOLKIT_VERSION);
        versaoLabel.alignment = ["fill", "top"];
        ligarRoda(versaoLabel);

        // --- Project ---
        var gProjeto = addGrupo("Project");
        var l1 = addLinha(gProjeto);
        addBtn(l1, "Tidy", "Organizes the Project Panel into folders by type, following the configured structure (button next to it). Only creates folders for file types actually present in the project.", declutter);
        addBtn(l1, "Edit Structure", "Edits the Tidy categories/folders (name + extensions).", editarEstruturaDeclutter);
        var l2 = addLinha(gProjeto);
        addBtn(l2, "Reduce Project", "Reduces the project to the comps selected in the Project Panel (or the active comp). Closes orphan tabs afterwards.", reduceProject);
        addBtn(l2, "Remove Unused", "Removes unused footage from the project.", removeUnusedFootage);
        var cbVarrerTudo = gProjeto.add("checkbox", undefined, "Reorganize entire project");
        cbVarrerTudo.value = tidyVarrerProjetoInteiro;
        cbVarrerTudo.helpTip = "Unchecked (default): Tidy only touches items loose at the project root, or already inside a folder it manages — safe on projects with intentional custom folders. Checked: Tidy reclassifies EVERY item everywhere (any nesting level) and deletes any folder left empty afterwards — use to fully flatten a messy/legacy project structure.";
        cbVarrerTudo.onClick = function () { tidyVarrerProjetoInteiro = cbVarrerTudo.value; };
        ligarRoda(cbVarrerTudo);

        // --- Cleanup ---
        var gLimpeza = addGrupo("Cleanup");
        var l3 = addLinha(gLimpeza);
        addBtn(l3, "Clear Expressions", "Removes all expressions from the selected layers.", limparExpressoes);
        addBtn(l3, "Reset Layer", "Removes effects, expressions and layer styles, and resets Transform to its default values.", resetarLayer);

        // --- Time Remap ---
        var gRemap = addGrupo("Time Remap");
        var l4 = addLinha(gRemap);
        addBtn(l4, "Hold Time Remap", "Creates a hold in Time Remap at the CTI and deletes the last keyframe (prevents it from pulling back at the end).", holdTimeRemap);
        addBtn(l4, "Hold Keyframe", "Turns any selected keyframe(s), on any property, into a hold keyframe.", holdKeyframes);

        // --- Curves ---
        var gCurvas = addGrupo("Curves");
        var l5 = addLinha(gCurvas);
        addBtn(l5, "Copy Curve", "Copies interpolation/ease from the selected keyframes (or from all animated properties).", copiarCurva);
        addBtn(l5, "Paste Curve", "Pastes the copied curve onto the selected keyframes.", colarCurva);

        // --- Layers ---
        var gCamadas = addGrupo("Layers");
        var l6 = addLinha(gCamadas);
        addBtn(l6, "Layer Normalize", "Zeroes out the scale of text layers, absorbing the value into font size.", layerNormalize);
        addBtn(l6, "Split Shapes", "Splits shape layers into separate objects, and converts PSD/vector layers into shapes split per layer.", quebrarShapes);
        var l7 = addLinha(gCamadas);
        addBtn(l7, "Precomp Extractor", "Brings the layers of a precomp (and nested ones) up into the current comp.", precompExtractor);
        addBtn(l7, "Layer Organizer", "Reorders layers by their horizontal position in the timeline.", layerOrganizer);
        var cbRecursivo = gCamadas.add("checkbox", undefined, "Extract nested precomps too");
        cbRecursivo.value = precompExtractorRecursivo;
        cbRecursivo.helpTip = "Checked: unwraps precomps inside precomps too (current behavior). Unchecked: Precomp Extractor only unwraps the first level.";
        cbRecursivo.onClick = function () { precompExtractorRecursivo = cbRecursivo.value; };
        ligarRoda(cbRecursivo);

        win.layout.layout(true);
        win.layout.resize();
        // Precisa valer tanto pra janela flutuante quanto pro painel
        // encaixado: ao encaixar/redimensionar a dock, o AE dispara resize
        // no Panel também, e sem recalcular o layout aqui os grupos ficavam
        // com o tamanho do primeiro layout (calculado antes de a dock ter
        // a largura definitiva), deixando os botões sem texto/cortados.
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        if (win instanceof Window) {
            win.center();
            win.show();
        }
        return win;
    }

    buildUI(thisObj);

})(this);
