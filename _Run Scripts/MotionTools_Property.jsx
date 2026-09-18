// ============================================================
// MOTION TOOLS PROPERTY INPUT - Módulo Independente
// ============================================================

function buildPropertyInputUI(parentPanel, buildSectionHelper, COLORS) {
    // piAvailableProps: array de arrays — cada entrada agrupa todas as props de mesmo nome vindas de layers diferentes
    // Ex: [[Stroke Width de layer1, Stroke Width de layer2], [Color de layer1, Color de layer2]]
    var piCurrentGroup = [];   // o array de props correspondente ao item selecionado no dropdown
    var piAvailableProps = []; // array de arrays (grupos)

    function piGetSelectedTargets() { var comp = app.project.activeItem; if (!(comp instanceof CompItem)) return []; return comp.selectedProperties; }

    function piValToStr(val) {
        if (val instanceof Array) { var parts = []; for (var i = 0; i < val.length; i++) parts.push(Math.round(val[i] * 100) / 100); return parts.join(", "); }
        else if (typeof val === "number") { return String(Math.round(val * 100) / 100); }
        else { return String(val); }
    }

    function piValsEqual(a, b) {
        if (a instanceof Array && b instanceof Array) {
            if (a.length !== b.length) return false;
            for (var i = 0; i < a.length; i++) { if (Math.abs(a[i] - b[i]) > 0.001) return false; }
            return true;
        }
        if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.001;
        return String(a) === String(b);
    }

    // Recebe um array de props (piCurrentGroup) e exibe valor único ou avisa múltiplos
    function piFormatCurrentValue(propGroup) {
        try {
            var comp = app.project.activeItem;
            var firstVal = propGroup[0].valueAtTime(comp.time, false);
            var allSame = true;
            for (var i = 1; i < propGroup.length; i++) {
                var v = propGroup[i].valueAtTime(comp.time, false);
                if (!piValsEqual(firstVal, v)) { allSame = false; break; }
            }
            if (!allSame) return "— múltiplos valores (" + propGroup.length + " layers)";
            return piValToStr(firstVal) + (propGroup.length > 1 ? "  [×" + propGroup.length + "]" : "");
        } catch (e) { return "—"; }
    }
    
    function piSolveMath(expr, currVal) {
        var s = expr.replace(/\s/g, ""); if (s === "") return null;
        if (s.charAt(0) === '+' || s.charAt(0) === '*' || s.charAt(0) === '/') s = String(currVal) + s;
        s = s.replace(/,/g, ".");
        try { var res = eval(s); return isNaN(res) ? null : Number(res); } catch (e) { return null; }
    }
    
    function piParseInput(rawText, prop, baseVal) {
        var text = rawText.replace(/\s/g, ""); if (text === "") return null;
        var currentVal = (baseVal !== undefined) ? baseVal : prop.valueAtTime(app.project.activeItem.time, false);
        if (currentVal instanceof Array) {
            var parts = rawText.split(","); var result = [];
            if (parts.length === 1) {
                var singleCheck = piSolveMath(parts[0], currentVal[0]); if (singleCheck === null) return null;
                for (var i = 0; i < currentVal.length; i++) { var v1 = piSolveMath(parts[0], currentVal[i]); result.push(v1 !== null ? v1 : currentVal[i]); }
            } else {
                for (var j = 0; j < currentVal.length; j++) {
                    if (j < parts.length && parts[j].replace(/\s/g, "") !== "") { var v2 = piSolveMath(parts[j], currentVal[j]); result.push(v2 !== null ? v2 : currentVal[j]); }
                    else { result.push(currentVal[j]); }
                }
            }
            return result;
        } else if (typeof currentVal === "number") { var v3 = piSolveMath(rawText, currentVal); return v3 !== null ? v3 : null; }
        else { if (text === "true") return true; if (text === "false") return false; return rawText; }
    }

    var piPanel = buildSectionHelper(parentPanel, "Property Input", COLORS.propertyInput[0], COLORS.propertyInput[1], COLORS.propertyInput[2], true);
    piPanel.margins = [6, 4, 6, 6];
    
    var piTopGrp = piPanel.add("group"); piTopGrp.orientation = "column"; piTopGrp.alignChildren = ["fill", "center"]; piTopGrp.spacing = 4;
    var piDdlProps = piTopGrp.add("dropdownlist", undefined, ["Nenhuma seleção"]); piDdlProps.selection = 0; piDdlProps.alignment = ["fill", "center"];
    var piLblValue = piTopGrp.add("statictext", undefined, ""); piLblValue.justify = "center"; piLblValue.alignment = ["fill", "center"]; piLblValue.graphics.font = ScriptUI.newFont("dialog", "BOLD", 10);
    
    var piInputGrp = piPanel.add("group"); piInputGrp.orientation = "row"; piInputGrp.alignChildren = ["fill", "center"]; piInputGrp.spacing = 4;
    var piInputField = piInputGrp.add("edittext", undefined, ""); piInputField.preferredSize = [120, 24]; piInputField.helpTip = "Ex: 1920/2, +50, *2";
    var piBtnApply = piInputGrp.add("button", undefined, "✓"); piBtnApply.preferredSize = [28, 24];
    
    var piLblStatus = piPanel.add("statictext", undefined, "Selecione um Efeito"); piLblStatus.justify = "center"; piLblStatus.alignment = ["fill", "center"];
    var piBtnRefresh = piPanel.add("button", undefined, "↺  Puxar Opções"); piBtnRefresh.preferredSize = [-1, 22];

    function piUpdateValueText() { if (piCurrentGroup && piCurrentGroup.length > 0) piLblValue.text = "Atual: " + piFormatCurrentValue(piCurrentGroup); else piLblValue.text = ""; }
    
    // Nomes de propriedades internas do AE que são não-editáveis em shape layers
    // (Blending Mode, Composite, etc.) — filtradas para não poluir o dropdown
    var PI_SKIP_NAMES = {
        "Blending Mode": true, "Blend Mode": true, "Composite": true,
        "Preserve Underlying Transparency": true, "Casts Shadows": true,
        "Accepts Shadows": true, "Accepts Lights": true
    };

    function piCollectEditableProps(group, outProps, outNames) {
        for (var i = 1; i <= group.numProperties; i++) {
            var child = group.property(i);
            if (child.propertyType === PropertyType.PROPERTY) {
                // Inclui somente se: canSetExpression OU setValue funciona (isModifiable)
                // e não é uma prop de lista interna não-numérica conhecida como inútil
                if (PI_SKIP_NAMES[child.name]) continue;
                try {
                    // propertyValueType === CUSTOM_VALUE ou NO_VALUE são não-editáveis
                    var pvt = child.propertyValueType;
                    if (pvt === PropertyValueType.CUSTOM_VALUE || pvt === PropertyValueType.NONE) continue;
                } catch(e) {}
                outProps.push(child);
                outNames.push(child.name);
            }
            // Não desce em sub-grupos (ex: Dashes dentro de Stroke) para não explodir a lista
        }
    }

    function piRefreshPropInfo() {
        piAvailableProps = []; var tempNames = []; var selItems = piGetSelectedTargets();

        if (selItems.length > 0) {
            // Caso 1: props individuais selecionadas (possivelmente de layers diferentes)
            // Agrupa por nome: props com mesmo nome vão para o mesmo slot do dropdown
            var hasDirectProps = false;
            var nameIndex = {}; // nome → índice em piAvailableProps

            for (var si = 0; si < selItems.length; si++) {
                var item = selItems[si];
                if (item.propertyType === PropertyType.PROPERTY) {
                    hasDirectProps = true;
                    if (PI_SKIP_NAMES[item.name]) continue;
                    try {
                        var pvt2 = item.propertyValueType;
                        if (pvt2 === PropertyValueType.CUSTOM_VALUE || pvt2 === PropertyValueType.NONE) continue;
                    } catch(e) {}

                    var nm = item.name;
                    if (nameIndex.hasOwnProperty(nm)) {
                        // já existe um slot para este nome — adiciona ao grupo
                        piAvailableProps[nameIndex[nm]].push(item);
                    } else {
                        nameIndex[nm] = piAvailableProps.length;
                        piAvailableProps.push([item]);
                        tempNames.push(nm);
                    }
                }
            }

            // Caso 2: grupo selecionado — lista filhos editáveis (cada filho vira um slot)
            if (!hasDirectProps) {
                for (var gi = 0; gi < selItems.length; gi++) {
                    var grpItem = selItems[gi];
                    if (grpItem.propertyType === PropertyType.NAMED_GROUP || grpItem.propertyType === PropertyType.INDEXED_GROUP) {
                        var tmpP = [], tmpN = [];
                        piCollectEditableProps(grpItem, tmpP, tmpN);
                        for (var ci = 0; ci < tmpP.length; ci++) {
                            piAvailableProps.push([tmpP[ci]]);
                            tempNames.push(tmpN[ci]);
                        }
                        break;
                    }
                }
            }
        }

        piDdlProps.removeAll();
        if (piAvailableProps.length > 0) {
            for (var j = 0; j < tempNames.length; j++) piDdlProps.add("item", tempNames[j]);
            piDdlProps.selection = 0; piCurrentGroup = piAvailableProps[0]; piLblStatus.text = "\u270f\ufe0f Digite a conta.";
        } else {
            piDdlProps.add("item", "Nenhuma seleção"); piDdlProps.selection = 0;
            piCurrentGroup = []; piLblStatus.text = "\u26A0 Selecione Efeito/Propriedade.";
        }
        piUpdateValueText();
        try { var root = parentPanel; while (root.parent) root = root.parent; if (root.layout) root.layout.layout(true); } catch(e){}
    }

    function piApplyValue() {
        if (!piCurrentGroup || piCurrentGroup.length === 0) { piLblStatus.text = "\u26A0 Puxe uma propriedade."; return; }
        var raw = piInputField.text;
        try {
            app.beginUndoGroup("PropertyInput");
            var totalCount = 0;

            for (var pi = 0; pi < piCurrentGroup.length; pi++) {
                var prop = piCurrentGroup[pi];
                var selectedKeys = prop.selectedKeys;

                if (selectedKeys && selectedKeys.length > 0) {
                    for (var i = 0; i < selectedKeys.length; i++) {
                        var keyIdx = selectedKeys[i];
                        var keyBase = prop.keyValue(keyIdx);
                        var newVal = piParseInput(raw, prop, keyBase);
                        if (newVal === null) continue;
                        prop.setValueAtKey(keyIdx, newVal);
                        totalCount++;
                    }
                } else {
                    var newVal2 = piParseInput(raw, prop);
                    if (newVal2 === null) continue;
                    if (prop.isTimeVarying) { prop.setValueAtTime(app.project.activeItem.time, newVal2); }
                    else { prop.setValue(newVal2); }
                    totalCount++;
                }
            }

            app.endUndoGroup();
            if (totalCount > 0) {
                piLblStatus.text = "\u2713 " + totalCount + " alterado(s) em " + piCurrentGroup.length + " layer(s).";
            } else {
                piLblStatus.text = "\u26A0 Valor inv\u00e1lido.";
            }
            piUpdateValueText();
            piInputField.active = false; piInputField.active = true;
        } catch(e) { app.endUndoGroup(); piLblStatus.text = "\u2717 Erro: " + e.message; }
    }
    
    piDdlProps.onChange = function() { if (piDdlProps.selection && piAvailableProps.length > 0) { piCurrentGroup = piAvailableProps[piDdlProps.selection.index]; piUpdateValueText(); } };
    piInputField.addEventListener("keydown", function(event) { if (event.keyName === "Enter") { piApplyValue(); event.preventDefault(); } });
    piBtnApply.onClick = piApplyValue; piBtnRefresh.onClick = function() { piRefreshPropInfo(); };
    
    piRefreshPropInfo();
}