# Agent Instructions

Estas instrucoes valem para qualquer agente trabalhando neste repositorio, incluindo Codex.

## Objetivo

Manter os scripts de After Effects organizados, versionados e faceis de continuar em diferentes ferramentas.

## Antes de editar

1. Leia `README.md` e `VERSIONING.md`.
2. Identifique qual pasta/projeto sera alterado.
3. Leia o cabecalho do `.jsx` que sera modificado.
4. Preserve o estilo existente do script.

## Ao editar

- Mantenha o escopo pequeno e diretamente ligado ao pedido.
- Nao misture projetos diferentes no mesmo commit.
- Nao reformatar arquivos inteiros sem necessidade.
- Atualize `Version:` no cabecalho do script alterado.
- Se a mudanca for relevante, acrescente changelog curto no cabecalho.

## Versionamento

Siga `VERSIONING.md`.

Scripts marcados como `Version: 1.0` devem evoluir como se fossem `1.0.0`.

Exemplo: a primeira correcao pequena vira `Version: 1.0.1`.

## Commits

Use mensagens claras em portugues, com prefixo quando fizer sentido:

- `fix:` para correcao
- `feat:` para recurso novo
- `docs:` para documentacao
- `chore:` para organizacao
- `release:` para preparacao de versao

Antes de commitar, confirme o escopo com o usuario quando houver risco de alterar mais do que foi pedido.
