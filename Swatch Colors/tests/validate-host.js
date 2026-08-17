const fs = require("fs");
const path = require("path");
const vm = require("vm");

function CompItem() {}
const colorValues = {};
const effectsList = [];

function makeEffect(matchName) {
  const colorProperty = {
    setValue: function (value) { colorValues[matchName] = value.slice(); }
  };
  return {
    matchName: matchName,
    enabled: true,
    property: function (name) {
      if (name === 2 || name === "ADBE Fill-0002" || name === "ADBE Tint-0002") return colorProperty;
      return null;
    }
  };
}

const effects = {
  get numProperties() { return effectsList.length; },
  property: function (index) { return effectsList[index - 1]; },
  addProperty: function (matchName) {
    const effect = makeEffect(matchName);
    effectsList.push(effect);
    return effect;
  }
};

const layer = {
  property: function (name) { return name === "ADBE Effect Parade" ? effects : null; }
};
const comp = new CompItem();
comp.selectedLayers = [layer];

const context = {
  CompItem: CompItem,
  ViewerType: { VIEWER_COMPOSITION: 1 },
  PropertyType: { PROPERTY: 1 },
  PropertyValueType: { COLOR: 1 },
  app: {
    activeViewer: { type: 1 },
    project: { activeItem: comp },
    beginUndoGroup: function () {},
    endUndoGroup: function () {}
  }
};
vm.createContext(context);
const source = fs.readFileSync(path.resolve(__dirname, "..", "jsx", "main.jsx"), "utf8");
vm.runInContext(source, context);

const host = context.SwatchColors;
const accepted = {
  "ADBE Vector Fill Color": "Shape fill",
  "ADBE Vector Stroke Color": "Shape stroke",
  "ADBE Fill-0002": "Fill effect"
};
Object.keys(accepted).forEach(function (matchName) {
  const label = host.exactColorLabel({ matchName: matchName });
  if (label !== accepted[matchName]) throw new Error("Exact property was not accepted: " + matchName);
});
["ADBE Ramp-0001", "ADBE Ramp-0002", "ADBE Color Control-0001", "ADBE Tint-0002"].forEach(function (matchName) {
  if (host.exactColorLabel({ matchName: matchName })) throw new Error("Non-solid property was promoted to Exact: " + matchName);
});

function apply(hex, mode) {
  const result = JSON.parse(host.applyEffectColor(hex, mode));
  if (!result.ok || result.changed !== 1) throw new Error("Effect application failed: " + mode);
}

apply("#0056D6", "fill");
apply("#E91D2A", "fill");
if (effectsList.filter(function (effect) { return effect.matchName === "ADBE Fill"; }).length !== 1) throw new Error("Fill effect was duplicated");
apply("#FFFFFF", "tint");
apply("#FFC400", "tint");
if (effectsList.filter(function (effect) { return effect.matchName === "ADBE Tint"; }).length !== 1) throw new Error("Tint effect was duplicated");
if (Math.abs(colorValues["ADBE Tint"][0] - 1) > .0001 || Math.abs(colorValues["ADBE Tint"][1] - (196 / 255)) > .0001) throw new Error("Tint Map White To received the wrong color");

console.log(JSON.stringify({ ok: true, exactWhitelist: Object.keys(accepted).length, effects: effectsList.map(function (effect) { return effect.matchName; }) }));
