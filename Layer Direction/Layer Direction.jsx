/*
    Version: 1.0

    Layer Direction - Reorder, Stagger and Clone System   v16 - Random Objects + icon UI

    - Reorders only the SELECTED layers, inside the index range they already occupy
    - Direction grid (3x3) with vector-drawn arrows and a pressed state
    - Order selector: resolves ties inside each band (row / column / ring)
    - Clone: builds a precomp with the current comp specs, duration driven by the
      source layer plus the stagger ramp
    - Clones parented to a visible CTRL null, placed by expression
    - Sizing ("Auto gap 50px") uses ONLY the selected layer's own native
      sourceRectAtTime(), and only when that checkbox is actually on.
    - Sources carrying a Position/Scale/Rotation expression on the SELECTED
      layer itself: the clone reads the (untouched, still-disabled) source
      live via valueAtTime, sampled at the clone's OWN elapsed time
      (time - thisLayer.startTime). This gives two things at once: grid
      layout changes on CTRL update live (no Rebuild needed), and the
      stagger genuinely delays the motion, not just when the clone appears -
      startTime alone only delays real keyframes, never a plain expression,
      since "time" inside an expression always means actual comp time.
      An earlier version baked a one-time value via scripting instead, to
      dodge a hang that (as later confirmed) had a completely unrelated
      cause; that trade-off is no longer needed.
    - "Preserve source animation" checkbox in the script panel (on by
      default): turns the above off entirely for a plain grid/radial/circular
      layout with no reference to the source's own expressions, and also
      strips all effects from the clone in that case.
    - Opacity slider + Random/Range/Seed on CTRL, same pattern as Scale and
      Rotation, multiplied on top of whatever opacity the source had.
    - After building, the new precomp is reinserted into the original comp
      at the selection's old stacking position in ONE move, not a stepping
      while loop.
    - Layouts: Grid, Radial (single ring, defaults to 30), Circular (concentric hex rings)
    - Order has a fifth option, Random: ignores direction/bands entirely and
      shuffles the whole sequence, deterministic via its own Seed field
      (script panel, next to Order)
    - Direction, Order and Preserve source animation are read from the script
      panel, not from CTRL
*/
/*
    v16 changelog (on top of v15):
    - New "Center Anchor Point" checkbox (Clone panel, next to "Enable
      clone", on by default). Recenters each clone's anchor point to its
      own visual bounding box (measured via sourceRectAtTime) before laying
      it out, compensating Position so nothing jumps. Fixes grids built
      from off-center sources - e.g. left-aligned point text, whose anchor
      sits at the text's origin, not its visual middle - and makes Scale
      and Rotation pivot the same way for every clone regardless of what
      kind of layer it started as. Skips layers already centered, and can
      be turned off per-run when different objects genuinely need to keep
      their own distinct anchors.
    - Checkbox layout reorganized: Enable clone + Center Anchor Point share
      a row; Random Objects and Preserve source animation each get their
      own row (both have longer tooltips and read better with room to
      breathe). Dropped the "(Position/Scale/Rotation)" qualifier from the
      Preserve source animation label - redundant once it had its own line.
*/
/*
    v15 changelog (on top of v14):
    - Mode (Grid/Radial/Circular) is now three hand-drawn icon buttons
      instead of a dropdown, matching the visual language of the Direction
      grid: the Grid icon is a 3x3 dot grid, Radial is a ring of dots,
      Circular is a center dot with one ring around it.
    - Small color-coded swatches tie each section to an accent: blue for
      Direction (already existed), teal for Order, amber for Stagger,
      purple for Clone/Mode - all colors chosen to sit quietly against
      After Effects' own panel gray rather than fight it.
    - Native ScriptUI controls (checkboxes, dropdowns, text fields) still
      render with the OS's own chrome - ScriptUI does not allow recoloring
      them. Only hand-drawn elements (Direction, Mode, the swatches) carry
      custom color. A from-scratch CEP/HTML rebuild is the only way to
      restyle every control.
*/
/*
    v14 changelog:
    - The clone position-shuffle "Random" checkbox is renamed "Random Objects"
      (and its CTRL slider counterpart to "Random Objects" / "Random Objects
      Seed") to avoid confusion with the unrelated Order > Random option.
    - Its Seed field is removed from the script panel entirely - after the
      first RUN, the seed only lives in the CTRL layer's own Effect Controls,
      matching how Spacing/Radius/Scale/Rotation/Opacity already work.
    - Moved next to "Enable clone" with a tooltip clarifying it only has a
      visible effect when cloning multiple distinct layers together.
*/

(function (thisObj) {

    var MARK_SRC = "TS_SRC";
    var MARK_CLONE = "TS_CLONE";
    var AUTO_GAP = 50;
    var NO_STAGGER_PAD = 3;
    var MAX_CLONES = 500;

    var currentDir = "center";
    var currentOrder = "centerOut";
    var currentOrderSeed = 1;
    var currentPreserveMotion = true;
    var currentCenterAnchor = true;
    var currentCloneMode = "grid";
    var ORDER_LIST = ["centerOut", "edgesIn", "leftFirst", "rightFirst", "random"];
    var DIR_LABELS = {
        diagNW: "\u2196 SE to NW", up: "\u2191 bottom to top", diagNE: "\u2197 SW to NE",
        left: "\u2190 right to left", center: "\u2022 center to edges", right: "\u2192 left to right",
        diagSW: "\u2199 NE to SW", down: "\u2193 top to bottom", diagSE: "\u2198 NW to SE"
    };
    var ORDER_LABELS = {
        centerOut: "Center out", edgesIn: "Edges in",
        leftFirst: "Left first", rightFirst: "Right first", random: "Random"
    };

    // ============================================================
    //  GENERIC HELPERS
    // ============================================================

    function isRealLayer(l) {
        if (!l) return false;
        if (l.locked) return false;
        if (l instanceof CameraLayer || l instanceof LightLayer) return false;
        if (!l.property("Position")) return false;
        return true;
    }

    function hasExpression(prop) {
        if (!prop) return false;
        try {
            return (prop.expressionEnabled && prop.expression && prop.expression.length > 0);
        } catch (e) { return false; }
    }

    function median(values) {
        if (!values.length) return 0;
        var v = values.slice(0);
        v.sort(function (a, b) { return a - b; });
        var mid = Math.floor(v.length / 2);
        return (v.length % 2) ? v[mid] : (v[mid - 1] + v[mid]) / 2;
    }

    // ============================================================
    //  LAYOUT MATH  (mirrors the expression exactly)
    // ============================================================

    function ringCountFor(n) {
        if (n <= 1) return 0;
        return Math.ceil((-3 + Math.sqrt(9 + 12 * (n - 1))) / 6);
    }

    function shuffledSlots(n, seed) {
        var a = [];
        for (var k = 0; k < n; k++) a[k] = k;
        var s = Math.floor(seed) * 7919 + 104729;
        for (var k2 = n - 1; k2 > 0; k2--) {
            s = (s * 9301 + 49297) % 233280;
            if (s < 0) s = -s;
            var j = Math.floor(s / 233280 * (k2 + 1));
            if (j > k2) j = k2;
            var tmp = a[k2]; a[k2] = a[j]; a[j] = tmp;
        }
        return a;
    }

    // p = { cols, spx, spy, radius }
    function layoutOffset(mode, slot, n, p) {
        var ox = 0, oy = 0;

        if (mode === "grid") {
            var c = Math.max(1, Math.round(p.cols));
            var r = Math.ceil(n / c);
            var col = slot % c;
            var row = Math.floor(slot / c);
            ox = (col - (c - 1) / 2) * p.spx;
            oy = (row - (r - 1) / 2) * p.spy;

        } else if (mode === "radial") {
            var ang = slot / n * Math.PI * 2 - Math.PI / 2;
            ox = Math.cos(ang) * p.radius;
            oy = Math.sin(ang) * p.radius;

        } else {
            var ring = 0, start = 0, cap = 1;
            while (slot >= start + cap) { start = start + cap; ring = ring + 1; cap = 6 * ring; }
            var inRing = slot - start;
            var filled = Math.min(cap, n - start);
            if (filled < 1) filled = 1;
            var rings = ringCountFor(n);
            var step = (rings > 0) ? p.radius / rings : 0;
            var a2 = (ring === 0) ? 0 : (inRing / filled * Math.PI * 2 - Math.PI / 2);
            var rad = ring * step;
            ox = Math.cos(a2) * rad;
            oy = Math.sin(a2) * rad;
        }

        return [ox, oy];
    }

    // ============================================================
    //  ORDERING
    // ============================================================

    var SQ = Math.sqrt(2);

    function wrapAngle(a) {
        while (a < -Math.PI) a += Math.PI * 2;
        while (a >= Math.PI) a -= Math.PI * 2;
        return a;
    }

    // u = travel axis (defines the bands), v = perpendicular axis
    function axisPair(mode, x, y, cx, cy) {
        var dx = x - cx, dy = y - cy;
        switch (mode) {
            case "center":
                return [Math.sqrt(dx * dx + dy * dy), wrapAngle(Math.atan2(dy, dx) + Math.PI / 2)];
            case "up":     return [-y, x];
            case "down":   return [y, x];
            case "left":   return [-x, y];
            case "right":  return [x, y];
            case "diagNE": return [(x - y) / SQ, (x + y) / SQ];
            case "diagNW": return [(-x - y) / SQ, (-x + y) / SQ];
            case "diagSW": return [(-x + y) / SQ, (x + y) / SQ];
            case "diagSE": return [(x + y) / SQ, (x - y) / SQ];
        }
        return [0, 0];
    }

    function splitBands(items) {
        var sorted = items.slice(0);
        sorted.sort(function (a, b) { return a.u - b.u; });

        var gaps = [];
        for (var i = 1; i < sorted.length; i++) {
            var g = sorted[i].u - sorted[i - 1].u;
            if (g > 1e-6) gaps.push(g);
        }

        var tol = (gaps.length) ? median(gaps) * 0.5 : 0;
        if (tol < 1e-6) tol = 1e-6;

        var bands = [];
        var cur = [sorted[0]];
        for (var j = 1; j < sorted.length; j++) {
            if (sorted[j].u - sorted[j - 1].u > tol) {
                bands.push(cur);
                cur = [];
            }
            cur.push(sorted[j]);
        }
        bands.push(cur);
        return bands;
    }

    function symmetricSpread(band) {
        band.sort(function (a, b) { return a.v - b.v; });
        var m = band.length;
        var out = [];
        var mid = Math.floor((m - 1) / 2);
        out.push(band[mid]);
        var step = 1;
        while (out.length < m) {
            if (mid - step >= 0) out.push(band[mid - step]);
            if (out.length < m && mid + step < m) out.push(band[mid + step]);
            step++;
        }
        return out;
    }

    function applyOrder(band, order) {
        band.sort(function (a, b) { return a.v - b.v; });
        var m = band.length;
        var out = [];
        var i;

        if (order === "leftFirst") return band;

        if (order === "rightFirst") {
            for (i = m - 1; i >= 0; i--) out.push(band[i]);
            return out;
        }

        if (order === "edgesIn") {
            var lo = 0, hi = m - 1;
            while (lo <= hi) {
                out.push(band[lo]);
                if (hi !== lo) out.push(band[hi]);
                lo++; hi--;
            }
            return out;
        }

        return symmetricSpread(band);
    }

    // items: [{ layer, x, y }]
    function buildSequence(items, mode, order, cx, cy, seed) {
        if (!items.length) return [];

        if (order === "random") {
            // True random ignores direction/bands entirely - shuffles the
            // whole set. Deterministic given the same seed, like every other
            // random option in this script.
            var shuffled = shuffledSlots(items.length, seed || 1);
            var out = [];
            for (var si = 0; si < shuffled.length; si++) out.push(items[shuffled[si]].layer);
            return out;
        }

        var pts = [];
        for (var i = 0; i < items.length; i++) {
            var uv = axisPair(mode, items[i].x, items[i].y, cx, cy);
            pts.push({ layer: items[i].layer, u: uv[0], v: uv[1] });
        }

        var bands = splitBands(pts);
        var seq = [];
        var b, k, ordered;

        if (mode === "center") {
            // on the radial direction the bands ARE the rings,
            // so the Order selector drives the rings themselves
            var list = [];
            for (b = 0; b < bands.length; b++) list.push(bands[b]);
            if (order === "edgesIn") list.reverse();

            for (b = 0; b < list.length; b++) {
                var ring = list[b];
                if (order === "rightFirst") {
                    ring.sort(function (a, c) { return a.v - c.v; });
                    ordered = ring;
                } else if (order === "leftFirst") {
                    ring.sort(function (a, c) { return c.v - a.v; });
                    ordered = ring;
                } else {
                    ordered = symmetricSpread(ring);
                }
                for (k = 0; k < ordered.length; k++) seq.push(ordered[k].layer);
            }
            return seq;
        }

        for (b = 0; b < bands.length; b++) {
            ordered = applyOrder(bands[b], order);
            for (k = 0; k < ordered.length; k++) seq.push(ordered[k].layer);
        }
        return seq;
    }

    // ============================================================
    //  REORDER + STAGGER
    // ============================================================

    function applySequence(comp, seq, staggerFrames, baseTime) {
        if (seq.length === 0) return 0;

        var idxs = [];
        for (var k = 0; k < seq.length; k++) idxs.push(seq[k].index);
        idxs.sort(function (a, b) { return a - b; });

        var topSlot = idxs[0];
        var anchor = (topSlot > 1) ? comp.layer(topSlot - 1) : null;

        var stack = [];
        for (var m = seq.length - 1; m >= 0; m--) stack.push(seq[m]);

        for (var n = 0; n < stack.length; n++) {
            if (n === 0) {
                if (anchor) stack[n].moveAfter(anchor);
                else stack[n].moveToBeginning();
            } else {
                stack[n].moveAfter(stack[n - 1]);
            }
        }

        var st = staggerFrames * comp.frameDuration;
        for (var s = 0; s < seq.length; s++) {
            seq[s].startTime = baseTime + s * st;
        }
        return seq.length;
    }

    function reorderLooseLayers(comp, layers, mode, order, staggerFrames, baseTime, seed) {
        var cx = comp.width / 2;
        var cy = comp.height / 2;

        var items = [];
        for (var i = 0; i < layers.length; i++) {
            if (!isRealLayer(layers[i])) continue;
            var pos;
            try { pos = layers[i].property("Position").valueAtTime(0, false); }
            catch (e) { pos = [cx, cy]; }
            items.push({ layer: layers[i], x: pos[0], y: pos[1] });
        }

        var seq = buildSequence(items, mode, order, cx, cy, seed);
        return applySequence(comp, seq, staggerFrames, baseTime);
    }

    function earliestStart(layers) {
        var t = null;
        for (var i = 0; i < layers.length; i++) {
            var s = layers[i].startTime;
            if (t === null || s < t) t = s;
        }
        return (t === null) ? 0 : t;
    }

    // ============================================================
    //  SIZE MEASUREMENT
    // ============================================================

    // Measures a layer using only its own native, rendered bounds - never
    // reaches inside a precomp to read its internal layers' properties.
    // Doing that used to trigger AE to evaluate whatever expressions live
    // inside the nested comp via scripting (e.g. a Duik rig), which can be
    // slow enough to hang After Effects and has nothing to do with sizing
    // the clone anyway. sourceRectAtTime() on the layer itself is what AE
    // uses internally and is always safe and cheap.
    function measuredSize(layer) {
        var s = { w: 100, h: 100 };
        try {
            var r = layer.sourceRectAtTime(0, false);
            if (r.width > 0 && r.height > 0) s = { w: r.width, h: r.height };
        } catch (e) {}
        var sc = [100, 100];
        try { sc = layer.property("Scale").value; } catch (e2) {}
        return { w: s.w * Math.abs(sc[0]) / 100, h: s.h * Math.abs(sc[1]) / 100 };
    }

    function biggestSize(layers) {
        var w = 0, h = 0;
        for (var i = 0; i < layers.length; i++) {
            var s = measuredSize(layers[i]);
            if (s.w > w) w = s.w;
            if (s.h > h) h = s.h;
        }
        if (w <= 0) w = 100;
        if (h <= 0) h = 100;
        return { w: w, h: h };
    }

    function longestSpan(layers) {
        var d = 0;
        for (var i = 0; i < layers.length; i++) {
            var span = layers[i].outPoint - layers[i].inPoint;
            if (span > d) d = span;
        }
        if (d <= 0) d = 1;
        return d;
    }

    function cloneDuration(baseDur, total, staggerFrames, frameDuration) {
        var d = baseDur + Math.max(0, total - 1) * staggerFrames * frameDuration;
        if (staggerFrames <= 0) d += NO_STAGGER_PAD;
        return Math.max(frameDuration * 2, d);
    }

    // ============================================================
    //  EXPRESSIONS
    // ============================================================

    function totalExpr(mode) {
        if (mode === "grid") {
            return 'Math.max(1,Math.round(C.effect("Columns")("Slider")))*Math.max(1,Math.round(C.effect("Rows")("Slider")))';
        }
        return 'Math.max(1,Math.round(C.effect("Count")("Slider")))';
    }

    function slotHeader(mode, idx) {
        var e = '';
        e += 'var C = thisComp.layer("CTRL");\n';
        e += 'var n = ' + totalExpr(mode) + ';\n';
        e += 'var i = Math.min(' + idx + ', n - 1);\n';
        e += 'var slot = i;\n';
        e += 'if (C.effect("Random Objects")("Checkbox") > 0.5) {\n';
        e += '  var a = [];\n';
        e += '  for (var k = 0; k < n; k++) { a[k] = k; }\n';
        e += '  var s = Math.floor(C.effect("Random Objects Seed")("Slider")) * 7919 + 104729;\n';
        e += '  for (var k2 = n - 1; k2 > 0; k2--) {\n';
        e += '    s = (s * 9301 + 49297) % 233280;\n';
        e += '    if (s < 0) { s = -s; }\n';
        e += '    var j = Math.floor(s / 233280 * (k2 + 1));\n';
        e += '    if (j > k2) { j = k2; }\n';
        e += '    var tmp = a[k2]; a[k2] = a[j]; a[j] = tmp;\n';
        e += '  }\n';
        e += '  slot = a[i];\n';
        e += '}\n';
        return e;
    }

    function offsetBlock(mode) {
        var e = '';
        if (mode === "grid") {
            e += 'var c = Math.max(1, Math.round(C.effect("Columns")("Slider")));\n';
            e += 'var r = Math.ceil(n / c);\n';
            e += 'var col = slot % c;\n';
            e += 'var row = Math.floor(slot / c);\n';
            e += 'var ox = (col - (c - 1) / 2) * C.effect("Spacing X")("Slider");\n';
            e += 'var oy = (row - (r - 1) / 2) * C.effect("Spacing Y")("Slider");\n';

        } else if (mode === "radial") {
            e += 'var R = C.effect("Radius")("Slider");\n';
            e += 'var ang = slot / n * Math.PI * 2 - Math.PI / 2;\n';
            e += 'var ox = Math.cos(ang) * R;\n';
            e += 'var oy = Math.sin(ang) * R;\n';

        } else {
            e += 'var R = C.effect("Radius")("Slider");\n';
            e += 'var ring = 0, start = 0, cap = 1;\n';
            e += 'while (slot >= start + cap) { start = start + cap; ring = ring + 1; cap = 6 * ring; }\n';
            e += 'var inRing = slot - start;\n';
            e += 'var filled = Math.min(cap, n - start);\n';
            e += 'if (filled < 1) { filled = 1; }\n';
            e += 'var rings = 0;\n';
            e += 'if (n > 1) { rings = Math.ceil((-3 + Math.sqrt(9 + 12 * (n - 1))) / 6); }\n';
            e += 'var step = (rings > 0) ? R / rings : 0;\n';
            e += 'var ang = (ring === 0) ? 0 : (inRing / filled * Math.PI * 2 - Math.PI / 2);\n';
            e += 'var rad = ring * step;\n';
            e += 'var ox = Math.cos(ang) * rad;\n';
            e += 'var oy = Math.sin(ang) * rad;\n';
        }
        return e;
    }

    // used when the clone itself carries the layout (source has no Position
    // expression of its own, just plain values/keyframes)
    function positionExpr(mode, idx) {
        var e = slotHeader(mode, idx) + offsetBlock(mode);
        // component-wise subtraction: valid in the JavaScript and Legacy engines
        e += 'var v0 = valueAtTime(0);\n';
        e += 'var px = ox + (value[0] - v0[0]);\n';
        e += 'var py = oy + (value[1] - v0[1]);\n';
        e += 'if (value.length > 2) { [px, py, value[2] - v0[2]] } else { [px, py] }';
        return e;
    }

    // used when the source has its own Position expression (Duik, wiggle,
    // spring...). Reads the SOURCE layer live via valueAtTime, sampled at
    // this clone's own elapsed time (time - thisLayer.startTime), so the
    // stagger delays the motion itself, not just when the clone appears -
    // startTime alone only delays real keyframes, never a plain expression,
    // since "time" inside an expression always means actual comp time.
    // The source's own expression text is never touched or copied - this
    // clone's Position expression fully replaces its own copy, referencing
    // the untouched, still-disabled source instead. Grid offset (ox, oy) is
    // read live from CTRL every frame, so slider changes update instantly,
    // matching the non-expression clones.
    function livePositionExpr(mode, idx, sourceName) {
        var e = slotHeader(mode, idx) + offsetBlock(mode);
        e += 'var S = thisComp.layer(' + JSON.stringify(sourceName) + ');\n';
        e += 'var v0 = S.position.valueAtTime(0);\n';
        e += 'var vt = S.position.valueAtTime(time - thisLayer.startTime);\n';
        e += 'var px = ox + (vt[0] - v0[0]);\n';
        e += 'var py = oy + (vt[1] - v0[1]);\n';
        e += 'if (vt.length > 2) { [px, py, vt[2] - v0[2]] } else { [px, py] }';
        return e;
    }

    // idx is the fixed creation-order slot (0..total-1), not the layer's
    // timeline index, which changes every time the direction/order reshuffles
    // the stacking order. Using timeline index would reshuffle every clone's
    // random scale/rotation on every RUN or Rebuild for no reason.
    function scaleExpr(idx) {
        var e = '';
        e += 'var C = thisComp.layer("CTRL");\n';
        e += 'var base = C.effect("Scale")("Slider") / 100;\n';
        e += 'var f = base;\n';
        e += 'if (C.effect("Random Scale")("Checkbox") > 0.5) {\n';
        e += '  var rng = C.effect("Scale Range")("Slider") / 100;\n';
        e += '  var s = Math.floor(C.effect("Scale Seed")("Slider")) * 12007 + ' + idx + ' * 7919 + 104729;\n';
        e += '  s = (s * 9301 + 49297) % 233280; if (s < 0) { s = -s; }\n';
        e += '  var t = (s % 10000) / 10000;\n';
        e += '  f = base * (1 - rng + t * rng * 2);\n';
        e += '}\n';
        e += 'value * f';
        return e;
    }

    // same idea as livePositionExpr, for Scale (combines multiplicatively).
    function liveScaleExpr(idx, sourceName) {
        var e = '';
        e += 'var C = thisComp.layer("CTRL");\n';
        e += 'var S = thisComp.layer(' + JSON.stringify(sourceName) + ');\n';
        e += 'var base = C.effect("Scale")("Slider") / 100;\n';
        e += 'var f = base;\n';
        e += 'if (C.effect("Random Scale")("Checkbox") > 0.5) {\n';
        e += '  var rng = C.effect("Scale Range")("Slider") / 100;\n';
        e += '  var s = Math.floor(C.effect("Scale Seed")("Slider")) * 12007 + ' + idx + ' * 7919 + 104729;\n';
        e += '  s = (s * 9301 + 49297) % 233280; if (s < 0) { s = -s; }\n';
        e += '  var t = (s % 10000) / 10000;\n';
        e += '  f = base * (1 - rng + t * rng * 2);\n';
        e += '}\n';
        e += 'S.scale.valueAtTime(time - thisLayer.startTime) * f';
        return e;
    }

    function rotationExpr(idx) {
        var e = '';
        e += 'var C = thisComp.layer("CTRL");\n';
        e += 'var add = C.effect("Rotation")("Slider");\n';
        e += 'if (C.effect("Random Rotation")("Checkbox") > 0.5) {\n';
        e += '  var rng = C.effect("Rotation Range")("Slider");\n';
        e += '  var s = Math.floor(C.effect("Rotation Seed")("Slider")) * 20011 + ' + idx + ' * 6151 + 104729;\n';
        e += '  s = (s * 9301 + 49297) % 233280; if (s < 0) { s = -s; }\n';
        e += '  var t = (s % 10000) / 10000;\n';
        e += '  add = add + (-rng + t * rng * 2);\n';
        e += '}\n';
        e += 'value + add';
        return e;
    }

    // same idea, for Rotation (combines additively).
    function liveRotationExpr(idx, sourceName) {
        var e = '';
        e += 'var C = thisComp.layer("CTRL");\n';
        e += 'var S = thisComp.layer(' + JSON.stringify(sourceName) + ');\n';
        e += 'var add = C.effect("Rotation")("Slider");\n';
        e += 'if (C.effect("Random Rotation")("Checkbox") > 0.5) {\n';
        e += '  var rng = C.effect("Rotation Range")("Slider");\n';
        e += '  var s = Math.floor(C.effect("Rotation Seed")("Slider")) * 20011 + ' + idx + ' * 6151 + 104729;\n';
        e += '  s = (s * 9301 + 49297) % 233280; if (s < 0) { s = -s; }\n';
        e += '  var t = (s % 10000) / 10000;\n';
        e += '  add = add + (-rng + t * rng * 2);\n';
        e += '}\n';
        e += 'S.rotation.valueAtTime(time - thisLayer.startTime) + add';
        return e;
    }

    // Opacity slider + Random, same pattern as Scale/Rotation, multiplied on
    // top of "value" (so it still respects any opacity the source itself
    // had). Keeps the "hide clones beyond n" trick used for live count
    // changes without needing Rebuild.
    function opacityExpr(mode, idx) {
        var e = '';
        e += 'var C = thisComp.layer("CTRL");\n';
        e += 'var n = ' + totalExpr(mode) + ';\n';
        e += 'var base = C.effect("Opacity")("Slider");\n';
        e += 'var f = base;\n';
        e += 'if (C.effect("Random Opacity")("Checkbox") > 0.5) {\n';
        e += '  var rng = C.effect("Opacity Range")("Slider");\n';
        e += '  var s = Math.floor(C.effect("Opacity Seed")("Slider")) * 15013 + ' + idx + ' * 5081 + 104729;\n';
        e += '  s = (s * 9301 + 49297) % 233280; if (s < 0) { s = -s; }\n';
        e += '  var t = (s % 10000) / 10000;\n';
        e += '  f = base + (-rng + t * rng * 2);\n';
        e += '  f = Math.max(0, Math.min(100, f));\n';
        e += '}\n';
        e += 'var result = value * (f / 100);\n';
        e += 'if (' + idx + ' < n) { result } else { 0 }';
        return e;
    }

    // ============================================================
    //  CTRL LAYER
    // ============================================================

    function addSlider(ctrl, name, val) {
        var fx = ctrl.property("Effects").addProperty("ADBE Slider Control");
        fx.name = name;
        fx.property("Slider").setValue(val);
        return fx;
    }

    function addCheckbox(ctrl, name, val) {
        var fx = ctrl.property("Effects").addProperty("ADBE Checkbox Control");
        fx.name = name;
        fx.property("Checkbox").setValue(val ? 1 : 0);
        return fx;
    }

    // Recenters a layer's Anchor Point to the middle of its own visual
    // bounding box (sourceRectAtTime), compensating Position so nothing
    // visibly moves. Skips layers that are already centered (within half a
    // pixel), so it's a no-op for shapes that were already fine. This is
    // what fixes grids built from off-center sources (e.g. left-aligned
    // point text, whose anchor sits at the text origin rather than its
    // visual middle) and makes Scale/Rotation pivot the same way for every
    // clone regardless of what kind of layer it started as.
    function centerAnchorPoint(L) {
        try {
            var r = L.sourceRectAtTime(0, false);
            if (!(r.width > 0 && r.height > 0)) return;
            var cx = r.left + r.width / 2;
            var cy = r.top + r.height / 2;
            var apProp = L.property("Anchor Point");
            var posProp = L.property("Position");
            var oldA = apProp.value;
            // pre-expression / raw, so this never triggers a possibly-heavy
            // inherited expression (e.g. a Duik rig) just to read a baseline
            var oldP = posProp.valueAtTime(0, true);
            if (Math.abs(oldA[0] - cx) < 0.5 && Math.abs(oldA[1] - cy) < 0.5) return;
            var dx = cx - oldA[0];
            var dy = cy - oldA[1];
            var newA = (oldA.length > 2) ? [cx, cy, oldA[2]] : [cx, cy];
            var newP = (oldP.length > 2) ? [oldP[0] + dx, oldP[1] + dy, oldP[2]] : [oldP[0] + dx, oldP[1] + dy];
            apProp.setValue(newA);
            posProp.setValue(newP);
        } catch (e) {}
    }

    function readCtrl(ctrl) {
        function num(n, d) {
            try { return ctrl.effect(n)("Slider").value; } catch (e) { return d; }
        }
        function chk(n, d) {
            try { return ctrl.effect(n)("Checkbox").value; } catch (e) { return d; }
        }
        return {
            cols: Math.max(1, Math.round(num("Columns", 5))),
            rows: Math.max(1, Math.round(num("Rows", 5))),
            count: Math.max(1, Math.round(num("Count", 30))),
            spx: num("Spacing X", 200),
            spy: num("Spacing Y", 200),
            radius: num("Radius", 400),
            random: (chk("Random Objects", 0) > 0.5),
            seed: num("Random Objects Seed", 1)
        };
    }

    function parseCfg(str) {
        var o = { mode: "grid", dir: "center", order: "centerOut", orderSeed: 1, stagger: 1, dur: 0, preserveMotion: true, centerAnchor: true };
        if (!str) return o;
        var parts = str.split("|");
        for (var i = 0; i < parts.length; i++) {
            var kv = parts[i].split("=");
            if (kv.length !== 2) continue;
            if (kv[0] === "mode") o.mode = kv[1];
            if (kv[0] === "dir") o.dir = kv[1];
            if (kv[0] === "order") o.order = kv[1];
            if (kv[0] === "orderSeed") o.orderSeed = parseFloat(kv[1]) || 1;
            if (kv[0] === "stagger") o.stagger = parseFloat(kv[1]) || 0;
            if (kv[0] === "dur") o.dur = parseFloat(kv[1]) || 0;
            if (kv[0] === "preserveMotion") o.preserveMotion = (kv[1] === "1");
            if (kv[0] === "centerAnchor") o.centerAnchor = (kv[1] === "1");
        }
        return o;
    }

    function writeCfg(o) {
        return "TS_CTRL|mode=" + o.mode +
               "|dir=" + o.dir +
               "|order=" + o.order +
               "|orderSeed=" + o.orderSeed +
               "|stagger=" + o.stagger +
               "|dur=" + o.dur +
               "|preserveMotion=" + (o.preserveMotion ? "1" : "0") +
               "|centerAnchor=" + (o.centerAnchor ? "1" : "0");
    }

    // ============================================================
    //  CLONE BUILD
    // ============================================================

    function buildClones(precomp, ctrl, cfg) {
        // clear previous clones
        for (var i = precomp.numLayers; i >= 1; i--) {
            if (precomp.layer(i).comment === MARK_CLONE) precomp.layer(i).remove();
        }

        var sources = [];
        for (var j = 1; j <= precomp.numLayers; j++) {
            if (precomp.layer(j).comment === MARK_SRC) sources.push(precomp.layer(j));
        }
        if (sources.length === 0) {
            alert("No source layer found in this precomp.");
            return 0;
        }

        var vals = readCtrl(ctrl);
        var total = (cfg.mode === "grid") ? (vals.cols * vals.rows) : vals.count;
        if (total > MAX_CLONES) total = MAX_CLONES;

        var baseDur = cfg.dur;
        if (!baseDur || baseDur <= 0) baseDur = longestSpan(sources);
        var newDur = cloneDuration(baseDur, total, cfg.stagger, precomp.frameDuration);
        try { precomp.duration = newDur; } catch (e4) {}
        try { ctrl.outPoint = precomp.duration; } catch (e4b) {}

        var slotMap = vals.random ? shuffledSlots(total, vals.seed) : null;
        var params = { cols: vals.cols, spx: vals.spx, spy: vals.spy, radius: vals.radius };

        var clones = [];
        var items = [];
        var preserveMotion = (cfg.preserveMotion !== false);
        var centerAnchor = (cfg.centerAnchor !== false);

        for (var k = 0; k < total; k++) {
            var src = sources[k % sources.length];
            var srcPos = src.property("Position");
            var srcScaleProp = src.property("Scale");
            var srcRotProp = src.property("Rotation");

            var L = src.duplicate();
            if (centerAnchor) centerAnchorPoint(L);

            if (!preserveMotion) {
                try {
                    var effGroup = L.property("Effects");
                    if (effGroup) {
                        for (var ei = effGroup.numProperties; ei >= 1; ei--) {
                            try { effGroup.property(ei).remove(); } catch (eRemEff) {}
                        }
                    }
                } catch (eEffGroup) {}
                try { L.property("Position").expression = ""; } catch (eCP) {}
                try { L.property("Scale").expression = ""; } catch (eCS) {}
                try { L.property("Rotation").expression = ""; } catch (eCR) {}
            }

            L.enabled = true;
            L.comment = MARK_CLONE;
            L.name = src.name.replace(/^\s+|\s+$/g, "") + " " + (k + 1);
            L.startTime = 0;
            L.parent = ctrl;

            var realSlot = slotMap ? slotMap[k] : k;
            var off = layoutOffset(cfg.mode, realSlot, total, params);

            // POSITION
            if (preserveMotion && hasExpression(srcPos)) {
                // Source's own Position expression stays fully untouched on
                // the (disabled) source layer. The clone reads it live via
                // valueAtTime, sampled at its own elapsed time, so slider
                // changes update instantly AND the stagger delays the
                // motion, not just the clone's appearance.
                L.property("Position").expression = livePositionExpr(cfg.mode, k, src.name);
            } else {
                try { L.property("Position").expression = ""; } catch (eClr) {}
                L.property("Position").expression = positionExpr(cfg.mode, k);
            }

            if (!hasExpression(L.property("Opacity"))) {
                try { L.property("Opacity").expression = opacityExpr(cfg.mode, k); } catch (e2) {}
            }

            // SCALE
            try {
                if (preserveMotion && hasExpression(srcScaleProp)) {
                    L.property("Scale").expression = liveScaleExpr(k, src.name);
                } else {
                    try { L.property("Scale").expression = ""; } catch (eClr2) {}
                    L.property("Scale").expression = scaleExpr(k);
                }
            } catch (e6) {}

            // ROTATION
            try {
                if (preserveMotion && hasExpression(srcRotProp)) {
                    L.property("Rotation").expression = liveRotationExpr(k, src.name);
                } else {
                    try { L.property("Rotation").expression = ""; } catch (eClr3) {}
                    L.property("Rotation").expression = rotationExpr(k);
                }
            } catch (e7) {}

            items.push({ layer: L, x: off[0], y: off[1] });
            clones.push(L);
        }

        ctrl.moveToBeginning();
        for (var s = 0; s < sources.length; s++) {
            sources[s].parent = null;
            sources[s].moveToEnd();
        }

        // layout offsets are centred on [0, 0]
        var seq = buildSequence(items, cfg.dir, cfg.order, 0, 0, cfg.orderSeed);
        applySequence(precomp, seq, cfg.stagger, 0);

        return total;
    }

    function runClone(comp, sel, opts) {
        var layers = [];
        for (var i = 0; i < sel.length; i++) if (isRealLayer(sel[i])) layers.push(sel[i]);
        if (layers.length === 0) {
            alert("Select at least one valid layer.");
            return;
        }

        layers.sort(function (a, b) { return a.index - b.index; });
        var topIndex = layers[0].index;
        var firstName = layers[0].name;

        // Only measure the source when the result will actually be used.
        // sourceRectAtTime() forces AE to evaluate the layer's own transform
        // expression to get rendered bounds - with a source like a Duik
        // Kleaner rig (which can search backward through time looking for
        // when the layer last moved), that single call can hang before a
        // single clone is even created. Skipping it whenever "Auto gap" is
        // off removes that risk entirely for anyone typing spacing by hand.
        var size = opts.autoSpacing ? biggestSize(layers) : { w: 100, h: 100 };
        var baseDur = longestSpan(layers);

        var total = (opts.mode === "grid") ? (opts.cols * opts.rows) : opts.count;
        if (total > MAX_CLONES) total = MAX_CLONES;
        var dur = cloneDuration(baseDur, total, opts.stagger, comp.frameDuration);

        var precompItem = app.project.items.addComp(
            "Clones " + firstName,
            comp.width, comp.height, comp.pixelAspect,
            dur, comp.frameRate
        );
        try { precompItem.bgColor = comp.bgColor; } catch (e) {}

        for (var b = layers.length - 1; b >= 0; b--) layers[b].copyToComp(precompItem);
        for (var r = 0; r < layers.length; r++) layers[r].remove();

        for (var m = 1; m <= precompItem.numLayers; m++) {
            var L = precompItem.layer(m);
            L.comment = MARK_SRC;
            L.enabled = false;
            L.parent = null;
            L.startTime = 0;
        }

        var ctrl = precompItem.layers.addNull();
        ctrl.name = "CTRL";
        ctrl.label = 9;
        ctrl.enabled = true;
        ctrl.startTime = 0;
        try {
            var pv = ctrl.property("Position").value;
            ctrl.property("Anchor Point").setValue((pv.length > 2) ? [0, 0, 0] : [0, 0]);
            ctrl.property("Position").setValue(
                (pv.length > 2)
                    ? [precompItem.width / 2, precompItem.height / 2, pv[2]]
                    : [precompItem.width / 2, precompItem.height / 2]
            );
        } catch (e2) {}

        var sp = opts.autoSpacing
            ? { sx: size.w + AUTO_GAP, sy: size.h + AUTO_GAP }
            : { sx: opts.spacingX, sy: opts.spacingY };

        var radius;
        if (opts.autoSpacing) {
            var unit = Math.max(size.w, size.h) + AUTO_GAP;
            if (opts.mode === "radial") {
                radius = Math.max(unit, total * unit / (2 * Math.PI));
            } else {
                radius = Math.max(unit, ringCountFor(total) * unit);
            }
            radius = Math.round(radius);
        } else {
            radius = opts.radius;
        }

        addSlider(ctrl, "Columns", opts.cols);
        addSlider(ctrl, "Rows", opts.rows);
        addSlider(ctrl, "Count", opts.count);
        addSlider(ctrl, "Spacing X", Math.round(sp.sx));
        addSlider(ctrl, "Spacing Y", Math.round(sp.sy));
        addSlider(ctrl, "Radius", radius);
        addCheckbox(ctrl, "Random Objects", opts.random);
        addSlider(ctrl, "Random Objects Seed", opts.seed);
        addSlider(ctrl, "Scale", 100);
        addCheckbox(ctrl, "Random Scale", false);
        addSlider(ctrl, "Scale Range", 30);
        addSlider(ctrl, "Scale Seed", 1);
        addSlider(ctrl, "Rotation", 0);
        addCheckbox(ctrl, "Random Rotation", false);
        addSlider(ctrl, "Rotation Range", 15);
        addSlider(ctrl, "Rotation Seed", 1);
        addSlider(ctrl, "Opacity", 100);
        addCheckbox(ctrl, "Random Opacity", false);
        addSlider(ctrl, "Opacity Range", 30);
        addSlider(ctrl, "Opacity Seed", 1);

        var cfg = {
            mode: opts.mode,
            dir: opts.dir,
            order: opts.order,
            orderSeed: opts.orderSeed || 1,
            stagger: opts.stagger,
            dur: baseDur,
            preserveMotion: (opts.preserveMotion !== false),
            centerAnchor: (opts.centerAnchor !== false)
        };
        ctrl.comment = writeCfg(cfg);

        buildClones(precompItem, ctrl, cfg);

        var pl = comp.layers.add(precompItem);
        // pl lands at index 1 (top). Move it to sit where the original
        // selection used to be, in ONE step - no stepping loop. The old
        // version used moveAfter/moveBefore in a while loop whose condition
        // could stay true forever in some layer arrangements (moving pl next
        // to a layer that was already adjacent to it doesn't change its
        // index), causing a genuine infinite loop with no error to catch.
        if (topIndex > 1) {
            var anchorIdx = Math.min(topIndex, comp.numLayers);
            if (anchorIdx >= 1 && anchorIdx !== pl.index) {
                try { pl.moveAfter(comp.layer(anchorIdx)); } catch (eMv) {}
            }
        }

        precompItem.openInViewer();
    }

    // ============================================================
    //  ACTIONS
    // ============================================================

    function doRun(opts) {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Open a composition before running the script.");
            return;
        }
        var sel = comp.selectedLayers;
        if (!sel || sel.length === 0) {
            alert("Select at least one layer.");
            return;
        }

        app.beginUndoGroup(opts.clone ? "Clone + Direction" : "Direction Reorder + Stagger");
        try {
            if (opts.clone) {
                runClone(comp, sel, opts);
            } else {
                var layers = [];
                for (var i = 0; i < sel.length; i++) if (isRealLayer(sel[i])) layers.push(sel[i]);
                if (layers.length === 0) {
                    alert("No eligible layer (locked, camera or light).");
                } else {
                    reorderLooseLayers(comp, layers, opts.dir, opts.order, opts.stagger, earliestStart(layers), opts.orderSeed);
                }
            }
        } catch (e) {
            alert("Error: " + e.toString() + "\nLine: " + (e.line || "?"));
        } finally {
            app.endUndoGroup();
        }
    }

    function doRebuild() {
        var comp = app.project.activeItem;
        if (!(comp && comp instanceof CompItem)) {
            alert("Open the clone precomp first.");
            return;
        }
        var sel = comp.selectedLayers;
        var ctrl = null;
        for (var i = 0; i < sel.length; i++) {
            if (sel[i].comment && sel[i].comment.indexOf("TS_CTRL") === 0) { ctrl = sel[i]; break; }
        }
        if (!ctrl) {
            alert("Select the CTRL layer inside the clone precomp.");
            return;
        }

        var cfg = parseCfg(ctrl.comment);
        // Direction, Order and its Seed come from the script panel
        // (currentDir/currentOrder/currentOrderSeed), not from CTRL.
        cfg.dir = currentDir;
        cfg.order = currentOrder;
        cfg.orderSeed = currentOrderSeed;

        var vals = readCtrl(ctrl);
        var total = (cfg.mode === "grid") ? (vals.cols * vals.rows) : vals.count;
        if (total > MAX_CLONES) total = MAX_CLONES;

        // Preserve-motion and center-anchor also come from the panel, like
        // Direction/Order, so the user can flip them and Rebuild to recover
        // immediately if needed, without needing the original layers (which
        // are already inside this precomp).
        cfg.preserveMotion = currentPreserveMotion;
        cfg.centerAnchor = currentCenterAnchor;

        var shape = (cfg.mode === "grid")
            ? ("Grid " + vals.cols + " x " + vals.rows)
            : ((cfg.mode === "radial" ? "Radial" : "Circular") + ", count " + vals.count);

        var dirLabel = DIR_LABELS[cfg.dir] || cfg.dir;
        var orderLabel = ORDER_LABELS[cfg.order] || cfg.order;
        if (cfg.order === "random") orderLabel += " (seed " + cfg.orderSeed + ")";

        var msg = "Rebuild this clone precomp?\n\n" +
                  shape + "\n" +
                  "Total clones: " + total + "\n" +
                  "Direction: " + dirLabel + "   Order: " + orderLabel + "\n" +
                  "Preserve source animation: " + (cfg.preserveMotion ? "On" : "Off") + "\n" +
                  "Center Anchor Point: " + (cfg.centerAnchor ? "On" : "Off") + "\n\n" +
                  "Columns/Rows/Count/Spacing/Radius/Random/Scale/Rotation come\n" +
                  "from the Effect Controls of CTRL. Direction, Order,\n" +
                  "Preserve source animation and Center Anchor Point come\n" +
                  "from this script panel.";

        if (!confirm(msg)) return;

        app.beginUndoGroup("Rebuild Clones");
        try {
            buildClones(comp, ctrl, cfg);
        } catch (e) {
            alert("Error: " + e.toString() + "\nLine: " + (e.line || "?"));
        } finally {
            app.endUndoGroup();
        }
    }

    // ============================================================
    //  UI
    // ============================================================

    var VEC = {
        up:     [0, 1, 0, -1],
        down:   [0, -1, 0, 1],
        left:   [1, 0, -1, 0],
        right:  [-1, 0, 1, 0],
        diagNW: [1, 1, -1, -1],
        diagNE: [-1, 1, 1, -1],
        diagSW: [1, -1, -1, 1],
        diagSE: [-1, -1, 1, 1]
    };

    // ------------------------------------------------------------
    // COLOR PALETTE
    // Base grays match After Effects' own panel chrome, so the script
    // never looks like a foreign object sitting inside the UI. Each
    // section gets one accent used only where ScriptUI actually allows
    // custom color (icon buttons, decorative swatches) - native checkboxes,
    // dropdowns and text fields keep the OS-drawn look regardless.
    // ------------------------------------------------------------
    var COL = {
        blue:   [0.16, 0.48, 0.82, 1],   // Direction
        teal:   [0.16, 0.62, 0.58, 1],   // Order
        amber:  [0.82, 0.60, 0.20, 1],   // Stagger
        purple: [0.56, 0.40, 0.86, 1],   // Clone / Mode
        ink:    [0.78, 0.78, 0.78, 1],
        inkOn:  [1, 1, 1, 1]
    };

    // small decorative color swatch placed before a checkbox/label to tie
    // it visually to its section's accent - purely cosmetic, not clickable
    function swatch(parent, color, size) {
        size = size || 10;
        var s = parent.add("group");
        s.preferredSize = [size, size];
        s.margins = 0;
        s.graphics.backgroundColor = s.graphics.newBrush(s.graphics.BrushType.SOLID_COLOR, color);
        return s;
    }

    // ------------------------------------------------------------
    // MODE ICON BUTTONS (Grid / Radial / Circular) - drawn to literally
    // resemble the layout they produce, same spirit as Direction's arrows.
    // ------------------------------------------------------------
    var MODE_IDS = ["grid", "radial", "circular"];
    var MODE_LABELS = { grid: "Grid", radial: "Radial", circular: "Circular" };

    function drawModeIcon(g, id, cx, cy, on) {
        var col = on ? COL.inkOn : COL.ink;
        var pen = g.newPen(g.PenType.SOLID_COLOR, col, 1);
        var brush = g.newBrush(g.BrushType.SOLID_COLOR, col);

        if (id === "grid") {
            var s = 5.4, gap = 2.4, r = 1.3;
            for (var gy = -1; gy <= 1; gy++) {
                for (var gx = -1; gx <= 1; gx++) {
                    var x = cx + gx * (s + gap) - s / 2;
                    var y = cy + gy * (s + gap) - s / 2;
                    g.newPath();
                    g.rectPath(x, y, s, s);
                    g.fillPath(brush);
                }
            }
        } else if (id === "radial") {
            var rad = 9, dotR = 1.6;
            for (var i = 0; i < 8; i++) {
                var ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
                var dx = cx + Math.cos(ang) * rad;
                var dy = cy + Math.sin(ang) * rad;
                g.newPath();
                g.ellipsePath(dx - dotR, dy - dotR, dotR * 2, dotR * 2);
                g.fillPath(brush);
            }
        } else { // circular: center dot + one ring, honeycomb feel
            var dotR2 = 1.5;
            g.newPath();
            g.ellipsePath(cx - dotR2, cy - dotR2, dotR2 * 2, dotR2 * 2);
            g.fillPath(brush);
            var ringR = 7;
            for (var j = 0; j < 6; j++) {
                var a2 = (j / 6) * Math.PI * 2 - Math.PI / 2;
                var rx = cx + Math.cos(a2) * ringR;
                var ry = cy + Math.sin(a2) * ringR;
                g.newPath();
                g.ellipsePath(rx - dotR2, ry - dotR2, dotR2 * 2, dotR2 * 2);
                g.fillPath(brush);
            }
        }
    }

    function buildUI(thisObj) {
        var pal = (thisObj instanceof Panel) ?
            thisObj :
            new Window("palette", "Layer Direction", undefined, { resizeable: true });

        pal.orientation = "column";
        pal.alignChildren = ["fill", "top"];
        pal.spacing = 5;
        pal.margins = 7;

        // ---------- direction ----------
        var dirPanel = pal.add("panel", undefined, "Direction");
        dirPanel.orientation = "column";
        dirPanel.alignChildren = ["fill", "top"];
        dirPanel.spacing = 2;
        dirPanel.margins = 8;

        var dirButtons = [];

        function drawBtn() {
            var g = this.graphics;
            var on = (currentDir === this.dirId);
            var w = this.size.width, h = this.size.height;

            var back = on ? [0.14, 0.44, 0.78, 1] : [0.24, 0.24, 0.24, 1];
            var brush = g.newBrush(g.BrushType.SOLID_COLOR, back);
            g.newPath();
            g.rectPath(0, 0, w, h);
            g.fillPath(brush);

            var eTop = on ? [0.07, 0.07, 0.07, 1] : [0.42, 0.42, 0.42, 1];
            var eBot = on ? [0.36, 0.36, 0.36, 1] : [0.10, 0.10, 0.10, 1];
            var pT = g.newPen(g.PenType.SOLID_COLOR, eTop, 1);
            g.newPath(); g.moveTo(0.5, h - 1); g.lineTo(0.5, 0.5); g.lineTo(w - 1, 0.5); g.strokePath(pT);
            var pB = g.newPen(g.PenType.SOLID_COLOR, eBot, 1);
            g.newPath(); g.moveTo(w - 0.5, 0.5); g.lineTo(w - 0.5, h - 0.5); g.lineTo(0.5, h - 0.5); g.strokePath(pB);

            var col = on ? [1, 1, 1, 1] : [0.78, 0.78, 0.78, 1];
            var pen = g.newPen(g.PenType.SOLID_COLOR, col, 1.6);
            var gb = g.newBrush(g.BrushType.SOLID_COLOR, col);
            var off = on ? 1 : 0;
            var cx = w / 2 + off, cy = h / 2 + off;

            if (this.dirId === "center") {
                g.newPath();
                g.ellipsePath(cx - 3.2, cy - 3.2, 6.4, 6.4);
                g.fillPath(gb);
                return;
            }

            var v = VEC[this.dirId];
            var s = 6.2;
            var x1 = cx + v[0] * s, y1 = cy + v[1] * s;
            var x2 = cx + v[2] * s, y2 = cy + v[3] * s;

            g.newPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokePath(pen);

            var len = Math.sqrt(v[2] * v[2] + v[3] * v[3]);
            var ux = v[2] / len, uy = v[3] / len;
            var px = -uy, py = ux;
            var hh = 4.2, ww = 3.1;
            var hx = x2 - ux * hh, hy = y2 - uy * hh;

            g.newPath();
            g.moveTo(hx + px * ww, hy + py * ww);
            g.lineTo(x2, y2);
            g.lineTo(hx - px * ww, hy - py * ww);
            g.strokePath(pen);
        }

        function makeDirBtn(parent, id, tip) {
            var b = parent.add("iconbutton", undefined, undefined, { style: "toolbutton" });
            b.preferredSize = [36, 28];
            b.minimumSize = [26, 24];
            b.dirId = id;
            b.helpTip = tip;
            b.onDraw = drawBtn;
            b.onClick = function () {
                currentDir = this.dirId;
                for (var i = 0; i < dirButtons.length; i++) dirButtons[i].notify("onDraw");
            };
            dirButtons.push(b);
            return b;
        }

        function makeRow() {
            var g = dirPanel.add("group");
            g.orientation = "row";
            g.alignChildren = ["fill", "fill"];
            g.spacing = 2;
            return g;
        }

        var r1 = makeRow();
        makeDirBtn(r1, "diagNW", "SE to NW");
        makeDirBtn(r1, "up", "bottom to top");
        makeDirBtn(r1, "diagNE", "SW to NE");

        var r2 = makeRow();
        makeDirBtn(r2, "left", "right to left");
        makeDirBtn(r2, "center", "center to edges");
        makeDirBtn(r2, "right", "left to right");

        var r3 = makeRow();
        makeDirBtn(r3, "diagSW", "NE to SW");
        makeDirBtn(r3, "down", "top to bottom");
        makeDirBtn(r3, "diagSE", "NW to SE");

        // ---------- order ----------
        var og = dirPanel.add("group");
        og.orientation = "row";
        og.spacing = 4;
        swatch(og, COL.teal);
        og.add("statictext", undefined, "Order:");
        var orderDD = og.add("dropdownlist", undefined,
            ["Center out", "Edges in", "Left first", "Right first", "Random"]);
        orderDD.selection = 0;
        orderDD.preferredSize.width = 92;
        orderDD.helpTip = "Sequence inside each row, column or ring.\n" +
            "On the center direction it drives the rings themselves:\n" +
            "Center out goes inner ring first, Edges in starts from the outer ring.\n" +
            "Random ignores direction/bands entirely and shuffles everything.";
        var orderSeedLbl = og.add("statictext", undefined, "Seed:");
        var orderSeedEdit = og.add("edittext", undefined, "1");
        orderSeedEdit.characters = 3;
        orderSeedEdit.helpTip = "Seed for the Random order option. Same seed, same shuffle.";

        function refreshOrderSeedField() {
            var isRandom = (ORDER_LIST[orderDD.selection.index] === "random");
            orderSeedLbl.enabled = isRandom;
            orderSeedEdit.enabled = isRandom;
        }

        orderDD.onChange = function () {
            currentOrder = ORDER_LIST[orderDD.selection.index];
            refreshOrderSeedField();
        };
        orderSeedEdit.onChange = function () {
            var v = parseInt(orderSeedEdit.text, 10);
            currentOrderSeed = isNaN(v) ? 1 : v;
        };
        refreshOrderSeedField();

        // ---------- stagger ----------
        var sg = pal.add("group");
        sg.orientation = "row";
        sg.spacing = 4;
        swatch(sg, COL.amber);
        sg.add("statictext", undefined, "Stagger:");
        var staggerEdit = sg.add("edittext", undefined, "1");
        staggerEdit.characters = 4;
        var minusBtn = sg.add("button", undefined, "-");
        var plusBtn = sg.add("button", undefined, "+");
        minusBtn.preferredSize = [24, 21];
        plusBtn.preferredSize = [24, 21];
        sg.add("statictext", undefined, "frames");

        plusBtn.onClick = function () {
            var v = parseInt(staggerEdit.text, 10);
            if (isNaN(v)) v = 0;
            staggerEdit.text = (v + 1).toString();
        };
        minusBtn.onClick = function () {
            var v = parseInt(staggerEdit.text, 10);
            if (isNaN(v)) v = 0;
            staggerEdit.text = Math.max(0, v - 1).toString();
        };

        // ---------- clone ----------
        var clonePanel = pal.add("panel", undefined, "Clone");
        clonePanel.orientation = "column";
        clonePanel.alignChildren = ["fill", "top"];
        clonePanel.spacing = 4;
        clonePanel.margins = 8;

        var cloneRow = clonePanel.add("group");
        cloneRow.orientation = "row";
        cloneRow.spacing = 12;
        swatch(cloneRow, COL.purple);
        var cloneChk = cloneRow.add("checkbox", undefined, "Enable clone");
        var centerAnchorChk = cloneRow.add("checkbox", undefined, "Center Anchor Point");
        centerAnchorChk.value = true;
        centerAnchorChk.helpTip = "Recenters each clone's anchor point to its own visual\n" +
            "bounding box before laying it out. Fixes misaligned grids from\n" +
            "off-center sources (e.g. left-aligned text) and makes Scale/\n" +
            "Rotation pivot the same way for every clone. Turn off if you\n" +
            "specifically want to keep each object's original anchor.";
        centerAnchorChk.onClick = function () {
            currentCenterAnchor = centerAnchorChk.value;
        };

        var randomChk = clonePanel.add("checkbox", undefined, "Random Objects");
        randomChk.helpTip = "Shuffles which grid/radial/circular slot each clone lands in.\n" +
            "Only has a visible effect when the layers you selected to clone\n" +
            "are more than one distinct layer - identical clones look the same\n" +
            "either way. Adjust the seed afterward in the CTRL layer's own\n" +
            "Effect Controls (Random Objects Seed), no need to Rebuild.";

        var motionChk = clonePanel.add("checkbox", undefined, "Preserve source animation");
        motionChk.value = true;
        motionChk.helpTip = "When off, clones ignore any wiggle/spring/expression on the\n" +
            "source and just get the plain grid/radial/circular layout. Turn this\n" +
            "off if a precomp source causes After Effects to freeze or hang.";
        motionChk.onClick = function () {
            currentPreserveMotion = motionChk.value;
        };

        var mg = clonePanel.add("group");
        mg.orientation = "row";
        mg.spacing = 4;
        var modeLbl = mg.add("statictext", undefined, "Mode:");

        var modeButtons = [];
        function drawModeBtn() {
            var g = this.graphics;
            var on = (currentCloneMode === this.modeId);
            var w = this.size.width, h = this.size.height;

            var back = on ? COL.purple : [0.24, 0.24, 0.24, 1];
            var brush = g.newBrush(g.BrushType.SOLID_COLOR, back);
            g.newPath();
            g.rectPath(0, 0, w, h);
            g.fillPath(brush);

            var eTop = on ? [0.10, 0.08, 0.16, 1] : [0.42, 0.42, 0.42, 1];
            var eBot = on ? [0.62, 0.52, 0.78, 1] : [0.10, 0.10, 0.10, 1];
            var pT = g.newPen(g.PenType.SOLID_COLOR, eTop, 1);
            g.newPath(); g.moveTo(0.5, h - 1); g.lineTo(0.5, 0.5); g.lineTo(w - 1, 0.5); g.strokePath(pT);
            var pB = g.newPen(g.PenType.SOLID_COLOR, eBot, 1);
            g.newPath(); g.moveTo(w - 0.5, 0.5); g.lineTo(w - 0.5, h - 0.5); g.lineTo(0.5, h - 0.5); g.strokePath(pB);

            var off = on ? 1 : 0;
            drawModeIcon(g, this.modeId, w / 2 + off, h / 2 + off, on);
        }

        for (var mi = 0; mi < MODE_IDS.length; mi++) {
            (function (id) {
                var b = mg.add("iconbutton", undefined, undefined, { style: "toolbutton" });
                b.preferredSize = [30, 26];
                b.modeId = id;
                b.helpTip = MODE_LABELS[id];
                b.onDraw = drawModeBtn;
                b.onClick = function () {
                    currentCloneMode = id;
                    for (var mb = 0; mb < modeButtons.length; mb++) modeButtons[mb].notify("onDraw");
                    refresh();
                };
                modeButtons.push(b);
            })(MODE_IDS[mi]);
        }

        var g1 = clonePanel.add("group");
        g1.orientation = "row";
        g1.spacing = 4;
        var colsLbl = g1.add("statictext", undefined, "Cols:");
        var colsEdit = g1.add("edittext", undefined, "5");
        colsEdit.characters = 3;
        var rowsLbl = g1.add("statictext", undefined, "Rows:");
        var rowsEdit = g1.add("edittext", undefined, "5");
        rowsEdit.characters = 3;
        var countLbl = g1.add("statictext", undefined, "Count:");
        var countEdit = g1.add("edittext", undefined, "30");
        countEdit.characters = 3;

        var g2 = clonePanel.add("group");
        g2.orientation = "row";
        g2.spacing = 4;
        var autoChk = g2.add("checkbox", undefined, "Auto gap 50px");
        autoChk.value = true;

        var g3 = clonePanel.add("group");
        g3.orientation = "row";
        g3.spacing = 4;
        var spxLbl = g3.add("statictext", undefined, "Sp X:");
        var spxEdit = g3.add("edittext", undefined, "200");
        spxEdit.characters = 4;
        var spyLbl = g3.add("statictext", undefined, "Y:");
        var spyEdit = g3.add("edittext", undefined, "200");
        spyEdit.characters = 4;
        var radLbl = g3.add("statictext", undefined, "Radius:");
        var radiusEdit = g3.add("edittext", undefined, "400");
        radiusEdit.characters = 4;

        // ---------- actions ----------
        var actGrp = pal.add("group");
        actGrp.orientation = "row";
        actGrp.alignChildren = ["fill", "fill"];
        actGrp.spacing = 4;

        var runBtn = actGrp.add("button", undefined, "RUN");
        runBtn.preferredSize = [-1, 28];
        var rebuildBtn = actGrp.add("button", undefined, "Rebuild");
        rebuildBtn.preferredSize = [-1, 28];
        rebuildBtn.helpTip = "Rebuilds from the CTRL sliders, not from this panel.\n" +
            "Select the CTRL layer inside the clone precomp first.";

        // ---------- enable / disable ----------
        function refresh() {
            var on = cloneChk.value;
            var isGrid = (currentCloneMode === "grid");
            var auto = autoChk.value;

            modeLbl.enabled = on;
            for (var mbi = 0; mbi < modeButtons.length; mbi++) modeButtons[mbi].enabled = on;
            motionChk.enabled = on;
            centerAnchorChk.enabled = on;
            autoChk.enabled = on;
            randomChk.enabled = on;
            rebuildBtn.enabled = on;

            colsLbl.enabled = on && isGrid;
            colsEdit.enabled = on && isGrid;
            rowsLbl.enabled = on && isGrid;
            rowsEdit.enabled = on && isGrid;
            countLbl.enabled = on && !isGrid;
            countEdit.enabled = on && !isGrid;

            spxLbl.enabled = on && isGrid && !auto;
            spxEdit.enabled = on && isGrid && !auto;
            spyLbl.enabled = on && isGrid && !auto;
            spyEdit.enabled = on && isGrid && !auto;
            radLbl.enabled = on && !isGrid && !auto;
            radiusEdit.enabled = on && !isGrid && !auto;
        }

        cloneChk.onClick = refresh;
        autoChk.onClick = refresh;
        refresh();

        function num(field, def, min) {
            var v = parseFloat(field.text);
            if (isNaN(v)) v = def;
            if (min !== undefined && v < min) v = min;
            return v;
        }

        runBtn.onClick = function () {
            doRun({
                clone: cloneChk.value,
                dir: currentDir,
                order: ORDER_LIST[orderDD.selection.index],
                orderSeed: currentOrderSeed,
                stagger: num(staggerEdit, 0, 0),
                mode: currentCloneMode,
                cols: Math.round(num(colsEdit, 5, 1)),
                rows: Math.round(num(rowsEdit, 5, 1)),
                count: Math.round(num(countEdit, 30, 1)),
                radius: num(radiusEdit, 400, 1),
                spacingX: num(spxEdit, 200, 0),
                spacingY: num(spyEdit, 200, 0),
                autoSpacing: autoChk.value,
                random: randomChk.value,
                seed: 1,
                preserveMotion: currentPreserveMotion,
                centerAnchor: currentCenterAnchor
            });
        };

        rebuildBtn.onClick = doRebuild;

        // ---------- stable layout ----------
        pal.onResizing = pal.onResize = function () {
            try { this.layout.resize(); } catch (e) {}
        };

        pal.layout.layout(true);
        pal.layout.resize();

        return pal;
    }

    var panel = buildUI(thisObj);
    if (panel instanceof Window) {
        panel.center();
        panel.show();
    }

})(this);
