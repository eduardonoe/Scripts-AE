(function() {
    // Localização universal da ponte na pasta Temp do sistema
    var bridgeDir = new Folder(Folder.temp.fsName + "/ae_bridge");
    if (!bridgeDir.exists) {
        bridgeDir.create();
    }

    var taskFile = new File(bridgeDir.fsName + "/task.json");
    var resultFile = new File(bridgeDir.fsName + "/result.json");

    function processTask() {
        if (taskFile.exists) {
            try {
                taskFile.open("r");
                var content = taskFile.read();
                taskFile.close();
                taskFile.remove();

                if (content && content.length > 0) {
                    var data = eval("(" + content + ")");
                    var evalResult = null;
                    var errorMsg = null;
                    
                    try {
                        evalResult = eval("(function() { " + data.code + " })()");
                    } catch(err) {
                        errorMsg = err.toString() + (err.line ? " (Linha " + err.line + ")" : "");
                    }

                    var response = {
                        id: data.id,
                        success: errorMsg === null,
                        data: evalResult,
                        error: errorMsg
                    };

                    resultFile.open("w");
                    resultFile.encoding = "UTF-8";
                    resultFile.write(JSON.stringify ? JSON.stringify(response) : "");
                    resultFile.close();
                }
            } catch(e) {
                // Erro de I/O ignorado
            }
        }
        
        app.scheduleTask("ae_bridge_tick()", 200, false);
    }

    $.global.ae_bridge_tick = processTask;
    processTask();
})();
