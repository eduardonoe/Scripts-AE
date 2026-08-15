# Scripts-AE

Repositorio de scripts e extensoes para Adobe After Effects.

## Projetos atuais

- `Layer Direction/`: script e extensao CEP do Layer Direction.
- `Text Splitter/`: script para dividir textos em letras, palavras ou linhas.

## Regra principal

Antes de alterar qualquer script, leia:

1. `VERSIONING.md`
2. `AGENTS.md`
3. `CLAUDE.md`

Esses arquivos definem o padrao compartilhado entre Codex, Claude Code e qualquer outro agente que trabalhe neste repositorio.

## Fluxo recomendado

1. Entender qual script sera alterado.
2. Ler o cabecalho do `.jsx` correspondente e identificar a versao atual.
3. Implementar a mudanca no menor escopo possivel.
4. Atualizar a versao no cabecalho do script.
5. Registrar um changelog curto no cabecalho quando a mudanca for relevante.
6. Fazer commit com mensagem clara.
7. Subir para o GitHub.

## Padrao de versao

O repositorio usa versionamento semantico simples:

- `1.0.1`: correcao pequena, bugfix ou ajuste sem mudar o uso principal.
- `1.1.0`: novo recurso compativel com a versao anterior.
- `2.0.0`: mudanca grande ou incompatibilidade no fluxo de uso.

Os scripts existentes com `Version: 1.0` devem ser tratados como `1.0.0` para proximas atualizacoes.
