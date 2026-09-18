/*
    FAUX 3D EXTRUSION RIG
    After Effects JSX
    Version: 4.8.1

    Monta o rig de extrusão 3D falsa a partir de uma camada de TEXTO ou de
    uma SHAPE LAYER já existente (cada grupo de nível 1 em Contents vira uma
    "letra") — ver "SHAPE LAYER NATIVA" abaixo. Técnica do post do
    contentlab.cc ("How to create Faux 3D extrusion in After Effects?"), que
    originalmente é manual — aqui é montada por script.

    SHAPE LAYER NATIVA (sem camada de texto)
      Selecione uma shape layer qualquer (não precisa ter vindo de texto —
      pode ser desenhada à mão, importada de outro programa, etc.) e rode o
      script. Cada grupo de NÍVEL 1 dentro de "Contents" vira uma "letra"
      (mesma lógica de duplicar+Repeater+Cap do modo texto). Diferença: aqui
      NÃO existe uma camada de texto separada — os controles (Progresso,
      Cor Extrusao, etc.) ficam na PRÓPRIA shape layer, junto com a
      geometria. Um Null ainda é criado pra facilitar mover a camada.
      Atualização (regenerar geometria depois de editar) não é suportada
      nesse modo — não existe uma "fonte" (tipo o texto) pra regenerar a
      partir dela; rodar de novo numa shape layer que já tem rig só mostra
      um aviso e não mexe em nada.

    ATUALIZAR TEXTO/FONTE DE UM RIG JÁ PRONTO (só no modo baseado em texto)
      Já montou o rig, já deixou "Progresso"/cores/etc do jeito que quer, e
      agora quer trocar o CONTEÚDO do texto ou a FONTE? Edite o texto/fonte
      normalmente (direto na camada de texto do rig, com a ferramenta de
      texto ou o painel Character) e rode o script DE NOVO na mesma camada
      de texto. O script detecta que o painel de controles já existe (efeito
      "Progresso" já presente) e entra em modo ATUALIZAÇÃO: pede confirmação,
      apaga a shape layer de extrusão antiga e remonta a geometria (Repeater
      + Cap por letra) a partir do texto/fonte atual — sem recriar nem tocar
      em nenhum controle, então "Progresso" mantém as keyframes que você já
      tinha, cores continuam as mesmas, etc. Se a fonte nova ganhou stroke e
      o painel antigo não tinha esses controles, eles são criados agora.

    PAINEL DE CONTROLES (tudo na camada de TEXTO, um lugar só)
      ANIMAÇÃO
      - "Progresso"    : 0 a 100. É ESTE o controle que você anima. Cada
                         letra extruda no seu tempo conforme ele avança.
      - "Profundidade" : nº de cópias do repeater = altura da extrusão.
      - "Direcao"      : ângulo de crescimento. 0° = para cima.
      - "Distancia"    : passo em px por cópia.
      - "Stagger"      : atraso entre uma letra e a seguinte.
      - "Ordem"        : ordem do reveal entre letras. 0 = esquerda->direita,
                         1 = direita->esquerda, 2 = centro->extremidades.
      - "Bounce"           : liga/desliga o bounce no final da extrusão de
                             cada letra. Estilo Duik/overshoot: usa a
                             VELOCIDADE real da keyframe de "Progresso" no
                             instante em que a letra bate 100%, e balança em
                             TEMPO REAL (segundos) a partir daí — não
                             depende de "Progresso" passar de 100.
      - "Bounce Forca"     : multiplicador sobre essa velocidade. 0 = sem
                             bounce; comum ficar entre 0.5 e 2.
      - "Bounce Repeticoes": frequência da oscilação, em "vezes por segundo"
                             (não é mais fração do progresso).
      - "Bounce Amortecimento": velocidade de decaimento em tempo real.
                             1 = padrão (some em ~1s); maior = assenta mais
                             rápido; menor = balança por mais tempo.
      COR
      - "Cor Face"     : cor da tampa (face frontal) de cada letra. No modo
                         "palavra" também tinge o texto original (efeito
                         Fill) — esse efeito só existe nesse modo.
      - "Cor Extrusao" : cor do corpo.
      - "Stroke"       : liga/desliga o contorno (corpo E tampa). Só é criado
                         quando o texto realmente tem stroke.
      - "Stroke Largura": espessura do contorno (só existe com stroke).
      - "Cor Stroke"   : cor do contorno — INDEPENDENTE de "Cor Face" e
                         "Cor Extrusao" (só existe com stroke).

    Um Null é criado junto (nomeado "<texto> Null") e vira pai da camada de
    texto e da shape layer — move as duas de uma vez. Numa atualização, o
    Null já existente é reaproveitado, não duplicado.

    Nada é "assado" em keyframes por letra: o Copies e o offset de cada
    glifo são EXPRESSÕES que leem esses controles. Mudar ritmo, direção ou
    profundidade é mexer num slider, não reeditar letra por letra.

    DOIS MODOS (constante MODO)
      - "caractere" (padrão): um Repeater DENTRO de cada glifo, cada um com
        seu atraso. Cada letra ganha sua própria TAMPA (um subgrupo "Cap"
        dentro dela mesma, com a geometria duplicada), empurrada pela
        extrusão DAQUELA letra — nunca pela de outra. É por isso que cada
        letra sobe exatamente na medida do que já extrudou, sem depender de
        nenhuma "líder": não existe face compartilhada para travar todas na
        mesma altura. O texto original (camada de TEXTO) fica apenas como
        suporte dos controles — quem renderiza é só o shape layer.
      - "palavra": um Repeater único para o texto todo, com o texto
        funcionando como face de verdade (compensada por expressão) e o
        corpo seguindo ele. A palavra inteira extruda junta, sem
        escalonamento.

    SOBRE A DIREÇÃO: no After Effects o eixo Y é invertido (Y positivo é
    para BAIXO). O ângulo aqui já corrige isso: 0° cresce para cima, 90°
    para a direita, 180° para baixo.

    SOBRE A COR DA FACE: é controlada por um efeito Fill aplicado no texto.
    Isso pinta a face inteira de uma cor só — se o seu texto tiver stroke de
    cor diferente na FACE, desligue (ou apague) esse efeito Fill e defina a
    cor no próprio texto. A extrusão não é afetada por isso.

    SOBRE O STROKE: o "Create Shapes from Text" já traz fill e stroke do
    texto. Desligar o stroke deixa o corpo mais FINO que a face, porque o
    stroke engrossa a silhueta — a extrusão aparece encolhida sob o texto.
    Por isso o padrão é manter o stroke, recolorido na cor da extrusão.

    O post também mostra um "Method 2 (Quick)" que usa ferramentas pagas de
    terceiros (o script Explode_Text e o painel Morpheus, com ADD EXTRUSION
    e animação do Radius de um efeito Extrusion Depth). Este script replica
    o Method 1, sem depender delas.

    Selecione a(s) camada(s) de texto e execute o script.

    Changelog:
    - 4.8.1: ordem esquerda->direita saía "aleatória" em shape layer nativa
      (4.8.0). Causa: minXdoGrupo() só compara os VÉRTICES LOCAIS de cada
      path, sem somar a Position do próprio grupo. Em texto convertido por
      "Create Shapes from Text" isso não importa (a posição real já vem
      embutida nos vértices, Transform geralmente identidade); mas numa
      shape layer desenhada/importada é comum CADA grupo ter sua própria
      Position (confirmado renomeando os grupos: "1"=x288, "3"=x608,
      "0"=x1009, "5"=x1405 — a ordem certa pra "1305"), e ordenar só pelos
      vértices locais não tem relação nenhuma com a posição real na tela.
      Corrigido: nova comPosicaoGrupo() soma Position menos Anchor Point de
      cada grupo (aplicada tanto nos candidatos de nível 1 quanto
      recursivamente em sub-grupos) antes de comparar.
    - 4.8.0: suporte a SHAPE LAYER NATIVA (sem camada de texto) — pedido pra
      montar o rig direto numa shape layer já pronta (desenhada à mão,
      importada, etc.), tratando cada grupo de nível 1 em Contents como uma
      "letra". Até aqui toda expressão do rig hardcodava
      "thisComp.layer(index - 1)" (controles numa camada de TEXTO acima) —
      generalizado com uma referência de controle substituível
      (CTRL_REF_TEXTO / CTRL_REF_SELF + paraCtrlRef(), que troca a string
      certa em qualquer expressão já pronta) threadada por
      configurarRepeater/ligarCoresGrupo/repeaterPorCaractere. Nova função
      processarShapeLayerNativa(): monta controles e geometria na MESMA
      camada (CTRL_REF_SELF = "thisComp.layer(index)"), sem
      "Create Shapes from Text" nenhum (a geometria já existe). Duas
      proteções: recusa rodar se a shape layer já tem o painel (efeito
      "Progresso") — atualização não suportada nesse modo, sem "fonte" pra
      regenerar; e recusa se os grupos já forem "FauxExt_..." (sinal de que
      é a shape layer GERADA por um rig baseado em texto, selecionada por
      engano — tratar cada corpo/tampa como letra nova bagunçaria tudo).
    - 4.7.1: dois bugs introduzidos pela própria 4.7.0:
        1) NULL NO LUGAR ERRADO: o Null novo nascia travado em [0,0] (canto
           do comp), sem relação com o texto, e as camadas não tinham a
           posição compensada ao ganhar esse pai — pulavam de lugar. Agora
           o Null nasce na posição atual do texto (equivalente ao anchor
           point, já que a camada ainda não tem pai nesse momento) e a
           posição de cada camada é compensada (subtraída da posição do
           Null) ao virar filha, pra não pular visualmente.
        2) KEYFRAMES DE "PROGRESSO" PARARAM DE SER CRIADOS: a variável
           "progresso" era capturada logo após criar o slider, só que usada
           só depois de ~10 outros fx.addProperty() (Profundidade, Direcao,
           Distancia, Stagger, Ordem, Bounce...) — e o Effect Parade
           também é uma lista indexada, sofrendo o MESMO gotcha do
           duplicate()/addProperty() em Contents de shape layer (ver
           reference_extendscript_ae_gotchas): cada addProperty() nela
           invalida referências de efeitos-irmãos capturadas antes. A
           referência de "progresso" já estava inválida quando o código
           tentava criar os keyframes, e o try/catch vazio engolia o erro
           em silêncio — parecia que "não fazia nada" sem nenhum aviso.
           Confirmado com um alerta de diagnóstico temporário que expôs
           "ReferenceError: Object is invalid". Corrigido: reobtém
           "Progresso" fresco por nome (fx.property("Progresso")) bem antes
           de criar os keyframes, nunca reaproveitando a referência antiga.
    - 4.7.0: causa raiz real do "cor não aparece" caçada nas últimas rodadas
      (4.6.x): não era estrutura nem expressão — era o efeito "Fill" na
      camada de texto (código morto do modo "palavra", que só tinge o texto
      original) SE a camada de texto ficasse visível por qualquer motivo.
      Confirmado pelo usuário: desativar manualmente esse Fill fez a cor da
      extrusão aparecer na hora. Em vez de continuar garantindo que a
      camada nunca fique visível por acidente, o efeito Fill simplesmente
      NUNCA é criado no modo "caractere" — não faz nada útil ali, só dano
      potencial.
      Junto, três pedidos de fluxo de trabalho:
        1) Keyframes de "Progresso" (0 e 100) agora são relativos ao INÍCIO
           DA PRÓPRIA CAMADA (inPoint) — 0 no inPoint, 100 dez frames depois
           (DURACAO_FRAMES) — em vez de um tempo fixo de composição.
        2) Um Null (nomeado "<texto> Null") vira pai da camada de texto e da
           shape layer, pra mover as duas juntas. Numa atualização, reaproveita
           o Null que já existe em vez de criar outro.
        3) O script termina com a camada de TEXTO selecionada (não a shape
           layer) — vai direto pro Effect Controls com os sliders.
      Também virou configuração padrão: Profundidade=70, Direcao=44°,
      Stagger=2.0, Bounce Forca=0.08, Bounce Repeticoes=1.5, Cor Extrusao
      rosa/vermelho, Cor Face branco, Cor Stroke azul (novo COR_STROKE,
      antes só herdava do texto original ou repetia Cor Extrusao).
    - 4.6.2: a 4.6.1 desligava a camada de texto original (.enabled = false)
      só DEPOIS de gerar os contornos — mas no modo Atualização, nesse ponto
      a camada JÁ estava desligada (sobra da rodada anterior, que desliga no
      fim). Rodar "Create Shapes from Text" numa camada de texto ESCONDIDA
      produziu geometria degenerada — grupos sobrepostos/fantasma (visível
      testando com "2342343225": dígitos duplicados uns por cima dos
      outros, tudo achatado numa cor só). Corrigido: reabilita a camada
      ANTES de gerar os contornos no modo Atualização — quem desliga de
      volta é a mesma lógica de sempre, mais abaixo.
    - 4.6.1: depois de usar o modo Atualização (4.6.0) num texto trocado, o
      resultado saiu totalmente branco/chapado, sem nenhuma cor, sem
      extrusão visível — sintoma de ou (a) o texto original ter ficado
      visível por cima do rig de novo, ou (b) o "Create Shapes from Text"
      não ter rodado do jeito esperado numa segunda passada e o
      repeaterPorCaractere não ter encontrado nenhum grupo de glifo pra
      processar. Duas blindagens: 1) modo "caractere" agora desliga a
      camada de texto original EXPLICITAMENTE (.enabled = false) em vez de
      confiar só no comportamento automático do "Create Shapes from Text";
      2) repeaterPorCaractere agora tem seu retorno (nº de letras
      processadas) checado — se vier 0, mostra um alerta claro em vez de
      deixar uma shape layer crua e sem explicação.
    - 4.6.0: modo ATUALIZAÇÃO — rodar o script de novo numa camada de texto
      que já tem o rig montado (detectado pelo efeito "Progresso" já
      existir) não recria o painel do zero: pede confirmação, apaga a shape
      layer de extrusão antiga (a que fica logo abaixo, por convenção) e
      remonta só a GEOMETRIA a partir do texto/fonte atual, mantendo
      "Progresso" com as keyframes que já estavam lá e todas as outras cores/
      configurações intactas. Pensado pro fluxo: montar o rig, ajustar tudo
      do jeito que quer, e DEPOIS trocar conteúdo/fonte do texto sem perder
      esse ajuste. Cria os controles de Stroke na hora se a fonte nova ganhou
      stroke e o painel antigo não tinha.
    - 4.5.2: a 4.5.1 movia cada par (tampa+corpo) JUNTO pro topo da lista —
      isso deixava o corpo de uma letra posicionado ENTRE a tampa dela e a
      tampa da vizinha seguinte, então o corpo de uma letra podia acabar na
      FRENTE da tampa de outra (visível no "INTEGRAL": o corpo cinza do R
      cobrindo parte da face branca do G ao lado). Corrigido: dois passos
      separados — todos os CORPOS são empilhados entre si primeiro (ordem
      direction-aware, resolve corpo-vs-corpo), e SÓ DEPOIS todas as TAMPAS
      são empilhadas por cima de tudo. Como cada moveTo(1) bota no topo
      absoluto da lista, rodar as tampas por último garante que nenhum
      corpo — de nenhuma letra — fica na frente de nenhuma tampa.
    - 4.5.1: o fix de ordem de empilhamento da 4.5.0 assumia sempre "letra da
      direita na frente" — só que isso só é certo quando a extrusão cresce
      pra DIREITA. Testando com Direcao apontando pra baixo-esquerda, ficou
      visivelmente invertido: quem precisa ficar na frente é sempre a letra
      pra ONDE a sombra da vizinha se espalha (a que receberia a invasão),
      não uma direção fixa. Corrigido: calcula o sinal horizontal do
      crescimento (mesmo termo da expressão de offset — seno do ângulo ×
      sinal de Profundidade × sinal de Distância) nos valores INICIAIS do
      rig, e escolhe a ordem de processamento (esquerda->direita ou
      direita->esquerda) de acordo — sempre a letra "a jusante" da sombra
      fica na frente.
    - 4.5.0: dois ajustes depois do feedback de que o bounce da 4.4.0 ainda
      estava ruim e "Progresso" precisava de um número feio (>100) pra
      última letra bouncar:
        1) BOUNCE REESCRITO NA LÓGICA DO DUIK: a 4.4.0 ainda usava uma
           senoide de amplitude FIXA ("Bounce Forca"), sem relação com a
           velocidade real do movimento nem com tempo de verdade — e exigia
           "Progresso" > 100 pra sobrar tempo de cauda na última letra.
           Reescrito do zero como o bounce/overshoot clássico (o mesmo
           princípio do Duik): lê a velocidade REAL da própria keyframe de
           "Progresso" no instante em que cada letra bate 100% (via
           `velocityAtTime` nas keyframes 1 e última de Progresso), e monta
           uma senoide amortecida em TEMPO REAL (segundos) a partir desse
           instante. Como agora é tempo de composição (não fração de
           progresso), o bounce completa mesmo com "Progresso" congelado
           exatamente em 100 — o tempo da comp continua passando depois
           disso. "Progresso" volta a ser limpo, 0 a 100%.
        2) ORDEM DE EMPILHAMENTO ENTRE LETRAS: com "Direcao" na diagonal
           (ex: 45°), a extrusão de uma letra cresce pro espaço da vizinha —
           e como a ordem dos grupos que o "Create Shapes from Text" cria
           NÃO é da esquerda pra direita, a extrusão de uma letra aparecia
           cortando a face de outra de forma incoerente (visível testando
           com Direcao=45°). Corrigido com um passo final (depois de tudo
           mais já montado) que reordena os grupos por posição X — letra
           mais à direita na frente. Feito por ÚLTIMO porque moveTo() tem o
           mesmo gotcha do duplicate() (invalida referência de irmãos na
           lista) — sem mais nada pra reaproveitar depois, sem risco.
    - 4.4.0: três ajustes depois do rig já funcionando (4.3.0):
        1) BOUNCE INCONTROLÁVEL: a oscilação inteira vivia espremida dentro
           da janela [0,1] de cada letra — janela essa já curta, dividida
           pelo Stagger entre todas as letras. Mais "Repeticoes" só apertava
           mais oscilações no mesmo espaço curto, ficando frenético e sem
           controle real. Correção: a subida (0->1) agora é sempre LINEAR,
           sem bounce nenhum dentro dela; o bounce vira uma CAUDA que só
           entra DEPOIS que a letra chega em 1 (ou seja, quando "Progresso"
           continua além do que essa letra precisava), com tempo próprio pra
           oscilar e decair — sem competir por espaço com o Stagger. Efeito
           colateral esperado: a ÚLTIMA letra a terminar (a que define o fim
           do Stagger) só ganha essa cauda se "Progresso" for animado um
           pouco além de 100 (as demais já ganham de graça, por terminarem
           mais cedo dentro da mesma animação 0->100).
        2) FACE SEMPRE VISÍVEL: a tampa (Cap) é uma duplicata ESTÁTICA,
           sempre desenhada — antes disso ela sentava na posição do chão
           (Copies=0) desde o início, aparecendo ANTES do Stagger daquela
           letra começar. Agora a Opacity do grupo da tampa tem expressão
           própria: 0 até o Repeater daquela letra ter pelo menos 1 cópia,
           100 depois — some/aparece exatamente quando o extrude dela começa.
        3) COR DO STROKE: não existia controle próprio — o contorno seguia
           "Cor Extrusao" (corpo) ou "Cor Face" (tampa), sem opção
           independente. Novo Color Control "Cor Stroke": corpo e tampa
           passam a usar essa MESMA cor no contorno, independente da cor de
           preenchimento de cada um.
    - 4.3.0: a 4.2.2 removeu o moveTo() mas o script CONTINUAVA quebrando com
      "ReferenceError: Object is invalid" a partir da segunda letra — porque
      o verdadeiro problema nunca foi o moveTo() especificamente, e sim
      QUALQUER duplicate()/addProperty() numa lista indexada (Contents): a
      lista inteira de grupos de letra era capturada como REFERÊNCIAS antes
      do loop, e ao duplicar a letra 0, as referências das letras seguintes
      (obtidas antes dessa duplicação) ficavam inválidas. Isso explica todos
      os sintomas anteriores de uma vez: nenhuma cor mudava, não tinha
      extrusão nem animação — o script morria no meio da PRIMEIRA execução
      de repeaterPorCaractere e o erro subia sem tratamento, abortando o
      script inteiro (e deixando o app.endUndoGroup() sem rodar, por isso
      também o try/finally agora em volta do processamento de cada camada).
      Correção definitiva: só nomes (strings) atravessam iterações do loop
      agora, nunca referências de PropertyGroup — cada grupo é buscado de
      novo por nome, fresco, inclusive uma segunda vez logo após seu próprio
      duplicate().
    - 4.2.2: o try/catch isolado da 4.2.1 não era suficiente — o problema
      não era o moveTo() falhar (ele "funcionava"), era o que ele FAZIA ao
      funcionar: reordenar um item numa lista indexada do AE (Contents)
      invalida a referência JS não só do item movido, mas de QUALQUER
      referência já obtida para as outras propriedades daquela mesma lista
      ("ReferenceError: Object is invalid" - erro visível no painel de
      Scripts após rodar). Isso incluía "gc" (o corpo, obtido ANTES do
      moveTo), derrubando o restante do loop no meio da letra. Removido o
      moveTo() de vez: duplicate() já insere a cópia ACIMA do original por
      padrão, que é a ordem certa (Cap na frente) sem precisar reordenar
      nada — e sem o risco de invalidar referência nenhuma.
    - 4.2.1: a 4.2.0 rodava duplicate() + rename + moveTo dentro do MESMO
      try/catch. Se o moveTo (reordenar a tampa pro topo da lista) falhasse
      por qualquer motivo, o catch descartava a variável "cap" (virava
      null) — só que a duplicata em si JÁ tinha sido criada pelo
      duplicate(), e ficava órfã: sem a expressão de cor, sem a expressão
      de posição, estática na cor original (branco), sentada bem em cima do
      resultado de verdade e escondendo tudo. É por isso que nenhuma cor
      (nem "Cor Extrusao" nem "Cor Face") parecia fazer efeito nenhum e a
      extrusão sumiu por completo. Correção: cada passo agora tem seu
      próprio try/catch — se o reposicionamento falhar, a tampa criada
      ainda recebe cor e posição corretas (só a ordem de empilhamento entre
      Cap e corpo é que fica no "melhor esforço").
    - 4.2.0: a reestruturação em "Body"/"Cap" da 4.1.0 ainda quebrava letras
      com buraco (A, B, G, O, R...) — o código extraía "o path" na mão pra
      reconstruir o corpo/tampa, mas essas letras não são um path só: o
      "Create Shapes from Text" monta elas com VÁRIOS subpaths + um filtro
      Merge Paths (contorno + buraco). Extrair um só path na mão descartava
      os outros (merge incluído), sobrando fragmentos soltos — os triângulos
      quebrados que apareceram em cima do R e do A. Correção definitiva: em
      vez de reconstruir a geometria manualmente, o grupo inteiro do glifo é
      DUPLICADO (grupo.duplicate()) pra virar a tampa — cópia fiel de
      qualquer estrutura, simples ou complexa, sem precisar entender o que
      tem dentro. O Repeater só é adicionado no grupo ORIGINAL (que vira o
      corpo) depois da duplicação, e o Cap duplicado é movido pro índice do
      original na lista de Contents (empurrando-o pra baixo) — garante a
      tampa na frente, sem aninhamento nenhum entre os dois.
      Também virou controle: "Stroke Largura", pra ajustar a espessura do
      contorno direto no painel (antes só dava pra ligar/desligar e recolorir,
      a largura ficava fixa na do texto original).
    - 4.1.0: a troca de índice numérico da 4.0.0 não era a causa real do bug
      de "Cor Face nunca muda" — era z-order. Em Contents de shape layer, a
      ordem da lista É a ordem de empilhamento (item mais acima = mais na
      frente), igual à timeline. A tampa (Cap) era criada por ÚLTIMO na
      lista só pra escapar de ser repetida pelo Repeater — mas isso também
      jogava ela pra TRÁS na renderização, atrás do próprio corpo. A cor até
      mudava, só que escondida. Correção: o corpo (path/fill/stroke +
      Repeater) agora mora num subgrupo "Body"; a tampa é criada como grupo
      IRMÃO do Body e movida pro topo da lista (cap.moveTo(1)) — na frente,
      e o Repeater (isolado dentro do Body) não alcança ela de jeito nenhum,
      não importa a ordem entre os dois. De quebra, o stroke da tampa (que
      era uma cópia estática da cor original) passou a seguir "Cor Face" por
      expressão também.
      Além disso, "Bounce Amortecimento": o decaimento do overshoot elástico
      era fixo, então subir "Bounce Repeticoes" deixava as oscilações mais
      RÁPIDAS sem dar mais tempo pra cada uma amortecer — ficava frenético e
      difícil de controlar. Agora o decaimento tem slider próprio,
      independente da frequência das oscilações.
    - 4.0.0: três correções/recursos pedidos depois de ver o rig rodando com
      o texto posicionado no CHÃO (a extrusão deveria crescer dali até a
      posição final, empurrando o branco para cima):
        1) BUG DE DIREÇÃO DA TAMPA: o corpo (Copies do repeater) já cresce
           ancorado no chão, na direção certa — mas a tampa (Cap, a face
           branca) somava o offset com sinal invertido e subia para o lado
           OPOSTO ao do corpo. Corrigido: a tampa agora soma o mesmo offset
           acumulado do corpo, então sempre fica exatamente na ponta de cima
           dele, subindo junto conforme o Progresso avança.
        2) BOUNCE: novo checkbox "Bounce" + sliders "Bounce Forca" e
           "Bounce Repeticoes". Aplica um overshoot elástico (easeOutElastic)
           no cálculo de Copies de cada letra — como a tampa lê o mesmo
           rep.copies, ela acompanha o bounce do corpo automaticamente, sem
           precisar de expressão própria nem duplicar lógica.
        3) ORDEM DO REVEAL: novo slider "Ordem" (0 = esquerda->direita,
           1 = direita->esquerda, 2 = centro->extremidades), calculado por
           expressão em cada letra — reordena o stagger sem precisar
           reeditar letra por letra.
      Além disso, os acessos a efeito por NOME de propriedade (ex:
      effect("Cor Face")("Color")) foram trocados por índice numérico
      (effect("Cor Face")(1)) em todas as expressões — nomes de propriedade
      de Slider/Color/Checkbox/Angle Control dependem do idioma do AE, e um
      nome não batendo faz a expressão falhar silenciosamente e travar no
      último valor válido (o provável motivo de "Cor Face" nunca atualizar).
    - 3.0.0: corrige o modo "caractere" de vez. A correção anterior (2.2.0)
      empurrava a face inteira (uma única camada de texto) pela extrusão de
      UMA letra "líder" — mas como todas as letras compartilhavam essa
      mesma face rígida, as que ainda não tinham extrudado nada subiam
      junto com as demais, ficando suspensas com um vão vazio embaixo
      (exatamente o bug relatado). Correção real: a face deixa de ser a
      camada de texto e passa a ser uma TAMPA por letra, dentro do próprio
      shape layer — cada uma lida com o repeater DELA MESMA, então cada
      letra só sobe na medida exata do que já extrudou. A camada de texto
      vira só um suporte para os controles, sem renderizar nada.
    - 2.2.0: (revertido) tentativa de empurrar a face inteira via letra líder.
    - 2.1.0: "Profundidade" aceita valor negativo, para inverter o sentido
      da extrusão sem mexer em "Direcao" — permite tanto um objeto que
      cresce "para o ar" (positiva) quanto um que parece emergir do chão
      (negativa). O Copies do Repeater nunca aceita negativo (o AE trava
      em 0), então a quantidade de cópias usa |Profundidade| e é o offset
      quem aplica o sinal, invertendo a direção do crescimento.
    - 2.0.0: a animação deixa de ser keyframes assados no Copies de cada
      letra (que não davam controle nenhum: mudar o ritmo exigia reeditar
      letra por letra) e passa a ser dirigida por controles no Effect
      Controls, lidos por expressão. Direção agora é um ângulo que corrige
      o eixo Y invertido do AE — antes o offset padrão crescia para baixo.
    - 1.3.0: modo "caractere" com Repeater por glifo e stagger.
    - 1.2.0: painel de controles de cor na camada de texto.
    - 1.1.0: cor própria para o corpo da extrusão.
    - 1.0.0: versão inicial, montagem do rig e das duas expressões.
*/
(function fauxExtrusionRig() {
    // ---- ajustes (valores INICIAIS dos controles) ----
    var MODO = "caractere";   // "caractere" ou "palavra"

    var PROFUNDIDADE = 70;    // nº de cópias = altura da extrusão
    var DIRECAO = 44;         // graus: 0 = para cima, 90 = direita, 180 = baixo
    var DISTANCIA = 1.5;      // px por cópia
    var STAGGER = 2.0;        // atraso entre letras (fração da duração de uma letra)
    var ORDEM_REVEAL = 0;     // 0 = esquerda->direita, 1 = direita->esquerda, 2 = centro->extremidades

    var BOUNCE_ATIVO = true;  // overshoot elástico no final da extrusão de cada letra
    var BOUNCE_FORCA = 0.08;  // 0 = sem overshoot, quanto maior, mais passa do ponto final
    var BOUNCE_REPETICOES = 1.5;    // nº de oscilações do bounce antes de estabilizar
    var BOUNCE_AMORTECIMENTO = 1.0; // velocidade de decaimento das oscilações,
                                     // independente das Repeticoes. 1 = padrão;
                                     // >1 = morre mais rápido (menos frenético);
                                     // <1 = oscila por mais tempo antes de assentar.

    // Keyframes iniciais no "Progresso", só para já sair animando — SEMPRE
    // relativas ao início da PRÓPRIA camada de texto (inPoint), não a um
    // tempo fixo de composição: 0 no inPoint, 100 dez frames depois.
    var ANIMAR = true;
    var DURACAO_FRAMES = 10;  // frames do inPoint até o Progresso chegar em 100

    var COR_FACE = [1, 1, 1];              // branco. null = mantém a cor atual do texto
    var COR_EXTRUSAO = [0.93, 0.11, 0.35]; // rosa/vermelho. null = cor do texto escurecida
    var COR_STROKE = [0.2, 0.42, 0.98];    // azul. null = cor do stroke original do texto
    var FATOR_ESCURECER = 0.55;   // 0 = preto, 1 = mesma cor do texto (só usado se COR_EXTRUSAO = null)

    var STROKE_INICIAL = true;
    var RECOLORIR_STROKE = true;
    // --------------------------------------------------

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Abra uma composição e selecione a camada de texto.");
        return;
    }

    var selecionadas = comp.selectedLayers;
    if (selecionadas.length === 0) {
        alert("Selecione a camada de texto que vai receber a extrusão.");
        return;
    }
    selecionadas = selecionadas.slice(0);

    // ---------- expressões ----------

    // Offset do repeater a partir de ângulo + distância. O -cos no Y corrige o
    // eixo invertido do AE (0° cresce para cima). O Copies do Repeater NUNCA
    // aceita negativo (o AE trava em 0) — por isso a quantidade de cópias usa
    // sempre |Profundidade|, e é este offset que aplica o SINAL de
    // Profundidade, invertendo o sentido do crescimento sem mexer no ângulo.
    // É o que permite animar tanto "saindo do ar" (Profundidade positiva)
    // quanto "emergindo do chão" (Profundidade negativa, ou o texto
    // posicionado no nível do chão com a extrusão crescendo para trás dele).
    // Referência padrão aos controles: camada de TEXTO logo ACIMA da shape
    // layer (arquitetura original). "CTRL_REF_SELF" é usado quando o rig é
    // montado direto numa shape layer NATIVA (sem camada de texto separada,
    // controles e geometria juntos na mesma camada) — ver
    // processarShapeLayerNativa(). paraCtrlRef() troca uma pela outra em
    // qualquer expressão já pronta, sem precisar duplicar nenhuma delas.
    var CTRL_REF_TEXTO = 'thisComp.layer(index - 1)';
    var CTRL_REF_SELF = 'thisComp.layer(index)';

    function paraCtrlRef(exprStr, ctrlRef) {
        return exprStr.split(CTRL_REF_TEXTO).join(ctrlRef);
    }

    var EXPR_OFFSET =
        'var ctrl = thisComp.layer(index - 1);\n' +
        'var a = degreesToRadians(ctrl.effect("Direcao")(1));\n' +
        'var d = ctrl.effect("Distancia")(1);\n' +
        'var s = ctrl.effect("Profundidade")(1) < 0 ? -1 : 1;\n' +
        '[Math.sin(a) * d * s, -Math.cos(a) * d * s];';

    // Bounce estilo Duik: em vez de uma senoide de amplitude fixa espremida
    // numa fração normalizada de progresso (o que ficava frenético e
    // dependia de "Progresso" passar de 100), usa a VELOCIDADE REAL da
    // própria keyframe de "Progresso" no instante em que esta letra bate
    // 100%, e monta uma senoide amortecida em TEMPO REAL (segundos) a partir
    // desse instante — exatamente a lógica clássica de "bounce/overshoot"
    // (Duik / a expressão de overshoot mais usada em AE): pega a velocidade
    // no momento em que o movimento "para", e deixa balançar e decair sobre
    // o tempo de verdade, não sobre uma fração artificial.
    //
    // Como acha "o instante": lê a PRIMEIRA e a ÚLTIMA keyframe de
    // "Progresso" (funciona perfeitamente para o caso padrão, 2 keyframes
    // lineares 0->100; com mais keyframes/easing na mão do usuário vira uma
    // aproximação razoável, não exata). Daí interpola linearmente pra achar
    // em que TEMPO (segundos) o valor de Progresso bateria o alvo desta
    // letra, e usa `time - essoTempo` como fase real do bounce.
    //
    // Por isso "Progresso" fica limpo em 0-100%: o bounce roda em TEMPO DE
    // COMPOSIÇÃO depois do instante calculado, não depende de Progresso
    // continuar subindo além de 100 — mesmo que ele congele em 100 (fim das
    // keyframes), o tempo da comp continua passando e o bounce ainda
    // completa, tanto pra letra do meio quanto pra última.
    var EXPR_BOUNCE_FN =
        'function aplicarBounce(ctrl, progProp, total, i, stag, tRaw) {\n' +
        '    var usaBounce = ctrl.effect("Bounce")(1);\n' +
        '    if (!usaBounce || tRaw < 1 || progProp.numKeys < 2) return 0;\n' +
        '    var k1 = progProp.key(1);\n' +
        '    var k2 = progProp.key(progProp.numKeys);\n' +
        '    if (k2.value === k1.value || k2.time === k1.time) return 0;\n' +
        '    var progressoCruzamento = ((1 + i * stag) / total) * 100;\n' +
        '    var fracaoTempo = (progressoCruzamento - k1.value) / (k2.value - k1.value);\n' +
        '    var tempoCruzamento = k1.time + fracaoTempo * (k2.time - k1.time);\n' +
        '    var tDesdeCruzou = time - tempoCruzamento;\n' +
        '    if (tDesdeCruzou <= 0) return 0;\n' +
        '    var vel = (progProp.velocityAtTime(tempoCruzamento) / 100) * total;\n' +
        '    var forca = Math.max(0, ctrl.effect("Bounce Forca")(1));\n' +
        '    var freq = Math.max(0.1, ctrl.effect("Bounce Repeticoes")(1));\n' +
        '    var decay = Math.max(0.05, ctrl.effect("Bounce Amortecimento")(1)) * 5;\n' +
        '    return vel * forca * Math.sin(freq * tDesdeCruzou * 2 * Math.PI) / Math.exp(decay * tDesdeCruzou);\n' +
        '}\n';

    // Copies de UM glifo: progresso global escalonado pela ordem de reveal.
    function exprCopies(k, n) {
        return '' +
            '// letra ' + (k + 1) + ' de ' + n + '\n' +
            'var ctrl = thisComp.layer(index - 1);\n' +
            'var progProp = ctrl.effect("Progresso")(1);\n' +
            'var prof = Math.abs(ctrl.effect("Profundidade")(1));\n' +
            'var stag = ctrl.effect("Stagger")(1);\n' +
            'var p = progProp.value / 100;\n' +
            'var k = ' + k + ';\n' +
            'var n = ' + n + ';\n' +
            '\n' +
            EXPR_BOUNCE_FN +
            '\n' +
            '// ordem do reveal: 0 = esquerda->direita, 1 = direita->esquerda, 2 = centro->extremidades\n' +
            'var ordem = Math.round(ctrl.effect("Ordem")(1));\n' +
            'var i, maxI;\n' +
            'if (ordem === 1) { i = (n - 1) - k; maxI = n - 1; }\n' +
            'else if (ordem === 2) { var c = (n - 1) / 2; i = Math.abs(k - c); maxI = c; }\n' +
            'else { i = k; maxI = n - 1; }\n' +
            '\n' +
            '// o progresso percorre a duracao de uma letra mais todos os atrasos\n' +
            'var total = 1 + stag * Math.max(0, maxI);\n' +
            'var tRaw = p * total - i * stag;\n' +
            'var subida = Math.min(1, Math.max(0, tRaw));\n' +
            'var cauda = aplicarBounce(ctrl, progProp, total, i, stag, tRaw);\n' +
            'var local = subida + cauda;\n' +
            '\n' +
            'Math.round(Math.max(0, local) * prof);';
    }

    // Modo "palavra": um repeater só, sem escalonamento (bounce ainda se aplica).
    var EXPR_COPIES_PALAVRA =
        'var ctrl = thisComp.layer(index - 1);\n' +
        'var progProp = ctrl.effect("Progresso")(1);\n' +
        'var prof = Math.abs(ctrl.effect("Profundidade")(1));\n' +
        'var p = Math.min(1, Math.max(0, progProp.value / 100));\n' +
        '\n' +
        EXPR_BOUNCE_FN +
        '\n' +
        'var tRaw = progProp.value / 100;\n' +
        'var cauda = aplicarBounce(ctrl, progProp, 1, 0, 0, tRaw);\n' +
        'var local = p + cauda;\n' +
        'Math.round(Math.max(0, local) * prof);';

    var EXPR_TEXTO =
        "// FAUX 3D EXTRUSION - face frontal\n" +
        "// compensa o deslocamento total do repeater do shape layer abaixo\n" +
        "var shapeLayer = thisComp.layer(index + 1);\n" +
        "var rep = shapeLayer.content(\"Repeater 1\");\n" +
        "var qtd = Math.max(0, rep.copies - 1);\n" +
        "var repPos = rep.transform.position;\n" +
        "\n" +
        "// a escala importa: o offset do repeater e medido antes da escala da camada\n" +
        "var scaleX = shapeLayer.transform.scale[0] / 100;\n" +
        "var scaleY = shapeLayer.transform.scale[1] / 100;\n" +
        "\n" +
        "var xOffset = repPos[0] * scaleX * qtd;\n" +
        "var yOffset = repPos[1] * scaleY * qtd;\n" +
        "\n" +
        "value - [xOffset, yOffset];";

    var EXPR_SHAPE =
        "// FAUX 3D EXTRUSION - corpo (modo palavra)\n" +
        "// segue a camada de texto logo acima (mesmo deslocamento, ancora o \"chao\")\n" +
        "thisComp.layer(index - 1).transform.position;";

    var EXPR_COR_CORPO = 'thisComp.layer(index - 1).effect("Cor Extrusao")(1);';
    var EXPR_COR_FACE_CARACTERE = 'thisComp.layer(index - 1).effect("Cor Face")(1);';
    var EXPR_COR_STROKE = 'thisComp.layer(index - 1).effect("Cor Stroke")(1);';
    var EXPR_STROKE_OP = 'thisComp.layer(index - 1).effect("Stroke")(1) ? 100 : 0;';
    var EXPR_STROKE_LARGURA = 'thisComp.layer(index - 1).effect("Stroke Largura")(1);';

    // Modo "caractere" — posição da TAMPA (cap) de UM glifo: cada letra tem a
    // sua própria tampa, empurrada pela quantidade de cópias do REPEATER
    // DELA MESMA (não de nenhuma "líder"). Isso é o que resolve a letra
    // suspensa/flutuando: cada letra só sobe na medida exata do que já
    // extrudou, nunca antes disso — sem depender de nenhuma outra letra.
    // O sinal é SOMADO (não subtraído): o corpo fica ancorado no chão (a
    // posição original do glifo) e cresce na direção do offset; a tampa
    // precisa acompanhar essa MESMA ponta de cima, senão sobe ao contrário
    // do corpo (bug relatado: a extrusão "descia" enquanto o branco deveria
    // subir empurrado por ela).
    function exprCapPos(nomeGrupo) {
        return '' +
            '// tampa da letra "' + nomeGrupo + '" - sobe so o quanto ELA MESMA ja extrudou\n' +
            'var rep = thisComp.layer(index).content("' + nomeGrupo + '").content("Repeater 1");\n' +
            'var qtd = Math.max(0, rep.copies - 1);\n' +
            'var repPos = rep.transform.position;\n' +
            '\n' +
            'value + [repPos[0] * qtd, repPos[1] * qtd];';
    }

    // Visibilidade da tampa: ela é uma duplicata ESTÁTICA da geometria, sempre
    // desenhada — sem isso, fica sentada na posição do chão (Copies=0) desde
    // o início, aparecendo ANTES do Stagger dessa letra começar. Só deve
    // ficar visível quando essa letra JÁ tem pelo menos 1 cópia extrudada.
    function exprCapOpacity(nomeGrupo) {
        return '' +
            '// tampa da letra "' + nomeGrupo + '" - só aparece quando ELA MESMA começar a extrudar\n' +
            'var rep = thisComp.layer(index).content("' + nomeGrupo + '").content("Repeater 1");\n' +
            'rep.copies > 0 ? 100 : 0;';
    }

    // ---------- helpers ----------

    function selecionarApenas(layer) {
        for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
        layer.selected = true;
    }

    function ehGrupo(p) {
        return p.propertyType === PropertyType.NAMED_GROUP ||
               p.propertyType === PropertyType.INDEXED_GROUP;
    }

    function criarContornos(textLayer) {
        selecionarApenas(textLayer);

        var nomes = ["Create Shapes from Text", "Criar Formas a Partir do Texto"];
        var cmdId = 0;
        for (var n = 0; n < nomes.length; n++) {
            cmdId = app.findMenuCommandId(nomes[n]);
            if (cmdId) break;
        }
        if (!cmdId) return null;

        try {
            app.executeCommand(cmdId);
        } catch (e) {
            return null;
        }

        var sel = comp.selectedLayers;
        for (var s = 0; s < sel.length; s++) {
            if (sel[s] instanceof ShapeLayer) return sel[s];
        }
        return null;
    }

    // X mínimo dos vértices — ordena os glifos da esquerda para a direita, já que
    // a ordem dos grupos criados pelo "Create Shapes from Text" não é garantida.
    // Soma a Position (menos o Anchor Point) de UM grupo a um X já calculado
    // no espaço LOCAL desse grupo — sem isso, grupos com Transform próprio
    // (comum em shape layers desenhadas/importadas; texto convertido por
    // "Create Shapes from Text" geralmente já embute a posição nos vértices,
    // com Transform identidade) comparam só os vértices locais, sem relação
    // nenhuma com a posição real na tela — dava ordem "aleatória".
    function comPosicaoGrupo(xLocal, grupo) {
        if (xLocal === null) return null;
        try {
            var t = grupo.property("ADBE Vector Transform Group");
            return xLocal - t.property("ADBE Vector Anchor Point").value[0]
                           + t.property("ADBE Vector Position").value[0];
        } catch (e) {
            return xLocal;
        }
    }

    function minXdoGrupo(group) {
        var min = null;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Shape - Group") {
                try {
                    var verts = p.property("ADBE Vector Shape").value.vertices;
                    for (var v = 0; v < verts.length; v++) {
                        if (min === null || verts[v][0] < min) min = verts[v][0];
                    }
                } catch (e) {}
            } else if (ehGrupo(p)) {
                var sub = comPosicaoGrupo(minXdoGrupo(p), p);
                if (sub !== null && (min === null || sub < min)) min = sub;
            }
        }
        return min;
    }

    function configurarRepeater(rep, exprCopiesStr, ctrlRef) {
        try {
            rep.property("ADBE Vector Repeater Transform")
               .property("ADBE Vector Repeater Position")
               .expression = paraCtrlRef(EXPR_OFFSET, ctrlRef);
        } catch (e) {}
        try {
            rep.property("ADBE Vector Repeater Copies").expression = exprCopiesStr;
        } catch (e) {}
        try { rep.name = "Repeater 1"; } catch (e) {}
    }

    // MODO "caractere": para cada glifo, DUPLICA o grupo inteiro pra virar a
    // tampa (Cap), e só depois adiciona o Repeater no grupo ORIGINAL (que
    // vira o corpo). Por quê duplicar em vez de reconstruir path a path
    // (como as versões 4.0/4.1 faziam): letras com "buraco" (A, B, G, O, R...)
    // não são um path só — o "Create Shapes from Text" monta elas com VÁRIOS
    // subpaths dentro do mesmo grupo, combinados pelo Fill Rule (Even-Odd).
    // Extrair "o path" na mão pegava só um desses subpaths e descartava o
    // resto — sobrava lixo solto dentro do grupo, exatamente os
    // fragmentos/triângulos quebrados que apareceram nas letras R e A.
    // Duplicar o grupo inteiro copia QUALQUER estrutura de uma vez, sem
    // reconstruir nada — sempre visualmente idêntico ao original.
    //
    // GOTCHA CRÍTICO DE EXTENDSCRIPT: duplicate() (e addProperty()) numa
    // lista indexada (Contents) invalida as referências JS já obtidas para
    // as OUTRAS propriedades da MESMA lista — não só a do item duplicado.
    // A versão anterior guardava a referência de CADA grupo de letra numa
    // array ANTES do loop; ao duplicar a letra 0, as referências das letras
    // 1, 2, 3... (guardadas antes de qualquer duplicação) ficavam
    // inválidas, e o script quebrava com "ReferenceError: Object is
    // invalid" ao tentar usar a segunda letra em diante — explicando por
    // que só a primeira letra (ou nenhuma) chegava a ganhar Repeater/Cap.
    // Correção: guarda só os NOMES (strings, imunes a essa invalidação) e
    // busca cada grupo de novo pelo nome, fresco, bem antes de usá-lo —
    // inclusive de novo logo depois do duplicate() de cada iteração.
    function repeaterPorCaractere(shapeLayer, temStroke, ctrlRef) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return 0;

        // Passo 1: só leitura + renomeio — ainda não mexe na QUANTIDADE de
        // propriedades de "contents", então as referências continuam válidas
        // até aqui. É a última vez que este código toca em referências de
        // PropertyGroup diretamente; daqui pra frente, só nomes.
        var candidatos = [];
        for (var i = 1; i <= contents.numProperties; i++) {
            var g = contents.property(i);
            if (g.matchName !== "ADBE Vector Group") continue;
            candidatos.push({ grupo: g, x: comPosicaoGrupo(minXdoGrupo(g), g) });
        }
        candidatos.sort(function (a, b) {
            if (a.x === null) return 1;
            if (b.x === null) return -1;
            return a.x - b.x;
        });

        var nomes = [];
        for (var c = 0; c < candidatos.length; c++) {
            var nomeGrupo = "FauxExt_" + c;
            try { candidatos[c].grupo.name = nomeGrupo; } catch (e) {}
            nomes.push(nomeGrupo);
        }

        // Passo 2: cada iteração busca seu grupo pelo NOME, fresco — nunca
        // reaproveita uma referência obtida antes de um duplicate() anterior
        // no loop (nem do próprio nem de outra letra).
        var n = nomes.length;
        var criados = 0;
        for (var k = 0; k < n; k++) {
            var nomeGrupo = nomes[k];
            var grupo = contents.property(nomeGrupo);
            if (!grupo) continue;

            var gc = grupo.property("ADBE Vectors Group");
            if (!gc) continue;

            // duplica o grupo INTEIRO ANTES de mexer em qualquer coisa no
            // original — o Cap nasce sem o Repeater, que só é adicionado
            // depois. duplicate() já insere a cópia ACIMA do original por
            // padrão (Cap na frente), sem precisar reordenar nada.
            var cap = null;
            try {
                cap = grupo.duplicate();
                cap.name = nomeGrupo + " Cap";
            } catch (e) {
                cap = null;
            }

            // o duplicate() acima pode ter invalidado "grupo"/"gc" (mesmo
            // sendo o próprio item, mesma lista) — reobtém fresco pelo nome
            // antes de continuar a usá-los.
            grupo = contents.property(nomeGrupo);
            gc = grupo ? grupo.property("ADBE Vectors Group") : null;
            if (!gc) continue;

            var rep;
            try { rep = gc.addProperty("ADBE Vector Filter - Repeater"); } catch (e) { continue; }
            if (!rep) continue;
            configurarRepeater(rep, paraCtrlRef(exprCopies(k, n), ctrlRef), ctrlRef);
            criados++;

            // corpo (grupo original + Repeater): cor da extrusão, stroke
            // recolorido/toggleável/com largura configurável.
            ligarCoresGrupo(gc, EXPR_COR_CORPO, temStroke, true, ctrlRef);

            if (cap) {
                // idem: reobtém o Cap fresco pelo nome antes de mexer nele.
                cap = contents.property(nomeGrupo + " Cap");
            }
            if (cap) {
                var capContents = cap.property("ADBE Vectors Group");
                if (capContents) {
                    // tampa: mesma geometria, mas cor/stroke seguem "Cor Face".
                    ligarCoresGrupo(capContents, EXPR_COR_FACE_CARACTERE, temStroke, true, ctrlRef);
                }
                try {
                    cap.property("ADBE Vector Transform Group")
                       .property("ADBE Vector Position")
                       .expression = exprCapPos(nomeGrupo);
                } catch (e) {}
                try {
                    cap.property("ADBE Vector Transform Group")
                       .property("ADBE Vector Group Opacity")
                       .expression = exprCapOpacity(nomeGrupo);
                } catch (e) {}
            }
        }

        // Passo 3: ordem de EMPILHAMENTO (z-order) entre letras DIFERENTES.
        // Quando "Direcao" não é reto pra cima/baixo, a extrusão de uma letra
        // cresce na diagonal e invade o espaço da letra vizinha — sem uma
        // ordem consistente entre os grupos (a ordem que "Create Shapes from
        // Text" cria não é da esquerda pra direita), a extrusão de uma letra
        // pode aparecer cortando a face de outra de forma incoerente.
        //
        // A letra que precisa ficar na FRENTE depende de PRA QUE LADO a
        // sombra se espalha: se cresce pra DIREITA, é a letra da direita que
        // recebe a sombra da esquerda por baixo dela — então a da direita
        // fica na frente. Se cresce pra ESQUERDA (esse era o bug: sempre
        // assumia "direita na frente", mas com a extrusão indo pra
        // baixo-esquerda é a ESQUERDA que recebe a invasão da direita, e
        // precisa ficar na frente — do jeito que tava, ficava invertido).
        // Calcula o sinal horizontal do crescimento com os MESMOS termos da
        // expressão de offset (seno do ângulo × sinal de Profundidade), nos
        // valores INICIAIS — z-order é decisão de montagem, não dá pra
        // reagir a um "Direcao" animado depois.
        var direcaoRad = DIRECAO * Math.PI / 180;
        var sinalProfundidade = PROFUNDIDADE < 0 ? -1 : 1;
        var sinalDistancia = DISTANCIA < 0 ? -1 : 1;
        var cresceParaDireita = (Math.sin(direcaoRad) * sinalProfundidade * sinalDistancia) >= 0;

        // Feito por ÚLTIMO, depois que nada mais no script precisa das
        // referências de Contents, porque moveTo() tem o MESMO gotcha do
        // duplicate() (invalida referências de irmãos na lista); sem mais
        // nada pra reaproveitar depois, não tem risco.
        //
        // DOIS passos separados, não um só movendo o par (tampa+corpo)
        // junto: mover o par junto deixava o CORPO de uma letra entre a
        // tampa dela e a tampa da VIZINHA — ou seja, o corpo de uma letra
        // podia ficar na FRENTE da tampa de outra. A tampa (face) tem que
        // ficar na frente de TODOS os corpos, não só do corpo da própria
        // letra. Por isso: primeiro empilha todos os CORPOS entre si (na
        // ordem direction-aware, pra resolver corpo-vs-corpo), e SÓ DEPOIS
        // empilha todas as TAMPAS por cima de tudo — cada moveTo(1) bota no
        // topo ABSOLUTO da lista, então rodar as tampas por último garante
        // que nenhum corpo fica acima de nenhuma tampa.
        for (var passoCorpo = 0; passoCorpo < n; passoCorpo++) {
            var mCorpo = cresceParaDireita ? passoCorpo : (n - 1 - passoCorpo);
            try {
                var grupoM = contents.property(nomes[mCorpo]);
                if (grupoM) grupoM.moveTo(1);
            } catch (e) {}
        }
        for (var passoCap = 0; passoCap < n; passoCap++) {
            var mCap = cresceParaDireita ? passoCap : (n - 1 - passoCap);
            try {
                var capM = contents.property(nomes[mCap] + " Cap");
                if (capM) capM.moveTo(1);
            } catch (e) {}
        }

        return criados;
    }

    function repeaterUnico(shapeLayer) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return;
        var rep;
        try { rep = contents.addProperty("ADBE Vector Filter - Repeater"); } catch (e) { return; }
        if (!rep) return;
        configurarRepeater(rep, EXPR_COPIES_PALAVRA, CTRL_REF_TEXTO);
    }

    function primeiraCorFill(group) {
        if (!group) return null;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Graphic - Fill") {
                try { return p.property("ADBE Vector Fill Color").value; } catch (e) {}
            } else if (ehGrupo(p)) {
                var achado = primeiraCorFill(p);
                if (achado) return achado;
            }
        }
        return null;
    }

    function primeiraCorStroke(group) {
        if (!group) return null;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Graphic - Stroke") {
                try { return p.property("ADBE Vector Stroke Color").value; } catch (e) {}
            } else if (ehGrupo(p)) {
                var achado = primeiraCorStroke(p);
                if (achado) return achado;
            }
        }
        return null;
    }

    function primeiraLarguraStroke(group) {
        if (!group) return null;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Graphic - Stroke") {
                try { return p.property("ADBE Vector Stroke Width").value; } catch (e) {}
            } else if (ehGrupo(p)) {
                var achado = primeiraLarguraStroke(p);
                if (achado !== null) return achado;
            }
        }
        return null;
    }

    function escurecer(cor, fator) {
        var nova = [cor[0] * fator, cor[1] * fator, cor[2] * fator];
        if (cor.length > 3) nova.push(cor[3]);
        return nova;
    }

    function contarStrokes(group) {
        var n = 0;
        if (!group) return n;
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);
            if (p.matchName === "ADBE Vector Graphic - Stroke") n++;
            else if (ehGrupo(p)) n += contarStrokes(p);
        }
        return n;
    }

    // Liga recursivamente todo Fill/Stroke de um grupo. O Fill segue "corExpr"
    // (diferente pro corpo/EXPR_COR_CORPO e pra tampa/EXPR_COR_FACE_CARACTERE)
    // — mas o STROKE sempre segue "Cor Stroke" (EXPR_COR_STROKE), a MESMA
    // cor pro corpo e pra tampa, independente do fill de cada um. Reutilizado
    // pro corpo e pra tampa — eles vivem em grupos SEPARADOS agora (Cap não é
    // mais aninhado dentro do grupo do corpo), então não precisa mais pular
    // nada por nome.
    function ligarCoresGrupo(group, corExpr, temCheckbox, aplicarLargura, ctrlRef) {
        var corExprFinal = paraCtrlRef(corExpr, ctrlRef);
        for (var i = 1; i <= group.numProperties; i++) {
            var p = group.property(i);

            if (p.matchName === "ADBE Vector Graphic - Fill") {
                try {
                    p.property("ADBE Vector Fill Color").expression = corExprFinal;
                } catch (e) {}

            } else if (p.matchName === "ADBE Vector Graphic - Stroke") {
                if (RECOLORIR_STROKE) {
                    try {
                        p.property("ADBE Vector Stroke Color").expression = paraCtrlRef(EXPR_COR_STROKE, ctrlRef);
                    } catch (e) {}
                }
                if (temCheckbox) {
                    try {
                        p.property("ADBE Vector Stroke Opacity").expression = paraCtrlRef(EXPR_STROKE_OP, ctrlRef);
                    } catch (e) {}
                }
                if (aplicarLargura && temCheckbox) {
                    try {
                        p.property("ADBE Vector Stroke Width").expression = paraCtrlRef(EXPR_STROKE_LARGURA, ctrlRef);
                    } catch (e) {}
                }

            } else if (ehGrupo(p)) {
                ligarCoresGrupo(p, corExpr, temCheckbox, aplicarLargura, ctrlRef);
            }
        }
    }

    function addSlider(fx, nome, valor) {
        try {
            var s = fx.addProperty("ADBE Slider Control");
            s.name = nome;
            s.property(1).setValue(valor);
            return s;
        } catch (e) {
            return null;
        }
    }

    function addCheckbox(fx, nome, valor) {
        try {
            var c = fx.addProperty("ADBE Checkbox Control");
            c.name = nome;
            c.property(1).setValue(valor ? 1 : 0);
            return c;
        } catch (e) {
            return null;
        }
    }

    // Painel único no texto: animação primeiro, depois cor.
    function montarControles(textLayer, shapeLayer) {
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        if (!contents) return;

        var fx = textLayer.property("ADBE Effect Parade");
        if (!fx) return;

        // --- animação ---
        var progresso = addSlider(fx, "Progresso", ANIMAR ? 0 : 100);
        addSlider(fx, "Profundidade", PROFUNDIDADE);

        try {
            var ang = fx.addProperty("ADBE Angle Control");
            ang.name = "Direcao";
            ang.property(1).setValue(DIRECAO);
        } catch (e) {}

        addSlider(fx, "Distancia", DISTANCIA);
        addSlider(fx, "Stagger", STAGGER);

        // Ordem do reveal entre letras: 0 = esquerda->direita, 1 = direita->esquerda,
        // 2 = centro->extremidades. Lido por expressão em cada letra (exprCopies).
        addSlider(fx, "Ordem", ORDEM_REVEAL);

        // Bounce: overshoot elástico no final da extrusão de cada letra. Como a
        // tampa (Cap) lê o mesmo Copies do repeater, ela acompanha o bounce do
        // corpo sem precisar de expressão própria.
        addCheckbox(fx, "Bounce", BOUNCE_ATIVO);
        addSlider(fx, "Bounce Forca", BOUNCE_FORCA);
        addSlider(fx, "Bounce Repeticoes", BOUNCE_REPETICOES);
        addSlider(fx, "Bounce Amortecimento", BOUNCE_AMORTECIMENTO);

        // keyframes só no Progresso — é o único ponto de animação do rig.
        // Sempre relativas ao INÍCIO DESTA CAMADA (inPoint), não a um tempo
        // fixo de composição — assim funciona igual não importa onde a
        // camada comece na timeline.
        //
        // "progresso" foi capturado lá em cima, ANTES de vários outros
        // fx.addProperty() (Profundidade, Direcao, Distancia, Stagger,
        // Ordem, Bounce...) — e o Effect Parade também é uma lista indexada:
        // mesmo gotcha do duplicate()/addProperty() em Contents de shape
        // layer, cada addProperty() nela invalida referências de IRMÃS já
        // obtidas antes ("ReferenceError: Object is invalid", confirmado
        // rodando com um alerta de diagnóstico). Por isso reobtém "Progresso"
        // fresco pelo NOME agora, bem antes de usar — nunca reaproveita a
        // referência antiga.
        if (ANIMAR) {
            var progressoFresco = null;
            try { progressoFresco = fx.property("Progresso"); } catch (e) {}
            if (progressoFresco) {
                try {
                    var p = progressoFresco.property(1);
                    var inicioReal = textLayer.inPoint;
                    var duracaoReal = DURACAO_FRAMES * comp.frameDuration;
                    p.setValueAtTime(inicioReal, 0);
                    p.setValueAtTime(inicioReal + duracaoReal, 100);
                } catch (e) {}
            }
        }

        // --- cor ---
        var corBase = primeiraCorFill(contents);
        var corFace = COR_FACE ? COR_FACE : (corBase ? corBase : [1, 1, 1]);
        var corExtrusao = COR_EXTRUSAO
            ? COR_EXTRUSAO
            : (corBase ? escurecer(corBase, FATOR_ESCURECER) : [0, 0, 0]);

        try {
            var ctlCorpo = fx.addProperty("ADBE Color Control");
            ctlCorpo.name = "Cor Extrusao";
            ctlCorpo.property(1).setValue(corExtrusao);
        } catch (e) {
            return false; // sem o controle de cor não há o que ligar no corpo
        }

        var temStroke = contarStrokes(contents) > 0;
        if (temStroke) {
            try {
                var chk = fx.addProperty("ADBE Checkbox Control");
                chk.name = "Stroke";
                chk.property(1).setValue(STROKE_INICIAL ? 1 : 0);
            } catch (e) {
                temStroke = false;
            }
            if (temStroke) {
                var larguraInicial = primeiraLarguraStroke(contents);
                addSlider(fx, "Stroke Largura", larguraInicial !== null ? larguraInicial : 2);

                // cor do stroke INDEPENDENTE de "Cor Face" e "Cor Extrusao" —
                // corpo e tampa usam essa mesma cor pro contorno, mas o fill
                // de cada um continua com sua própria cor.
                var corStrokeInicial = primeiraCorStroke(contents);
                var corStrokeFinal = COR_STROKE ? COR_STROKE : (corStrokeInicial ? corStrokeInicial : corExtrusao);
                try {
                    var ctlStroke = fx.addProperty("ADBE Color Control");
                    ctlStroke.name = "Cor Stroke";
                    ctlStroke.property(1).setValue(corStrokeFinal);
                } catch (e) {}
            }
        }

        // No modo "caractere" NÃO liga aqui: repeaterPorCaractere ainda vai
        // duplicar cada grupo (corpo vira o original + Repeater, tampa é a
        // cópia) — ligar antes disso não teria efeito nenhum na tampa, que
        // ainda nem existe. repeaterPorCaractere liga os dois separadamente
        // depois de duplicar.
        if (MODO !== "caractere") {
            ligarCoresGrupo(contents, EXPR_COR_CORPO, temStroke, true, CTRL_REF_TEXTO);
        }

        // "Cor Face" é usado nos dois modos: no "caractere" é a cor da tampa
        // (Cap) dentro da shape layer; no "palavra" é também a cor do
        // efeito Fill abaixo. Por isso o controle sempre existe.
        try {
            var ctlFace = fx.addProperty("ADBE Color Control");
            ctlFace.name = "Cor Face";
            ctlFace.property(1).setValue(corFace);
        } catch (e) {}

        // O efeito Fill só faz sentido no modo "palavra" (o texto original É
        // a face, precisa ser tingido). No "caractere" ele é código morto —
        // quem renderiza a face é a tampa (Cap) dentro da shape layer, o
        // texto original nem aparece. Pior: código morto que ainda assim
        // FUNCIONA se a camada de texto acabar ficando visível por qualquer
        // motivo (reordenação manual, sobra de teste, etc.) — nesse caso ele
        // pinta a camada INTEIRA de "Cor Face", cobrindo o rig de verdade
        // por baixo (foi exatamente o que aconteceu: só desativando esse
        // Fill a cor da extrusão voltou a aparecer). Em vez de garantir que
        // a camada nunca fique visível por acidente, é mais robusto nem
        // criar o efeito que só causa dano nesse cenário.
        if (MODO !== "caractere") {
            try {
                var fill = fx.addProperty("ADBE Fill");
                var corDoFill = null;
                try { corDoFill = fill.property("Color"); } catch (e) {}
                if (!corDoFill) { try { corDoFill = fill.property("ADBE Fill-0002"); } catch (e) {} }
                if (corDoFill) corDoFill.expression = 'effect("Cor Face")(1);';
            } catch (e) {}
        }

        return temStroke;
    }

    function aplicarExpressao(layer, expr) {
        try {
            var pos = layer.property("ADBE Transform Group").property("ADBE Position");
            if (pos && pos.canSetExpression) {
                pos.expression = expr;
                return true;
            }
        } catch (e) {}
        return false;
    }

    // Prende a camada de texto e a shape layer a um Null, pra mover as duas
    // juntas de uma vez. Numa ATUALIZAÇÃO (texto já tinha rig), reaproveita o
    // Null que a camada de texto já tem como pai em vez de criar outro — só
    // cria um novo se ela ainda não tiver parent nenhum (primeira montagem).
    // Prende uma camada ao Null SEM ela pular de lugar: a posição efetiva de
    // uma camada com pai é null.position + camada.position (no espaço do
    // pai) — então, pra manter o resultado visual igual, subtrai da posição
    // atual da camada o quanto o Null já vale, ANTES de atribuir o parent.
    function parentearCompensado(layer, nullLayer) {
        var posAtual = null, posNull = null;
        try { posAtual = layer.property("ADBE Transform Group").property("ADBE Position").value; } catch (e) {}
        try { posNull = nullLayer.property("ADBE Transform Group").property("ADBE Position").value; } catch (e) {}

        try { layer.parent = nullLayer; } catch (e) { return; }

        if (posAtual && posNull) {
            try {
                var nova = [];
                for (var i = 0; i < posAtual.length; i++) nova.push(posAtual[i] - (posNull[i] || 0));
                layer.property("ADBE Transform Group").property("ADBE Position").setValue(nova);
            } catch (e) {}
        }
    }

    function garantirNullDeControle(textLayer, shapeLayer) {
        var nullExistente = null;
        try { nullExistente = textLayer.parent; } catch (e) {}

        if (!nullExistente) {
            // Null nasce no ANCHOR POINT do texto (a posição atual da
            // camada, no espaço do comp, já que ela ainda não tem pai) — não
            // em [0,0], que fica num canto qualquer do comp sem relação
            // nenhuma com o texto.
            var posAncoraTexto = null;
            try { posAncoraTexto = textLayer.property("ADBE Transform Group").property("ADBE Position").value; } catch (e) {}

            try {
                nullExistente = comp.layers.addNull();
                nullExistente.name = textLayer.name + " Null";
                if (posAncoraTexto) {
                    nullExistente.property("ADBE Transform Group").property("ADBE Position").setValue(posAncoraTexto);
                }
            } catch (e) { nullExistente = null; }

            if (nullExistente) {
                parentearCompensado(textLayer, nullExistente);
            }
        }

        // numa shape layer NATIVA, textLayer e shapeLayer são a MESMA
        // camada — já foi parenteada/compensada acima, não faz de novo
        // (compensaria a posição duas vezes, jogando a camada pro lugar errado).
        if (nullExistente && shapeLayer !== textLayer) {
            parentearCompensado(shapeLayer, nullExistente);
        }
    }

    // Monta o rig direto numa SHAPE LAYER já existente (não gerada a partir
    // de texto) — cada grupo de nível 1 em Contents vira uma "letra". Não
    // há camada de texto separada: controles e geometria vivem na MESMA
    // camada, e as expressões usam CTRL_REF_SELF (thisComp.layer(index)) em
    // vez de CTRL_REF_TEXTO (thisComp.layer(index - 1)) — mesma lógica de
    // sempre, só apontando pra si mesma. Retorna true se montou com sucesso.
    function processarShapeLayerNativa(shapeLayer) {
        var fx = null, jaTemRig = false;
        try {
            fx = shapeLayer.property("ADBE Effect Parade");
            jaTemRig = !!(fx && fx.property("Progresso"));
        } catch (e) { jaTemRig = false; }

        if (jaTemRig) {
            // Atualização (regenerar geometria a partir de uma fonte) só
            // existe pro fluxo de texto, onde "Create Shapes from Text" dá
            // uma fonte pra regenerar. Uma shape layer nativa já É a
            // geometria — não tem de onde reconstruir. Pra não arriscar
            // destruir o rig existente, só avisa e não mexe em nada.
            alert(
                'A camada "' + shapeLayer.name + '" já parece ter um rig montado ' +
                '(efeito "Progresso" já existe). Rodar de novo numa shape layer ' +
                'nativa que já tem rig ainda não é suportado — nada foi alterado.'
            );
            return false;
        }

        // Protege contra selecionar por engano a shape layer GERADA por um
        // rig baseado em texto (onde os controles ficam na camada de texto
        // acima, não nela) — nesse caso "jaTemRig" acima dá falso, mas os
        // grupos já são "FauxExt_..." (corpos) e "FauxExt_... Cap" (tampas).
        // Tratar cada um como uma letra nova bagunçaria tudo.
        var contentsAtual = null;
        try { contentsAtual = shapeLayer.property("ADBE Root Vectors Group"); } catch (e) {}
        if (contentsAtual) {
            for (var gi = 1; gi <= contentsAtual.numProperties; gi++) {
                var gCheck = contentsAtual.property(gi);
                if (gCheck.matchName === "ADBE Vector Group" && gCheck.name &&
                    gCheck.name.indexOf("FauxExt_") === 0) {
                    alert(
                        'A camada "' + shapeLayer.name + '" parece ser a shape layer ' +
                        'GERADA por um rig baseado em texto (tem grupos "FauxExt_..."), ' +
                        'não uma shape layer nativa. Rodar aqui trataria cada corpo/tampa ' +
                        'como letra nova e bagunçaria a estrutura — nada foi alterado.'
                    );
                    return false;
                }
            }
        }

        var temStroke = montarControles(shapeLayer, shapeLayer);

        garantirNullDeControle(shapeLayer, shapeLayer);

        var letrasProcessadas = repeaterPorCaractere(shapeLayer, temStroke, CTRL_REF_SELF);
        if (letrasProcessadas === 0) {
            alert(
                'A camada "' + shapeLayer.name + '" não tem nenhum grupo de nível 1 ' +
                'em Contents pra virar "letra" (nenhum "ADBE Vector Group" direto na ' +
                'raiz). Confira a estrutura da shape layer.'
            );
            return false;
        }

        try { selecionarApenas(shapeLayer); } catch (e) {}
        return true;
    }

    // ---------- execução ----------

    var montados = 0;
    var semTexto = 0;
    var falhaContornos = 0;
    var semLetras = 0;

    for (var i = 0; i < selecionadas.length; i++) {
        var camada = selecionadas[i];

        if (camada instanceof ShapeLayer) {
            app.beginUndoGroup("Faux 3D Extrusion Rig");
            try {
                if (processarShapeLayerNativa(camada)) montados++;
            } finally {
                app.endUndoGroup();
            }
            continue;
        }

        var textLayer = camada;

        if (!(textLayer instanceof TextLayer)) {
            semTexto++;
            continue;
        }

        app.beginUndoGroup("Faux 3D Extrusion Rig");

        // try/finally: se algo quebrar no meio do processamento desta
        // camada, o endUndoGroup() ainda roda — sem isso, um erro deixava o
        // grupo de undo aberto (o "Erro ao rodar..." interrompia o script
        // ANTES de chegar no endUndoGroup original, no fim do loop).
        try {
            // Detecta se essa camada JÁ tem o painel montado (efeito
            // "Progresso" já existe) — nesse caso é uma ATUALIZAÇÃO: o
            // texto/fonte foi editado depois do rig pronto, e só a
            // GEOMETRIA (shape layer) precisa ser refeita, sem recriar nem
            // tocar em nenhum controle (Progresso mantém as keyframes que
            // já estavam lá).
            var fxTexto = null;
            var jaTemRig = false;
            try {
                fxTexto = textLayer.property("ADBE Effect Parade");
                jaTemRig = !!(fxTexto && fxTexto.property("Progresso"));
            } catch (e) { jaTemRig = false; }

            var shapeLayer, temStroke;

            if (jaTemRig) {
                // a shape layer antiga, por convenção do próprio script, fica
                // logo ABAIXO da camada de texto (shapeLayer.moveAfter) —
                // pede confirmação antes de apagar, já que é destrutivo.
                var antiga = null;
                try {
                    var candidata = comp.layer(textLayer.index + 1);
                    if (candidata instanceof ShapeLayer) antiga = candidata;
                } catch (e) {}

                if (antiga) {
                    var confirma = confirm(
                        'Apagar a camada de extrusão antiga "' + antiga.name +
                        '" e remontar a partir do texto/fonte atual de "' + textLayer.name +
                        '"?\n\nOs controles (Progresso com as keyframes, cores, etc.) ' +
                        'na camada de texto não serão alterados.'
                    );
                    if (!confirma) { continue; }
                    try { antiga.remove(); } catch (e) {}
                }

                // reabilita ANTES de gerar os contornos: nesse ponto a camada
                // normalmente já está desligada (a rodada anterior desliga
                // no fim, modo "caractere") — rodar "Create Shapes from
                // Text" numa camada de texto ESCONDIDA já produziu geometria
                // degenerada (grupos fantasma/sobrepostos). Quem desliga de
                // volta é a lógica mais abaixo (igual faz numa montagem nova).
                try { textLayer.enabled = true; } catch (e) {}

                shapeLayer = criarContornos(textLayer);
                if (!shapeLayer) { falhaContornos++; continue; }
                shapeLayer.name = textLayer.name + " Extrusao";
                try { shapeLayer.moveAfter(textLayer); } catch (e) {}

                // Stroke: reaproveita o checkbox "Stroke" já existente. Se o
                // texto/fonte novo ganhou stroke e o painel antigo não tinha
                // esses controles, cria agora (mesma lógica de montarControles).
                var contentsNovo = shapeLayer.property("ADBE Root Vectors Group");
                var temStrokeGeom = contarStrokes(contentsNovo) > 0;
                var jaTemStrokeCtrl = false;
                try { jaTemStrokeCtrl = !!fxTexto.property("Stroke"); } catch (e) {}

                if (temStrokeGeom && !jaTemStrokeCtrl) {
                    try {
                        var chkNovo = fxTexto.addProperty("ADBE Checkbox Control");
                        chkNovo.name = "Stroke";
                        chkNovo.property(1).setValue(STROKE_INICIAL ? 1 : 0);
                    } catch (e) {}
                    var larguraNova = primeiraLarguraStroke(contentsNovo);
                    addSlider(fxTexto, "Stroke Largura", larguraNova !== null ? larguraNova : 2);
                    var corStrokeNova = primeiraCorStroke(contentsNovo);
                    var corStrokeNovaFinal = COR_STROKE ? COR_STROKE : (corStrokeNova ? corStrokeNova : [0, 0, 0]);
                    try {
                        var ctlStrokeNovo = fxTexto.addProperty("ADBE Color Control");
                        ctlStrokeNovo.name = "Cor Stroke";
                        ctlStrokeNovo.property(1).setValue(corStrokeNovaFinal);
                    } catch (e) {}
                }

                try { temStroke = temStrokeGeom && !!fxTexto.property("Stroke"); } catch (e) { temStroke = false; }

            } else {
                // fluxo original: monta o painel do zero.
                shapeLayer = criarContornos(textLayer);
                if (!shapeLayer) {
                    falhaContornos++;
                    continue;
                }

                shapeLayer.name = textLayer.name + " Extrusao";
                try { shapeLayer.moveAfter(textLayer); } catch (e) {}

                // controles primeiro: os repeaters entram já lendo eles por expressão
                temStroke = montarControles(textLayer, shapeLayer);
            }

            // um Null pai pras duas camadas (texto + shape) facilita mover
            // o rig inteiro de uma vez. Reaproveita o Null existente numa
            // atualização; cria um novo só na primeira montagem.
            garantirNullDeControle(textLayer, shapeLayer);

            if (MODO === "caractere") {
                // a face vira as "tampas" dentro do próprio shape layer, cada uma
                // empurrada pela extrusão da SUA letra — o texto original só
                // guarda os controles, não precisa mais renderizar nada.
                // Desliga EXPLICITAMENTE (não confia só no "Create Shapes from
                // Text" desligar sozinho) — reforço depois de ver um caso em
                // que o texto original apareceu por cima do rig, sem cor
                // nenhuma, num reprocessamento (modo Atualização).
                try { textLayer.enabled = false; } catch (e) {}

                var letrasProcessadas = repeaterPorCaractere(shapeLayer, temStroke, CTRL_REF_TEXTO);
                if (letrasProcessadas === 0) {
                    semLetras++;
                    alert(
                        'A camada "' + textLayer.name + '" gerou uma shape layer, mas ' +
                        'nenhuma letra foi processada (0 grupos de glifo encontrados em ' +
                        '"' + shapeLayer.name + '"). A geometria ficou crua, sem repeater, ' +
                        'sem cor — o "Create Shapes from Text" pode não ter rodado direito ' +
                        'dessa vez. Apague essa shape layer e rode o script de novo.'
                    );
                }
            } else {
                // o comando desliga o texto original; aqui ele volta a ser a face
                try { textLayer.enabled = true; } catch (e) {}
                repeaterUnico(shapeLayer);
                aplicarExpressao(textLayer, EXPR_TEXTO);
                aplicarExpressao(shapeLayer, EXPR_SHAPE);
            }

            // termina com a camada de TEXTO selecionada (não a shape layer)
            // — é ela que tem os controles, pra ir direto no Effect Controls.
            try { selecionarApenas(textLayer); } catch (e) {}

            montados++;
        } finally {
            app.endUndoGroup();
        }
    }

    if (montados === 0) {
        var msg = "Nenhum rig foi montado.\n\n";
        if (semTexto > 0) msg += "Camadas selecionadas que não são texto: " + semTexto + "\n";
        if (falhaContornos > 0) msg += "Falhas ao gerar contornos (Create Shapes from Text): " + falhaContornos + "\n";
        if (semLetras > 0) msg += "Camadas sem nenhuma letra processada: " + semLetras + "\n";
        alert(msg);
    }
})();
