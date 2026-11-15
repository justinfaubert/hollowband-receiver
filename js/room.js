/* Hollowband Receiver — the room.
   Top Room, 9 Lantern Row. It was A. Pruitt's. You are his relief.
   The window, the lamp, the kettle, the clock, the door and what comes through it, the logbook,
   and Formal, who came with the room and cannot be lied to. */
(function(){
"use strict";
const HB=window.HB, A=HB.sound, RD=HB.radio, K=HB.sky, CD=window.HB_CARDS, D=window.HB_SCRIPT;
const $=id=>document.getElementById(id);
const app=$("app"), room=$("room"), stage=$("stage"), radioEl=$("radio"), cap=$("caption"), winsky=$("winsky");
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const now=()=>Date.now();
const later=(fn,ms)=>setTimeout(fn,ms);
const show=(el,on)=>{if(on) el.removeAttribute("hidden"); else el.setAttribute("hidden","");};
const fmt=n=>Math.round(n).toLocaleString("en-US");
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const clockStr=()=>{const d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");};

const RKEY="hollowband-room";
const R={lamp:true,open:false,boiled:false,cards:{},mat:[],noteRead:false,lampFailed:false,log:[],used:{},peeks:0};
try{Object.assign(R,JSON.parse(localStorage.getItem(RKEY)||"{}"));}catch(_){}
const saveR=()=>{try{localStorage.setItem(RKEY,JSON.stringify(R));}catch(_){}};
HB.room={state:R};
HB.weather={rain:0,fog:0,wind:0.3};
const W={rainUntil:0,fogUntil:0};

/* ================= sitting at the set, leaning back from it ================= */
function setView(v){
  HB.view=v;app.dataset.view=v;
  try{room.inert=v!=="room";radioEl.inert=v!=="set";}catch(_){}
  A.setDistance(v==="room");
  if(v==="set"){RD.redraw();later(()=>RD.measure(),720);}
}
$("set").addEventListener("click",()=>{used("set");setView("set");});
$("leanback").addEventListener("click",()=>setView("room"));

/* ================= what is said, written under the picture ================= */
let capT=0;
function caption(text,cls,ms){
  cap.textContent=text;cap.className="caption on "+(cls||"");
  clearTimeout(capT);capT=later(()=>cap.classList.remove("on"),Math.max(2400,ms||3600));
}
function cue(text,ghost){caption(text,"cue"+(ghost?" ghost":""),4400);RD.addLine("cue"+(ghost?" ghost":""),text);}
function used(id){
  const el=$(id);if(el) el.classList.add("used");
  if(!R.used[id]){R.used[id]=1;saveR();}
}

/* ================= light ================= */
function light(){
  const dead=RD.deadMode(), S=RD.S;
  room.classList.toggle("room-dead",dead);
  room.classList.toggle("room-him",!!S.letIn);
  stage.style.setProperty("--lampA",R.lamp&&!dead?"1":"0");
  stage.style.setProperty("--dialA",RD.power?"1":"0");
  stage.style.setProperty("--dark",R.lamp?"#323d63":"#272f55");
  $("lamp").setAttribute("aria-pressed",String(R.lamp));
  $("win").setAttribute("aria-pressed",String(R.open));
  show($("coat"),!!S.letIn);
  $("tides").classList.toggle("blank",S.phase>=1&&!S.returned);
  ambience();
}
function ambience(){
  const S=RD.S, dead=RD.deadMode(), cur=RD.current;
  A.ambience({power:RD.power,lamp:R.lamp&&!dead,rain:HB.weather.rain,wind:HB.weather.wind,
    him:S.letIn?1:(RD.replaced()&&cur&&cur.listener?0.5:0),sea:!(S.phase>=1&&!S.returned),dead:dead});
  A.setWindow(R.open);
}
$("lamp").addEventListener("click",()=>{
  used("lamp");R.lamp=!R.lamp;saveR();A.room.lamp();RD.buzz(6);light();G.stir=now();
});
/* late in the night it goes out by itself, once. You were told to keep it on. */
function lampFails(){
  const S=RD.S;
  if(!R.lamp||R.lampFailed||S.phase<2||S.returned||RD.deadMode()) return;
  R.lampFailed=true;
  [0,90,170,300,360].forEach((t,i)=>later(()=>stage.style.setProperty("--lampA",i%2?"1":"0"),t));
  later(()=>{R.lamp=false;saveR();A.room.lamp();light();cue("(the lamp goes out)");later(()=>honk(0.9,0.95),700);},480);
}
$("win").addEventListener("click",()=>{
  used("win");R.open=!R.open;saveR();light();
  if(R.open&&!R.used.winsaid){R.used.winsaid=1;saveR();cue("(the window is open. The bay is louder than it looks.)");}
});

/* ================= weather. The forecast is never wrong, because it goes first. ================= */
const rain=sec=>{W.rainUntil=now()+sec*1000;};
const fog=sec=>{W.fogUntil=now()+sec*1000;};

/* ================= Formal ================= */
const G={el:$("goose"),eyes:$("eyes"),where:"bed",pose:"sleep",busy:0,hold:0,moonUntil:0,feedUntil:0,stir:0,x:1};
const SPOT={bed:1,mid:25,door:41,desk:12,feed:2};
function pose(p,holdMs){G.pose=p;G.el.dataset.pose=p;G.el.classList.toggle("peck",p==="peck");if(holdMs) G.hold=now()+holdMs;}
function honk(v,p){
  if(G.where==="under") return;
  G.el.classList.add("honk");A.room.honk(v,p);later(()=>G.el.classList.remove("honk"),380);
}
function want(){
  const S=RD.S, cur=RD.current, t=now();
  if(RD.deadMode()) return {where:"bed",pose:"sit",front:true};
  if(S.letIn) return {where:"under"};
  if(RD.replaced()&&cur&&cur.listener) return {where:"mid",pose:"hiss"};
  if(t<G.feedUntil) return {where:"feed",pose:"peck"};
  if(t<G.moonUntil) return {where:"mid",pose:"up"};
  if(R.mat.length) return {where:"door",pose:"peer"};
  if(RD.power) return {where:"bed",pose:cur?"listen":"sit"};
  if(R.lamp&&t-G.stir<45000) return {where:"bed",pose:"sit"};
  return {where:"bed",pose:"sleep"};
}
function walk(to,done){
  const d=Math.abs(to-G.x), ms=d*95+300;
  if(d<0.5){done();return;}
  pose("alert");G.el.classList.add("walk");G.el.classList.toggle("left",to<G.x);G.el.classList.remove("front");
  G.el.style.transition="left "+ms+"ms linear";G.el.style.left=to+"%";G.x=to;G.busy=now()+ms+150;
  const pats=setInterval(()=>{if(HB.view==="room") A.room.pat(0.7);},280);
  later(()=>{clearInterval(pats);G.el.classList.remove("walk","left");done();},ms);
}
function go(w){
  if(w.where==="under"){
    walk(SPOT.desk,()=>{show(G.el,false);show(G.eyes,true);G.where="under";});
    return;
  }
  if(G.where==="under"){
    show(G.eyes,false);show(G.el,true);G.x=SPOT.desk;
    G.el.style.transition="none";G.el.style.left=G.x+"%";void G.el.offsetWidth;
  }
  walk(SPOT[w.where],()=>{G.where=w.where;pose(w.pose);G.el.classList.toggle("front",!!w.front);});
}
function gooseTick(){
  const t=now();
  if(t<G.busy) return;
  const w=want();
  if(w.where!==G.where){G.busy=t+300;go(w);return;}
  if(G.where==="under") return;
  if(t>G.hold&&w.pose&&w.pose!==G.pose){pose(w.pose);G.el.classList.toggle("front",!!w.front);}
  else if(t>G.hold&&!w.front&&(G.pose==="sit"||G.pose==="listen")&&Math.random()<0.004) pose("preen",1800+Math.random()*1400);
  if(G.pose==="hiss"&&HB.view==="room"&&Math.random()<0.02) A.room.hiss();
  if(G.pose==="peck"&&G.where==="feed"&&HB.view==="room"&&Math.random()<0.25) A.room.peck();
}
G.el.addEventListener("click",()=>{
  used("goose");G.stir=now();RD.buzz(8);
  if(G.pose==="hiss"){A.room.hiss();caption("(she is not taking her eyes off the set)","cue");return;}
  if(now()<G.busy) return;
  A.room.murmur();
  const line=formalLine();if(line) caption(line,"cue",3600);
  if(G.pose==="sleep") pose("sit",4000);
  else{G.el.classList.add("front");G.hold=now()+1800;later(()=>{if(!RD.deadMode()) G.el.classList.remove("front");},1700);}
});
/* she came with the room. Pruitt: "Don't call her Ordinary, she can tell." */
function formalLine(){
  const S=RD.S, n=(G.pats=(G.pats||0)+1), any=a=>a[Math.floor(Math.random()*a.length)];
  if(RD.deadMode()) return "(she looks straight at you. She has never done that before.)";
  if(S.phase>=2&&!S.returned) return any(["(she is watching the door)","(she will not settle)","(she leans against your leg, and keeps her eyes on the set)"]);
  if(S.phase>=1&&!S.returned) return "(she keeps looking at the window)";
  if(n===1) return G.pose==="sleep"?"(she wakes, and looks at you as though you owe her something)":"(Formal regards you, then the set, then you again)";
  return n%3===0?any(["(she would like it known that she was here first)","(she is not Ordinary, and she can tell when you think it)","(she allows it)"]):null;
}
G.eyes.addEventListener("click",()=>{caption("(she will not come out)","cue");});

/* ================= the kettle ================= */
let kettle="cold", kT=0;
function kettleSet(s){
  kettle=s;
  stage.classList.toggle("is-heat",s==="heating"||s==="whistling");
  stage.classList.toggle("is-steam",s==="whistling"||s==="hot");
  $("kettle").classList.toggle("whistle",s==="whistling");
}
function boil(){
  const cur=RD.current;let m=cur&&cur.scale?cur.scale[0]:69;
  while(m<79) m+=12;
  A.room.kettle.whistle(m);kettleSet("whistling");R.boiled=true;saveR();
  later(()=>{if(kettle==="whistling"&&G.where!=="under") honk(0.7,1.12);},6000);
  kT=later(()=>{if(kettle==="whistling"){A.room.kettle.stop();kettleSet("hot");caption("(the kettle gives up on you)","cue");kT=later(()=>kettleSet("cold"),180000);}},30000);
  /* "Next bulletin at six, or when the kettle has boiled, whichever is later." */
  if(cur&&cur.id==="coast") RD.skipQuiet();
  if(G.where!=="under"&&G.pose==="sleep") pose("sit",5000);
}
$("kettle").addEventListener("click",()=>{
  used("kettle");RD.buzz(6);clearTimeout(kT);
  if(kettle==="cold"){kettleSet("heating");A.room.kettle.start();kT=later(boil,38000);}
  else if(kettle==="heating"){A.room.kettle.stop(true);kettleSet("cold");}
  else if(kettle==="whistling"){A.room.kettle.stop();kettleSet("hot");kT=later(()=>kettleSet("cold"),180000);}
  else caption("(still warm)","cue");
});

/* ================= Pruitt's desk ================= */
function drawer(id,ms){const el=$(id);el.classList.add("open");A.room.drawer(true);later(()=>{el.classList.remove("open");A.room.drawer(false);},ms||1800);}
$("dr1").addEventListener("click",()=>{
  used("dr1");drawer("dr1",2400);
  if(RD.deadMode()){caption("(the drawer is empty. It is very clean.)","cue ghost");return;}
  caption("(a torch, two valves wrapped in newspaper, and a list in Pruitt's hand)","cue",4200);
  const p=document.createElement("div");p.className="paper";
  CD.owls.forEach((l,i)=>{const e=document.createElement("p");if(i===0) e.className="ttl";e.textContent=l;p.appendChild(e);});
  later(()=>{openViewer(p,[key("Put it back",closeViewer)]);A.room.flip();},450);
});
$("dr2").addEventListener("click",()=>{used("dr2");drawer("dr2",2600);feed();});
$("dr3").addEventListener("click",()=>{
  used("dr3");
  if(!RD.deadMode()){A.room.rattle();RD.buzz([10,40,10]);caption("(the bottom drawer is stuck)","cue");return;}
  drawer("dr3",2800);later(()=>openThing(CD.things.photo),450);
});
/* "One scoop. She will say two." */
function feed(){
  const t=now();
  if(RD.deadMode()){caption("(a tin of grain. It is full. It has always been full.)","cue ghost");return;}
  const first=!R.tinSeen;R.tinSeen=1;saveR();
  const say=(s)=>later(()=>caption(s,"cue",3600),first?5000:0);
  if(first) caption("(a tin of grain. On the lid, in Pruitt's hand: FORMAL. ONE SCOOP. SHE WILL SAY TWO.)","cue",4800);
  if(G.where==="under"){say("(she will not come out. Not even for this.)");return;}
  if(G.pose==="hiss"){say("(she will not take her eyes off the set)");return;}
  if(t-(R.fed||0)<240000){say("(she has had hers. She would like yours.)");later(()=>honk(0.5,1.1),first?5200:300);return;}
  R.fed=t;R.feeds=(R.feeds||0)+1;saveR();
  A.room.grain();show($("grainpile"),true);
  G.feedUntil=t+9500;G.busy=0;G.stir=t;
  later(()=>{if(G.where==="feed"){honk(0.8,1);later(()=>honk(0.8,1.06),420);later(()=>caption("(two)","cue",2600),900);}},8400);
  later(()=>show($("grainpile"),false),26000);
}
$("clocktap").addEventListener("click",()=>{
  used("clocktap");
  const d=new Date();
  if(RD.deadMode()) caption("(the clock is going the other way. It seems happier.)","cue ghost");
  else if(HB.mood()==="wrong") caption("(the clock says "+clockStr()+". It said that a moment ago, as well.)","cue",4400);
  else caption("(the clock says "+clockStr()+". The Bureau would call it about "+D.timeWords(d.getHours(),d.getMinutes())+".)","cue",4400);
});

/* ================= the door, and what comes through it ================= */
const queued=new Set(), mailQ=[];
let delivering=false, nextMailAt=now()+25000;
function sinpo(st){
  if(st.dead) return "00000";
  if(st.listener&&RD.replaced()) return "55555";
  const c=RD.clarity(), r=()=>3+Math.floor(Math.random()*3), a=[clamp(Math.round(3+2*c),1,5),4+Math.floor(Math.random()*2),r(),r()];
  return a.join("")+Math.min.apply(null,a);
}
function byId(id){return RD.LIVING.concat(RD.DEAD).find(s=>s.id===id)||(id==="double"?RD.LISTENER:null);}
function info(id){
  const st=byId(id), d=new Date(), l=R.log.find(x=>x.id===id||(id==="double"&&x.id==="engineer"));
  return {freq:st?fmt(st.f):"",time:D.timeWords(d.getHours(),d.getMinutes()),date:d.getDate()+" "+MONTHS[d.getMonth()],day:D.slots.weekday[d.getDay()],sinpo:id==="double"?"55555":(l&&l.sinpo)||"45444"};
}
function queue(id,how){
  if(R.cards[id]||queued.has(id)||R.mat.some(m=>m.id===id)) return;
  queued.add(id);mailQ.push({id:id,how:how});
}
function mailTick(){
  const S=RD.S, dw=RD.stats.dwell, f=RD.found(), t=now();
  for(const s of RD.LIVING) if(!s.listener&&f.has(s.id)&&(dw[s.id]||0)>70000) queue(s.id,"slot");
  const L=RD.LISTENER;
  if(f.has(L.id)&&(dw[L.id]||0)>35000){ if(RD.replaced()) queue("double","under"); else queue("engineer","slot"); }
  for(const s of RD.DEAD) if(!s.door&&f.has(s.id)) queue(s.id,"pin");
  if(S.listenMs>100000) queue("notice","slot");
  if(S.phase>=1&&S.listenMs-S.moonMs>80000) queue("overdue","slot");
  if(S.phase>=2&&S.listenMs-S.moonMs>240000) queue("pruitt","slot");
  if(delivering||!mailQ.length) return;
  const i=mailQ.findIndex(m=>m.how==="pin"||(!RD.deadMode()&&t>nextMailAt));
  if(i>=0) deliver(mailQ.splice(i,1)[0]);
}
function deliver(m){
  queued.delete(m.id);
  if(m.how==="pin"){
    R.cards[m.id]={t:now(),info:info(m.id)};renderPins();saveR();
    cue("(there is a card on the door that you did not pin)",true);return;
  }
  delivering=true;
  if(m.how==="under"){
    A.room.slide();
    later(()=>{
      R.mat.push({id:m.id,under:true});showMat();saveR();
      cue("(something is pushed under the door. There were no footsteps on the stairs.)");
      if(G.where!=="under") A.room.hiss();
      delivering=false;nextMailAt=now()+40000;
    },900);
    return;
  }
  const secs=A.room.steps(true);
  later(()=>{
    A.room.clack();R.mat.push({id:m.id});showMat();saveR();
    cue("(the letterbox)");
    if(G.where!=="under"&&G.pose!=="hiss") pose("alert",1500);
    later(()=>{A.room.steps(false);delivering=false;nextMailAt=now()+45000;},900);
  },secs*1000+250);
}
function showMat(){
  const m=R.mat[R.mat.length-1], el=$("mail");
  show(el,!!m);el.classList.toggle("under",!!(m&&m.under));
  $("leanback").classList.toggle("has-mail",R.mat.length>0);
}
$("mail").addEventListener("click",openTop);
function openTop(){const m=R.mat[R.mat.length-1];if(m) openCard(m.id,true);}
function pin(id,inf){
  R.mat=R.mat.filter(m=>m.id!==id);R.cards[id]={t:now(),info:inf};
  renderPins();showMat();saveR();
}
const SLOTS=[];
[6,17,28,39,61,72,83].forEach(y=>[8,38,68].forEach(x=>SLOTS.push([x,y])));
function renderPins(){
  const box=$("pins");box.textContent="";
  Object.keys(R.cards).sort((a,b)=>R.cards[a].t-R.cards[b].t).forEach((id,i)=>{
    const c=CD.cards[id], s=SLOTS[i%SLOTS.length], e=document.createElement("span");
    if(!c) return;
    e.className="pin "+c.cls;e.style.left=s[0]+"%";e.style.top=s[1]+"%";e.style.setProperty("--r",(((i*37)%13)-6)+"deg");
    box.appendChild(e);
  });
}
$("pins").addEventListener("click",openBrowser);
$("tides").addEventListener("click",()=>{
  used("tides");const S=RD.S;
  caption(RD.deadMode()?"(tide tables. They are in a hand you do not know, and they go on for centuries.)":S.phase>=1&&!S.returned?"(tide tables. The columns are empty. The paper is not new.)":"(tide tables. High water, low water, and the moon's age in the margin.)","cue",5200);
});
$("slot").addEventListener("click",()=>{
  if(R.mat.length){openTop();return;}
  const el=$("slot");el.classList.add("peek");later(()=>el.classList.remove("peek"),2800);
  R.peeks=(R.peeks||0)+1;saveR();
  if(RD.deadMode()) caption("(through the letterbox: your own room, with the lamp on)","cue ghost");
  else if(R.peeks<=2) cue("(through the letterbox: no landing, no stairs. Stars.)");
  else caption("(stars)","cue");
});

/* ================= reading ================= */
const viewer=$("viewer"), vbody=$("vbody"), vkeys=$("vkeys");
let vClose=null;
function key(label,fn){
  const b=document.createElement("button"), c=document.createElement("span");
  b.className="key";c.className="cap";c.textContent=label;b.appendChild(c);b.addEventListener("click",fn);return b;
}
function openViewer(node,keys,onClose){
  vbody.textContent="";vbody.appendChild(node);vkeys.textContent="";keys.forEach(k=>vkeys.appendChild(k));
  show(viewer,true);vClose=onClose||null;
  try{room.inert=true;radioEl.inert=true;}catch(_){}
  if(keys.length) keys[keys.length-1].focus();
}
function closeViewer(){
  if(viewer.hasAttribute("hidden")) return;
  show(viewer,false);
  const f=vClose;vClose=null;
  try{room.inert=HB.view!=="room";radioEl.inert=HB.view!=="set";}catch(_){}
  if(f) f();
}
viewer.addEventListener("click",e=>{if(e.target===viewer) closeViewer();});
document.addEventListener("keydown",e=>{if(e.key==="Escape") closeViewer();});
function cardEl(front,back){
  const q=document.createElement("div");q.className="qsl";
  q.innerHTML='<div class="flipper"><div class="side front">'+front+'</div><div class="side rear">'+back+"</div></div>";
  const turn=()=>{q.classList.toggle("turned");A.room.flip();};
  q.addEventListener("click",turn);
  return {q:q,turn:turn,size:()=>{const f=()=>q.style.setProperty("--u",(q.clientWidth/100)+"px");f();requestAnimationFrame(f);}};
}
function openCard(id,fresh){
  const c=CD.cards[id];
  if(!c) return;
  const inf=fresh?info(id):(R.cards[id]&&R.cards[id].info)||info(id), k=cardEl(c.front(inf),c.back(inf));
  openViewer(k.q,[key("Turn it over",k.turn),key(fresh?"Pin it to the door":"Put it back",closeViewer)],fresh?()=>pin(id,inf):null);
  k.size();A.room.flip();
}
function openThing(c){
  const k=cardEl(c.front(),c.back());
  openViewer(k.q,[key("Turn it over",k.turn),key("Put it back",closeViewer)]);
  k.size();A.room.flip();
}
window.addEventListener("resize",()=>{const q=vbody.querySelector(".qsl");if(q) q.style.setProperty("--u",(q.clientWidth/100)+"px");});
function openBrowser(){
  const ids=Object.keys(R.cards).sort((a,b)=>R.cards[a].t-R.cards[b].t);
  if(!ids.length) return;
  const g=document.createElement("div");g.className="grid";
  ids.forEach(id=>{
    const c=CD.cards[id];if(!c) return;
    const b=document.createElement("button");b.className=c.cls;b.textContent=c.name;
    b.addEventListener("click",()=>{closeViewer();openCard(id,false);});g.appendChild(b);
  });
  openViewer(g,[key("Step back",closeViewer)]);
}
$("note").addEventListener("click",()=>{
  const p=document.createElement("div");p.className="paper";
  CD.note.forEach((l,i)=>{const e=document.createElement("p");if(i===CD.note.length-2) e.className="sign";e.textContent=l;p.appendChild(e);});
  openViewer(p,[key("Put it back",closeViewer)],()=>{R.noteRead=true;used("note");});
  A.room.flip();
});
$("book").addEventListener("click",()=>{
  used("book");
  const b=document.createElement("div");b.className="paper pages";
  const page=(cls,title,lines)=>{
    const pg=document.createElement("div"), h=document.createElement("h3");pg.className="page "+cls;h.textContent=title;pg.appendChild(h);
    lines.forEach(l=>{const e=document.createElement("p");e.textContent=typeof l==="string"?l:l.t;if(l.color) e.style.color=l.color;if(l.hand) e.style.fontFamily=l.hand;pg.appendChild(e);});
    b.appendChild(pg);
  };
  page("his","A. Pruitt, the last page",CD.pruittLog);
  const mine=R.log.map(l=>l.dead?{t:"  –     "+fmt(l.f)+"  "+l.name+"  (the set was off)",color:"#6b7388"}:l.t+"  "+fmt(l.f)+"  "+l.name+"  SINPO "+l.sinpo);
  if(!mine.length) mine.push("Nothing yet. Log what you hear.");
  if(RD.S.letIn) mine.push({t:RD.S.youAt+"  One listener. Steady thumb.",color:"#7a1f14",hand:"var(--font-hand)"});
  page("mine","The relief, tonight",mine);
  openViewer(b,[key("Close the book",closeViewer)]);
  A.room.flip();
});

/* ================= what the room overhears ================= */
HB.on("line",o=>{
  if(HB.view==="room") caption(o.text,o.kind==="his"?"his":o.kind==="ghost"?"ghost":"",o.dur+500);
  const t=o.text.toLowerCase(), n=(t.match(/\b(goose|geese|orro)\b/g)||[]).length;
  /* she knows her name in two languages */
  if(n&&G.where!=="under"&&G.pose!=="hiss"&&!RD.deadMode()){
    later(()=>{
      if(G.where==="under"||now()<G.busy) return;
      if(G.pose==="sleep") pose("sit",5000); else G.hold=now()+1500;
      honk(0.75,1);if(n>1) later(()=>honk(0.65,1.08),430);
      G.stir=now();
    },Math.min(2600,o.dur*0.45));
  }
  if(o.st.id==="coast"&&!RD.deadMode()){
    if(/\b(rain|showers)\b/.test(t)) later(()=>rain(170),o.dur+5000);
    if(/\b(fog|mist)\b/.test(t)) later(()=>fog(150),o.dur+5000);
  }
});
HB.on("phase",p=>{
  if(p==="moonfall"){G.moonUntil=now()+75000;later(()=>{if(G.where==="mid") honk(0.6,0.8);},5600);}
  if(p==="wrong") later(lampFails,35000+Math.random()*30000);
  if(p==="letin") A.room.hiss();
  if(p==="returned"){G.stir=now();later(()=>{honk(0.8,1.05);later(()=>honk(0.8,1.12),420);},2600);}
  if(p==="reset"){
    R.cards={};R.mat=[];R.log=[];R.lampFailed=false;R.boiled=false;R.peeks=0;R.fed=0;queued.clear();mailQ.length=0;
    renderPins();showMat();saveR();
  }
  light();
});
HB.on("power",()=>{light();G.stir=now();});
HB.on("lock",ambience);HB.on("unlock",ambience);
HB.on("knock",()=>{if(G.where!=="under"&&HB.view==="room") A.room.hiss();});
HB.on("found",st=>{R.log.push({id:st.id,name:st.name,f:st.f,t:clockStr(),dead:!!st.dead,sinpo:sinpo(st)});saveR();});
HB.on("call",st=>{if(st&&!st.dead&&!st.listener&&!st.you) queue(st.id,"slot");});
HB.on("audio",()=>{A.setDistance(HB.view==="room");ambience();});

/* ================= time passing ================= */
let frame=0, beamWas=0, secWas=-1, tickN=0;
const clockEl=$("clock"), needle=document.querySelector(".minidial");
setInterval(()=>{
  if(document.hidden) return;
  frame++;
  const w=HB.weather, t=now();
  w.rain+=((t<W.rainUntil?1:0)-w.rain)*0.02;w.fog+=((t<W.fogUntil?1:0)-w.fog)*0.015;
  w.wind=clamp(w.wind+(Math.random()-0.5)*0.03+(t<W.rainUntil?0.008:-0.003),0.15,1);
  if(HB.view==="room"){
    K.draw(winsky,RD.sky("window"));
    if(Math.abs(K.beam-beamWas)>0.03){beamWas=K.beam;stage.style.setProperty("--beamA",K.beam.toFixed(2));}
  }
  gooseTick();
  const d=new Date(), s=d.getSeconds();
  if(s!==secWas){
    secWas=s;tickN++;
    /* late in the night the second hand sometimes thinks better of it */
    const slip=HB.mood()==="wrong"&&Math.random()<0.12?-1:0;
    clockEl.style.setProperty("--s",((s+slip)*6)+"deg");
    clockEl.style.setProperty("--m",(d.getMinutes()*6+s*0.1)+"deg");
    clockEl.style.setProperty("--h",((d.getHours()%12)*30+d.getMinutes()*0.5)+"deg");
    if(HB.view==="room"&&!RD.deadMode()) later(()=>A.room.tick(s),slip?350:0);
    needle.style.setProperty("--needle",((RD.freq-3000)/14000*100).toFixed(1)+"%");
    mailTick();
    if(tickN%3===0) ambience();
    if(R.open&&!RD.deadMode()&&Math.random()<0.012) A.room.hoot();
  }
},100);

/* ================= on a wide screen, the night spills round the room ================= */
const amb=$("ambient"), actx=amb.getContext("2d");amb.width=48;amb.height=30;
setInterval(()=>{
  if(document.hidden||window.innerWidth<app.clientWidth+60) return;
  try{actx.drawImage(HB.view==="room"?winsky:$("sky"),0,0,48,30);}catch(_){}
},700);

/* ================= begin ================= */
Object.keys(R.used).forEach(id=>{const el=$(id);if(el) el.classList.add("used");});
document.querySelectorAll(".obj").forEach((el,i)=>el.style.setProperty("--gd",(-i*0.9)+"s"));
renderPins();showMat();light();setView("room");
later(()=>{
  const first=!R.noteRead&&!Object.keys(R.used).length;
  caption(first?"(Top room, 9 Lantern Row. Somebody has left a note against the set.)":"(Top room, 9 Lantern Row.)","cue",5200);
},1400);
K.draw(winsky,RD.sky("window"));
HB.room.debug={rain:rain,fog:fog,queue:queue,deliver:deliver,lampFails:lampFails,view:setView,goose:G,openCard:openCard,openThing:id=>openThing(CD.things[id]),feed:feed,boil:boil,close:closeViewer};
})();
