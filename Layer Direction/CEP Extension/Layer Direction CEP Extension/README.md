# Layer Direction — CEP Extension

Versão em construção. Interface real em HTML/CSS/JS (CEP), motor idêntico
ao script `.jsx` já em uso — a lógica de reordenar/clonar não mudou, só a
casca visual.

## Changelog

**0.2.0**
- Novo checkbox "Center Anchor Point" (ligado por padrão): recentraliza a
  âncora de cada clone no seu próprio bounding box visual antes de
  posicioná-lo, compensando a Position pra nada saltar na tela. Resolve
  grids desalinhados quando a fonte tem âncora fora do centro (texto
  alinhado à esquerda, por exemplo) e faz Scale/Rotation girarem em torno
  do centro real do objeto pra todo clone, não de um canto.
- Checkboxes reorganizados: Enable clone + Center Anchor Point na mesma
  linha; Random Objects e Preserve source animation cada um na sua linha.
- Ícone do Mode → Grid corrigido (estava com leve assimetria).
- Setas de Direção um pouco maiores (16px → 18px).

**0.1.0** — primeira versão funcional (Direction, Order, Stagger, Clone
Grid/Radial/Circular, CTRL com Scale/Rotation/Opacity + Random).

## Estrutura

```
Layer Direction CEP Extension/
├── CSXS/
│   └── manifest.xml       -> descreve a extensão pro After Effects
├── .debug                 -> habilita inspeção via Chrome DevTools
├── client/                -> a interface (o que você vê)
│   ├── index.html
│   ├── css/style.css
│   ├── js/app.js          -> interação do painel
│   ├── js/CSInterface.js  -> ponte de comunicação (versão mínima, ver aviso abaixo)
│   └── icons/             -> ícone da aba do painel
└── host/                  -> o motor (o que faz o trabalho de verdade)
    ├── engine.jsx         -> toda a lógica, extraída do script ScriptUI
    └── main.jsx           -> funções que o painel chama (LD_run, LD_rebuild...)
```

## Como testar agora (sem assinar nada)

O After Effects só carrega extensões **assinadas digitalmente** por padrão.
Enquanto estamos iterando, o caminho certo é ativar o **modo de depuração**,
que permite carregar extensões não assinadas — isso é uma configuração da
sua máquina, não algo que dá pra embutir no arquivo da extensão.

**1. Ative o modo debug:**

*macOS* — Terminal:
```
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

*Windows* — Editor de Registro, crie (se não existir):
```
Caminho:  HKEY_CURRENT_USER\Software\Adobe\CSXS.12
Valor:    PlayerDebugMode (String) = 1
```

> O número `12` é a versão do CEP (a que o After Effects atual usa). Se uma
> versão futura do AE vier com CEP 13, repita com `CSXS.13`.

**2. Copie esta pasta inteira** (`Layer Direction CEP Extension`) para:

*macOS:* `~/Library/Application Support/Adobe/CEP/extensions/`
*Windows:* `%APPDATA%\Adobe\CEP\extensions\`

(crie a pasta `extensions` se ela não existir)

**3. Reinicie o After Effects.** O painel aparece em `Window → Extensions → Layer Direction`.

## Sobre a assinatura digital (pra quando formos distribuir pra outras pessoas)

Isso muda dependendo de quantas pessoas vão usar e o quanto o projeto já
estabilizou:

| Cenário | Caminho |
|---|---|
| Só você testando | Modo debug (acima). Já cobre. |
| Poucos amigos, projeto ainda mudando bastante | Manda a pasta + o passo do modo debug pra eles também. Sem assinatura nenhuma. É o que eu recomendo **agora**. |
| Distribuição mais séria, projeto estável | Empacotar como `.zxp` assinado. Sem "modo debug" nenhum necessário de quem instala. |

**Por que não assinar já:** assinar gera um pacote `.zxp` fechado. Toda vez
que a gente muda uma linha, seria preciso reempacotar e reassinar. Enquanto
estamos testando/ajustando, isso só atrapalha — o modo debug lê a pasta
direto, então qualquer alteração já aparece na próxima vez que você abre o
painel.

**Quando chegarmos numa versão estável**, o processo de assinar é:

1. Baixar a ferramenta `ZXPSignCmd` da Adobe (gratuita, não incluída aqui —
   é um binário da Adobe, eu não tenho como embutir).
2. Gerar um certificado (self-signed é gratuito e funciona — só aparece um
   aviso de "editor não verificado" na instalação, que a pessoa aceita uma
   vez; certificado comprado de terceiro remove esse aviso).
3. Rodar `ZXPSignCmd -sign "Layer Direction CEP Extension" saida.zxp certificado.p12 senha`
4. Distribuir o `.zxp` — instala com duplo clique (usando ZXP Installer,
   gratuito) sem precisar mexer em registro/config nenhuma.

Posso preparar esse script de empacotamento quando chegarmos lá — não faz
sentido gerar certificado e testar o fluxo de assinatura enquanto a
interface ainda está mudando a cada rodada.

## O que falta (conhecido, não é bug)

- `client/js/CSInterface.js` aqui é uma versão **mínima**, só com o que o
  painel usa (`evalScript`). Antes de distribuir pra qualquer pessoa, troque
  pelo arquivo oficial completo da Adobe:
  https://github.com/Adobe-CEP/CEP-Resources → pasta `CEP_12.x` →
  `CSInterface.js`. É gratuito e faz parte do próprio kit da Adobe.
- Os ícones da aba do painel (`client/icons/`) são placeholders simples (a
  grade 3×3 azul, a mesma marca usada no guia em PDF) — dá pra refinar
  depois.
- O grid de Direção (3×3) usa CSS Grid, que só renderiza corretamente dentro
  do Chromium real do After Effects — não tive como conferir visualmente
  aqui fora do AE.
