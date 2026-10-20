import { runExtendScript } from "./ae-runner.js";
async function main() {
    console.log("🎨 Adicionando efeito 'Fill' azul em todas as camadas de texto...");
    const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && (item.name === "comp_01" || item.name === "Comp 1")) {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição 'comp_01' não encontrada." };

    var blueColor = [0.08, 0.52, 1.0]; // Azul vibrante / Electric Blue
    var affectedLayers = [];

    for (var j = 1; j <= foundComp.numLayers; j++) {
        var layer = foundComp.layer(j);
        if (layer instanceof TextLayer) {
            var effect = null;

            // Tenta adicionar pelo matchName universal
            try {
                effect = layer.property("ADBE Effect Parade").addProperty("ADBE Fill");
            } catch(e) {
                try {
                    effect = layer.property("ADBE Effect Parade").addProperty("Fill");
                } catch(e2) {
                    try {
                        effect = layer.property("ADBE Effect Parade").addProperty("Preenchimento");
                    } catch(e3) {}
                }
            }

            if (effect) {
                try {
                    effect.property("Color").setValue(blueColor);
                } catch(eColor) {
                    try {
                        effect.property(2).setValue(blueColor);
                    } catch(eProp2) {}
                }
                affectedLayers.push(layer.name);
            }
        }
    }

    return {
        success: true,
        message: "Efeito Fill azul adicionado com sucesso em " + affectedLayers.length + " camadas de texto!",
        comp: foundComp.name,
        layers: affectedLayers
    };
  `;
    const result = await runExtendScript(script);
    console.log("Resultado:", JSON.stringify(result, null, 2));
}
main().catch(console.error);
