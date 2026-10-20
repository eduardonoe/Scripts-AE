import { runExtendScript } from "./ae-runner.js";

/**
 * Retorna as Composições, Camadas de Texto e Camadas de Mídia do projeto atual.
 */
export async function getProjectElements() {
  const script = `
    var proj = app.project;
    var result = { comps: [] };

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem) {
            var compObj = {
                name: item.name,
                id: item.id,
                width: item.width,
                height: item.height,
                duration: item.duration,
                frameRate: item.frameRate,
                layers: []
            };
            
            for (var j = 1; j <= item.numLayers; j++) {
                var layer = item.layer(j);
                
                var type = "other";
                var sourceName = layer.source ? layer.source.name : null;

                if (layer instanceof TextLayer) {
                    type = "text";
                } else if (layer instanceof AVLayer) {
                    if (layer.source && layer.source instanceof FootageItem) {
                        type = layer.source.mainSource instanceof SolidSource ? "solid" : "footage";
                    } else if (layer.source && layer.source instanceof CompItem) {
                        type = "comp";
                    } else {
                        type = "av";
                    }
                } else if (layer instanceof ShapeLayer) {
                    type = "shape";
                } else if (layer instanceof CameraLayer) {
                    type = "camera";
                } else if (layer instanceof LightLayer) {
                    type = "light";
                }

                var layerInfo = {
                    name: layer.name,
                    type: type,
                    index: layer.index,
                    sourceName: sourceName
                };
                
                if (type === "text") {
                    try {
                        var textProp = layer.property("Source Text");
                        if (textProp) {
                            layerInfo.currentText = textProp.value.text;
                        }
                    } catch(e) {}
                }
                
                compObj.layers.push(layerInfo);
            }
            
            result.comps.push(compObj);
        }
    }
    return result;
  `;
  
  return runExtendScript(script);
}

/**
 * Localiza composições por nome (busca parcial ou exata, sem diferenciar maiúsculas/minúsculas)
 */
export async function findCompositions(query: string) {
  const safeQuery = query.toLowerCase().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  
  const script = `
    var proj = app.project;
    var matches = [];
    var q = "${safeQuery}".toLowerCase();

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem) {
            if (item.name.toLowerCase().indexOf(q) !== -1) {
                var layersSummary = [];
                for (var j = 1; j <= item.numLayers; j++) {
                    var layer = item.layer(j);
                    layersSummary.push({
                        name: layer.name,
                        index: layer.index,
                        type: (layer instanceof TextLayer) ? "text" : (layer.source && layer.source instanceof CompItem ? "comp" : "other")
                    });
                }
                matches.push({
                    name: item.name,
                    id: item.id,
                    width: item.width,
                    height: item.height,
                    duration: item.duration,
                    frameRate: item.frameRate,
                    layers: layersSummary
                });
            }
        }
    }
    return { count: matches.length, results: matches };
  `;

  return runExtendScript(script);
}

/**
 * Altera o nome de uma composição existente
 */
export async function renameComposition(currentName: string, newName: string) {
  const safeCurrent = currentName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeNew = newName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeCurrent}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeCurrent}' não encontrada." };

    foundComp.name = "${safeNew}";
    return { success: true, message: "Composição renomeada de '${safeCurrent}' para '${safeNew}' com sucesso." };
  `;

  return runExtendScript(script);
}

/**
 * Altera propriedades fundamentais de uma composição (Dimensões, Duração, FPS, Nome)
 */
export async function updateCompositionSettings(
  compName: string,
  settings: { width?: number; height?: number; duration?: number; frameRate?: number; newName?: string }
) {
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  
  let modificationsCode = "";
  if (settings.width) modificationsCode += `foundComp.width = ${settings.width};\n`;
  if (settings.height) modificationsCode += `foundComp.height = ${settings.height};\n`;
  if (settings.duration) modificationsCode += `foundComp.duration = ${settings.duration};\n`;
  if (settings.frameRate) modificationsCode += `foundComp.frameRate = ${settings.frameRate};\n`;
  if (settings.newName) {
    const safeNewName = settings.newName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    modificationsCode += `foundComp.name = "${safeNewName}";\n`;
  }

  const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };

    ${modificationsCode}

    return {
        success: true,
        message: "Propriedades da composição atualizadas com sucesso.",
        updated: {
            name: foundComp.name,
            width: foundComp.width,
            height: foundComp.height,
            duration: foundComp.duration,
            frameRate: foundComp.frameRate
        }
    };
  `;

  return runExtendScript(script);
}

/**
 * Atualiza o texto de uma camada dentro de uma composição específica
 */
export async function updateTextLayer(compName: string, layerName: string, newText: string) {
  const safeText = newText.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeLayer = layerName ? layerName.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : "";

  const script = `
    var proj = app.project;
    var foundComp = null;
    var foundLayer = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };

    // Tenta achar pelo nome exato ou primeiro texto
    if ("${safeLayer}") {
        for (var j = 1; j <= foundComp.numLayers; j++) {
            var layer = foundComp.layer(j);
            if (layer.name === "${safeLayer}" && layer instanceof TextLayer) {
                foundLayer = layer;
                break;
            }
        }
    }

    if (!foundLayer) {
        for (var k = 1; k <= foundComp.numLayers; k++) {
            var l = foundComp.layer(k);
            if (l instanceof TextLayer) {
                foundLayer = l;
                break;
            }
        }
    }

    if (!foundLayer) return { error: "Nenhuma camada de texto encontrada na composição '${safeComp}'." };

    var textProp = foundLayer.property("Source Text");
    var textDocument = textProp.value;
    textDocument.text = "${safeText}";
    textProp.setValue(textDocument);

    return { success: true, message: "Texto atualizado com sucesso na camada '" + foundLayer.name + "' para: '${safeText}'." };
  `;

  return runExtendScript(script);
}

/**
 * Substitui o arquivo base (footage) de uma camada específica
 */
export async function replaceFootage(compName: string, layerName: string, newFilePath: string) {
  const safePath = newFilePath.replace(/\\/g, "/");
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeLayer = layerName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
    var proj = app.project;
    var foundComp = null;
    var foundLayer = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };

    for (var j = 1; j <= foundComp.numLayers; j++) {
        var layer = foundComp.layer(j);
        if (layer.name === "${safeLayer}") {
            foundLayer = layer;
            break;
        }
    }

    if (!foundLayer) return { error: "Camada '${safeLayer}' não encontrada na composição '${safeComp}'." };
    if (!foundLayer.source || !(foundLayer.source instanceof FootageItem)) {
        return { error: "Camada '${safeLayer}' não é um FootageItem (não pode ser substituída dessa forma)." };
    }

    var newFile = new File("${safePath}");
    if (!newFile.exists) {
        return { error: "O arquivo especificado não existe: " + "${safePath}" };
    }

    foundLayer.source.replace(newFile);
    return { success: true, message: "Mídia substituída com sucesso na camada '${safeLayer}'." };
  `;

  return runExtendScript(script);
}

/**
 * Substitui a origem (source) de uma camada por outro item do projeto (como uma pré-composição)
 */
export async function replaceLayerSource(compName: string, layerName: string, newSourceName: string) {
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeLayer = layerName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeSource = newSourceName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
    var proj = app.project;
    var foundComp = null;
    var foundLayer = null;
    var newSourceItem = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item.name === "${safeSource}") {
            newSourceItem = item;
        }
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };
    if (!newSourceItem) return { error: "Novo item de origem '${safeSource}' não encontrado no projeto." };

    for (var j = 1; j <= foundComp.numLayers; j++) {
        var layer = foundComp.layer(j);
        if (layer.name === "${safeLayer}") {
            foundLayer = layer;
            break;
        }
    }

    if (!foundLayer) return { error: "Camada '${safeLayer}' não encontrada na composição '${safeComp}'." };
    if (!foundLayer.replaceSource) {
        return { error: "A camada '${safeLayer}' não suporta substituição de source." };
    }

    foundLayer.replaceSource(newSourceItem, true);
    return { success: true, message: "Source da camada '${safeLayer}' substituído por '${safeSource}' com sucesso." };
  `;

  return runExtendScript(script);
}

/**
 * Envia uma composição para a fila de renderização (Render Queue)
 */
export async function renderComposition(compName: string, outputPath: string) {
  const safePath = outputPath.replace(/\\/g, "/");
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };

    var rq = proj.renderQueue;
    var rqItem = rq.items.add(foundComp);
    var outputModule = rqItem.outputModule(1);
    
    var file = new File("${safePath}");
    outputModule.file = file;

    return { success: true, message: "Composição '${safeComp}' adicionada à fila de renderização com destino: ${safePath}." };
  `;

  return runExtendScript(script);
}

/**
 * Executa código ExtendScript customizado diretamente no After Effects
 */
export async function runCustomScript(scriptCode: string) {
  return runExtendScript(scriptCode);
}

/**
 * Cria uma nova composição no projeto
 */
export async function createComposition(
  name: string,
  width: number = 1920,
  height: number = 1080,
  duration: number = 10.0,
  frameRate: number = 30.0,
  pixelAspect: number = 1.0
) {
  const safeName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
    var proj = app.project;
    var newComp = proj.items.addComp("${safeName}", ${width}, ${height}, ${pixelAspect}, ${duration}, ${frameRate});
    newComp.openInViewer();
    return {
        success: true,
        message: "Composição '${safeName}' criada com sucesso!",
        comp: {
            id: newComp.id,
            name: newComp.name,
            width: newComp.width,
            height: newComp.height,
            duration: newComp.duration,
            frameRate: newComp.frameRate
        }
    };
  `;

  return runExtendScript(script);
}

/**
 * Cria uma nova camada de texto dentro de uma composição
 */
export async function createTextLayer(compName: string, text: string, layerName?: string) {
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  const safeLayerName = layerName ? layerName.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : "";

  const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };

    var textLayer = foundComp.layers.addText("${safeText}");
    ${safeLayerName ? `textLayer.name = "${safeLayerName}";` : ""}

    return {
        success: true,
        message: "Camada de texto criada com sucesso na composição '${safeComp}'.",
        layer: {
            name: textLayer.name,
            index: textLayer.index
        }
    };
  `;

  return runExtendScript(script);
}

/**
 * Cria uma camada de sólido (Solid) dentro de uma composição
 */
export async function createSolidLayer(
  compName: string,
  layerName: string,
  color: [number, number, number] = [0.1, 0.1, 0.1],
  width?: number,
  height?: number
) {
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeName = layerName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };

    var w = ${width || "foundComp.width"};
    var h = ${height || "foundComp.height"};
    var solid = foundComp.layers.addSolid([${color[0]}, ${color[1]}, ${color[2]}], "${safeName}", w, h, foundComp.pixelAspect);

    return {
        success: true,
        message: "Camada sólida '${safeName}' criada com sucesso.",
        layer: {
            name: solid.name,
            index: solid.index
        }
    };
  `;

  return runExtendScript(script);
}

/**
 * Renomeia todas as composições do projeto seguindo um padrão sequencial (ex: "comp_01", "comp_02")
 */
export async function batchRenameCompositions(prefix: string = "comp_") {
  const safePrefix = prefix.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  const script = `
    var proj = app.project;
    var comps = [];
    
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem) {
            comps.push(item);
        }
    }

    var renamedList = [];
    for (var j = 0; j < comps.length; j++) {
        var num = j + 1;
        var numStr = (num < 10 ? "0" : "") + num;
        var oldName = comps[j].name;
        var newName = "${safePrefix}" + numStr;
        comps[j].name = newName;
        renamedList.push({
            oldName: oldName,
            newName: newName,
            id: comps[j].id
        });
    }

    return {
        success: true,
        message: comps.length + " composições renomeadas com sucesso para o padrão '${safePrefix}xx'.",
        total: comps.length,
        renamed: renamedList
    };
  `;

  return runExtendScript(script);
}

/**
 * Anima a posição de uma camada ou de todas as camadas de texto de uma composição
 */
export async function animatePosition(
  compName: string,
  startFrame: number,
  endFrame: number,
  startXPercent: number = 0.20,
  endXPercent: number = 0.80,
  layerName?: string
) {
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeLayer = layerName ? layerName.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : "";

  const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };

    var fps = foundComp.frameRate;
    var startTime = ${startFrame} / fps;
    var endTime = ${endFrame} / fps;
    var startX = foundComp.width * ${startXPercent};
    var endX = foundComp.width * ${endXPercent};

    var animatedLayers = [];

    for (var j = 1; j <= foundComp.numLayers; j++) {
        var layer = foundComp.layer(j);
        var shouldAnimate = "${safeLayer}" ? (layer.name === "${safeLayer}") : (layer instanceof TextLayer);

        if (shouldAnimate) {
            var posProp = layer.property("Transform").property("Position");
            var curPos = posProp.value;
            var curY = curPos[1];
            var curZ = curPos.length > 2 ? curPos[2] : 0;

            while (posProp.numKeys > 0) {
                posProp.removeKey(1);
            }

            posProp.setValueAtTime(startTime, [startX, curY, curZ]);
            posProp.setValueAtTime(endTime, [endX, curY, curZ]);

            try {
                var easeIn = new KeyframeEase(0, 33.33);
                var easeOut = new KeyframeEase(0, 33.33);
                posProp.setTemporalEaseAtKey(1, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
                posProp.setTemporalEaseAtKey(2, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
            } catch(e) {}

            animatedLayers.push(layer.name);
        }
    }

    return {
        success: true,
        message: "Animação de posição aplicada em: " + animatedLayers.join(", "),
        layers: animatedLayers
    };
  `;

  return runExtendScript(script);
}

/**
 * Adiciona o efeito 'Fill' (Preenchimento) com cor personalizada a camadas de uma composição
 */
export async function applyFillEffect(
  compName: string,
  color: [number, number, number] = [0.08, 0.52, 1.0],
  layerName?: string
) {
  const safeComp = compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeLayer = layerName ? layerName.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : "";

  const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && item.name === "${safeComp}") {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição '${safeComp}' não encontrada." };

    var col = [${color[0]}, ${color[1]}, ${color[2]}];
    var affected = [];

    for (var j = 1; j <= foundComp.numLayers; j++) {
        var layer = foundComp.layer(j);
        var match = "${safeLayer}" ? (layer.name === "${safeLayer}") : (layer instanceof TextLayer);

        if (match) {
            var effect = null;
            try {
                effect = layer.property("ADBE Effect Parade").addProperty("ADBE Fill");
            } catch(e) {
                try {
                    effect = layer.property("ADBE Effect Parade").addProperty("Fill");
                } catch(e2) {}
            }

            if (effect) {
                try {
                    effect.property("Color").setValue(col);
                } catch(eColor) {
                    try {
                        effect.property(2).setValue(col);
                    } catch(eProp2) {}
                }
                affected.push(layer.name);
            }
        }
    }

    return {
        success: true,
        message: "Efeito Fill aplicado com sucesso em: " + affected.join(", "),
        layers: affected
    };
  `;

  return runExtendScript(script);
}

/**
 * Altera a família tipográfica (fonte) de camadas de texto no projeto ou em uma composição específica
 */
export async function changeFont(fontFamily: string = "SegoeUI", compName?: string) {
  const safeFont = fontFamily.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeComp = compName ? compName.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : "";

  const script = `
    var proj = app.project;
    var updatedLayers = [];

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem) {
            if ("${safeComp}" && item.name !== "${safeComp}") {
                continue;
            }

            for (var j = 1; j <= item.numLayers; j++) {
                var layer = item.layer(j);
                if (layer instanceof TextLayer) {
                    var textProp = layer.property("Source Text");
                    var textDoc = textProp.value;
                    var successFont = null;

                    var fontCandidates = ["${safeFont}", "${safeFont}".replace(/\\s+/g, ""), "${safeFont}-Regular"];
                    for (var f = 0; f < fontCandidates.length; f++) {
                        try {
                            textDoc.font = fontCandidates[f];
                            textProp.setValue(textDoc);
                            successFont = fontCandidates[f];
                            break;
                        } catch(eFont) {}
                    }

                    if (successFont) {
                        updatedLayers.push({
                            comp: item.name,
                            layer: layer.name,
                            font: successFont
                        });
                    }
                }
            }
        }
    }

    return {
        success: true,
        message: "Fonte alterada para '${safeFont}' em " + updatedLayers.length + " camadas de texto!",
        updated: updatedLayers
    };
  `;

  return runExtendScript(script);
}





