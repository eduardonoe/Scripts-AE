# After Effects Automation Rules for Antigravity

This workspace contains a real-time Adobe After Effects automation system located in `./ae-mcp-server`.

## How to interact with After Effects
When the user asks to manipulate, query, animate, or create anything in Adobe After Effects:
1. The After Effects instance is connected via the local bridge script (`./ae-mcp-server/ae-mcp-bridge.jsx`) which runs in the background of After Effects.
2. To execute actions, run commands using the compiled scripts in `./ae-mcp-server/dist/` or invoke ExtendScript snippets via `./ae-mcp-server/src/ae-runner.ts` / `./ae-mcp-server/dist/tools.js`.

## Available Capabilities:
- `getProjectElements()`: Inspect all comps and editable layers in real time.
- `createComposition(name, width, height, duration, fps)`: Create new compositions.
- `createTextLayer(compName, text, layerName)`: Add text layers.
- `createSolidLayer(compName, layerName, color, width, height)`: Add background solids.
- `updateTextLayer(compName, layerName, newText)`: Live update text content.
- `changeFont(fontFamily, compName)`: Batch replace typography with any installed system font.
- `animatePosition(compName, startFrame, endFrame, startXPercent, endXPercent, layerName)`: Add smooth keyframe position animation.
- `applyFillEffect(compName, color, layerName)`: Ingest native Fill effects with custom RGB colors.
- `batchRenameCompositions(prefix)`: Sequentially rename all compositions in batch.
- `replaceFootage(compName, layerName, filePath)`: Replace image/video media sources.
- `renderComposition(compName, outputPath)`: Add to render queue.
