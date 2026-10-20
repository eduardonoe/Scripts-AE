import { runExtendScript } from "./ae-runner.js";

async function main() {
  console.log("🔤 Alterando todas as fontes do projeto para 'Segoe UI'...");

  const script = `
    var proj = app.project;
    var updatedLayers = [];

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem) {
            for (var j = 1; j <= item.numLayers; j++) {
                var layer = item.layer(j);
                if (layer instanceof TextLayer) {
                    var textProp = layer.property("Source Text");
                    var textDoc = textProp.value;
                    var successFont = null;

                    // Tenta os nomes de fonte PostScript / Familia do Segoe UI
                    var fontCandidates = ["SegoeUI", "Segoe UI", "SegoeUI-Semibold", "SegoeUI-Bold"];
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
        message: "Fontes alteradas com sucesso em " + updatedLayers.length + " camadas de texto!",
        updated: updatedLayers
    };
  `;

  const result = await runExtendScript(script);
  console.log("Resultado da troca de fontes:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
