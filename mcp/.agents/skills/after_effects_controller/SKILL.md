---
name: after_effects_controller
description: Controls, automates, and manipulates Adobe After Effects in real-time. Use whenever the user wants to create compositions, edit texts, change fonts, animate keyframes, apply effects, rename comps, replace footage, or inspect the open After Effects project.
---

# After Effects Controller Skill for Antigravity

This skill gives Antigravity the native ability to communicate directly with the user's Adobe After Effects in real time.

## Quick Execution Patterns
All operations can be executed directly using Node.js or ExtendScript scripts located in `./ae-mcp-server`.

### 1. Inspecting Open Project
To see all comps and editable layers:
```bash
node -e "import('./ae-mcp-server/dist/tools.js').then(m => m.getProjectElements().then(r => console.log(JSON.stringify(r, null, 2))))"
```

### 2. Updating Text Layer
```bash
node -e "import('./ae-mcp-server/dist/tools.js').then(m => m.updateTextLayer('NOME_COMP', 'NOME_LAYER', 'NOVO TEXTO').then(console.log))"
```

### 3. Creating Composition & Layers
```bash
node -e "import('./ae-mcp-server/dist/tools.js').then(m => m.createComposition('Nova Comp', 1920, 1080, 10, 30).then(console.log))"
```

### 4. Changing Fonts (Typography)
```bash
node -e "import('./ae-mcp-server/dist/tools.js').then(m => m.changeFont('Segoe UI').then(console.log))"
```

### 5. Animating Position Keyframes
```bash
node -e "import('./ae-mcp-server/dist/tools.js').then(m => m.animatePosition('NOME_COMP', 20, 120, 0.20, 0.80).then(console.log))"
```

### 6. Applying Fill Effect
```bash
node -e "import('./ae-mcp-server/dist/tools.js').then(m => m.applyFillEffect('NOME_COMP', [0.08, 0.52, 1.0]).then(console.log))"
```

### 7. Batch Renaming Comps
```bash
node -e "import('./ae-mcp-server/dist/tools.js').then(m => m.batchRenameCompositions('comp_').then(console.log))"
```

### 8. Custom Arbitrary ExtendScript Execution
For any advanced Adobe After Effects task not covered above:
```typescript
import { runExtendScript } from "./ae-mcp-server/dist/ae-runner.js";
const result = await runExtendScript(`
  // Any ExtendScript code here
  var comp = app.project.activeItem;
  return { activeComp: comp ? comp.name : null };
`);
```
