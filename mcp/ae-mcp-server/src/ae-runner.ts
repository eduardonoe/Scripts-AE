import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório universal da ponte na pasta Temp do usuário e na pasta do pacote
const TEMP_BRIDGE_DIR = path.join(os.tmpdir(), "ae_bridge");
const PACKAGE_BRIDGE_DIR = path.resolve(__dirname, "..", ".ae_bridge");

const BRIDGE_DIRS = [PACKAGE_BRIDGE_DIR, TEMP_BRIDGE_DIR];

for (const dir of BRIDGE_DIRS) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
}

/**
 * Executa um código ExtendScript dentro do After Effects através da ponte em tempo real (.ae_bridge)
 */
export async function runExtendScript<T = any>(scriptBody: string): Promise<T> {
  const taskId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const payload = {
    id: taskId,
    code: scriptBody,
  };

  // Limpa resultados antigos e escreve a tarefa em todos os diretórios monitorados
  for (const dir of BRIDGE_DIRS) {
    const resultPath = path.join(dir, "result.json");
    if (fs.existsSync(resultPath)) {
      try {
        fs.unlinkSync(resultPath);
      } catch {}
    }

    const taskPath = path.join(dir, "task.json");
    try {
      fs.writeFileSync(taskPath, JSON.stringify(payload), "utf-8");
    } catch {}
  }

  // Aguarda o After Effects processar e responder
  const startTime = Date.now();
  const timeoutMs = 8000;

  while (Date.now() - startTime < timeoutMs) {
    for (const dir of BRIDGE_DIRS) {
      const resultPath = path.join(dir, "result.json");
      if (fs.existsSync(resultPath)) {
        try {
          const rawResult = fs.readFileSync(resultPath, "utf-8");
          if (rawResult && rawResult.trim().length > 0) {
            const parsed = JSON.parse(rawResult);
            if (parsed.id === taskId) {
              // Limpa os arquivos de resultado consumidos
              try {
                fs.unlinkSync(resultPath);
              } catch {}

              if (!parsed.success) {
                throw new Error(parsed.error || "Erro desconhecido no ExtendScript");
              }

              return parsed.data as T;
            }
          }
        } catch (readErr: any) {
          if (readErr.message && readErr.message.includes("Erro")) {
            throw readErr;
          }
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(
    "Tempo limite esgotado aguardando resposta do After Effects.\n" +
      "Certifique-se de que o After Effects está aberto e com o script da ponte em execução."
  );
}
