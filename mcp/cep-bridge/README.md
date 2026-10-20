# AE MCP Bridge (CEP) — substituto do polling por `app.scheduleTask`

## Por que essa mudança existia

O `ae-bridge.jsx` antigo (em `Scripts/Startup`) rodava dentro do próprio
After Effects via `app.scheduleTask("ae_bridge_tick()", 200, false)`,
reagendando-se a cada 200ms para sempre, enquanto o AE estivesse aberto.

Quando uma janela modal estava na tela (Composition Settings, Render Queue
Output Module, etc.), o AE tentava disparar essa tarefa agendada mesmo assim
e mostrava:

> Unable to execute script at line 0. After Effects error: Cannot run a
> script while a modal dialog is waiting for response.

Isso acontecia **mesmo sem nenhum comando do Claude/MCP em andamento**,
porque o polling nunca parava.

## Como funciona agora

Em vez de um script ExtendScript se reagendando sozinho, uma **extensão CEP**
(painel do AE, mas com um contexto Node.js/Chromium próprio, fora do motor
ExtendScript) faz o polling:

- `js/main.js` roda em `setInterval(200ms)` **no processo Node/CEF do painel**,
  não dentro do ExtendScript. Ele lê `task.json` diretamente com `fs`.
- Só quando existe uma tarefa pendente, ele chama
  `window.__adobe_cep__.evalScript(...)`, que executa **uma única vez** a
  função `aemcp_runTask(code)` definida em `jsx/host.jsx`.
- `jsx/host.jsx` não tem nenhum `scheduleTask`. Ele só existe para ser
  chamado sob demanda.
- Se o AE estiver com um diálogo modal aberto, o `evalScript` simplesmente
  fica pendente/enfileirado (comportamento normal do CEP) até o modal
  fechar — ou, se passar de 6 segundos (`TASK_TIMEOUT_MS`, sempre menor que
  os 8s que o servidor Node espera), o próprio painel escreve um
  `result.json` de erro controlado, sem gerar popup no AE.

O contrato de arquivos (`task.json` / `result.json`, campos `id`/`code`/
`success`/`data`/`error`) é **idêntico** ao anterior — nada mudou em
`ae-mcp-server/dist/ae-runner.js` nem em `ae-mcp-server/dist/index.js`.
O servidor MCP e o cliente Claude Code continuam funcionando sem alterações.

## Instalação

1. **Backup + desativação do script antigo** (já feito nesta máquina):
   - Backup em `D:\_Claude\AE-mcp\backups\ae-bridge.jsx.<timestamp>.bak`
   - Original renomeado para:
     `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Scripts\Startup\ae-bridge.jsx.disabled`
   - (requer permissão de administrador, pois fica em Program Files)

2. **Copiar a extensão CEP** para a pasta de extensões do usuário
   (não precisa de admin):
   ```powershell
   $dest = "$env:APPDATA\Adobe\CEP\extensions\com.aemcp.bridge"
   New-Item -ItemType Directory -Path $dest -Force
   Copy-Item -Path "D:\_Claude\AE-mcp\cep-bridge\*" -Destination $dest -Recurse -Force
   ```

3. **Habilitar modo debug do CEP** (necessário porque a extensão não é
   assinada digitalmente — só afeta extensões carregadas localmente):
   ```powershell
   foreach ($v in @("6","7","8","9","10","11","12")) {
     $key = "HKCU:\Software\Adobe\CSXS.$v"
     New-Item -Path $key -Force | Out-Null
     New-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force
   }
   ```
   > Atenção ao nome da chave: é `CSXS.9`, `CSXS.10`... (sem `.0` extra).

4. **Reiniciar o After Effects** completamente (fechar e abrir de novo) para
   ele carregar a extensão no menu e deixar de carregar o script antigo do
   Startup.

## Iniciar (toda sessão do AE)

1. Abra o After Effects.
2. Vá em **Window → Extensions → AE MCP Bridge**.
3. O painel mostra "aguardando tarefas..." — é só isso, pode deixar
   flutuando/dockado em qualquer canto.
4. Enquanto esse painel estiver aberto, os comandos MCP do Claude funcionam
   normalmente. Se o painel for fechado, a ponte para de responder (mas o
   AE continua 100% normal, sem nenhum popup ou script rodando sozinho).

## Testar

- **Comando básico**: no Claude, peça algo que use
  `ae_get_project_elements` ou `ae_run_custom_script` — deve responder em
  menos de 1 segundo.
- **Teste de modal**: abra qualquer diálogo modal no AE (ex: Composition →
  Composition Settings) e, com ele aberto, peça ao Claude para rodar um
  comando MCP. Nenhum popup de erro deve aparecer; o AE deve continuar
  respondendo normalmente ao fechar o diálogo.
- **Teste de idle**: com o painel aberto e nenhum comando sendo enviado,
  confirme que o AE se comporta normalmente (sem lentidão, sem popups),
  já que agora o polling roda fora do ExtendScript.

## Remover / reverter

Para desfazer completamente e voltar ao estado anterior:

```powershell
# 1. Remove a extensão CEP
Remove-Item -Recurse -Force "$env:APPDATA\Adobe\CEP\extensions\com.aemcp.bridge"

# 2. Restaura o script antigo do Startup (requer admin)
Rename-Item -Path "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Scripts\Startup\ae-bridge.jsx.disabled" `
            -NewName "ae-bridge.jsx"

# 3. (opcional) remove o PlayerDebugMode se não usar outras extensões CEP não assinadas
```

Para apenas desativar temporariamente sem remover nada: feche o painel
"AE MCP Bridge" no AE (Window → Extensions) — a ponte simplesmente para de
responder, sem precisar desinstalar nada.

## Arquivos

- `CSXS/manifest.xml` — declaração da extensão (host AEFT, painel).
- `index.html` — UI mínima do painel (status + log).
- `js/main.js` — polling em Node.js/CEF, `evalScript` sob demanda, timeout
  e limpeza de arquivos.
- `jsx/host.jsx` — função ExtendScript chamada sob demanda (sem
  `scheduleTask`).

## O que NÃO foi alterado

- `ae-mcp-server/dist/ae-runner.js` e `ae-mcp-server/dist/index.js` — o
  contrato de comunicação (task.json/result.json, IDs, timeouts do lado do
  Node) continua o mesmo.
- Painéis/scripts do **Duik** (Bassel/Angela) e do **Matter** — nenhum
  arquivo desses foi tocado. O `ae-bridge.js` do Matter usa
  `CSInterface.evalScript` sob demanda a partir do próprio painel do Matter
  e não tinha o problema de polling permanente.
