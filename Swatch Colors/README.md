# Swatch Colors — CEP panel and ScriptUI panel for After Effects

Reads the colors of the active composition and lets you apply them back to layers. Two versions ship in this folder and share the same analysis engine:

```text
Swatch Colors/
├── Swatch Colors.jsx                    ScriptUI panel (standalone)
├── Install_Swatch_Colors_ScriptUI.bat   installs the .jsx
└── CEP Extension/
    ├── Install_Swatch_Colors.bat        installs the CEP extension
    ├── INSTALACAO_INSTALLATION.txt      install guide, PT and EN
    └── Swatch Colors/                   the extension itself
```

| Version | Where | Install with | Opens at |
| --- | --- | --- | --- |
| CEP extension | `CEP Extension/Swatch Colors/` | `CEP Extension/Install_Swatch_Colors.bat` | `Window > Extensions (Legacy) > Swatch Colors` |
| ScriptUI panel | `Swatch Colors.jsx` | `Install_Swatch_Colors_ScriptUI.bat` | `Window > Swatch Colors.jsx` |

Both read the composition identically and produce the same colors. They differ only in interface and in where they store data — see [Differences between the two versions](#differences-between-the-two-versions).

## Versioning

**Both versions always carry the same version number.** When either one changes, bump the version in both. Current: **1.0.3**. The version appears in five places:

| File | What to change |
| --- | --- |
| `Swatch Colors.jsx` | `Version:` header and the `VERSION` constant near the top |
| `CEP Extension/Swatch Colors/jsx/main.jsx` | `Version:` header |
| `CEP Extension/Swatch Colors/CSXS/manifest.xml` | `ExtensionBundleVersion` and `Extension ... Version` |
| `CEP Extension/Swatch Colors/panel/index.html` | the `<small>` tag next to the title |
| `CEP Extension/Swatch_Colors_CEP_x.y.z.zip` | rebuild the archive under the new name |

The ScriptUI panel shows its version in its own header, so a docked panel still tells you what is running.

## Reading the composition

Analysis is always manual: nothing is watched or recalculated in the background, and it only runs when **Read composition** is clicked. The source is always the composition open in the active Composition Viewer — selecting an item in the Project panel does not make it the source. The Render Queue is never opened, changed, or used, and no output-module template is involved.

Results are split into two sections.

### Exact colors

Values that are exact rather than approximated, up to 64 of them. Two things qualify:

1. **Solid sources** — solid layers, shape fills and strokes, text fills and strokes, and the Fill effect. These are read straight from layer properties, including inside nested compositions.
2. **Flat areas of the rendered frame** — a color earns this section when it *dominates its own cluster*: the same pixel value repeats in at least 2 samples and accounts for 40% or more of the samples grouped with it. That is the signature of a logo, a title, or a flat background.

The second rule is what lets a flat white title or an amber word in a **video frame** be reported exactly, even though neither exists as a layer property. Dominance is used instead of a raw sample count on purpose: a small element such as a thin handwritten word is hit by very few samples, but nearly all of them carry the same value, so it is still recognized. A gradient behaves the opposite way — even when banding makes values repeat, each one accounts for a small share of its cluster, so gradients do not leak in.

### Derived palette

The dominant colors of the rendered frame that genuinely *are* a blend — photos, video, gradients, skin, fabric. Up to 12 clusters, minus any promoted to Exact colors.

### How sampling works

The frame is sampled on a **28 × 16 grid (448 points)** through After Effects' `sampleImage()` expression engine, reading visible layers directly at the current composition time. Transparent points are ignored, and layers the panel itself created (`Swatch Fill …` / `Swatch Tint …` adjustment layers) are skipped so re-reading does not feed the panel its own output.

Two details matter for accuracy:

- **One pixel per point** (`sampleImage` radius `0.5`). `sampleImage` averages a box of ±radius, so a larger radius contaminates every sample taken near an edge and stops flat colors from ever coming out pure.
- **The reported color of a cluster is its most frequently repeated exact pixel value**, not the cluster average. With the noise typical of compressed video, averaging returns `#FEBF01` where the real color is `#FFBF00`.

## Using the colors

| Action | Result |
| --- | --- |
| **Click** a swatch | Applies or updates a **Fill** effect on every selected layer |
| **Shift + click** | Applies or updates a **Tint** effect, sending the swatch to **Map White To** |
| **Right-click** | Copies the HEX code, including `#`, to the system clipboard |
| **Shift + right-click** *(CEP only)* | Opens a popover with the HEX value and the color's source |

If **no layer is selected**, Fill and Tint instead create a composition-sized adjustment layer carrying that effect, so a click always does something visible.

**+ Add color**, present in both sections, opens the native After Effects color editor — including its screen eyedropper — and appends the chosen color to that section.

**Variations** rewrites the derived palette as Balanced, Vibrant, or Soft alternatives, cycling through the three on each click.

## Persistent memory

- The active palette is saved automatically and restored whenever the panel opens, surviving project switches and application restarts.
- **Palette memory** keeps the current palette plus the two previous ones. Click one to load it back.
- **Saved palettes** stores named palettes with no time limit. Saving under an existing name updates that palette.

Where the data lives depends on the version: the ScriptUI panel writes `palettes.dat`, `active.dat`, and `history.dat` under `%APPDATA%\Swatch Colors`; the CEP extension uses its own extension storage. Both survive reinstalling or updating the panel, and neither is touched by the installers.

## Differences between the two versions

| | CEP | ScriptUI |
| --- | --- | --- |
| Analysis engine | identical | identical |
| Skins, collapsible cards, drag-to-reorder, interface size | yes | no — ScriptUI has no HTML/CSS |
| Shift + right-click detail popover | yes | no |
| Storage | extension storage | `%APPDATA%\Swatch Colors` |
| Needs CEP installed and unsigned extensions enabled | yes | no |

The ScriptUI panel is a single self-contained file, which makes it the simpler one to install and move between machines.

### Clipboard note

On Windows the ScriptUI panel copies through `cmd.exe` launching PowerShell. That indirection is deliberate and measured, not incidental: inside the After Effects process, invoking PowerShell directly through `system.callSystem` does nothing at all, and `clip.exe` is not resolvable on that process's PATH, so every route through it fails silently. `cmd` launching PowerShell is the one combination that works. The right-click also mirrors the value into the HEX field at the top of the panel and selects it, so `Ctrl+C` remains available if a future environment breaks the shell call. The macOS branch uses `osascript` and is untested.

## Installing the CEP extension on Windows

`Install_Swatch_Colors.bat` installs the extension and enables unsigned CEP extensions automatically.

1. Extract the entire `Swatch_Colors_CEP_1.0.3.zip` archive to a folder, or use the `CEP Extension` folder from this repository directly — both have the same layout, with `Install_Swatch_Colors.bat` sitting beside a `Swatch Colors` folder.
2. Right-click `Install_Swatch_Colors.bat` and choose **Run as administrator**. The installer also requests elevation automatically when needed.
3. Wait for the installation-complete message, then restart After Effects.
4. Open **Window > Extensions (Legacy) > Swatch Colors**.

The installer removes the previous `Swatch Colors` extension folder before copying the new files to `C:\Program Files\Common Files\Adobe\CEP\extensions\Swatch Colors`. Running it again updates the panel without deleting the active palette, recent history, or saved palettes.

For complete instructions in Portuguese and English, see `CEP Extension/INSTALACAO_INSTALLATION.txt`.

## Installing the ScriptUI panel

1. Right-click `Install_Swatch_Colors_ScriptUI.bat` and choose **Run as administrator**. It also requests elevation automatically.
2. The installer finds every `Adobe After Effects *` installation under `C:\Program Files\Adobe`, deletes any previous copy, and installs `Swatch Colors.jsx` into each one's `Support Files\Scripts\ScriptUI Panels`.
3. Restart After Effects and open **Window > Swatch Colors.jsx**.

## Manual or development installation

Both installers copy real files. For development it is more convenient to point After Effects at the repository instead, with a junction for the CEP folder and a symbolic link for the `.jsx`, so an edit takes effect without reinstalling. Note that running either installer afterwards replaces those links with real copies.

Manually, for the CEP extension:

1. Copy `CEP Extension/Swatch Colors` into a CEP extensions directory, keeping the folder name `Swatch Colors`.
2. Enable CEP debug mode (`PlayerDebugMode`) for the installed CSXS version.
3. Restart After Effects.

Declared compatibility: After Effects 2021 or later (CEP/CSXS 11). Both installers target Windows; manual installation is required on other operating systems.

## CEP interface

- Click a card header to collapse or expand it.
- Drag the grip on a card header to reorder the cards.
- Card order and collapsed state persist locally.
- The options menu offers a small, medium, or large interface and one of six persistent skins: Violet, Midnight Indigo, Graphite, Minimal Flat, Adobe Native, or Cyber Slate.
- The compact interface uses a five-pixel internal scrollbar with a transparent track.
