// AE MCP Bridge - CEP panel logic (runs in the panel's Chromium/Node process,
// NOT inside the ExtendScript engine). Polls for task.json here in JS/Node,
// and only calls CSInterface.evalScript() when a task actually exists.
// This replaces the old app.scheduleTask(200ms) loop that used to run
// permanently inside ExtendScript and blocked/errored on modal dialogs.

(function () {
  var fs = require("fs");
  var path = require("path");
  var os = require("os");

  var TEMP_BRIDGE_DIR = path.join(os.tmpdir(), "ae_bridge");
  var PACKAGE_BRIDGE_DIR = path.join(__dirname, "..", "..", "ae-mcp-server", ".ae_bridge");
  var BRIDGE_DIRS = [TEMP_BRIDGE_DIR, PACKAGE_BRIDGE_DIR];

  var POLL_INTERVAL_MS = 200;
  var TASK_TIMEOUT_MS = 6000; // must stay below the Node server's 8s wait

  var stateEl = document.getElementById("state");
  var logEl = document.getElementById("log");

  function log(msg, cls) {
    var line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = new Date().toLocaleTimeString() + "  " + msg;
    logEl.insertBefore(line, logEl.firstChild);
    while (logEl.childNodes.length > 40) logEl.removeChild(logEl.lastChild);
  }

  function setState(text, cls) {
    stateEl.textContent = text;
    stateEl.className = cls || "";
  }

  BRIDGE_DIRS.forEach(function (dir) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // ignore - directory may already exist or be uncreatable, handled at read time
    }
  });

  var busy = false;
  var handledIds = {};

  function writeResult(id, payload) {
    var json = JSON.stringify(payload);
    BRIDGE_DIRS.forEach(function (dir) {
      try {
        fs.writeFileSync(path.join(dir, "result.json"), json, "utf-8");
      } catch (e) {
        // best-effort: if one dir is unwritable, the other may still succeed
      }
    });
  }

  function removeTaskFile(dir) {
    try {
      fs.unlinkSync(path.join(dir, "task.json"));
    } catch (e) {
      // already consumed or removed by a previous tick
    }
  }

  function findPendingTask() {
    for (var i = 0; i < BRIDGE_DIRS.length; i++) {
      var dir = BRIDGE_DIRS[i];
      var taskPath = path.join(dir, "task.json");
      try {
        if (fs.existsSync(taskPath)) {
          var raw = fs.readFileSync(taskPath, "utf-8");
          if (raw && raw.trim().length > 0) {
            var data = JSON.parse(raw);
            return { dir: dir, data: data };
          }
        }
      } catch (e) {
        // malformed/partial write mid-flight - skip this tick, try again next tick
      }
    }
    return null;
  }

  function processTask(found) {
    var id = found.data.id;
    var code = found.data.code;

    // consume the task file immediately so it is not picked up twice
    removeTaskFile(found.dir);

    busy = true;
    handledIds[id] = false;
    setState("executando tarefa " + id + "...", "busy");
    log("Tarefa recebida: " + id);

    var timeoutHandle = setTimeout(function () {
      if (handledIds[id]) return; // real result already arrived, ignore
      handledIds[id] = true;
      busy = false;
      setState("aguardando tarefas...", "ok");
      log("Timeout (" + TASK_TIMEOUT_MS + "ms) - possivel dialogo modal aberto no AE. Erro controlado enviado.", "err");
      writeResult(id, {
        id: id,
        success: false,
        data: null,
        error: "Tempo limite no lado do CEP: o After Effects pode estar ocupado com uma janela modal. Tente novamente apos fechar o dialogo."
      });
    }, TASK_TIMEOUT_MS);

    try {
      var script = "aemcp_runTask(" + JSON.stringify(code) + ")";
      window.__adobe_cep__.evalScript(script, function (resultStr) {
        if (handledIds[id]) return; // timeout already fired and handled this id
        handledIds[id] = true;
        clearTimeout(timeoutHandle);
        busy = false;

        var parsed;
        try {
          parsed = JSON.parse(resultStr);
        } catch (parseErr) {
          parsed = { success: false, data: null, error: "Falha ao interpretar resposta do AE: " + String(resultStr) };
        }

        writeResult(id, {
          id: id,
          success: !!parsed.success,
          data: parsed.data,
          error: parsed.error || null
        });

        if (parsed.success) {
          setState("aguardando tarefas...", "ok");
          log("Tarefa " + id + " concluida.", "ok");
        } else {
          setState("aguardando tarefas...", "ok");
          log("Tarefa " + id + " falhou: " + parsed.error, "err");
        }
      });
    } catch (callErr) {
      if (!handledIds[id]) {
        handledIds[id] = true;
        clearTimeout(timeoutHandle);
        busy = false;
        writeResult(id, { id: id, success: false, data: null, error: "Erro ao chamar evalScript: " + callErr.toString() });
        setState("aguardando tarefas...", "ok");
        log("Erro ao despachar tarefa " + id + ": " + callErr.toString(), "err");
      }
    }
  }

  function tick() {
    if (busy) return;
    var found = findPendingTask();
    if (found) processTask(found);
  }

  setState("aguardando tarefas...", "ok");
  log("Ponte iniciada. Diretorios monitorados: " + BRIDGE_DIRS.join(" | "));

  setInterval(tick, POLL_INTERVAL_MS);
})();
