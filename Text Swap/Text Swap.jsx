/*
    Text Swap
    Version: 0.1.0
    Author: Eduardo Noe

    Descricao: a definir (aguardando video de referencia).

    v0.1.0 changelog:
    - Estrutura inicial do script.
*/

(function TextSwap(thisObj) {
    var SCRIPT_NAME = "Text Swap";
    var SCRIPT_VERSION = "0.1.0";

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME + " v" + SCRIPT_VERSION, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.add("statictext", undefined, SCRIPT_NAME + " v" + SCRIPT_VERSION + " — em construcao");

        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    var ui = buildUI(thisObj);
    if (ui instanceof Window) {
        ui.center();
        ui.show();
    } else {
        ui.layout.layout(true);
    }
})(this);
