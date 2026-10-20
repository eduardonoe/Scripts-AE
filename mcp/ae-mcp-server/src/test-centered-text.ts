import { runExtendScript } from "./ae-runner.js";

async function createTestComp() {
  const script = `
    var proj = app.project;
    var compName = "Teste Texto Vermelho";
    var comp = proj.items.addComp(compName, 1920, 1080, 1.0, 10.0, 30.0);
    comp.openInViewer();

    // 1. Criar sólido de fundo vermelho
    var redSolid = comp.layers.addSolid([0.88, 0.12, 0.15], "BG Vermelho", 1920, 1080, 1.0);

    // 2. Criar camada de texto
    var textLayer = comp.layers.addText("isso é um teste");
    textLayer.name = "Texto Centralizado";

    // 3. Centralizar alinhamento do parágrafo, ajustar tamanho e cor branca
    var textProp = textLayer.property("Source Text");
    var textDoc = textProp.value;
    textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
    textDoc.fontSize = 100;
    textDoc.fillColor = [1, 1, 1];
    textDoc.applyFill = true;
    textProp.setValue(textDoc);

    // 4. Posicionar no centro exato da tela
    textLayer.property("Position").setValue([comp.width / 2, comp.height / 2]);

    return {
        success: true,
        message: "Composição com fundo vermelho e texto centralizado criada com sucesso!",
        comp: {
            name: comp.name,
            width: comp.width,
            height: comp.height
        }
    };
  `;

  const result = await runExtendScript(script);
  console.log("Resultado:", result);
}

createTestComp().catch(console.error);
