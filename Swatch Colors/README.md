# Swatch Colors — CEP panel and ScriptUI panel for After Effects

Two versions ship in this folder:

```text
Swatch Colors/
├── Swatch Colors.jsx                    ScriptUI panel (standalone)
├── Install_Swatch_Colors_ScriptUI.bat   installs the .jsx
└── CEP Extension/
    ├── Install_Swatch_Colors.bat        installs the CEP extension
    └── Swatch Colors/                   the extension itself
```

| Version | Where | Install with |
| --- | --- | --- |
| CEP extension (full interface, skins, drag-to-reorder cards) | `CEP Extension/Swatch Colors/` | `CEP Extension/Install_Swatch_Colors.bat` |
| ScriptUI panel (standalone, no CEP required) | `Swatch Colors.jsx` | `Install_Swatch_Colors_ScriptUI.bat` |

Both read the composition the same way and share the same palette logic. The ScriptUI version is a single self-contained file that docks like any other panel in `Window`, and keeps its palettes in the user profile instead of the CEP storage. Its interface is plainer, since ScriptUI has no HTML/CSS: no skins, no collapsible cards, and no reordering.

Known limitation of the ScriptUI version: right-clicking a swatch fills the HEX field at the top of the panel and selects it, but automatic copying to the system clipboard is unreliable in this environment, so press `Ctrl+C` to copy. The CEP version copies directly.


The panel reads the active composition in two ways:

- **Exact colors:** RGB values from true solid sources only: solid layers, shape fills and strokes, text fills and strokes, and the Fill effect. Gradient stops, arbitrary effect controls, photos, and videos are not promoted to this section.
- **Derived palette:** dominant colors extracted from the current rendered frame, useful for photos, videos, and gradients.

The derived palette samples 240 small areas directly from visible layers at the current composition time through After Effects' `sampleImage()` expression engine. Transparent points are ignored, and dominant clusters use representative sampled colors instead of averaged RGB colors so saturated details are not washed into pastels. The panel never opens, changes, or uses the Render Queue and does not depend on output-module templates.

The panel displays up to 64 unique exact colors plus 12 dominant colors from the rendered frame. The **Add color** button in either section opens the native After Effects color editor, including its screen eyedropper, and appends the chosen color to that palette. **Click** a color to apply or update a **Fill** effect on every selected layer. **Shift + click** applies or updates a **Tint** effect and sends the swatch to **Map White To**. If no layer is selected, either action creates a composition-sized adjustment layer with the corresponding effect. **Right-click** copies the HEX code, including `#`, to the clipboard. **Shift + right-click** opens the color information popover with its HEX value and source.

Analysis is always manual. The panel does not watch or recalculate the composition in the background. It only starts when **Read composition** is clicked.

The source is always the composition currently open in the active Composition Viewer. Selecting an item in the Project panel does not make it the analysis source.

## Persistent memory

- The active palette is stored locally and restored whenever the panel opens.
- It remains active across After Effects projects and application restarts until another composition is analyzed or another palette is loaded.
- The current palette and the two previous active palettes are kept automatically under **Palette Memory**.
- Named palettes can be stored without a time limit in **Saved palettes**.
- Local data remains available until the CEP extension storage is manually cleared or the extension profile is removed.

## Installation on Windows

The release ZIP includes `Install_Swatch_Colors.bat`, which installs the extension and enables unsigned CEP extensions automatically.

1. Extract the entire `Swatch_Colors_CEP_1.0.1.zip` archive to a folder, or use the `CEP Extension` folder from this repository directly — both have the same layout, with `Install_Swatch_Colors.bat` sitting beside a `Swatch Colors` folder.
2. Right-click `Install_Swatch_Colors.bat` and choose **Run as administrator**. The installer also requests elevation automatically when needed.
4. Wait for the installation-complete message, then restart After Effects.
5. Open **Window > Extensions (Legacy) > Swatch Colors**.

The installer removes the previous `Swatch Colors` extension folder before copying the new files to:

`C:\Program Files\Common Files\Adobe\CEP\extensions\Swatch Colors`

Running the installer again updates the panel without deleting the active palette, recent history, or saved palettes. These are stored separately in the CEP profile.

For complete instructions in Portuguese and English, see `INSTALACAO_INSTALLATION.txt` inside the package.

## Installing the ScriptUI panel

1. Right-click `Install_Swatch_Colors_ScriptUI.bat` and choose **Run as administrator**. It also requests elevation automatically.
2. The installer finds every `Adobe After Effects *` installation under `C:\Program Files\Adobe`, deletes any previous copy, and installs `Swatch Colors.jsx` into each one's `Support Files\Scripts\ScriptUI Panels`.
3. Restart After Effects and open **Window > Swatch Colors.jsx**.

Saved palettes live in `%APPDATA%\Swatch Colors` and survive reinstalls and updates.

## Manual or development installation

1. Copy the extension folder to a CEP extensions directory and name it `Swatch Colors`.
2. Enable CEP debug mode for the installed CSXS version.
3. Restart After Effects and open **Window > Extensions (Legacy) > Swatch Colors**.

Declared compatibility: After Effects 2021 or later (CEP/CSXS 11). The included automatic installer targets Windows; manual installation is required on other operating systems.

## Interface

- Click a card header to collapse or expand it.
- Drag the small grip on a module header to reorder the modules.
- Card order and collapsed state persist locally.
- Open the options menu to choose a small, medium, or large interface and one of six persistent skins: Violet, Midnight Indigo, Graphite, Minimal Flat, Adobe Native, or Cyber Slate.
- The compact interface uses a five-pixel internal scrollbar with a transparent track.
- **Generate variations** creates balanced, vibrant, or soft alternatives based on the analyzed composition.
- Enter a name and click **Save palette** to store the active colors.
- **Saved palettes** can be previewed, loaded, updated, or deleted. Saving with an existing name updates that palette.
