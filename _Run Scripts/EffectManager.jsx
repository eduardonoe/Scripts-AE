// ============================================================
// EFFECT MANAGER - Script para After Effects
// Lista todos os efeitos usados no projeto e permite deletá-los
// Compatível com AE CC 2018+
// ============================================================

(function () {

    // --- DADOS GLOBAIS ---
    var effectsMap = {}; // { "Nome do Efeito": [ {comp, layer, effectIndex}, ... ] }

    // --- ESCANEAR PROJETO ---
    function scanProject() {
        effectsMap = {};

        var proj = app.project;
        if (!proj) { alert("Nenhum projeto aberto."); return; }

        for (var i = 1; i <= proj.numItems; i++) {
            var item = proj.item(i);
            if (!(item instanceof CompItem)) continue;

            for (var l = 1; l <= item.numLayers; l++) {
                var layer = item.layer(l);
                if (!layer.Effects) continue;

                var fx = layer.Effects;
                for (var e = 1; e <= fx.numProperties; e++) {
                    var effect = fx.property(e);
                    var name = effect.name;
                    var matchName = effect.matchName;
                    var key = name + " [" + matchName + "]";

                    if (!effectsMap[key]) effectsMap[key] = [];
                    effectsMap[key].push({
                        compName: item.name,
                        compItem: item,
                        layerIndex: l,
                        layerName: layer.name,
                        effectIndex: e,
                        effectName: name,
                        matchName: matchName
                    });
                }
            }
        }
    }

    // --- DELETAR TODOS OS USOS DE UM EFEITO ---
    function deleteEffect(key) {
        var uses = effectsMap[key];
        if (!uses || uses.length === 0) return 0;

        var count = 0;

        app.beginUndoGroup("Deletar efeito: " + uses[0].effectName);

        // Precisamos deletar de trás pra frente para não bagunçar os índices
        // Agrupamos por comp+layer e deletamos em ordem reversa de effectIndex
        var grouped = {};
        for (var i = 0; i < uses.length; i++) {
            var u = uses[i];
            var gkey = u.compName + "||" + u.layerIndex;
            if (!grouped[gkey]) grouped[gkey] = { comp: u.compItem, layerIndex: u.layerIndex, indices: [] };
            grouped[gkey].indices.push(u.effectIndex);
        }

        for (var gk in grouped) {
            var g = grouped[gk];
            var layer = g.comp.layer(g.layerIndex);
            if (!layer || !layer.Effects) continue;

            // Ordenar índices em ordem decrescente para deletar sem bagunçar
            g.indices.sort(function(a, b) { return b - a; });

            for (var j = 0; j < g.indices.length; j++) {
                try {
                    layer.Effects.property(g.indices[j]).remove();
                    count++;
                } catch (e) {
                    // Efeito pode já ter sido removido ou índice inválido
                }
            }
        }

        app.endUndoGroup();
        return count;
    }

    // --- HIGHLIGHT: selecionar camadas que têm o efeito ---
    function highlightLayers(key) {
        var uses = effectsMap[key];
        if (!uses || uses.length === 0) return;

        // Abrir a primeira comp que tem o efeito e selecionar as camadas
        var firstComp = uses[0].compItem;
        app.project.activeItem; // força foco
        firstComp.openInViewer();

        // Deselecionar tudo
        for (var l = 1; l <= firstComp.numLayers; l++) {
            firstComp.layer(l).selected = false;
        }

        // Selecionar camadas com esse efeito nessa comp
        for (var i = 0; i < uses.length; i++) {
            if (uses[i].compName === firstComp.name) {
                try {
                    firstComp.layer(uses[i].layerIndex).selected = true;
                } catch(e) {}
            }
        }
    }

    // --- INTERFACE GRÁFICA ---
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Effect Manager", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 8;
        win.margins = 12;

        // --- HEADER ---
        var headerGrp = win.add("group");
        headerGrp.orientation = "row";
        headerGrp.alignChildren = ["fill", "center"];
        headerGrp.spacing = 8;

        var titleText = headerGrp.add("statictext", undefined, "🔍 Effect Manager");
        titleText.graphics.font = ScriptUI.newFont("Arial", "BOLD", 14);

        var scanBtn = headerGrp.add("button", undefined, "Escanear Projeto");
        scanBtn.preferredSize = [130, 28];

        // --- FILTRO ---
        var filterGrp = win.add("group");
        filterGrp.orientation = "row";
        filterGrp.alignChildren = ["fill", "center"];
        filterGrp.spacing = 6;

        filterGrp.add("statictext", undefined, "Filtrar:");
        var filterInput = filterGrp.add("edittext", undefined, "");
        filterInput.preferredSize = [200, 22];

        var clearFilterBtn = filterGrp.add("button", undefined, "✕");
        clearFilterBtn.preferredSize = [28, 22];

        // --- LISTA DE EFEITOS ---
        var listLabel = win.add("statictext", undefined, "Efeitos encontrados no projeto:");
        var effectList = win.add("listbox", [0, 0, 460, 220], [], {
            multiselect: false,
            numberOfColumns: 2,
            showHeaders: true,
            columnTitles: ["Efeito [MatchName]", "Usos"],
            columnWidths: [370, 60]
        });

        // --- DETALHES ---
        var detailPanel = win.add("panel", undefined, "Onde é usado:");
        detailPanel.orientation = "column";
        detailPanel.alignChildren = ["fill", "top"];
        detailPanel.margins = 8;

        var detailList = detailPanel.add("listbox", [0, 0, 460, 130], [], {
            multiselect: false,
            numberOfColumns: 3,
            showHeaders: true,
            columnTitles: ["Composição", "Camada", "Efeito"],
            columnWidths: [160, 180, 100]
        });

        // --- BOTÕES DE AÇÃO ---
        var actionGrp = win.add("group");
        actionGrp.orientation = "row";
        actionGrp.alignChildren = ["fill", "center"];
        actionGrp.spacing = 8;

        var highlightBtn = actionGrp.add("button", undefined, "📌 Selecionar Camadas");
        highlightBtn.preferredSize = [160, 28];
        highlightBtn.enabled = false;

        var deleteBtn = actionGrp.add("button", undefined, "🗑 Deletar Todos os Usos");
        deleteBtn.preferredSize = [170, 28];
        deleteBtn.enabled = false;

        // --- STATUS ---
        var statusText = win.add("statictext", undefined, "Clique em 'Escanear Projeto' para começar.");
        statusText.alignment = ["fill", "center"];

        // --- HELPERS ---
        var allKeys = []; // lista de keys na mesma ordem da listbox

        function populateList(filter) {
            effectList.removeAll();
            allKeys = [];

            var lowerFilter = filter ? filter.toLowerCase() : "";

            for (var key in effectsMap) {
                if (lowerFilter && key.toLowerCase().indexOf(lowerFilter) === -1) continue;
                var count = effectsMap[key].length;
                var item = effectList.add("item", key);
                item.subItems[0].text = String(count);
                allKeys.push(key);
            }

            var total = allKeys.length;
            statusText.text = total + " efeito(s) encontrado(s)" + (lowerFilter ? " (filtrado)" : "") + ".";
            deleteBtn.enabled = false;
            highlightBtn.enabled = false;
            detailList.removeAll();
        }

        function showDetails(key) {
            detailList.removeAll();
            var uses = effectsMap[key];
            if (!uses) return;

            for (var i = 0; i < uses.length; i++) {
                var u = uses[i];
                var item = detailList.add("item", u.compName);
                item.subItems[0].text = u.layerName;
                item.subItems[1].text = u.effectName;
            }
        }

        // --- EVENTOS ---
        scanBtn.onClick = function () {
            statusText.text = "Escaneando...";
            win.update();
            scanProject();
            populateList(filterInput.text);
            var total = 0;
            for (var k in effectsMap) total++;
            statusText.text = total + " efeito(s) único(s) encontrado(s) no projeto.";
        };

        filterInput.onChanging = function () {
            populateList(filterInput.text);
        };

        clearFilterBtn.onClick = function () {
            filterInput.text = "";
            populateList("");
        };

        effectList.onChange = function () {
            if (effectList.selection === null) {
                deleteBtn.enabled = false;
                highlightBtn.enabled = false;
                detailList.removeAll();
                return;
            }
            var idx = effectList.selection.index;
            var key = allKeys[idx];
            showDetails(key);
            deleteBtn.enabled = true;
            highlightBtn.enabled = true;
            var count = effectsMap[key].length;
            statusText.text = '"' + effectList.selection.text.split(" [")[0] + '" — ' + count + " uso(s) encontrado(s).";
        };

        highlightBtn.onClick = function () {
            if (effectList.selection === null) return;
            var idx = effectList.selection.index;
            var key = allKeys[idx];
            highlightLayers(key);
            statusText.text = "Camadas selecionadas na primeira comp com esse efeito.";
        };

        deleteBtn.onClick = function () {
            if (effectList.selection === null) return;
            var idx = effectList.selection.index;
            var key = allKeys[idx];
            var uses = effectsMap[key];
            var effectDisplayName = uses[0].effectName;
            var count = uses.length;

            var confirm = Window.confirm(
                'Deletar o efeito "' + effectDisplayName + '" de ' + count + ' uso(s)?\n\n' +
                'Esta ação pode ser desfeita com Ctrl+Z.\n\n' +
                'Deseja continuar?'
            );
            if (!confirm) return;

            var deleted = deleteEffect(key);
            statusText.text = "✅ " + deleted + " instância(s) de '" + effectDisplayName + "' deletadas.";

            // Reatualizar lista
            scanProject();
            populateList(filterInput.text);
        };

        // --- LAYOUT ---
        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }

        return win;
    }

    buildUI(this);

})();
