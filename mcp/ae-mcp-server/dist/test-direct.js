import { getProjectElements, updateTextLayer } from "./tools.js";
async function runTest() {
    console.log("🔍 Verificando o projeto aberto no After Effects...");
    try {
        const projectInfo = await getProjectElements();
        console.log("\n📁 Estrutura encontrada no After Effects:");
        console.log(JSON.stringify(projectInfo, null, 2));
        if (projectInfo.comps && projectInfo.comps.length > 0) {
            const firstComp = projectInfo.comps[0];
            console.log(`\n✨ Composição encontrada: "${firstComp.name}"`);
            const textLayer = firstComp.layers.find((l) => l.type === "text");
            if (textLayer) {
                console.log(`📝 Camada de texto encontrada: "${textLayer.name}" (Texto atual: "${textLayer.currentText || ''}")`);
                console.log("⚡ Atualizando o texto da camada via MCP...");
                const updateResult = await updateTextLayer(firstComp.name, textLayer.name, "🚀 Automação MCP com IA Funcionando 100%!");
                console.log("\n🎉 Resultado da alteração:");
                console.log(updateResult);
            }
            else {
                console.log("⚠️ Nenhuma camada de texto encontrada na composição. Crie uma camada de texto para testarmos a alteração.");
            }
        }
        else {
            console.log("⚠️ Nenhuma composição encontrada no projeto aberto.");
        }
    }
    catch (err) {
        console.error("\n❌ Erro ao interagir com o After Effects:", err.message);
    }
}
runTest();
