import { createComposition, createTextLayer, createSolidLayer } from "./tools.js";
async function test() {
    console.log("🎬 Criando nova composição no After Effects...");
    const compResult = await createComposition("🚀 Campanha IA 2026", 1080, 1920, 15, 30);
    console.log("Composição criada:", compResult);
    console.log("🎨 Adicionando camada sólida de fundo...");
    await createSolidLayer("🚀 Campanha IA 2026", "BG Fundo", [0.08, 0.08, 0.12]);
    console.log("✍️ Criando camada de texto...");
    await createTextLayer("🚀 Campanha IA 2026", "NOVO PROJETO COM IA", "Titulo Principal");
    console.log("✨ Tudo criado com sucesso!");
}
test();
