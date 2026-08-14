/*
    Layer Direction - Reorder, Stagger and Clone System   v15 - Random Objects + icon UI

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

    var MARK_SRC = "TS_SRC";
    var MARK_CLONE = "TS_CLONE";
    var AUTO_GAP = 50;
    var NO_STAGGER_PAD = 3;
    var MAX_CLONES = 500;

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
    // pixel). Fixes grids built from off-center sources (e.g. left-aligned
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

