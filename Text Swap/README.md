# Text Swap

Script ScriptUI para After Effects.

> Status: v0.2.0 — primeira implementacao, ainda nao testada no AE. Requer AE 25.0+ (estilo por caractere via expressao, engine JavaScript).

## Objetivo

Trocar o estilo de uma layer de texto (TL1) pelo de outra (TL2) em sequencia, por caractere, palavra ou linha, animado por um slider de 0 a 100.

## Instalacao

Copiar `Text Swap.jsx` para `Scripts/ScriptUI Panels/` do After Effects (ou rodar via File > Scripts > Run Script File).

## Uso

1. Crie TL1 (estilo inicial) e TL2 (estilo final) com o mesmo texto.
2. Selecione TL1 e depois TL2.
3. Escolha Based On / Order / Duracao e clique **Animate**.
4. TL1 recebe os efeitos `Swap - *` e keyframes 0>100 no CTI; TL2 fica oculta como referencia.
5. **Remove Rig** limpa efeitos e expressao das layers selecionadas.

## Changelog

- v0.2.0 — primeira implementacao do rig.
- v0.1.0 — estrutura inicial do projeto.
