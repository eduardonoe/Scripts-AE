/* Stop Motion - Fraco | Controle global por Null */
(function(){
var N="Stop Motion Controller";
function getCtrl(c){var x=null;try{x=c.layer(N);}catch(e){}if(!x){x=c.layers.addNull();x.name=N;x.label=10;}return x;}
function slider(l,n,v){var f=l.property("ADBE Effect Parade"),s=f.property(n);if(!s){s=f.addProperty("ADBE Slider Control");s.name=n;}s.property(1).setValue(v);}
function check(l,n,v){var f=l.property("ADBE Effect Parade"),s=f.property(n);if(!s){s=f.addProperty("ADBE Checkbox Control");s.name=n;}s.property(1).setValue(v);}
function removeFx(l,n){var s=l.property("ADBE Effect Parade").property(n);if(s)s.remove();}
function set(p,e){if(p&&p.canSetExpression){p.expression=e;p.expressionEnabled=true;}}
var comp=app.project&&app.project.activeItem;if(!comp||!(comp instanceof CompItem)||!comp.selectedLayers.length){alert("Abra uma composicao e selecione pelo menos um layer.");return;}
app.beginUndoGroup("Stop Motion - Fraco");try{
var ls=[];for(var q=0;q<comp.selectedLayers.length;q++)ls.push(comp.selectedLayers[q]);var c=getCtrl(comp);
removeFx(c,"Spring Amount");removeFx(c,"Spring Frequency");removeFx(c,"Spring Decay");
slider(c,"Posterize FPS",12);slider(c,"Position Frequency",3);slider(c,"Position Amount",10);slider(c,"Rotation Frequency",3);slider(c,"Rotation Amount",1);
check(c,"Scale Spring Enabled",1);slider(c,"Scale Spring Amount",10);slider(c,"Scale Spring Frequency",3);slider(c,"Scale Spring Decay",6);
check(c,"Rotation Spring Enabled",1);slider(c,"Rotation Spring Amount",10);slider(c,"Rotation Spring Frequency",3);slider(c,"Rotation Spring Decay",6);
var h="var c=thisComp.layer(\""+N+"\");\nposterizeTime(Math.max(1,c.effect(\"Posterize FPS\")(1)));\n";
var pos=h+"wiggle(c.effect(\"Position Frequency\")(1),c.effect(\"Position Amount\")(1));";
var rot=h+[
"var base=wiggle(c.effect(\"Rotation Frequency\")(1),c.effect(\"Rotation Amount\")(1));",
"var on=c.effect(\"Rotation Spring Enabled\")(1);",
"var a=c.effect(\"Rotation Spring Amount\")(1)/100,f=c.effect(\"Rotation Spring Frequency\")(1),d=c.effect(\"Rotation Spring Decay\")(1);",
"var n=0;if(numKeys>0){n=nearestKey(time).index;if(key(n).time>time)n--;}",
"if(on&&n>0){var dt=time-key(n).time;var v=velocityAtTime(key(n).time-thisComp.frameDuration/10);if(dt>=0)base+(v*a*Math.sin(f*dt*2*Math.PI))/Math.exp(d*dt);else base;}else base;"
].join("\n");
var sc=h+[
"var base=value;",
"var on=c.effect(\"Scale Spring Enabled\")(1);",
"var a=c.effect(\"Scale Spring Amount\")(1)/100,f=c.effect(\"Scale Spring Frequency\")(1),d=c.effect(\"Scale Spring Decay\")(1);",
"var n=0;if(numKeys>0){n=nearestKey(time).index;if(key(n).time>time)n--;}",
"if(on&&n>0){var dt=time-key(n).time;var v=velocityAtTime(key(n).time-thisComp.frameDuration/10);if(dt>=0)base+(v*a*Math.sin(f*dt*2*Math.PI))/Math.exp(d*dt);else base;}else base;"
].join("\n");
for(var i=0;i<ls.length;i++){var l=ls[i];if(l===c)continue;var tr=l.property("ADBE Transform Group");if(!tr)continue;var p=tr.property("ADBE Position");if(p&&p.dimensionsSeparated){for(var j=0;j<(l.threeDLayer?3:2);j++)set(p.getSeparationFollower(j),pos);}else set(p,pos);set(tr.property("ADBE Scale"),sc);set(tr.property("ADBE Rotate Z"),rot);}c.selected=true;
}finally{app.endUndoGroup();}})();
