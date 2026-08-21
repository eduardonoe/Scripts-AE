(function () {
  "use strict";
  var state = { exact: [], based: [], current: null, variation: 0, dragging: null, compName: "", compTime: 0, activeName: "", saved: [], history: [] };
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var els = { cards: $("#cards"), scan: $("#scanBtn"), progress: $("#progress"), status: $("#status"), comp: $("#compName"), frameName: $("#currentFrameName"), hint: $("#captureHint"), exact: $("#exactGrid"), based: $("#basedGrid"), exactEmpty: $("#exactEmpty"), basedEmpty: $("#basedEmpty"), exactCount: $("#exactCount"), basedCount: $("#basedCount"), addExact: $("#addExactColor"), addBased: $("#addBasedColor"), pop: $("#popover"), popColor: $("#popoverColor"), popHex: $("#popoverHex"), popSource: $("#popoverSource"), toast: $("#toast"), name: $("#paletteName"), save: $("#savePaletteBtn"), savedList: $("#savedList"), libraryEmpty: $("#libraryEmpty"), savedBadge: $("#savedBadge"), historyPanel: $("#historyPanel"), historyList: $("#historyList"), historyCount: $("#historyCount"), historyEmpty: $("#historyEmpty"), settings: $("#settingsMenu"), settingsBtn: $("#settingsBtn") };
  var hostSource = null;

  function extensionPath() {
    var path = window.__adobe_cep__.getSystemPath("extension") || "";
    try { path = decodeURI(path); } catch (ignore) {}
    path = path.replace(/^file:\/\//i, "");
    if (/^\/[A-Za-z]:/.test(path)) path = path.substr(1);
    return path.replace(/\\/g, "/");
  }

  function getHostSource() {
    if (hostSource) return hostSource;
    if (!window.cep || !window.cep.fs) throw new Error("CEP file access is not available.");
    var result=window.cep.fs.readFile(extensionPath()+"/jsx/main.jsx");
    if(!result||result.err!==0||!result.data)throw new Error("Could not read the After Effects host script.");
    hostSource=result.data;
    return hostSource;
  }

  function evalHost(code, retries) {
    var remaining=typeof retries==="number"?retries:2;
    function attempt(){
      return new Promise(function (resolve, reject) {
        var source;
        try{source=getHostSource();}catch(readError){reject(readError);return;}
        window.__adobe_cep__.evalScript(source+"\n"+code, function (raw) {
          try { var data = JSON.parse(raw); data.ok ? resolve(data) : reject(new Error(data.error || "After Effects returned an error.")); }
          catch (e) {
            var detail=String(raw||"empty response").replace(/^\s+|\s+$/g,"").substr(0,160);
            reject(new Error("After Effects response error: " + detail));
          }
        });
      }).catch(function(error){
        var transient=/EvalScript|empty response|modal dialog|host script execution|response error/i.test(String(error&&error.message||error));
        if(!transient||remaining<=0)throw error;
        remaining--;
        return delay(120+Math.floor(Math.random()*180)).then(attempt);
      });
    }
    return attempt();
  }

  function escHost(value) { return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }
  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function rgbHex(rgb) { return "#" + rgb.map(function (v) { var h = clamp(v).toString(16).toUpperCase(); return h.length < 2 ? "0" + h : h; }).join(""); }
  function exactToDisplay(item) { return { rgb: item.rgb.map(function(v){return v * 255;}), source: item.source + (item.layer ? " · " + item.layer : "") }; }

  function setStatus(text, type) {
    els.status.className = "status" + (type ? " " + type : "");
    els.status.querySelector("p").textContent = text;
  }
  function busy(on) { els.scan.classList.toggle("busy", on); els.progress.classList.toggle("on", on); if (on) setStatus("Analyzing properties and pixels…", "busy"); }
  function toast(text) { els.toast.textContent = text; els.toast.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(function(){ els.toast.classList.remove("show"); }, 1500); }

  function render(type) {
    var list = state[type], grid = els[type], empty = type === "exact" ? els.exactEmpty : els.basedEmpty;
    grid.innerHTML = ""; empty.hidden = list.length > 0;
    (type === "exact" ? els.exactCount : els.basedCount).textContent = list.length;
    list.forEach(function (item, i) {
      var hex = rgbHex(item.rgb), button = document.createElement("button");
      button.className = "swatch" + ((item.rgb[0] * .299 + item.rgb[1] * .587 + item.rgb[2] * .114) > 180 ? " light" : ""); button.style.background = hex; button.style.setProperty("--i", i); button.dataset.short = hex; button.title = hex + " — " + item.source + "\nClick: Fill · Shift-click: Tint · Right-click: Copy HEX · Shift-right-click: Details";
      button.addEventListener("click", function(e){ if(e.shiftKey)applyEffect(hex,"tint");else applyEffect(hex,"fill"); });
      button.addEventListener("contextmenu", function(e){ e.preventDefault(); if(e.shiftKey)openPopover(button,item,hex);else copy(hex); });
      grid.appendChild(button);
    });
  }

  function copy(hex) {
    var input = document.createElement("textarea"); input.value = hex; document.body.appendChild(input); input.select();
    try { document.execCommand("copy"); toast(hex + " copied"); } catch(e) { toast(hex); }
    document.body.removeChild(input);
  }
  function addManualColor(type,hex) {
    var clean=String(hex||"").replace("#","");
    if(!/^[0-9a-fA-F]{6}$/.test(clean)){toast("Invalid color");return;}
    var rgb=[parseInt(clean.substr(0,2),16),parseInt(clean.substr(2,2),16),parseInt(clean.substr(4,2),16)];
    if(state[type].some(function(item){return distance(item.rgb,rgb)<1;})){toast("Color already in palette");return;}
    state[type].push({rgb:rgb,source:type==="exact"?"Manually added exact color":"Manually added derived color"});
    render(type);persistActive();els.save.disabled=false;toast("Color added");
  }
  function pickColor(type) {
    setStatus("Choose a color with the After Effects picker…", "busy");
    evalHost("SwatchColors.pickColor()").then(function(result){
      addManualColor(type,result.hex);
      setStatus("Color added to " + (type==="exact"?"Exact Colors":"Derived Palette"));
    }).catch(function(error){setStatus(error.message,"error");toast(error.message);});
  }
  function applyEffect(hex,mode) {
    var label=mode==="tint"?"Tint":"Fill";
    setStatus("Applying " + label + " " + hex + "…", "busy");
    evalHost("SwatchColors.applyEffectColor('" + escHost(hex) + "','" + mode + "')").then(function(r){ var message=r.created?label+" added on a new adjustment layer":label+" applied to "+r.changed+" layer(s)";setStatus(message);toast(label+" · "+hex); }).catch(function(e){ setStatus(e.message, "error"); toast(e.message); });
  }
  function openPopover(anchor, item, hex) {
    state.current = { item:item, hex:hex }; els.popColor.style.background = hex; els.popHex.textContent = hex; els.popSource.textContent = item.source || "Derived palette"; els.pop.hidden = false;
    var r = anchor.getBoundingClientRect(), w = 270; els.pop.style.left = Math.max(7, Math.min(innerWidth - w - 7, r.left)) + "px"; els.pop.style.top = Math.min(innerHeight - 58, r.bottom + 6) + "px";
  }

  function paletteFromSamples(samples, count) {
    var bins={},points=[],i;
    for(i=0;i<samples.length;i++){
      if(samples[i].length>3&&samples[i][3]<.05)continue;
      var rgb=[clamp(samples[i][0]*255),clamp(samples[i][1]*255),clamp(samples[i][2]*255)];
      var key=Math.floor(rgb[0]/12)+","+Math.floor(rgb[1]/12)+","+Math.floor(rgb[2]/12),bin=bins[key];
      if(!bin)bin=bins[key]={rgb:[0,0,0],weight:0};
      bin.rgb[0]+=rgb[0];bin.rgb[1]+=rgb[1];bin.rgb[2]+=rgb[2];bin.weight++;
    }
    Object.keys(bins).forEach(function(key){var bin=bins[key];bin.rgb=[bin.rgb[0]/bin.weight,bin.rgb[1]/bin.weight,bin.rgb[2]/bin.weight];points.push(bin);});
    if(count<=0||!points.length)return[];
    count=Math.min(count,points.length);
    points.sort(function(a,b){return b.weight-a.weight;});
    var cent=[points[0].rgb.slice()];
    while(cent.length<count){
      var next=null,nextScore=-1;
      points.forEach(function(point){var nearest=Infinity;cent.forEach(function(center){nearest=Math.min(nearest,distanceSquared(point.rgb,center));});var hsl=rgbToHsl(point.rgb),score=nearest*Math.sqrt(point.weight)*(1+hsl[1]*.35);if(score>nextScore){nextScore=score;next=point;}});
      cent.push(next.rgb.slice());
    }
    var assign=new Array(points.length),rounds=10;
    while(rounds--){
      var sums=[];for(i=0;i<count;i++)sums.push([0,0,0,0]);
      points.forEach(function(point,p){var best=0,bestDistance=Infinity;for(var c=0;c<count;c++){var d=distanceSquared(point.rgb,cent[c]);if(d<bestDistance){bestDistance=d;best=c;}}assign[p]=best;sums[best][0]+=point.rgb[0]*point.weight;sums[best][1]+=point.rgb[1]*point.weight;sums[best][2]+=point.rgb[2]*point.weight;sums[best][3]+=point.weight;});
      for(i=0;i<count;i++)if(sums[i][3])cent[i]=[sums[i][0]/sums[i][3],sums[i][1]/sums[i][3],sums[i][2]/sums[i][3]];
    }
    var clusters=[];for(i=0;i<count;i++)clusters.push({center:cent[i],weight:0,members:[]});
    points.forEach(function(point,p){clusters[assign[p]].weight+=point.weight;clusters[assign[p]].members.push(point);});
    return clusters.filter(function(cluster){return cluster.weight>0;}).map(function(cluster){
      var representative=null,bestScore=Infinity;
      cluster.members.forEach(function(point){var saturation=rgbToHsl(point.rgb)[1],score=distanceSquared(point.rgb,cluster.center)/(1+saturation*.45);if(score<bestScore){bestScore=score;representative=point.rgb;}});
      return{rgb:representative.slice(),source:"Dominant sampled color · rendered frame",weight:cluster.weight};
    }).sort(function(a,b){return b.weight-a.weight;}).filter(function(color,index,list){return list.every(function(other,j){return j>=index||distance(color.rgb,other.rgb)>22;});}).slice(0,count);
  }
  function distanceSquared(a,b){var x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return x*x+y*y+z*z;}
  function distance(a,b){var x=a[0]-b[0],y=a[1]-b[1],z=a[2]-b[2];return Math.sqrt(x*x+y*y+z*z);}
  function delay(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}

  function scan() {
    var pending=null,scanData=null,samples=[];busy(true); els.scan.querySelector("span:last-child").textContent="Analyzing…";
    delay(70).then(function(){return evalHost("SwatchColors.scanExact()",4);}).then(function(data){
      scanData=data;
      var chain=Promise.resolve(),cols=20,rows=12,batchSize=16;
      for(var start=0;start<cols*rows;start+=batchSize)(function(batchStart){
        chain=chain.then(function(){return evalHost("SwatchColors.sampleBatch("+batchStart+","+batchSize+","+cols+","+rows+")",4);}).then(function(batch){
          if(batch.comp!==scanData.comp)throw new Error("The active composition changed during analysis.");
          samples=samples.concat(batch.samples||[]);
        });
      })(start);
      return chain.then(function(){data.samples=samples;return data;});
    }).then(function(data){
      var propertyExact=data.exact.map(exactToDisplay);
      pending={name:data.comp,comp:data.comp,time:data.time,exact:propertyExact.slice(0,64),based:[]};
      pending.based=paletteFromSamples(data.samples||[],12).filter(function(color){return !pending.exact.some(function(exact){return distance(color.rgb,exact.rgb)<=10;});});activatePalette(pending,true);els.name.value=pending.name;
      setStatus((state.exact.length+state.based.length)+" colors found");toast("Palettes created");
    })
      .catch(function(e){setStatus(e.message,"error");toast(e.message);}).then(function(){busy(false);els.scan.querySelector("span:last-child").textContent="Read composition";});
  }

  function rgbToHsl(rgb){var r=rgb[0]/255,g=rgb[1]/255,b=rgb[2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2,d=max-min;if(d){s=l>.5?d/(2-max-min):d/(max+min);if(max===r)h=(g-b)/d+(g<b?6:0);else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h/=6;}return[h,s,l];}
  function hslToRgb(hsl){var h=hsl[0],s=hsl[1],l=hsl[2],r,g,b;if(!s)r=g=b=l;else{var q=l<.5?l*(1+s):l+s-l*s,p=2*l-q,f=function(t){if(t<0)t++;if(t>1)t--;if(t<1/6)return p+(q-p)*6*t;if(t<.5)return q;if(t<2/3)return p+(q-p)*(2/3-t)*6;return p;};r=f(h+1/3);g=f(h);b=f(h-1/3);}return[r*255,g*255,b*255];}
  function variations(){if(!state.based.length){toast("Read a composition first");return;}state.variation=(state.variation+1)%3;var labels=["Balanced","Vibrant","Soft"],mode=state.variation;$("#variationLabel").textContent=labels[mode];state.based=state.based.map(function(x,i){var h=rgbToHsl(x.rgb);if(mode===0){h[0]=(h[0]+(i%2?-.035:.035)+1)%1;h[1]=Math.min(1,h[1]*1.08);}else if(mode===1){h[1]=Math.min(1,h[1]*1.4+.08);h[2]=Math.max(.12,Math.min(.82,h[2]+(i%2?-.05:.05)));}else{h[1]*=.68;h[2]=h[2]*.82+.09;}return{rgb:hslToRgb(h),source:labels[mode]+" variation"};});render("based");persistActive();toast(labels[mode]+" variation");}

  function setupCards(){
    var saved;
    try{saved=JSON.parse(localStorage.getItem("swatchCards")||"{}");}catch(e){saved={};}
    if(saved.order){
      var order=saved.order.slice ? saved.order.slice(0) : [];
      if(order.indexOf("capture")<0&&order.indexOf("memory")<0)order=["capture"].concat(order).concat(["memory"]);
      ["capture","exact","based","memory"].forEach(function(id){if(order.indexOf(id)<0)order.push(id);});
      order.forEach(function(id){var el=$("#cards > [data-card='"+id+"']");if(el)els.cards.appendChild(el);});
    }
    $$("#cards > .color-card").forEach(function(card){
      var head=card.querySelector(".card-header"),body=card.querySelector(".card-body"),grip=card.querySelector(".drag-grip");
      if(saved.collapsed&&saved.collapsed.indexOf(card.dataset.card)>-1){card.classList.add("collapsed");body.style.height="0px";head.setAttribute("aria-expanded","false");}
      head.addEventListener("click",function(){toggleCard(card);});
      grip.addEventListener("pointerdown",function(e){if(e.button!==0)return;e.preventDefault();e.stopPropagation();startDrag(card,e);});
    });
  }
  function toggleCard(card){
    var body=card.querySelector(".card-body"),head=card.querySelector(".card-header"),opening=card.classList.contains("collapsed"),startHeight=body.getBoundingClientRect().height;
    body.style.height=startHeight+"px";body.getBoundingClientRect();
    if(opening){
      card.classList.remove("collapsed");head.setAttribute("aria-expanded","true");body.style.height="0px";body.getBoundingClientRect();
      requestAnimationFrame(function(){body.style.height=body.scrollHeight+"px";});
    }else{
      card.classList.add("collapsed");head.setAttribute("aria-expanded","false");requestAnimationFrame(function(){body.style.height="0px";});
    }
    var finish=function(e){if(e.propertyName!=="height")return;body.removeEventListener("transitionend",finish);if(opening)body.style.height="auto";};
    body.addEventListener("transitionend",finish);saveCards();
  }
  function startDrag(card,e){var r=card.getBoundingClientRect(),clone=card.cloneNode(true);state.dragging={card:card,clone:clone,oy:e.clientY-r.top};clone.classList.add("drag-clone");clone.style.width=r.width+"px";clone.style.left=r.left+"px";clone.style.top=r.top+"px";document.body.appendChild(clone);card.classList.add("drag-source");window.addEventListener("pointermove",dragMove);window.addEventListener("pointerup",dragEnd);}
  function dragMove(e){if(!state.dragging)return;state.dragging.clone.style.top=(e.clientY-state.dragging.oy)+"px";var card=state.dragging.card;$$("#cards > .color-card").forEach(function(other){if(other===card)return;var r=other.getBoundingClientRect();if(e.clientY>r.top&&e.clientY<r.bottom){if(e.clientY<r.top+r.height/2)els.cards.insertBefore(card,other);else els.cards.insertBefore(card,other.nextSibling);}});}
  function dragEnd(){var d=state.dragging;if(!d)return;if(d.clone.parentNode)d.clone.parentNode.removeChild(d.clone);d.card.classList.remove("drag-source");d.card.classList.add("drop-pop");setTimeout(function(){d.card.classList.remove("drop-pop");},390);state.dragging=null;window.removeEventListener("pointermove",dragMove);window.removeEventListener("pointerup",dragEnd);saveCards();}
  function saveCards(){localStorage.setItem("swatchCards",JSON.stringify({order:$$("#cards > .color-card").map(function(x){return x.dataset.card;}),collapsed:$$("#cards > .color-card.collapsed").map(function(x){return x.dataset.card;})}));}

  function snapshot(){return{ name:state.activeName||state.compName||"Untitled palette",comp:state.compName,time:state.compTime,exact:state.exact,based:state.based,stamp:(new Date()).toISOString() };}
  function paletteKey(item){return (item.comp||"")+"|"+(item.time||0)+"|"+(item.exact||[]).concat(item.based||[]).map(function(c){return rgbHex(c.rgb);}).join(",");}
  function persistActive(){
    if(state.exact.length||state.based.length)localStorage.setItem("swatchColorActive",JSON.stringify(snapshot()));
    localStorage.setItem("swatchColorHistory",JSON.stringify(state.history.slice(0,2)));
    renderHistory();
  }
  function activatePalette(item,addPrevious){
    var previous=(state.exact.length||state.based.length)?snapshot():null,incomingKey=paletteKey(item);
    if(addPrevious&&previous&&paletteKey(previous)!==incomingKey){state.history=state.history.filter(function(old){return paletteKey(old)!==paletteKey(previous)&&paletteKey(old)!==incomingKey;});state.history.unshift(previous);state.history=state.history.slice(0,2);}
    state.exact=item.exact||[];state.based=item.based||[];state.compName=item.comp||item.name||"";state.compTime=item.time||0;state.activeName=item.name||state.compName||"Untitled palette";
    els.comp.textContent=item.fromLibrary?("Palette: "+state.activeName):state.compName;els.frameName.textContent=item.fromLibrary?state.activeName:(state.compName||"Active composition");els.hint.textContent=item.fromLibrary?(item.comp?("Saved from "+item.comp):"Saved palette"):("Frame at "+Number(state.compTime).toFixed(2)+"s");els.save.disabled=false;render("exact");render("based");persistActive();
  }
  function restoreMemory(){
    try{state.history=JSON.parse(localStorage.getItem("swatchColorHistory")||"[]");if(!Array.isArray(state.history))state.history=[];state.history=state.history.slice(0,2);}catch(e){state.history=[];}
    try{var active=JSON.parse(localStorage.getItem("swatchColorActive")||"null");if(active&&(active.exact||active.based)){activatePalette(active,false);els.name.value=active.name||active.comp||"";setStatus((state.exact.length+state.based.length)+" colors restored");}}catch(ignore){}
    renderHistory();
  }
  function renderHistory(){
    els.historyList.innerHTML="";els.historyPanel.hidden=!state.history.length;els.historyEmpty.hidden=state.history.length>0;els.historyCount.textContent=state.history.length;
    state.history.slice(0,2).forEach(function(item,index){var button=document.createElement("button"),preview=document.createElement("span"),title=document.createElement("b"),meta=document.createElement("small");button.className="history-item";preview.className="history-preview";title.textContent=item.name||item.comp||("Palette "+(index+1));meta.textContent=(item.exact.length+item.based.length)+" colors";item.exact.concat(item.based).slice(0,8).forEach(function(color){var chip=document.createElement("i");chip.style.background=rgbHex(color.rgb);preview.appendChild(chip);});button.appendChild(preview);button.appendChild(title);button.appendChild(meta);button.addEventListener("click",function(){activatePalette(item,true);els.name.value=item.name||item.comp||"";setStatus((state.exact.length+state.based.length)+" colors restored from history");toast("Recent palette restored");});els.historyList.appendChild(button);});
  }

  function readLibrary(){
    try { state.saved=JSON.parse(localStorage.getItem("swatchColorLibrary")||"[]"); if(!Array.isArray(state.saved))state.saved=[]; }
    catch(e){state.saved=[];}
    renderLibrary();
  }
  function writeLibrary(){localStorage.setItem("swatchColorLibrary",JSON.stringify(state.saved));renderLibrary();}
  function savePalette(){
    var name=els.name.value.replace(/^\s+|\s+$/g,"");
    if(!name){toast("Enter a palette name");els.name.focus();return;}
    if(!state.exact.length&&!state.based.length){toast("Read a composition first");return;}
    var item={id:String(Date.now()),name:name,comp:state.compName,time:state.compTime,created:(new Date()).toISOString(),exact:state.exact,based:state.based};
    var replaced=false;
    state.saved=state.saved.map(function(old){if(old.name.toLowerCase()===name.toLowerCase()){item.id=old.id;replaced=true;return item;}return old;});
    if(!replaced)state.saved.unshift(item);writeLibrary();toast(replaced?"Palette updated":"Palette saved");
  }
  function renderLibrary(){
    els.savedList.innerHTML="";els.savedBadge.textContent=state.saved.length;els.libraryEmpty.hidden=state.saved.length>0;
    state.saved.forEach(function(item){
      var card=document.createElement("article"),head=document.createElement("div"),info=document.createElement("div"),title=document.createElement("b"),meta=document.createElement("small"),load=document.createElement("button"),del=document.createElement("button"),preview=document.createElement("div");
      card.className="saved-palette";head.className="saved-head";preview.className="saved-preview";title.textContent=item.name;meta.textContent=(item.exact.length+item.based.length)+" colors"+(item.comp?" · "+item.comp:"");load.className="load-btn";load.textContent="Load";del.className="delete-btn";del.textContent="×";del.title="Delete palette";info.appendChild(title);info.appendChild(meta);head.appendChild(info);head.appendChild(load);head.appendChild(del);card.appendChild(head);
      item.exact.concat(item.based).slice(0,20).forEach(function(color){var chip=document.createElement("i");chip.style.background=rgbHex(color.rgb);preview.appendChild(chip);});card.appendChild(preview);els.savedList.appendChild(card);
      load.addEventListener("click",function(){loadPalette(item);});del.addEventListener("click",function(){deletePalette(item.id);});
    });
  }
  function loadPalette(item){
    var loaded={name:item.name,comp:item.comp,time:item.time,exact:item.exact,based:item.based,fromLibrary:true};activatePalette(loaded,true);els.name.value=item.name;switchView("composition");setStatus((state.exact.length+state.based.length)+" colors loaded");toast("Palette loaded");
  }
  function deletePalette(id){if(!window.confirm("Delete this saved palette?"))return;state.saved=state.saved.filter(function(item){return item.id!==id;});writeLibrary();toast("Palette deleted");}
  function switchView(view){$$(".view-tab").forEach(function(tab){tab.classList.toggle("active",tab.dataset.view===view);});$("#compositionView").classList.toggle("active",view==="composition");$("#libraryView").classList.toggle("active",view==="library");if(view==="library")renderLibrary();}

  function setUiSize(size){
    if(["compact","standard","large"].indexOf(size)<0)size="compact";
    document.body.setAttribute("data-ui-size",size);localStorage.setItem("swatchUiSize",size);
    $$("[data-ui-size]").forEach(function(button){button.classList.toggle("active",button.getAttribute("data-ui-size")===size);});
  }

  function setSkin(skin){
    var skins=["violet","midnight-indigo","graphite","minimal-flat","adobe-native","cyber-slate"];
    if(skins.indexOf(skin)<0)skin="violet";
    document.body.setAttribute("data-skin",skin);localStorage.setItem("swatchSkin",skin);
    $$("[data-skin-option]").forEach(function(button){button.classList.toggle("active",button.getAttribute("data-skin-option")===skin);});
  }

  els.scan.addEventListener("click",scan);els.save.addEventListener("click",savePalette);els.addExact.addEventListener("click",function(){pickColor("exact");});els.addBased.addEventListener("click",function(){pickColor("based");});els.name.addEventListener("keydown",function(e){if(e.keyCode===13&&!els.save.disabled)savePalette();});$$(".view-tab").forEach(function(tab){tab.addEventListener("click",function(){switchView(tab.dataset.view);});});$("#variationBtn").addEventListener("click",variations);$("#variationMode").addEventListener("click",variations);$("#copyBtn").addEventListener("click",function(){if(state.current)copy(state.current.hex);});$("#applyBtn").addEventListener("click",function(){if(state.current)applyEffect(state.current.hex,"fill");});els.settingsBtn.addEventListener("click",function(e){e.stopPropagation();els.settings.hidden=!els.settings.hidden;});$$("[data-ui-size]").forEach(function(button){button.addEventListener("click",function(){setUiSize(button.getAttribute("data-ui-size"));});});$$("[data-skin-option]").forEach(function(button){button.addEventListener("click",function(){setSkin(button.getAttribute("data-skin-option"));});});document.addEventListener("pointerdown",function(e){if(!els.pop.hidden&&!e.target.closest("#popover")&&!e.target.closest(".swatch"))els.pop.hidden=true;if(!els.settings.hidden&&!e.target.closest("#settingsMenu")&&!e.target.closest("#settingsBtn"))els.settings.hidden=true;});setUiSize(localStorage.getItem("swatchUiSize")||"compact");setSkin(localStorage.getItem("swatchSkin")||"violet");setupCards();readLibrary();restoreMemory();render("exact");render("based");
  if(window.__SWATCH_COLORS_TEST__)window.__swatchColorsInternals={paletteFromSamples:paletteFromSamples};
}());
