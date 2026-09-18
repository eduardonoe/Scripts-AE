/* Uma camada, mesma fonte, troca seca caractere por caractere. */
(function () {
    app.beginUndoGroup("Marker Text Replace - Single Layer");
    try {
        var comp=app.project.activeItem;
        if(!(comp instanceof CompItem)) throw new Error("Abra uma composicao e selecione uma camada de texto.");
        if(comp.selectedLayers.length!==1) throw new Error("Selecione exatamente uma camada de texto.");
        var layer=comp.selectedLayers[0], tp=layer.property("ADBE Text Properties");
        if(!tp) throw new Error("A camada selecionada nao e de texto.");
        var st=tp.property("ADBE Text Document");

        function removeFx(name){
            var fx=layer.property("ADBE Effect Parade");
            for(var i=fx.numProperties;i>=1;i--) if(fx.property(i).name===name) fx.property(i).remove();
        }
        function addMarker(t,text){
            var p=layer.property("ADBE Marker"),k=p.addKey(t);p.setValueAtKey(k,new MarkerValue(text));
        }

        st.expressionEnabled=false;
        var doc=st.value;
        if(doc.text==="") doc.text="RAPIDO";
        // Mantem a fonte atual. O alinhamento esquerdo prende o inicio da palavra.
        doc.justification=ParagraphJustification.LEFT_JUSTIFY;
        st.setValue(doc);

        removeFx("Transition Duration"); removeFx("Character Delay");
        removeFx("Distance"); removeFx("Direction"); removeFx("Slot Width");
        var anim=tp.property("ADBE Text Animators");
        for(var a=anim.numProperties;a>=1;a--)
            if(anim.property(a).name.indexOf("Marker Text Replace")===0) anim.property(a).remove();

        var delay=layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
        delay.name="Character Delay"; delay.property(1).setValue(0.06);

        var mp=layer.property("ADBE Marker");
        if(mp.numKeys===0){
            var duration=Math.max(layer.outPoint-layer.inPoint,comp.frameDuration*4);
            var step=Math.min(1,duration/3),safe=layer.outPoint-comp.frameDuration;
            var t1=Math.min(layer.inPoint+step,safe),t2=Math.min(layer.inPoint+step*2,safe);
            if(t2<=t1)t2=Math.min(t1+comp.frameDuration,safe);
            addMarker(t1,"MELHOR");addMarker(t2,"BARATO");
        }

        st.expression=
            'var base=value.toString(),m=marker,r=base;\n'+
            'if(m.numKeys>0&&time>=m.key(1).time){var n=m.nearestKey(time).index;if(m.key(n).time>time)n--;if(n>0){\n'+
            'var old=(n===1)?base:(m.key(n-1).comment+"");var neu=m.key(n).comment+"";\n'+
            'var dt=Math.max(effect("Character Delay")("Slider"),thisComp.frameDuration);var total=Math.max(old.length,neu.length);\n'+
            'var c=Math.max(0,Math.min(total,Math.floor((time-m.key(n).time)/dt)+1));\n'+
            'r=(c>=total)?neu:neu.substr(0,Math.min(c,neu.length))+old.substr(Math.min(c,old.length));}}r;';

        layer.enabled=true;
    }catch(e){alert("Marker Text Replace\n\nErro: "+e.toString());}
    finally{app.endUndoGroup();}
})();
