# Claude Code Instructions

Estas instrucoes alinham o trabalho do Claude Code com o fluxo usado tambem pelo Codex.

## Leitura obrigatoria

Antes de alterar qualquer script, leia:

1. `README.md`
2. `VERSIONING.md`
3. Este arquivo

## Regra de versionamento

O repositorio usa versionamento semantico simples:

```text
MAJOR.MINOR.PATCH
```

Os scripts atuais com:

```text
Version: 1.0
```

devem ser tratados como `1.0.0`.

A primeira correcao pequena deve atualizar o cabecalho para:

```text
Version: 1.0.1
```

## Fluxo de trabalho

1. Identificar o script/projeto afetado.
2. Fazer a menor alteracao necessaria.
3. Atualizar `Version:` no cabecalho do `.jsx` alterado.
4. Adicionar changelog curto no cabecalho quando a mudanca for relevante.
5. Fazer commit com mensagem clara em portugues.
6. Subir para o GitHub.

## Cuidados

- Nao misturar scripts diferentes no mesmo commit sem necessidade.
- Nao reformatar arquivo inteiro sem pedido explicito.
- Nao remover historico de changelog existente.
- Preservar compatibilidade com After Effects e ExtendScript sempre que possivel.
