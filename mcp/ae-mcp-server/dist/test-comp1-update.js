import { runExtendScript } from "./ae-runner.js";
async function main() {
    const n1 = Math.floor(Math.random() * 1001);
    const n2 = Math.floor(Math.random() * 1001);
    const n3 = Math.floor(Math.random() * 1001);
    console.log(`🎲 Números aleatórios gerados: [${n1}, ${n2}, ${n3}]`);
    console.log("⚙️ Atualizando propriedades e criando as 3 camadas de texto na comp_01...");
    const script = `
    var proj = app.project;
    var foundComp = null;

    // Procura por 'comp_01' ou 'Comp 1' ou 'comp 1'
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem) {
            if (item.name.toLowerCase() === "comp_01" || item.name.toLowerCase() === "comp 1" || item.name.toLowerCase() === "comp1") {
                foundComp = item;
                break;
            }
        }
    }

    if (!foundComp && proj.numItems > 0) {
        // Fallback: pega a primeira comp
        for (var k = 1; k <= proj.numItems; k++) {
            if (proj.item(k) instanceof CompItem) {
                foundComp = proj.item(k);
                break;
            }
        }
    }

    if (!foundComp) return { error: "Nenhuma composição encontrada." };

    // 1. Altera resolução para 1920x1080
    foundComp.width = 1920;
    foundComp.height = 1080;
    foundComp.openInViewer();

    // 2. Cria as 3 camadas de texto com os números aleatórios
    var numbers = [${n1}, ${n2}, ${n3}];
    var yPositions = [350, 540, 730];
    var colors = [
        [0.2, 0.8, 1.0],  // Cyan
        [1.0, 0.85, 0.2], // Dourado / Amarelo
        [0.3, 1.0, 0.4]   // Verde vibrante
    ];

    var createdLayers = [];

    for (var idx = 0; idx < numbers.length; idx++) {
        var numVal = numbers[idx];
        var textLayer = foundComp.layers.addText("Número: " + numVal);
        textLayer.name = "Random_" + (idx + 1) + " (" + numVal + ")";

        var textProp = textLayer.property("Source Text");
        var textDoc = textProp.value;
        textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
        textDoc.fontSize = 80;
        textDoc.fillColor = colors[idx];
        textDoc.applyFill = true;
        textProp.setValue(textDoc);

        textLayer.property("Position").setValue([foundComp.width / 2, yPositions[idx]]);

        createdLayers.push({
            name: textLayer.name,
            value: numVal,
            position: [foundComp.width / 2, yPositions[idx]]
        });
    }

    return {
        success: true,
        message: "Composição '" + foundComp.name + "' atualizada para 1920x1080 com 3 camadas de números aleatórios!",
        comp: {
            name: foundComp.name,
            width: foundComp.width,
            height: foundComp.height
        },
        layersCreated: createdLayers
    };
  `;
    const result = await runExtendScript(script);
    console.log("Resultado da operação:", JSON.stringify(result, null, 2));
}
main().catch(console.error);
