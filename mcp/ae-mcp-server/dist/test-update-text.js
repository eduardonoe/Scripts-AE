import { updateTextLayer } from "./tools.js";
async function main() {
    console.log("📝 Atualizando o texto da composição 'Teste Texto Vermelho'...");
    const result = await updateTextLayer("Teste Texto Vermelho", "", "nem acredito q funcionou");
    console.log("Resultado:", result);
}
main().catch(console.error);
