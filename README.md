# Scripts-AE

Repositorio oficial de scripts, painéis, extensões e ferramentas de automação para Adobe After Effects.

## Projetos atuais

### Scripts & Extensões de Produção
- `AE Toolkit Panel/`: painel único de ScriptUI (encaixável ou janela flutuante) com um conjunto de 12 ferramentas de produção do dia a dia (Tidy, Reduce Project, Remove Unused Footage, Clear Expressions, Reset Layer, Hold Time Remap, Hold Keyframe, Copy/Paste Curve, Layer Normalize, Split Shapes, Precomp Extractor e Layer Organizer).
- `Layer Direction/`: script e extensão CEP para alinhamento e direção de camadas.
- `Swatch Colors/`: extensão CEP para extrair, salvar e aplicar paletas da composição ativa.
- `Text Splitter/`: script para dividir textos em letras, palavras ou linhas.
- `Precomp Extractor/`: script standalone de extração de pré-composições preservando transformações.
- `_Run Scripts/`: biblioteca de utilitários rápidos (Text Swap, Batch Comp, Faux 3D Extrusion, etc.).

### Automação & MCP Bridge
- `mcp/`: servidor Model Context Protocol (MCP) e ponte CEP para controle em tempo real do After Effects via agentes de IA.
  - `ae-mcp-server/`: servidor Node.js MCP.
  - `cep-bridge/`: painel de comunicação CEP com o After Effects.
  - `skill/`: skill `after_effects_controller` para o agente.
  - `AE-MCP-Instalador-Completo.zip`: pacote com instalador automatizado.

## Releases

Versões estáveis empacotadas para cada script e extensão individual estão disponíveis na aba [Releases](https://github.com/eduardonoe/Scripts-AE/releases).

## Diretrizes de Desenvolvimento

Antes de alterar qualquer script, consulte:
1. `VERSIONING.md`
2. `AGENTS.md`
3. `CLAUDE.md`

Sempre siga o versionamento SemVer (`MAJOR.MINOR.PATCH`) e faça commits em português com prefixos semânticos padronizados.
