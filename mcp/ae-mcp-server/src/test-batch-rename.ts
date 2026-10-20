import { batchRenameCompositions } from "./tools.js";

async function main() {
  console.log("🔄 Renomeando todas as composições do projeto para o padrão 'comp_xx'...");
  const result = await batchRenameCompositions("comp_");
  console.log("Resultado:", JSON.stringify(result, null, 2));
}

main().catch(console.error);
