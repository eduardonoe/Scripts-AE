import { runExtendScript } from "./ae-runner.js";
async function animateTextLayers() {
    console.log("🎬 Aplicando animação de posição X (20% a 80%) do frame 20 ao 120...");
    const script = `
    var proj = app.project;
    var foundComp = null;

    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof CompItem && (item.name === "comp_01" || item.name === "Comp 1")) {
            foundComp = item;
            break;
        }
    }

    if (!foundComp) return { error: "Composição 'comp_01' não encontrada." };

    foundComp.openInViewer();

    var fps = foundComp.frameRate;
    var startTime = 20 / fps;
    var endTime = 120 / fps;
    var startX = foundComp.width * 0.20; // 384px
    var endX = foundComp.width * 0.80;   // 1536px

    var animatedLayers = [];

    for (var j = 1; j <= foundComp.numLayers; j++) {
        var layer = foundComp.layer(j);
        if (layer instanceof TextLayer) {
            var posProp = layer.property("Transform").property("Position");
            
            // Pega o Y atual da camada
            var currentPos = posProp.value;
            var curY = currentPos[1];
            var curZ = currentPos.length > 2 ? currentPos[2] : 0;

            // Remove keyframes antigos se houver
            while (posProp.numKeys > 0) {
                posProp.removeKey(1);
            }

            // Cria keyframe 1 no frame 20
            posProp.setValueAtTime(startTime, [startX, curY, curZ]);
            // Cria keyframe 2 no frame 120
            posProp.setValueAtTime(endTime, [endX, curY, curZ]);

            // Aplica atenuação suave (Easy Ease)
            try {
                var easeIn = new KeyframeEase(0, 33.33);
                var easeOut = new KeyframeEase(0, 33.33);
                if (posProp.isSpatial) {
                    posProp.setTemporalEaseAtKey(1, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
                    posProp.setTemporalEaseAtKey(2, [easeIn, easeIn, easeIn], [easeOut, easeOut, easeOut]);
                } else {
                    posProp.setTemporalEaseAtKey(1, [easeIn], [easeOut]);
                    posProp.setTemporalEaseAtKey(2, [easeIn], [easeOut]);
                }
            } catch(e) {
                // Easy ease opcional
            }

            animatedLayers.push({
                layerName: layer.name,
                startX: startX,
                endX: endX,
                startFrame: 20,
                endFrame: 120,
                yPos: curY
            });
        }
    }

    return {
        success: true,
        message: "Animação de Position X aplicada com sucesso em " + animatedLayers.length + " camadas de texto!",
        comp: foundComp.name,
        fps: fps,
        layers: animatedLayers
    };
  `;
    const result = await runExtendScript(script);
    console.log("Resultado da animação:", JSON.stringify(result, null, 2));
}
animateTextLayers().catch(console.error);
