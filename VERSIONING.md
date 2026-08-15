# Versioning

Este repositorio usa um padrao simples baseado em SemVer:

```text
MAJOR.MINOR.PATCH
```

Exemplo:

```text
1.0.1
```

## Como incrementar

- `PATCH` (`1.0.0` -> `1.0.1`): correcao de bug, ajuste pequeno, melhoria interna, texto, comentario, compatibilidade ou empacotamento.
- `MINOR` (`1.0.0` -> `1.1.0`): novo recurso que mantem o fluxo anterior funcionando.
- `MAJOR` (`1.0.0` -> `2.0.0`): mudanca que quebra compatibilidade, altera comandos principais ou muda significativamente o comportamento esperado.

## Estado inicial

Os scripts que atualmente aparecem como:

```text
Version: 1.0
```

devem ser considerados `1.0.0` para fins de evolucao.

A proxima correcao pequena deve virar:

```text
Version: 1.0.1
```

## Onde atualizar

Sempre que um script for alterado, atualizar o cabecalho do proprio `.jsx` correspondente.

Exemplo:

```javascript
// Version: 1.0.1
```

ou, em cabecalho de bloco:

```javascript
/*
    Version: 1.0.1
*/
```

## Changelog no arquivo

Quando a alteracao for mais do que uma correcao minuscula, adicionar um bloco curto no cabecalho do script:

```text
v1.0.1 changelog:
- Corrige comportamento X.
- Ajusta compatibilidade com Y.
```

## Commits

Use mensagens objetivas em portugues, preferencialmente neste estilo:

```text
fix: corrige divisao de texto por linhas
feat: adiciona controle de stagger
chore: organiza arquivos de empacotamento
release: prepara Layer Direction v1.0.1
```

Quando a mudanca representar uma versao pronta para uso, incluir a versao na mensagem do commit.
