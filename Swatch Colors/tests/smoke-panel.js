const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async function () {
  const browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const errors = [];
  page.on("pageerror", function (error) { errors.push(error.message); });
  page.on("console", function (message) { if (message.type() === "error") errors.push(message.text()); });

  await page.addInitScript(function () {
    window.__SWATCH_COLORS_TEST__ = true;
    window.__hostCalls = [];
    window.__copiedHex = [];
    document.execCommand = function (command) {
      if (command === "copy") {
        window.__copiedHex.push(document.activeElement && document.activeElement.value);
        return true;
      }
      return false;
    };
    window.cep = { fs: { readFile: function () { return { err: 0, data: "var SwatchColors=SwatchColors||{};" }; } } };
    window.__adobe_cep__ = {
      getSystemPath: function () { return "C:/mock/Swatch Colors"; },
      evalScript: function (source, callback) {
        var mode = source.indexOf("'tint'") > -1 ? "tint" : (source.indexOf("'fill'") > -1 ? "fill" : "other");
        window.__hostCalls.push(mode);
        callback('{"ok":true,"changed":1}');
      }
    };
    localStorage.setItem("swatchColorActive", JSON.stringify({
      name: "Smoke Palette", comp: "Smoke Comp", time: 0,
      exact: [{ rgb: [0, 86, 214], source: "Solid" }, { rgb: [255, 255, 255], source: "Shape fill" }],
      based: [{ rgb: [37, 52, 79], source: "Dominant sampled color" }, { rgb: [185, 135, 114], source: "Dominant sampled color" }]
    }));
    localStorage.setItem("swatchColorHistory", JSON.stringify([
      { name: "Previous 1", comp: "Comp 1", time: 0, exact: [{ rgb: [255, 0, 0], source: "Solid" }], based: [] },
      { name: "Previous 2", comp: "Comp 2", time: 0, exact: [{ rgb: [0, 255, 0], source: "Solid" }], based: [] },
      { name: "Legacy third", comp: "Comp 3", time: 0, exact: [{ rgb: [0, 0, 255], source: "Solid" }], based: [] }
    ]));
    localStorage.removeItem("swatchCards");
  });

  const panelPath = path.resolve(__dirname, "..", "panel", "index.html");
  await page.goto(pathToFileURL(panelPath).href);
  await page.waitForSelector(".swatch");
  const paletteCheck = await page.evaluate(function () {
    var samples = [], colors = [[1, 0, 0, 1], [0, 0, 1, 1], [0, 1, 0, 1], [.45, .45, .45, 1]];
    colors.forEach(function (color, index) { for (var i = 0; i < 8 + index; i++) samples.push(color); });
    samples.push([1, 1, 0, 0]);
    var result = window.__swatchColorsInternals.paletteFromSamples(samples, 4);
    var allFromFrame = result.every(function (item) {
      return colors.some(function (color) {
        return Math.abs(item.rgb[0] - color[0] * 255) < 1 && Math.abs(item.rgb[1] - color[1] * 255) < 1 && Math.abs(item.rgb[2] - color[2] * 255) < 1;
      });
    });
    return { count: result.length, allFromFrame: allFromFrame };
  });
  if (paletteCheck.count !== 4 || !paletteCheck.allFromFrame) throw new Error("Derived palette invented averaged colors not present in the frame");
  const historyItems = await page.locator("#historyList .history-item").count();
  if (historyItems !== 2) throw new Error("History was not limited to two previous palettes");

  const skins = ["violet", "midnight-indigo", "graphite", "minimal-flat", "adobe-native", "cyber-slate"];
  await page.click("#settingsBtn");
  for (const skin of skins) {
    await page.click('[data-skin-option="' + skin + '"]');
    const applied = await page.getAttribute("body", "data-skin");
    if (applied !== skin) throw new Error("Skin did not apply: " + skin);
  }
  await page.click("#settingsBtn");

  const cards = await page.$$("#cards > .color-card");
  if (cards.length !== 4) throw new Error("Expected four modules, found " + cards.length);
  for (const card of cards) {
    const header = await card.$(".card-header");
    const body = await card.$(".card-body");
    await header.click();
    await page.waitForTimeout(650);
    const collapsed = await card.evaluate(function (element) { return element.classList.contains("collapsed"); });
    const collapsedHeight = await body.evaluate(function (element) { return element.getBoundingClientRect().height; });
    if (!collapsed || collapsedHeight > 1) throw new Error("Module did not collapse vertically");
    await header.click();
    await page.waitForTimeout(650);
    const expandedHeight = await body.evaluate(function (element) { return element.getBoundingClientRect().height; });
    if (expandedHeight < 2) throw new Error("Module did not expand vertically");
  }

  const swatch = page.locator(".swatch").first();
  await swatch.click();
  await page.waitForTimeout(30);
  await swatch.click({ modifiers: ["Shift"] });
  await page.waitForTimeout(30);
  await swatch.click({ button: "right" });
  await page.waitForTimeout(30);
  const copiedHex = await page.evaluate(function () { return window.__copiedHex.slice(); });
  const popoverAfterCopy = await page.locator("#popover").evaluate(function (element) { return !element.hidden; });
  await swatch.click({ button: "right", modifiers: ["Shift"] });
  const calls = await page.evaluate(function () { return window.__hostCalls.slice(); });
  const popoverVisible = await page.locator("#popover").evaluate(function (element) { return !element.hidden; });
  if (calls.length !== 2 || calls[0] !== "fill" || calls[1] !== "tint") throw new Error("Swatch gestures are incorrect: " + calls.join(","));
  if (popoverAfterCopy) throw new Error("Plain right-click opened details instead of copying HEX");
  if (copiedHex.length !== 1 || copiedHex[0] !== "#0056D6") throw new Error("Right-click did not copy the HEX code with #");
  if (!popoverVisible) throw new Error("Shift + right-click did not open color information");

  const swatchBorder = await swatch.evaluate(function (element) { return getComputedStyle(element).borderTopWidth; });
  if (swatchBorder !== "0px") throw new Error("Swatch border was not removed");
  if (errors.length) throw new Error("Browser errors: " + errors.join(" | "));

  await page.screenshot({ path: path.resolve(__dirname, "panel-smoke.png"), fullPage: true });
  console.log(JSON.stringify({ ok: true, skins: skins.length, modules: cards.length, history: historyItems, gestures: calls, copiedHex: copiedHex, shiftRightClickDetails: popoverVisible, swatchBorder: swatchBorder }));
  await browser.close();
})().catch(function (error) {
  console.error(error.stack || error.message);
  process.exit(1);
});
