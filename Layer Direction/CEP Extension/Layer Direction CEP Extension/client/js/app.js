(function () {
    "use strict";

    // polyfill first, in case this runs on an older bundled Chromium -
    // must exist before any .closest() call below.
    if (!Element.prototype.closest) {
        Element.prototype.closest = function (selector) {
            var el = this;
            while (el) {
                if (el.matches && el.matches(selector)) return el;
                el = el.parentElement;
            }
            return null;
        };
    }

    var csInterface = new CSInterface();

    // ------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------

    // evalScript only round-trips strings safely - JSON.stringify the
    // params, then JSON.stringify AGAIN so the result is a valid quoted
    // JS string literal we can safely splice into the ExtendScript call.
    function callHost(fnName, paramsObj) {
        return new Promise(function (resolve) {
            var argLiteral = paramsObj === undefined
                ? ""
                : JSON.stringify(JSON.stringify(paramsObj));
            var call = fnName + "(" + argLiteral + ")";
            csInterface.evalScript(call, function (result) {
                try {
                    resolve(JSON.parse(result));
                } catch (e) {
                    resolve({ ok: false, error: "Bad response from host: " + result });
                }
            });
        });
    }

    function setStatus(text, kind) {
        var el = document.getElementById("status");
        el.textContent = text || "";
        el.className = "status" + (kind ? " is-" + kind : "");
    }

    function num(id, def) {
        var v = parseFloat(document.getElementById(id).value);
        return isNaN(v) ? def : v;
    }

    // ------------------------------------------------------------
    // DIRECTION
    // ------------------------------------------------------------

    var currentDir = "center";
    var dirButtons = Array.prototype.slice.call(document.querySelectorAll(".dir-btn"));
    dirButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            currentDir = btn.getAttribute("data-dir");
            dirButtons.forEach(function (b) { b.classList.toggle("is-on", b === btn); });
        });
    });

    // ------------------------------------------------------------
    // ORDER
    // ------------------------------------------------------------

    var orderSelect = document.getElementById("orderSelect");
    var orderSeedInput = document.getElementById("orderSeed");
    orderSelect.addEventListener("change", function () {
        orderSeedInput.style.display = (orderSelect.value === "random") ? "" : "none";
    });

    // ------------------------------------------------------------
    // MODE (Grid / Radial / Circular)
    // ------------------------------------------------------------

    var currentMode = "grid";
    var modeButtons = Array.prototype.slice.call(document.querySelectorAll(".mode-btn"));
    var gridFields = document.querySelector(".grid-fields");
    var countField = document.querySelector(".count-field");
    var spacingFields = document.querySelector(".spacing-fields");
    var radiusField = document.querySelector(".radius-field");

    function refreshModeFields() {
        var isGrid = (currentMode === "grid");
        gridFields.style.display = isGrid ? "" : "none";
        countField.style.display = isGrid ? "none" : "";
        var auto = document.getElementById("autoGap").checked;
        spacingFields.style.display = (isGrid && !auto) ? "" : "none";
        radiusField.style.display = (!isGrid && !auto) ? "" : "none";
    }

    modeButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            currentMode = btn.getAttribute("data-mode");
            modeButtons.forEach(function (b) { b.classList.toggle("is-on", b === btn); });
            refreshModeFields();
        });
    });

    document.getElementById("autoGap").addEventListener("change", refreshModeFields);

    // ------------------------------------------------------------
    // ENABLE CLONE toggles the whole clone body
    // ------------------------------------------------------------

    var enableClone = document.getElementById("enableClone");
    var cloneBody = document.getElementById("cloneBody");
    var centerAnchorWrap = document.getElementById("centerAnchorWrap");
    var randomObjectsWrap = document.getElementById("randomObjectsWrap");
    var preserveMotionRow = document.getElementById("preserveMotion").closest(".checkbox");
    var rebuildBtn = document.getElementById("rebuildBtn");

    function refreshCloneEnabled() {
        var on = enableClone.checked;
        cloneBody.classList.toggle("is-disabled", !on);
        centerAnchorWrap.style.opacity = on ? "1" : ".45";
        centerAnchorWrap.style.pointerEvents = on ? "" : "none";
        randomObjectsWrap.style.opacity = on ? "1" : ".45";
        randomObjectsWrap.style.pointerEvents = on ? "" : "none";
        preserveMotionRow.style.opacity = on ? "1" : ".45";
        preserveMotionRow.style.pointerEvents = on ? "" : "none";
        rebuildBtn.disabled = !on;
    }
    enableClone.addEventListener("change", refreshCloneEnabled);
    refreshCloneEnabled();
    refreshModeFields();

    // ------------------------------------------------------------
    // RUN
    // ------------------------------------------------------------

    document.getElementById("runBtn").addEventListener("click", function () {
        var params = {
            clone: enableClone.checked,
            dir: currentDir,
            order: orderSelect.value,
            orderSeed: num("orderSeed", 1),
            stagger: num("stagger", 0),
            mode: currentMode,
            cols: Math.round(num("cols", 5)),
            rows: Math.round(num("rows", 5)),
            count: Math.round(num("count", 30)),
            radius: num("radius", 400),
            spacingX: num("spX", 200),
            spacingY: num("spY", 200),
            autoSpacing: document.getElementById("autoGap").checked,
            random: document.getElementById("randomObjects").checked,
            seed: 1,
            centerAnchor: document.getElementById("centerAnchor").checked,
            preserveMotion: document.getElementById("preserveMotion").checked
        };

        setStatus("Running\u2026");
        callHost("LD_run", params).then(function (res) {
            if (res.ok) {
                setStatus("Done.", "ok");
            } else {
                setStatus(res.error || "Something went wrong.", "error");
            }
        });
    });

    // ------------------------------------------------------------
    // REBUILD - preview first (own modal, not a native alert), then confirm
    // ------------------------------------------------------------

    var rebuildModal = document.getElementById("rebuildModal");
    var rebuildModalBody = document.getElementById("rebuildModalBody");

    function currentPanelState() {
        return {
            dir: currentDir,
            order: orderSelect.value,
            orderSeed: num("orderSeed", 1),
            preserveMotion: document.getElementById("preserveMotion").checked,
            centerAnchor: document.getElementById("centerAnchor").checked
        };
    }

    rebuildBtn.addEventListener("click", function () {
        setStatus("Checking selection\u2026");
        callHost("LD_rebuildPreview", currentPanelState()).then(function (res) {
            if (!res.ok) {
                setStatus(res.error || "Select the CTRL layer first.", "error");
                return;
            }
            setStatus("");
            rebuildModalBody.innerHTML =
                "<div>" + res.shape + "</div>" +
                "<div>Total clones: <b>" + res.total + "</b></div>" +
                "<div>Direction: <b>" + res.dirLabel + "</b> &middot; Order: <b>" + res.orderLabel + "</b></div>" +
                "<div>Preserve source animation: <b>" + (res.preserveMotion ? "On" : "Off") + "</b></div>" +
                "<div>Center Anchor Point: <b>" + (res.centerAnchor ? "On" : "Off") + "</b></div>";
            rebuildModal.classList.add("is-visible");
        });
    });

    document.getElementById("rebuildCancel").addEventListener("click", function () {
        rebuildModal.classList.remove("is-visible");
    });

    document.getElementById("rebuildConfirm").addEventListener("click", function () {
        rebuildModal.classList.remove("is-visible");
        setStatus("Rebuilding\u2026");
        callHost("LD_rebuildConfirmed", currentPanelState()).then(function (res) {
            if (res.ok) {
                setStatus("Rebuilt.", "ok");
            } else {
                setStatus(res.error || "Something went wrong.", "error");
            }
        });
    });
})();
