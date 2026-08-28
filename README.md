# Scripts-AE

Repositorio de scripts e extensoes para Adobe After Effects.

## Projetos atuais

- `AE Toolkit Panel/`: painel unico de ScriptUI (encaixavel ou janela flutuante) com um conjunto de ferramentas do dia a dia — Tidy (organizador do Project Panel), Reduce Project, Remove Unused Footage, Clear Expressions, Reset Layer, Hold Time Remap, Hold Keyframe, Copy/Paste Curve, Layer Normalize, Split Shapes, Precomp Extractor e Layer Organizer. Substitui o Declutter antigo e os scripts avulsos que antes viviam em `_Run Scripts/`.
- `Layer Direction/`: script e extensao CEP do Layer Direction.
- `Momentum/`: stretch & squash orientado a velocidade e assistentes de keyframe (CEP + ScriptUI).
- `Precomp Extractor/`: script standalone original de extracao de precomp. Superado pela versao integrada e mais completa dentro de `AE Toolkit Panel/` (preserva timing/parenting/track matte/blend mode, e tem opcao de desempacotar so o primeiro nivel); mantido aqui por historico.
- `Swatch Colors/`: extensao CEP para extrair, salvar e aplicar paletas da composicao ativa.
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
