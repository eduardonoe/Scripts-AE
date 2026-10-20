/*
    Diagnostico de area de transferencia para o Swatch Colors - versao 2.

    A versao 1 nao conseguiu concluir nada porque a propria leitura de
    verificacao usava PowerShell, e o relatorio mostrou que o PowerShell
    nao executa via system.callSystem nesta instalacao (enquanto o cmd.exe
    executa normalmente).

    Esta versao nao usa PowerShell para verificar: para cada metodo de copia
    ela abre uma caixa e pede que voce cole com Ctrl+V. O script compara
    sozinho o que foi colado com o que deveria ter sido copiado.

    Rode em: File > Scripts > Run Script File...
    Nao altera nenhum projeto.
*/

(function () {
    var report = [];
    var tempDir = Folder.temp.fsName;

    function line(s) { report.push(s); }

    // Escreve o arquivo sem BOM. ExtendScript adiciona BOM quando a encoding
    // e "UTF-8", e um BOM no inicio corrompe o valor que vai para o clipboard.
    function writeRaw(path, value) {
        var f = File(path);
        f.encoding = "BINARY";
        f.open("w");
        f.write(value);
        f.close();
        return f;
    }

    // --- Verifica se o PowerShell roda quando lancado pelo cmd ------------
    var psMarker = tempDir + "\\swatch_ps_marker.txt";
    try {
        var pf = File(psMarker);
        if (pf.exists) pf.remove();
        system.callSystem('cmd.exe /c powershell -NoProfile -Command "\'PSOK\' | Out-File -Encoding ascii \'' + psMarker + '\'"');
        $.sleep(1500);
        line("PowerShell executa via cmd: " + String(File(psMarker).exists));
    } catch (e) {
        line("PowerShell executa via cmd: EXCECAO " + e);
    }

    // --- clip.exe existe e responde? --------------------------------------
    try {
        var whereOut = system.callSystem('cmd.exe /c where clip');
        line("where clip: [" + String(whereOut).replace(/[\r\n]+/g, " ") + "]");
    } catch (e) {
        line("where clip: EXCECAO " + e);
    }

    // --- Metodos de copia -------------------------------------------------
    var methods = [
        {
            name: "A  cmd echo|clip",
            run: function (v) {
                system.callSystem('cmd.exe /c echo ' + v + '|clip');
            }
        },
        {
            name: "B  cmd echo|set /p (sem quebra de linha)",
            run: function (v) {
                system.callSystem('cmd.exe /c echo|set /p=' + v + '|clip');
            }
        },
        {
            name: "C  clip lendo arquivo (sem BOM)",
            run: function (v) {
                var t = writeRaw(tempDir + "\\swatch_clipsrc.txt", v);
                // Confirma que o arquivo intermediario existe mesmo e com o
                // tamanho esperado - se falhar aqui, o problema e a escrita,
                // nao o clipboard.
                line("   C: arquivo existe=" + String(t.exists) + " tamanho=" + String(t.length) + " (esperado " + v.length + ")");
                line("   C: caminho=[" + t.fsName + "]");
                system.callSystem('cmd.exe /c clip < "' + t.fsName + '"');
            }
        },
        {
            name: "E  clip lendo arquivo, caminho curto 8.3",
            run: function (v) {
                var t = writeRaw(tempDir + "\\swatchc.txt", v);
                // Sem espacos no caminho: descarta a hipotese de que as aspas
                // se percam entre o ExtendScript, o cmd e o clip.
                system.callSystem('cmd.exe /c clip < ' + t.fsName);
            }
        },
        {
            name: "D  powershell Set-Clipboard",
            run: function (v) {
                system.callSystem('powershell -NoProfile -STA -Command "Set-Clipboard -Value \'' + v + '\'"');
            }
        }
    ];

    // --- Para cada metodo: copia, pede Ctrl+V, compara --------------------
    for (var i = 0; i < methods.length; i++) {
        var probe = "TESTE-" + i + "-OK";
        var errored = null;

        try {
            methods[i].run(probe);
            $.sleep(700);
        } catch (e) {
            errored = String(e);
        }

        if (errored) {
            line("metodo " + methods[i].name + ": EXCECAO " + errored);
            continue;
        }

        var dlg = new Window("dialog", "Teste " + (i + 1) + " de " + methods.length);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.add("statictext", undefined, "Metodo: " + methods[i].name);
        dlg.add("statictext", undefined, "Clique na caixa abaixo e pressione Ctrl+V.");
        dlg.add("statictext", undefined, "Se nada aparecer, apenas clique em Continuar.");
        var field = dlg.add("edittext", undefined, "");
        field.preferredSize = [420, 24];
        var row = dlg.add("group");
        row.alignment = ["right", "top"];
        var next = row.add("button", undefined, "Continuar");
        next.onClick = function () { dlg.close(); };
        field.active = true;
        dlg.show();

        var pasted = String(field.text);
        var clean = pasted.replace(/^\s+|\s+$/g, "");
        var ok = (clean === probe);
        line("metodo " + methods[i].name + ": " + (ok ? "FUNCIONOU" : "falhou") +
            "  (colado: [" + pasted + "] / esperado: [" + probe + "])");
    }

    // --- Relatorio final --------------------------------------------------
    var text = report.join("\n");
    var w = new Window("dialog", "Swatch Colors - resultado");
    w.orientation = "column";
    w.alignChildren = ["fill", "top"];
    var box = w.add("edittext", undefined, text, { multiline: true, scrolling: true });
    box.preferredSize = [620, 220];
    var row2 = w.add("group");
    row2.alignment = ["right", "top"];
    var okBtn = row2.add("button", undefined, "Fechar");
    okBtn.onClick = function () { w.close(); };
    w.show();
})();
