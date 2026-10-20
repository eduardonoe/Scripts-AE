# 🎬 After Effects MCP Server

Servidor de automação em tempo real para **Adobe After Effects** via [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

Permite que assistentes de IA (Claude Desktop, Cursor, Antigravity, VS Code, etc.) controlem o After Effects aberto na sua máquina com latência ultrabaixa (~100ms), sem travar a interface e sem precisar reiniciar o programa.

---

## ⚡ Como Usar em Outra Máquina (Passo a Passo)

### 1. Copiar os arquivos
Copie a pasta `ae-mcp-server` para a nova máquina (você pode colocar em qualquer lugar, ex: `C:\ae-mcp-server` ou `D:\ae-mcp-server`).

> **Requisitos na nova máquina:**
> * **Node.js** instalado (v18 ou superior).
> * **Adobe After Effects** (2024, 2025, 2026 ou superior).

---

### 2. Executar o Instalador Automático
Abra o **PowerShell** dentro da pasta `ae-mcp-server` e execute:

```powershell
.\setup.ps1
```

O script vai:
1. Instalar as dependências (`npm install`) e compilar o TypeScript (`npm run build`).
2. Detectar sua versão do After Effects instalada no computador.
3. Instalar a ponte automática (`ae-mcp-bridge.jsx`) na pasta de inicialização do After Effects (`Scripts/Startup`).

---

### 3. Configurar a Permissão no After Effects (Uma única vez)
No After Effects da nova máquina:
1. Vá em **Edit > Preferences > Scripting & Expressions** (ou *Editar > Preferências > Scripts e Expressões*).
2. Marque a opção: **`"Allow Scripts to Write Files and Access Network"`** (*Permitir que os scripts gravem arquivos e acessem a rede*).
3. Clique em **OK**.

---

### 4. Adicionar ao seu Aplicativo de IA (Claude / Cursor / Antigravity)

Abra o arquivo de configuração MCP do seu cliente (ex: `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "after-effects": {
      "command": "node",
      "args": [
        "C:/caminho/para/ae-mcp-server/dist/index.js"
      ]
    }
  }
}
```
*(Substitua `C:/caminho/para/ae-mcp-server/` pelo caminho real da pasta na máquina)*.

Pronto! Ao abrir o After Effects e o seu aplicativo de IA, o servidor se conectará automaticamente.

---

## 🧰 Lista de Ferramentas Disponíveis

| Ferramenta | Descrição |
|---|---|
| `ae_get_project_elements` | Retorna todas as composições e camadas editáveis (textos, mídias) do projeto aberto. |
| `ae_create_composition` | Cria uma nova composição definindo largura, altura, duração, FPS e proporção. |
| `ae_create_text_layer` | Cria uma nova camada de texto dentro de uma composição. |
| `ae_create_solid_layer` | Cria uma nova camada sólida (Solid) com cor RGB personalizada. |
| `ae_update_text_layer` | Altera o texto de qualquer camada de texto instantaneamente. |
| `ae_change_font` | Altera a família de fontes (ex: Segoe UI, Arial, Montserrat, Impact) em lote ou em camada específica. |
| `ae_animate_position` | Cria animação de posição X (keyframe inicial e final) com atenuação suave (*Easy Ease*). |
| `ae_apply_fill_effect` | Aplica o efeito nativo `Fill` (*Preenchimento*) com qualquer cor RGB. |
| `ae_find_composition` | Localiza detalhes de composições pelo nome. |
| `ae_rename_composition` | Renomeia uma composição existente. |
| `ae_batch_rename_compositions` | Renomeia todas as composições do projeto em lote para o padrão `comp_01`, `comp_02`, etc. |
| `ae_update_composition_settings` | Altera resolução, frame rate ou duração de uma composição existente. |
| `ae_replace_footage` | Substitui um arquivo de mídia (imagem/vídeo) de uma camada do projeto. |
| `ae_replace_layer_source` | Troca a origem de uma camada por outra composição/item existente. |
| `ae_render_composition` | Adiciona uma composição à fila de renderização (Render Queue). |
| `ae_run_custom_script` | Executa qualquer código ExtendScript arbitrário diretamente no After Effects. |

---

## 💻 Comandos Úteis de Desenvolvimento

```bash
# Compilar TypeScript
npm run build

# Iniciar servidor MCP diretamente
npm start
```
