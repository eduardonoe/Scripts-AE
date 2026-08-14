//@include "engine.jsx"

/*
    Bridge functions - the ONLY things the HTML/JS panel calls directly,
    via CSInterface's evalScript(). Each one:
      1. parses the JSON string sent from the panel,
      2. calls into the ported engine (engine.jsx, adapted from the
         ScriptUI script - identical logic, no UI code left in it),
      3. returns a JSON string back to JS (never a raw ExtendScript object -
         CEP's evalScript bridge only reliably round-trips strings).

    Keeping this file tiny and boring is deliberate: every real bug lives in
    engine.jsx, which is the same code (functionally) as the ScriptUI
    version already in production, so it inherits everything already fixed
    there (the reorder infinite-loop fix, the live expression system, etc).
*/

function LD_ping() {
    return JSON.stringify({ ok: true, version: "0.1.0" });
}

// params: { clone, dir, order, orderSeed, stagger, mode, cols, rows, count,
//           radius, spacingX, spacingY, autoSpacing, random, seed,
//           preserveMotion }
function LD_run(paramsJSON) {
    try {
        var opts = JSON.parse(paramsJSON);
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return JSON.stringify({ ok: false, error: "Open a composition first." });
        }
        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            return JSON.stringify({ ok: false, error: "Select at least one layer." });
        }

        doRun(opts);
        return JSON.stringify({ ok: true });
    } catch (e) {
        return JSON.stringify({ ok: false, error: e.toString() + " (line " + (e.line || "?") + ")" });
    }
}

// panelState: { dir, order, orderSeed, preserveMotion }
// Returns a preview (shape/total/labels) WITHOUT rebuilding, so the panel
// can show its own confirmation UI instead of relying on a native dialog.
function LD_rebuildPreview(panelStateJSON) {
    try {
        var panelState = JSON.parse(panelStateJSON);
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return JSON.stringify({ ok: false, error: "Open the clone precomp first." });
        }
        var sel = comp.selectedLayers;
        var ctrl = null;
        for (var i = 0; i < sel.length; i++) {
            if (sel[i].comment && sel[i].comment.indexOf("TS_CTRL") === 0) { ctrl = sel[i]; break; }
        }
        if (!ctrl) {
            return JSON.stringify({ ok: false, error: "Select the CTRL layer inside the clone precomp." });
        }

        var cfg = parseCfg(ctrl.comment);
        cfg.dir = panelState.dir;
        cfg.order = panelState.order;
        cfg.orderSeed = panelState.orderSeed;
        cfg.preserveMotion = panelState.preserveMotion;
        cfg.centerAnchor = panelState.centerAnchor;

        var vals = readCtrl(ctrl);
        var total = (cfg.mode === "grid") ? (vals.cols * vals.rows) : vals.count;
        if (total > MAX_CLONES) total = MAX_CLONES;

        var shape = (cfg.mode === "grid")
            ? ("Grid " + vals.cols + " x " + vals.rows)
            : ((cfg.mode === "radial" ? "Radial" : "Circular") + ", count " + vals.count);

        return JSON.stringify({
            ok: true,
            shape: shape,
            total: total,
            dirLabel: DIR_LABELS[cfg.dir] || cfg.dir,
            orderLabel: ORDER_LABELS[cfg.order] || cfg.order,
            preserveMotion: !!cfg.preserveMotion,
            centerAnchor: !!cfg.centerAnchor
        });
    } catch (e) {
        return JSON.stringify({ ok: false, error: e.toString() + " (line " + (e.line || "?") + ")" });
    }
}

// Actually performs the rebuild - call only after the panel's own
// confirmation UI (built from LD_rebuildPreview's response) says go.
function LD_rebuildConfirmed(panelStateJSON) {
    try {
        var panelState = JSON.parse(panelStateJSON);
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            return JSON.stringify({ ok: false, error: "Open the clone precomp first." });
        }
        var sel = comp.selectedLayers;
        var ctrl = null;
        for (var i = 0; i < sel.length; i++) {
            if (sel[i].comment && sel[i].comment.indexOf("TS_CTRL") === 0) { ctrl = sel[i]; break; }
        }
        if (!ctrl) {
            return JSON.stringify({ ok: false, error: "Select the CTRL layer inside the clone precomp." });
        }

        var cfg = parseCfg(ctrl.comment);
        cfg.dir = panelState.dir;
        cfg.order = panelState.order;
        cfg.orderSeed = panelState.orderSeed;
        cfg.preserveMotion = panelState.preserveMotion;
        cfg.centerAnchor = panelState.centerAnchor;

        app.beginUndoGroup("Rebuild Clones");
        try {
            buildClones(comp, ctrl, cfg);
        } finally {
            app.endUndoGroup();
        }
        return JSON.stringify({ ok: true });
    } catch (e) {
        return JSON.stringify({ ok: false, error: e.toString() + " (line " + (e.line || "?") + ")" });
    }
}

// Lets the panel know whether the current selection already IS a CTRL
// layer (so it can enable/disable its own Rebuild button live, instead of
// only failing after the click).
function LD_selectionIsCtrl() {
    try {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) return JSON.stringify({ isCtrl: false });
        var sel = comp.selectedLayers;
        for (var i = 0; i < sel.length; i++) {
            if (sel[i].comment && sel[i].comment.indexOf("TS_CTRL") === 0) {
                return JSON.stringify({ isCtrl: true, mode: parseCfg(sel[i].comment).mode });
            }
        }
        return JSON.stringify({ isCtrl: false });
    } catch (e) {
        return JSON.stringify({ isCtrl: false });
    }
}
