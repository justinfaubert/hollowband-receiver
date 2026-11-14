/* Hollowband Receiver — the set itself.
   State and story, tuning, the tape, the sky, the materials the set is made of, and everything you can touch. */
(function(){
"use strict";
const HB=window.HB=window.HB||{}, A=HB.sound, K=HB.sky, D=window.HB_SCRIPT;
const FMIN=3000, FMAX=17000, PPK=0.5;
const BANDS=[[90,3200,3400],[75,3900,4000],[60,4750,5060],[49,5900,6200],[41,7200,7450],[31,9400,9900],[25,11600,12100],[22,13570,13870],[19,15100,15800]];
const $=id=>document.getElementById(id);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const fmt=n=>Math.round(n).toLocaleString("en-US");
const pick=a=>a[Math.floor(Math.random()*a.length)];
const reduced=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
const clock=()=>{const d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");};
function moonPhase(){const days=(Date.now()-Date.UTC(2000,0,6,18,14))/86400000;return ((days/29.530588853)%1+1)%1;}
function moonName(){
  const p=moonPhase();
  if(p<0.03||p>0.97) return "new moon";
  if(p<0.22) return "waxing crescent"; if(p<0.28) return "first quarter"; if(p<0.47) return "waxing gibbous";
  if(p<0.53) return "full moon"; if(p<0.72) return "waning gibbous"; if(p<0.78) return "last quarter";
  return "waning crescent";
}

/* ================= preferences and state ================= */
const PKEY="hollowband-prefs", KEY="hollowband-night";
const prefs={v:0,vol:70,voice:100,music:100,static:100,room:100,voiceOn:true,text:"m",still:false,haptics:true,freq:6000,logOpen:window.innerHeight>780,yoursF:0,monitor:false};
try{Object.assign(prefs,JSON.parse(localStorage.getItem(PKEY)||"{}"));}catch(_){}
/* the mix was rebalanced (voices now sit under the music): start everyone from the new centre once */
if(prefs.v<2){prefs.voice=100;prefs.music=100;prefs.static=100;prefs.room=100;prefs.v=2;}
const savePrefs=()=>{try{localStorage.setItem(PKEY,JSON.stringify(prefs));}catch(_){}};
const buzz=p=>{if(!prefs.haptics) return;try{navigator.vibrate&&navigator.vibrate(p);}catch(_){}};

const S={phase:0,letIn:false,returned:false,youAt:"",listenMs:0,moonMs:0,moonSegs:0,pendingMoon:false,everOn:false,noteDone:false};
const stats={taps:0,powerCycles:0,prevShort:null,lastShort:null,dwell:{},spoke:false};
let found=new Set();
let freq=prefs.freq, power=false, currentSt=null, pendingSt=null, lockTimer=0, session=0, anim=0, drifting=false;
let ttsCap=null, sampleCap=null, dictCap=null, synthDead=!("speechSynthesis" in window), cur={st:null,d:1e9,s:0};
let lastTouch=performance.now(), lastDet=600, bedSt=null, bedTimer=0, speakInside=false, ptr=null, sigSmooth=0, audioReady=false, skyLvl=0;
function save(){
  try{localStorage.setItem(KEY,JSON.stringify({found:[...found],phase:S.phase,letIn:S.letIn,returned:S.returned,youAt:S.youAt,listenMs:S.listenMs,moonMs:S.moonMs,moonSegs:S.moonSegs,noteDone:S.noteDone}));}catch(_){}
}
HB.mood=()=>S.returned?"back":S.phase>=2?"wrong":S.phase>=1?"moon":"normal";
HB.letIn=()=>S.letIn;

/* ================= stations ================= */
const LIVING=D.living.map(s=>Object.assign({},s));
const LISTENER=Object.assign({},D.listener,{listener:true,hidden:true,max:0.88,lock:3,scale:[57,60,62,64,67]});
LIVING.push(LISTENER);
const DEAD=D.dead.map(s=>Object.assign({dead:true,scale:[50,53,57,60,62]},s));
const YOURS={id:"yours",f:prefs.yoursF,name:"Unlicensed transmission",short:"your own station",bed:"yours",you:true,scale:[60,62,65,67,69],segs:[]};
const ALL=LIVING.concat(DEAD,[YOURS]);
ALL.forEach((s,i)=>{s.i=s.listener||s.door||!s.segs.length?0:Math.floor(Math.random()*s.segs.length);s.fresh=[];s.vi=i;s.max=s.max||(s.dead?0.97:1);s.lock=s.lock||6;if(s.door) s.hidden=true;});
const livingFound=()=>LIVING.filter(s=>found.has(s.id)).length;
function longest(){let b=null,m=20000;for(const st of LIVING){const v=stats.dwell[st.id]||0;if(v>m&&!st.listener){m=v;b=st;}}return b;}
const hasYours=()=>YOURS.f>0&&(A.media.tracks.length>0||A.media.clips.length>0);
function band(){
  if(power) return hasYours()?LIVING.concat([YOURS]):LIVING;
  if(S.everOn) return DEAD.filter(s=>(!s.future||!S.returned)&&(!s.door||(S.phase>=1&&!S.returned)));
  return [];
}
const deadMode=()=>!power&&S.everOn;
const replaced=()=>S.phase>=1&&!S.returned;
const mk=(g,arr,cast)=>arr.map(l=>({g:g,l:l,cast:cast}));

/* conditions and slots that lines can ask for */
const COND={
  newmoon:()=>moonName()==="new moon",
  hasprev:()=>!!stats.prevShort,
  loud:()=>prefs.vol>=60,
  cycled:()=>stats.powerCycles>0,
  haslongest:()=>!!longest(),
  voiceon:()=>prefs.voiceOn,
  /* he can see into the room */
  lampon:()=>!!(HB.room&&HB.room.state.lamp),
  windowopen:()=>!!(HB.room&&HB.room.state.open),
  kettle:()=>!!(HB.room&&HB.room.state.boiled)
};
function slotValue(k,item){
  const d=new Date();
  if(k==="time") return D.timeWords(d.getHours(),d.getMinutes());
  if(k==="weekday") return D.slots.weekday[d.getDay()];
  if(k==="moon") return moonName();
  if(k==="n") return D.slots.n[clamp(livingFound(),1,10)-1];
  if(k==="taps"){const t=stats.taps;return D.slots.taps[t<9?0:t<18?1:t<45?2:t<100?3:t<250?4:5];}
  if(k==="station"){const l=longest();return item&&item.l&&item.l.if==="haslongest"&&l?l.short:(stats.prevShort||"nowhere");}
  return "";
}

/* ================= the one on 16,661 ================= */
let obsI=0, insI=0;
function listenerSeg(st){
  const L=D.listener, E=st.cast, X=st.castDouble;
  const own=()=>{const i=st.i++%st.segs.length;return mk("seg"+i,st.segs[i],E);};
  if(S.returned){ if(!st.homeDone){st.homeDone=true;return mk("home",L.home,E);} return own(); }
  if(S.phase===0) return own();
  if(S.letIn){const a=[];for(let k=0;k<3;k++) a.push({g:"inside",l:L.inside[insI++%L.inside.length],cast:X});return a;}
  if(!st.met){st.met=true;return mk("first",L.first,X);}
  const a=[];for(let k=0;k<3;k++) a.push({g:"obs",l:L.obs[obsI++%L.obs.length],cast:X});
  a.push({g:"asks",l:L.asks[(obsI/3|0)%L.asks.length],cast:X});
  return a;
}
function letHimIn(){
  S.letIn=true;S.youAt=clock();LISTENER.max=1;save();HB.emit("phase","letin");
  LISTENER.fresh.unshift(mk("letIn",D.listener.letIn,LISTENER.castDouble));
  session++;stopSpeech();
  addLine("cue","(two knocks on the glass)");
  runStation(LISTENER,session,true);
}
function shutDoor(){
  S.returned=true;S.letIn=false;S.youAt="";
  LISTENER.hidden=false;LISTENER.max=1;LISTENER.lock=6;LISTENER.homeDone=false;
  save();
  session++;stopSpeech();
  addLine("cue","(two knocks, from this side)");
  A.thump(0);A.thump(0.34);buzz([40,120,40]);
  setTimeout(()=>{
    addLine("cue","(something answers once, and stops)");A.thump(0,0.5);
    setTimeout(()=>{
      K.setMoon(1);setMoonlight();restoreMoon();HB.emit("phase","returned");
      addLine("note","The door is shut.");
      A.moonChord();
      if(currentSt) unlock(true);
      renderLog();updateTuning();drawDial();
    },1800);
  },1500);
}
function moonfall(){
  S.pendingMoon=false;S.phase=1;S.moonMs=S.listenMs;
  K.setMoon(0,true);setMoonlight();A.moonGone();save();HB.emit("phase","moonfall");
  setTimeout(()=>{
    if(S.noteDone||S.phase<1) return;
    S.noteDone=true;save();
    addLine("cue","(pencilled at the foot of the operating notes, not in your hand)");
    addLine("note","6. When switched off, the receiver is not off.");
  },45000);
}
function setMoonlight(){document.documentElement.style.setProperty("--moonlight",String(K.moonTarget));}
/* the word goes out of the record, a line at a time */
const erased=[];
function eraseMoon(){
  const now=Date.now();
  for(const p of tape.querySelectorAll("p")){
    if(now-(+p.dataset.t||now)<25000) continue;
    const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);
    let n;
    while((n=w.nextNode())){
      const m=/moon/i.exec(n.nodeValue);
      if(m){erased.push({n:n,w:m[0]});n.nodeValue=n.nodeValue.slice(0,m.index)+"····"+n.nodeValue.slice(m.index+4);return;}
    }
  }
}
function restoreMoon(){
  let i=0;
  const h=setInterval(()=>{
    const e=erased[i++];
    if(!e){clearInterval(h);erased.length=0;return;}
    try{e.n.nodeValue=e.n.nodeValue.replace("····",e.w);}catch(_){}
  },220);
}

/* ================= materials: the set becomes other sets ================= */
const SKINS=[
 {font:'"Saira Extra Condensed","Arial Narrow",sans-serif',ls:0.1,fs:1,rk:6,m:" m",
  c:{chassis:[39,49,46],hi:[53,66,61],lo:[26,34,32],engrave:[183,195,186],maker:[223,231,223],key1:[65,79,73],key2:[45,56,52],lamp:[255,182,72],needle:[217,68,44],dA:[255,242,204],dB:[243,226,179],dC:[198,170,106],ink:[43,34,25],paper:[236,229,211],pink:[42,37,29],bezel:[120,132,126]},
  l:{brand:"HOLLOWBAND",model:"Shortwave receiver, model 9",power:"Power",seek:"Seek",next:"Next",call:"Call in",onair:"On air",vol:"Vol",signal:"Signal",logbook:"Logbook",khz:"kHz"}},
 {font:'"IM Fell English SC","Times New Roman",serif',ls:0.05,fs:0.8,rk:22,m:" metres",
  c:{chassis:[62,38,26],hi:[90,57,37],lo:[36,21,14],engrave:[226,200,150],maker:[240,216,160],key1:[112,78,48],key2:[70,44,28],lamp:[255,206,120],needle:[40,24,14],dA:[255,238,186],dB:[240,205,130],dC:[168,118,58],ink:[50,30,14],paper:[240,230,205],pink:[50,36,22],bezel:[176,138,70]},
  l:{brand:"VANE & MARROW",model:"All-wave wireless, 1934",power:"Mains",seek:"Search",next:"Onward",call:"Telephone",onair:"Transmit",vol:"Loud",signal:"Strength",logbook:"Day book",khz:"kc/s"}},
 {font:'"PT Sans Narrow","Arial Narrow",sans-serif',ls:0.07,fs:0.9,rk:2,m:" м",
  c:{chassis:[28,52,74],hi:[42,72,98],lo:[15,31,47],engrave:[214,224,230],maker:[240,242,238],key1:[52,84,110],key2:[32,58,82],lamp:[255,96,74],needle:[238,62,52],dA:[240,248,244],dB:[208,226,224],dC:[128,158,164],ink:[20,40,50],paper:[228,232,224],pink:[28,36,44],bezel:[190,198,202]},
  l:{brand:"ОРБИТА-4",model:"Приёмник коротковолновый",power:"Сеть",seek:"Поиск",next:"Далее",call:"Звонок",onair:"Эфир",vol:"Громк",signal:"Сигнал",logbook:"Журнал",khz:"кГц"}},
 {font:'"Megrim","Courier New",monospace',ls:0.12,fs:0.92,rk:14,m:" lom",
  c:{chassis:[44,26,52],hi:[70,42,80],lo:[24,13,30],engrave:[218,208,174],maker:[238,230,198],key1:[86,54,94],key2:[52,30,60],lamp:[110,232,200],needle:[90,220,190],dA:[230,240,214],dB:[198,216,188],dC:[108,140,120],ink:[34,20,40],paper:[232,226,206],pink:[40,24,46],bezel:[150,120,170]},
  l:{brand:"ORRO VANT",model:"Ke lom, ke lom, meb 9",power:"Brannu",seek:"Virru",next:"Pem",call:"Sella",onair:"Hup hup",vol:"Groth",signal:"Lom",logbook:"Oska",khz:"khu"}}
];
/* A transition is not a slide. It rests twice on the way, at sets that are neither one thing nor the other. */
const STAGES=[[75000,0,0],[32000,0,0.34],[80000,0.34,0.34],[32000,0.34,0.67],[80000,0.67,0.67],[32000,0.67,1]];
let skinIdx=0, skinT=0, stageI=0, SK=null, skinP=0, labelEls=[], orders={}, texEls=[];
const rgb=(a,al)=>al===undefined?"rgb("+Math.round(a[0])+","+Math.round(a[1])+","+Math.round(a[2])+")":"rgba("+Math.round(a[0])+","+Math.round(a[1])+","+Math.round(a[2])+","+al+")";
function mixStr(a,b,order,p){
  const L=Math.max(a.length,b.length), X=a.padEnd(L), Y=b.padEnd(L), n=Math.floor(clamp((p-0.12)/0.76,0,1)*L), out=X.split("");
  for(let i=0;i<n;i++) out[order[i]]=Y[order[i]];
  return out.join("").replace(/\s+$/,"")||b;
}
function applySkin(p){
  const Aa=SKINS[skinIdx], B=SKINS[(skinIdx+1)%SKINS.length], e=p, root=document.documentElement.style;
  const c={};for(const k in Aa.c) c[k]=[0,1,2].map(i=>lerp(Aa.c[k][i],B.c[k][i],e));
  skinP=p;
  SK={c:c,font:p<0.5?Aa.font:B.font,fs:lerp(Aa.fs,B.fs,e),m:p<0.5?Aa.m:B.m,w:[0,0,0,0]};
  SK.w[skinIdx]=1-e;SK.w[(skinIdx+1)%SKINS.length]=e;
  const set=(k,v)=>root.setProperty(k,v);
  set("--chassis",rgb(c.chassis));set("--chassis-hi",rgb(c.hi));set("--chassis-lo",rgb(c.lo));set("--engrave",rgb(c.engrave));set("--maker",rgb(c.maker));
  set("--key1",rgb(c.key1));set("--key2",rgb(c.key2));set("--lamp",rgb(c.lamp));set("--needle",rgb(c.needle));set("--paper",rgb(c.paper));set("--paper-ink",rgb(c.pink));set("--bezel",rgb(c.bezel));
  set("--r-key",lerp(Aa.rk,B.rk,e).toFixed(1)+"px");set("--ls",lerp(Aa.ls,B.ls,e).toFixed(3)+"em");set("--fs",SK.fs.toFixed(3));set("--font-label",SK.font);
  texEls.forEach((el,i)=>{el.style.opacity=SK.w[i].toFixed(3);});
  for(const el of labelEls){
    const k=el.dataset.l, a=Aa.l[k], b=B.l[k];
    const txt=p<=0?a:p>=1?b:mixStr(a,b,orders[k]||[],p);
    if(el.textContent!==txt) el.textContent=txt;
    el.style.fontFamily=p>0&&p<1?(p>=el._sw?B.font:Aa.font):"";
  }
}
function newOrders(){
  const Aa=SKINS[skinIdx], B=SKINS[(skinIdx+1)%SKINS.length];
  for(const k in Aa.l){
    const L=Math.max(Aa.l[k].length,B.l[k].length), o=[];
    for(let i=0;i<L;i++) o.push(i);
    for(let i=L-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=o[i];o[i]=o[j];o[j]=t;}
    orders[k]=o;
  }
  labelEls.forEach(el=>{el._sw=0.2+Math.random()*0.6;});
}
function tickSkin(dt){
  if(prefs.still) return;
  skinT+=dt;
  let st=STAGES[stageI];
  if(skinT>=st[0]){
    skinT=0;stageI++;
    if(stageI>=STAGES.length){stageI=0;skinIdx=(skinIdx+1)%SKINS.length;newOrders();applySkin(0);drawDial();return;}
    st=STAGES[stageI];
  }
  if(st[1]===st[2]) return;
  const u=skinT/st[0];
  applySkin(lerp(st[1],st[2],u*u*(3-2*u)));
  drawDial();
}
/* things change while you are not looking, never while you are */
function lookedAway(){
  if(prefs.still||!S.everOn) return;
  do{
    stageI++;
    if(stageI>=STAGES.length){stageI=0;skinIdx=(skinIdx+1)%SKINS.length;newOrders();}
  }while(STAGES[stageI][1]!==STAGES[stageI][2]);
  skinT=0;applySkin(STAGES[stageI][1]);drawDial();
}

/* ================= sky (drawn by sky.js; this is what it needs to know) ================= */
const sky=$("sky");
function skyState(kind){
  const w=HB.weather||{};
  return {kind:kind,freq:freq,dead:deadMode(),phase:S.phase,returned:S.returned,letIn:S.letIn,replaced:replaced(),found:found,currentId:currentSt&&currentSt.id,
    yours:hasYours(),onAir:A.onAir(),lvl:skyLvl,rain:w.rain||0,fog:w.fog||0,wind:w.wind||0};
}
function drawSky(){K.draw(sky,skyState("strip"));}

/* ================= the indicator: lamps, a magic eye, a needle, an eye ================= */
const eye=$("eye"), eg=eye.getContext("2d");
let blink=0;
function drawEye(){
  const r=eye.getBoundingClientRect(), W=eye.clientWidth, H=eye.clientHeight, dpr=window.devicePixelRatio||1;
  if(!W||!SK) return;
  if(eye.width!==Math.round(W*dpr)||eye.height!==Math.round(H*dpr)){eye.width=Math.round(W*dpr);eye.height=Math.round(H*dpr);}
  eg.setTransform(dpr,0,0,dpr,0,0);eg.clearRect(0,0,W,H);
  const dm=deadMode(), live=power||dm, target=A.onAir()?A.micLevel():(live?cur.s:0);
  sigSmooth=lerp(sigSmooth,target+(live?(Math.random()-0.5)*0.06:0),0.3);
  const s=clamp(sigSmooth,0,1), c=SK.c, w=SK.w, lamp=dm?[169,192,238]:A.onAir()?[255,90,72]:c.lamp, cx=W/2, cy=H/2;
  if(w[0]>0.02){ /* nine lamps */
    eg.globalAlpha=w[0];
    const n=9, gw=(W-(n-1)*3)/n, lit=Math.round(s*9);
    for(let i=0;i<n;i++){
      const on=i<lit;
      eg.fillStyle=on?(i>=7&&!dm?rgb(c.needle):rgb(lamp)):"rgba(0,0,0,.3)";
      if(on){eg.shadowColor=eg.fillStyle;eg.shadowBlur=7;}
      eg.fillRect(i*(gw+3),H*0.3,gw,H*0.45);eg.shadowBlur=0;
    }
  }
  if(w[1]>0.02){ /* a magic eye tube: the shadow closes as the signal comes in */
    eg.globalAlpha=w[1];
    const R=H*0.48;
    eg.fillStyle="#0c120e";eg.beginPath();eg.arc(cx,cy,R,0,6.2832);eg.fill();
    const gr=eg.createRadialGradient(cx,cy,R*0.2,cx,cy,R);
    gr.addColorStop(0,live?"#d9ffe0":"#243028");gr.addColorStop(0.6,live?"#52e08a":"#1c2620");gr.addColorStop(1,live?"#1f8a4c":"#141a16");
    eg.fillStyle=gr;eg.beginPath();eg.arc(cx,cy,R*0.94,0,6.2832);eg.fill();
    const half=lerp(0.85,0.03,s);
    eg.fillStyle="#0c120e";eg.beginPath();eg.moveTo(cx,cy);eg.arc(cx,cy,R*0.95,1.5708-half,1.5708+half);eg.closePath();eg.fill();
    eg.fillStyle="#0a0d0b";eg.beginPath();eg.arc(cx,cy,R*0.26,0,6.2832);eg.fill();
    eg.strokeStyle=rgb(c.bezel);eg.lineWidth=2;eg.beginPath();eg.arc(cx,cy,R,0,6.2832);eg.stroke();
  }
  if(w[2]>0.02){ /* a moving-coil meter */
    eg.globalAlpha=w[2];
    eg.fillStyle="#f3efe0";eg.fillRect(2,2,W-4,H-4);
    eg.strokeStyle="#1c2a34";eg.lineWidth=1;eg.strokeRect(2.5,2.5,W-5,H-5);
    const px=cx, py=H*1.05, R=H*0.82;
    for(let i=0;i<=10;i++){
      const a=-2.3+i*0.146*1;const ang=-1.5708+(i/10-0.5)*1.5;
      eg.strokeStyle=i>=8?"#e03a2e":"#1c2a34";eg.lineWidth=i%5===0?1.6:1;
      eg.beginPath();eg.moveTo(px+Math.cos(ang)*R,py+Math.sin(ang)*R);eg.lineTo(px+Math.cos(ang)*(R-(i%5===0?7:4)),py+Math.sin(ang)*(R-(i%5===0?7:4)));eg.stroke();
    }
    const na=-1.5708+(s-0.5)*1.5;
    eg.strokeStyle=dm?"#4a6ab0":"#e03a2e";eg.lineWidth=1.6;eg.beginPath();eg.moveTo(px,py);eg.lineTo(px+Math.cos(na)*(R-2),py+Math.sin(na)*(R-2));eg.stroke();
  }
  if(w[3]>0.02){ /* an eye. It opens for a signal. It looks where your hand is. */
    eg.globalAlpha=w[3];
    if(blink>0) blink-=0.34; else if(Math.random()<0.012) blink=1;
    const open=(S.letIn?1:lerp(0.22,1,s))*(1-Math.max(0,Math.sin(Math.max(0,blink)*3.1416))), ew=W*0.46, eh=H*0.44*open;
    eg.save();eg.beginPath();eg.moveTo(cx-ew,cy);eg.quadraticCurveTo(cx,cy-eh*2,cx+ew,cy);eg.quadraticCurveTo(cx,cy+eh*2,cx-ew,cy);eg.closePath();
    eg.fillStyle="#e9ecdc";eg.fill();eg.clip();
    let lx=0, ly=0;
    if(ptr&&!S.letIn){const dx=ptr.x-(r.left+cx), dy=ptr.y-(r.top+cy), dd=Math.hypot(dx,dy)||1;lx=dx/dd*Math.min(ew*0.45,dd*0.08);ly=dy/dd*Math.min(H*0.16,dd*0.05);}
    const ir=H*0.3;
    const ig=eg.createRadialGradient(cx+lx,cy+ly,ir*0.2,cx+lx,cy+ly,ir);ig.addColorStop(0,rgb(lamp));ig.addColorStop(1,"#17403a");
    eg.fillStyle=ig;eg.beginPath();eg.arc(cx+lx,cy+ly,ir,0,6.2832);eg.fill();
    eg.fillStyle="#07090a";eg.beginPath();eg.arc(cx+lx,cy+ly,ir*(0.38+0.3*skyLvl),0,6.2832);eg.fill();
    eg.fillStyle="rgba(255,255,255,.7)";eg.beginPath();eg.arc(cx+lx-ir*0.3,cy+ly-ir*0.3,ir*0.12,0,6.2832);eg.fill();
    eg.restore();
    eg.strokeStyle=rgb(c.lo);eg.lineWidth=1.6;eg.beginPath();eg.moveTo(cx-ew,cy);eg.quadraticCurveTo(cx,cy-eh*2,cx+ew,cy);eg.quadraticCurveTo(cx,cy+eh*2,cx-ew,cy);eg.stroke();
  }
  eg.globalAlpha=1;
}

/* ================= dial ================= */
const radio=$("radio"), cv=$("dial"), g=cv.getContext("2d"), tape=$("tape");
function drawDial(){
  const W=cv.clientWidth, H=cv.clientHeight, dpr=window.devicePixelRatio||1;
  if(!W||!SK) return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  g.setTransform(dpr,0,0,dpr,0,0);
  const dm=deadMode(), c=SK.c, ink=dm?[196,212,238]:c.ink;
  if(dm){const f=g.createLinearGradient(0,0,0,H);f.addColorStop(0,"#0c1017");f.addColorStop(1,"#1a2232");g.fillStyle=f;}
  else{const f=g.createRadialGradient(W/2,H*0.55,10,W/2,H*0.55,W*0.8);f.addColorStop(0,rgb(c.dA));f.addColorStop(0.55,rgb(c.dB));f.addColorStop(1,rgb(c.dC));g.fillStyle=f;}
  g.fillRect(0,0,W,H);
  const lo=freq-W/2/PPK, hi=freq+W/2/PPK, X=k=>W/2+(k-freq)*PPK;
  g.fillStyle=rgb(ink,0.36);
  if(lo<FMIN) g.fillRect(0,0,X(FMIN),H);
  if(hi>FMAX) g.fillRect(X(FMAX),0,W-X(FMAX),H);
  const text=(s,x,y)=>{ if(dm){g.save();g.translate(x,y);g.scale(-1,1);g.fillText(s,0,0);g.restore();} else g.fillText(s,x,y); };
  g.textAlign="center";g.textBaseline="middle";g.fillStyle=rgb(ink,dm?0.8:1);
  g.font="600 "+Math.round(14*SK.fs)+"px "+SK.font;
  for(const b of BANDS){
    if(b[2]<lo||b[1]>hi) continue;
    const xa=X(b[1]), xb=X(b[2]);
    g.fillRect(xa,24,xb-xa,3);g.fillRect(xa,18,1.5,9);g.fillRect(xb-1.5,18,1.5,9);
    text(b[0]+SK.m,(xa+xb)/2,11);
  }
  for(let k=Math.ceil(Math.max(lo,FMIN)/10)*10;k<=Math.min(hi,FMAX);k+=10){
    const x=X(k), big=k%100===0, mid=k%50===0;
    g.globalAlpha=(big?1:mid?0.8:0.5)*(dm?0.8:1);
    g.fillRect(x-(big?1:0.5),40,big?2:1,big?26:mid?17:10);
    if(big){g.font="600 "+Math.round(18*SK.fs)+"px "+SK.font;text((k/1000).toFixed(1),x,82);}
  }
  g.globalAlpha=1;
  /* pencil marks where you have been */
  g.strokeStyle=rgb(ink,0.75);g.lineWidth=1.3;g.lineCap="round";
  for(const st of (dm?DEAD:LIVING.concat(hasYours()?[YOURS]:[]))){
    if(!found.has(st.id)||st.f<lo||st.f>hi) continue;
    const x=X(st.f);
    g.beginPath();g.moveTo(x-4.5,107);g.lineTo(x,99);g.lineTo(x+4.5,107);g.stroke();
    if(st.you){g.beginPath();g.arc(x,95,2,0,6.2832);g.stroke();}
  }
  if(!power&&!dm){g.fillStyle="rgba(14,16,18,.6)";g.fillRect(0,0,W,H);}
  if(!dm){
    const glass=g.createLinearGradient(0,0,0,H);
    glass.addColorStop(0,"rgba(255,255,255,.26)");glass.addColorStop(0.35,"rgba(255,255,255,0)");glass.addColorStop(1,"rgba(0,0,0,.2)");
    g.fillStyle=glass;g.fillRect(0,0,W,H);
    g.strokeStyle="rgba(255,255,255,.1)";g.lineWidth=1;g.beginPath();g.moveTo(W*0.12,H);g.lineTo(W*0.3,0);g.moveTo(W*0.16,H);g.lineTo(W*0.34,0);g.stroke();
  }
  g.fillStyle=dm?"#a9c0ee":rgb(c.needle);g.fillRect(W/2-1,0,2,H);
  g.beginPath();g.moveTo(W/2-6,0);g.lineTo(W/2+6,0);g.lineTo(W/2,9);g.closePath();g.fill();
}

/* ================= tuning ================= */
function nearest(includeHidden){
  let best=null;
  for(const st of band()){
    if(st.hidden&&!includeHidden) continue;
    const d=freq-st.f;
    if(!best||Math.abs(d)<Math.abs(best.d)) best={st:st,d:d};
  }
  if(!best) return {st:null,d:1e9,s:0};
  best.s=Math.max(0,1-Math.abs(best.d)/30)*best.st.max;
  return best;
}
const clarity=()=>currentSt?Math.max(0,1-Math.abs(freq-currentSt.f)/30)*currentSt.max:0;
function setFreq(f,soft){
  if(soft){ if(f<FMIN) f=FMIN-Math.min(45,(FMIN-f)*0.3); else if(f>FMAX) f=FMAX+Math.min(45,(f-FMAX)*0.3); }
  else f=clamp(f,FMIN,FMAX);
  freq=f;
  const n=Math.floor(freq/10);
  if(n!==lastDet){
    if(S.everOn){A.pluck(n,(cur.st&&cur.s>0.05?cur.st.scale:null)||[57,60,62,64,67],!power);buzz(3);}
    lastDet=n;
  }
  $("freq").textContent=fmt(clamp(freq,FMIN,FMAX));
  cv.setAttribute("aria-valuenow",Math.round(clamp(freq,FMIN,FMAX)));
  updateTuning();drawDial();
}
function updateTuning(){
  cur=nearest(true);
  const locked=(cur.st&&!drifting&&Math.abs(cur.d)<=cur.st.lock)?cur.st:null;
  if(locked!==pendingSt){
    pendingSt=locked;clearTimeout(lockTimer);
    if(!locked){ if(currentSt) unlock(); }
    else if(locked!==currentSt) lockTimer=setTimeout(()=>commitLock(locked),380);
  }
  /* music swims up out of the static before the voice does */
  const near=cur.st&&cur.s>0.04?cur.st:null;
  if(near!==bedSt){
    bedSt=near;clearTimeout(bedTimer);
    if(!near) A.stopBed(); else bedTimer=setTimeout(()=>{if(bedSt===near) A.startBed(near);},220);
  }
  setAudio();setStatus();
}
function setAudio(){
  A.tune({power:power,dead:deadMode(),s:cur.s,d:cur.d,locked:!!currentSt,clarity:clarity(),inside:speakInside||(S.letIn&&currentSt===LISTENER)});
}
function setStatus(){
  const el=$("status"), dm=deadMode();
  const put=(a,b)=>{el.textContent=a;if(b){const x=document.createElement("b");x.textContent=b;el.appendChild(x);}};
  if(A.onAir()) put("On air. ","The lamp is red.");
  else if(!power&&!dm) put("Receiver off");
  else if(dm){
    if(currentSt) put(currentSt.door?"Receiver off. ":"Receiver off. Hearing ",currentSt.door?"There is a door here.":currentSt.name);
    else if(cur.s>0.05) put("Receiver off. Something is on anyway.");
    else put("Receiver off");
  }
  else if(currentSt) put("Receiving ",currentSt.name);
  else if(drifting) put("The dial is moving.");
  else if(cur.s>0.05) put("Carrier detected. Tune closer.");
  else put("No carrier");
  $("next").disabled=!currentSt||!!currentSt.door||!!currentSt.you;
  $("fresh").disabled=!currentSt||!!currentSt.door||!!currentSt.you||!sampleCap;
  document.querySelectorAll("#chips .key").forEach(k=>k.classList.toggle("now",!!currentSt&&k.dataset.id===currentSt.id));
}
function commitLock(st){
  if(currentSt) unlock(true);
  stats.prevShort=stats.lastShort||null;stats.lastShort=st.listener?null:st.short||null;
  currentSt=st;session++;
  if(!st.door&&!found.has(st.id)){found.add(st.id);save();renderLog();HB.emit("found",st);}
  if(!st.door) addLine("hdr"+(st.dead?" ghost":""),fmt(st.f)+" kHz · "+st.name);
  if(st.listener&&!S.returned&&!S.letIn) addLine("cue","Weak signal. Copy is poor.");
  A.startBed(st);setAudio();setStatus();
  HB.emit("lock",st);
  if(!st.you) runStation(st,session);
}
function unlock(quiet){
  currentSt=null;session++;stopSpeech();HB.emit("unlock");
  if(!quiet&&power) addLine("cue",drifting?"(the dial is moving)":"Signal lost.");
  setStatus();
}

/* ================= tape ================= */
let follow=true;
function atBottom(){return tape.scrollHeight-tape.scrollTop-tape.clientHeight<40;}
function scrollTape(){if(follow) tape.scrollTop=tape.scrollHeight; else $("latest").hidden=false;}
tape.addEventListener("scroll",()=>{follow=atBottom();if(follow) $("latest").hidden=true;},{passive:true});
function addLine(cls,text){
  const p=document.createElement("p");p.className=cls;p.textContent=text;p.dataset.t=Date.now();
  p.style.setProperty("--tilt",((Math.random()-0.5)*0.5).toFixed(2)+"deg");p.style.setProperty("--nudge",((Math.random()-0.5)*2).toFixed(1)+"px");
  tape.appendChild(p);
  while(tape.children.length>110) tape.removeChild(tape.firstChild);
  scrollTape();
  return p;
}
function printNotes(){
  addLine("hdr","Operating notes");
  D.notes.forEach((n,i)=>addLine("say",(i+1)+". "+n));
  if(S.noteDone) addLine("note","6. When switched off, the receiver is not off.");
}
function garble(s){
  const p=clamp((1-clarity())*0.9,0,0.6);
  if(p<=0.01) return s;
  let out="";
  for(const ch of s) out+=Math.random()<p?"·":ch;
  return out;
}
function appendWord(el,word,lead){
  if(lead) el.appendChild(document.createTextNode(" "));
  for(const part of word.split(/(\^.)/)){
    if(!part) continue;
    if(part.length===2&&part[0]==="^"){const b=document.createElement("b");b.className="anom";b.textContent=part[1];el.appendChild(b);}
    else el.appendChild(document.createTextNode(garble(part)));
  }
}

/* ================= programme ================= */
function nextSeg(st){
  if(st.fresh.length) return st.fresh.shift();
  if(st.listener) return listenerSeg(st);
  const seg=()=>{const i=st.i++%st.segs.length;return mk("seg"+i,st.segs[i]);};
  if(st.dead) return seg();
  if(S.returned){ if(st.back&&!st.backDone){st.backDone=true;return mk("misc",[st.back]).concat(seg());} return seg(); }
  if(S.phase>=1&&!st.moonDone){st.moonDone=true;S.moonSegs++;return mk("moon",st.moon);}
  if(S.phase>=2&&!st.wrongDone){st.wrongDone=true;return mk("wrong",st.wrong);}
  const n=st.segs.length+(S.phase>=1?1:0)+(S.phase>=2?1:0), i=st.i++%n;
  if(i<st.segs.length) return mk("seg"+i,st.segs[i]);
  return i===st.segs.length?mk("moon",st.moon):mk("wrong",st.wrong);
}
function resolveLine(item,st){
  let l=item.l;
  if(typeof l!=="string") l=COND[l.if]()?l.t:l.else;
  if(l[0]==="~"||l[0]==="(") return {text:l};
  const cast=item.cast||st.cast, vals={};
  const text=l.replace(/\{(\w+)\}/g,(m,k)=>{vals[k]=slotValue(k,item);return vals[k];});
  let parts=null;
  if(item.g&&cast){
    parts=[];
    for(const p of D.parts(l)){
      const sprite=st.id+"."+(p.slot?"slots":item.g), key=D.hash(cast+"|"+(p.slot?vals[p.slot]:p.text));
      if(!A.clip(sprite,key)){parts=null;break;}
      parts.push({sprite:sprite,key:key});
    }
    if(parts&&!parts.length) parts=null;
  }
  return {text:text,parts:parts};
}
function prepareSeg(st,seg){
  if(!prefs.voiceOn) return Promise.resolve();
  const names=new Set();
  seg.forEach(it=>{if(it.g){names.add(st.id+"."+it.g);if(typeof it.l!=="string"||/\{/.test(it.l)) names.add(st.id+".slots");}});
  return Promise.race([Promise.all([...names].map(A.prepare)),wait(6000)]);
}
async function runStation(st,id,now){
  if(!now) await wait(st.dead?1600:700);
  while(id===session){
    const seg=nextSeg(st);
    await prepareSeg(st,seg);
    for(const item of seg){
      if(id!==session) return;
      await sayLine(item,st,id);
      if(id!==session) return;
      await wait((st.dead?900:420)+Math.random()*380);
      if(id===session&&S.letIn&&!st.listener&&!st.dead&&Math.random()<0.2){
        const it={g:"intrude",l:pick(D.listener.intrude),cast:LISTENER.castDouble};
        await A.prepare("engineer.intrude");
        speakInside=true;setAudio();
        await sayLine(it,LISTENER,id,"his");
        speakInside=false;setAudio();
        await wait(500);
      }
    }
    if(id!==session) return;
    await wait(st.gap||(st.dead?5200:3400));
  }
}
async function sayLine(item,st,id,cls){
  const R=resolveLine(item,st), text=R.text;
  if(text==="~tone"){A.longTone();addLine("cue","(tone)");await wait(1400);return;}
  if(text==="~knock"){await wait(500);A.thump(0);A.thump(0.34);buzz([30,110,30]);addLine("cue","(two knocks, answered)");await wait(1300);return;}
  if(text==="~you"){renderLog();addLine("cue","(the logbook has an entry you did not make)");await wait(1600);return;}
  if(text.charAt(0)==="("){addLine("cue"+(st.dead?" ghost":""),text);await wait(2400);return;}
  if(st.chime){A.chime();await wait(520);}
  if(id!==session) return;
  const kind=cls||(st.dead?"ghost":(st.listener&&replaced()?"his":"say"));
  const el=addLine(kind,"");
  const words=text.split(" "), spoken=text.replace(/\^/g,"");
  const vo={rate:st.dead?0.94:1,dead:!!st.dead,double:!st.dead&&!st.listener&&HB.mood()==="wrong"&&Math.random()<0.35};
  const clipMs=prefs.voiceOn&&R.parts?A.duration(R.parts,vo):0;
  const dur=clipMs||words.length*340+300, lead=clipMs&&st.dead?Math.min(1000,dur*0.3):0;
  HB.emit("line",{text:spoken,st:st,kind:kind,dur:dur});
  const speech=!prefs.voiceOn?Promise.resolve():clipMs?A.say(R.parts,vo):fallbackSpeak(spoken,st,dur);
  const typing=(async()=>{
    const stepMs=(dur-lead)*0.92/words.length;
    if(lead) await wait(lead);
    for(let i=0;i<words.length;i++){
      if(id!==session) return;
      appendWord(el,words[i],i>0);scrollTape();
      await wait(stepMs);
    }
  })();
  await Promise.all([speech,typing]);
}
function skip(){
  const st=currentSt;
  if(!st||st.you||st.door) return;
  session++;stopSpeech();addLine("cue","(you turn the page for them)");
  runStation(st,session,true);
}

/* ================= voices that are not on tape: Claude's, or the browser's ================= */
const FALLV=["rounded","glassy","buttery","airy"];
function fallbackSpeak(text,st,dur){
  if(ttsCap){
    return ttsCap.speak(text,{voice:FALLV[st.vi%4],rate:st.dead?0.82:1,language:"en"}).catch(e=>{if(e&&e.code==="not_granted") ttsCap=null;});
  }
  if(!synthDead){
    return new Promise(res=>{
      let started=false, done=false;
      const fin=()=>{if(!done){done=true;res();}};
      try{
        const u=new SpeechSynthesisUtterance(text);
        u.rate=st.dead?0.85:1;u.pitch=0.7+(st.vi%5)*0.12;u.lang="en";
        const vs=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));
        if(vs.length) u.voice=vs[st.vi%vs.length];
        u.onstart=()=>{started=true;};u.onend=fin;u.onerror=fin;
        speechSynthesis.speak(u);
        setTimeout(()=>{if(!started&&!done){synthDead=true;try{speechSynthesis.cancel();}catch(_){}fin();}},1800);
        setTimeout(fin,dur*2+4000);
      }catch(_){synthDead=true;fin();}
    });
  }
  return Promise.resolve();
}
function stopSpeech(){
  A.stopVoice();
  try{ttsCap&&ttsCap.stop();}catch(_){}
  try{"speechSynthesis" in window&&speechSynthesis.cancel();}catch(_){}
}

/* ================= calling in, going on air, your own station ================= */
function placeYours(){
  if(YOURS.f) return;
  let f=Math.round(clamp(freq,FMIN+100,FMAX-100)/5)*5;
  const clear=x=>LIVING.concat(DEAD).every(s=>Math.abs(s.f-x)>=120);
  for(let k=0;k<200&&!clear(f);k++) f+=(k%2?1:-1)*(k+1)*25;
  YOURS.f=clamp(f,FMIN+100,FMAX-100);prefs.yoursF=YOURS.f;savePrefs();
  found.add("yours");save();renderLog();
  addLine("cue","(a carrier comes up on "+fmt(YOURS.f)+" kHz. Nobody licensed it. It is yours.)");
  updateTuning();drawDial();
}
HB.onTrack=(name,kind)=>{if(currentSt&&currentSt.you) addLine("cue",(kind==="clip"?"◉ ":"♪ ")+name);};
async function callIn(text,clip){
  if(text) addLine("you","You, on the air: "+text);
  else if(clip) addLine("you","(you, on the air, "+Math.round(clip.secs)+" seconds)");
  stats.spoke=true;HB.emit("call",currentSt);
  if(clip) placeYours();
  const st=currentSt;
  if(!st){ if(power&&!clip) addLine("cue","(nobody is on this frequency. It went out anyway.)"); return; }
  if(st.you) return;
  if(st.door){addLine("cue ghost","(the door does not answer words. It is waiting for something else.)");return;}
  const L=D.listener;
  let reply=null;
  if(st.listener) reply=replaced()?mk("calls",L.calls,st.castDouble):mk("home",L.callsHome,st.cast);
  else if(st.dead&&!st.calls){addLine("cue ghost","(the dead cannot hear the living. One of them looks up anyway.)");return;}
  else if(text&&sampleCap&&!st.dead){
    const note=addLine("cue","(the line clicks)");
    try{
      const r=await sampleCap("You write for an invented shortwave radio station inside a strange, deadpan radio toy. Station: "+st.name+". Premise: "+st.brief+worldLine(st)+
        " A listener has just got through to the station and said: \""+text.slice(0,300)+"\". Write the station's on-air response: 2 or 3 short spoken lines, in the station's own voice and format, deadpan, kind underneath, never breaking the premise, never mentioning AI. Output only the spoken lines, one per line, plain text.",{modelTier:"quick",cache:false});
      const lines=String(r&&r.text||"").split("\n").map(s=>s.trim().replace(/^[-*\d.)\s]+/,"").replace(/[{}~^]/g,"")).filter(s=>s.length>2&&s.charAt(0)!=="(").slice(0,3);
      if(lines.length) reply=mk(null,lines);
      note.remove();
    }catch(e){if(e&&e.code==="not_granted") sampleCap=null;}
  }
  if(!reply&&st.calls) reply=mk("misc",st.calls);
  if(!reply||st!==currentSt) return;
  st.fresh.unshift(reply);
  session++;stopSpeech();
  runStation(st,session,true);
}
function worldLine(st){
  return st.dead?"":S.returned?" Tonight the moon, which had vanished, came back. The station is quietly relieved.":
    S.phase>=2?" The moon vanished from the sky a little while ago with no other effect, and now things are subtly wrong: people replaced by near-identical copies, and a sense that the listener is being listened to. Deadpan and eerie rather than jokey.":
    S.phase>=1?" This evening everyone noticed that the moon has simply vanished. Nothing else has changed. The station deals with it in its own way.":"";
}
async function toggleAir(){
  const b=$("onair");
  if(A.onAir()){
    const clip=await A.stopMic();
    b.classList.remove("live");$("airlamp").classList.remove("lit");setStatus();
    if(clip) callIn(null,clip); else addLine("cue","(too short to carry)");
    A.restartYours();
    return;
  }
  try{
    await A.startMic(prefs.monitor);
    b.classList.add("live");$("airlamp").classList.add("lit");setStatus();
    addLine("cue","(on air. Press again to stop.)");
  }catch(_){
    addLine("cue","(no microphone here. Run the set from your own machine to go on air, or use Call in and type.)");
    b.hidden=true;
  }
}

/* ================= motion, drag, taps ================= */
function cancelAnim(){if(anim){cancelAnimationFrame(anim);anim=0;}}
function animateTo(target){
  cancelAnim();drifting=false;
  if(reduced){setFreq(target);return;}
  const f0=freq, dist=Math.abs(target-f0), dur=clamp(dist/2.2,260,1400), t0=performance.now();
  const step=now=>{
    const p=Math.min(1,(now-t0)/dur), e=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    setFreq(f0+(target-f0)*e);
    anim=p<1?requestAnimationFrame(step):0;
  };
  anim=requestAnimationFrame(step);
}
function afc(){
  const n=nearest(false);
  if(n.st&&Math.abs(n.d)<=14&&Math.abs(n.d)>0.4) animateTo(n.st.f);
}
function coast(v){
  cancelAnim();
  if(reduced||Math.abs(v)<0.05){afc();return;}
  let last=performance.now();
  const step=now=>{
    const dt=Math.min(50,now-last);last=now;
    setFreq(freq+v*dt);v*=Math.pow(0.996,dt);
    if(Math.abs(v)>0.03&&freq>FMIN&&freq<FMAX) anim=requestAnimationFrame(step);
    else{anim=0;afc();}
  };
  anim=requestAnimationFrame(step);
}
function seek(dir){
  const list=band().filter(s=>!s.hidden).map(s=>s.f).sort((a,b)=>a-b);
  let target;
  if(dir>0) target=list.find(f=>f>freq+7); else target=list.slice().reverse().find(f=>f<freq-7);
  if(target===undefined) target=dir>0?FMAX:FMIN;
  animateTo(target);
}
let drag=null, lastTap=0, knockNoted=false;
cv.addEventListener("pointerdown",e=>{
  cancelAnim();
  drag={x:e.clientX,f:freq,lx:e.clientX,lt:performance.now(),t0:performance.now(),v:0,moved:0};
  try{cv.setPointerCapture(e.pointerId);}catch(_){}
});
cv.addEventListener("pointermove",e=>{
  if(!drag) return;
  const now=performance.now(), dt=now-drag.lt;
  if(dt>0) drag.v=drag.v*0.6+(-(e.clientX-drag.lx)/PPK/dt)*0.4;
  drag.moved=Math.max(drag.moved,Math.abs(e.clientX-drag.x));
  drag.lx=e.clientX;drag.lt=now;
  setFreq(drag.f-(e.clientX-drag.x)/PPK,true);
});
function endDrag(){
  if(!drag) return;
  const now=performance.now(), d=drag;drag=null;
  prefs.freq=Math.round(clamp(freq,FMIN,FMAX));
  if(d.moved<6&&now-d.t0<350){tapDial(now);afc();return;}
  if(freq<FMIN||freq>FMAX){animateTo(clamp(freq,FMIN,FMAX));return;}
  coast(now-d.lt>90?0:d.v);
}
cv.addEventListener("pointerup",endDrag);cv.addEventListener("pointercancel",()=>{if(drag){drag.moved=99;endDrag();}});
function tapDial(now){
  A.tink();buzz(6);
  const dbl=now-lastTap<560;lastTap=dbl?0:now;
  const onHim=power&&currentSt&&currentSt.listener&&replaced();
  const onDoor=!power&&currentSt&&currentSt.door;
  if(dbl){
    if(onHim&&!S.letIn){letHimIn();return;}
    if(onDoor){shutDoor();return;}
  }
  if(onHim) setTimeout(()=>{A.thump(0,0.8);buzz(28);HB.emit("knock");if(!knockNoted){knockNoted=true;addLine("cue","(a knock, from the other side of the glass)");}},520);
}
function holdKey(btn,delta){
  let h=0, h2=0;
  const stop=()=>{clearTimeout(h);clearInterval(h2);};
  btn.addEventListener("pointerdown",()=>{
    cancelAnim();setFreq(Math.round(freq)+delta);
    h=setTimeout(()=>{h2=setInterval(()=>setFreq(Math.round(freq)+delta),90);},380);
  });
  ["pointerup","pointerleave","pointercancel"].forEach(ev=>btn.addEventListener(ev,stop));
  btn.addEventListener("click",e=>{if(e.detail===0){cancelAnim();setFreq(Math.round(freq)+delta);}});
}
holdKey($("finedn"),-1);holdKey($("fineup"),1);
$("seekdn").addEventListener("click",()=>seek(-1));
$("seekup").addEventListener("click",()=>seek(1));
$("next").addEventListener("click",skip);
$("latest").addEventListener("click",()=>{follow=true;$("latest").hidden=true;tape.scrollTop=tape.scrollHeight;});

/* ================= keys that push back; screws that look ================= */
const screws=[].slice.call(document.querySelectorAll(".screw"));
let keyRects=[], screwPos=[], leanRaf=0, eatNoted=false;
function measure(){
  keyRects=[].slice.call(document.querySelectorAll(".face .key")).map(k=>{const r=k.getBoundingClientRect();return {k:k,x:r.left+r.width/2,y:r.top+r.height/2};});
  screwPos=screws.map(s=>{const r=s.getBoundingClientRect();return {s:s,x:r.left+r.width/2,y:r.top+r.height/2};});
}
function lean(){
  leanRaf=0;
  for(const o of keyRects){
    let lx=0, ly=0;
    if(ptr&&!reduced){
      const dx=ptr.x-o.x, dy=ptr.y-o.y, dist=Math.hypot(dx,dy)||1, pull=Math.max(0,1-dist/170), m=pull*pull*6;
      lx=dx/dist*m;ly=dy/dist*m;
    }
    o.k.style.setProperty("--lx",lx.toFixed(2)+"px");o.k.style.setProperty("--ly",ly.toFixed(2)+"px");
  }
  if(!S.letIn&&ptr) for(const o of screwPos) o.s.style.setProperty("--a",(Math.atan2(ptr.y-o.y,ptr.x-o.x)*57.2958).toFixed(1)+"deg");
}
const askLean=()=>{if(!leanRaf) leanRaf=requestAnimationFrame(lean);};
document.addEventListener("pointermove",e=>{ptr={x:e.clientX,y:e.clientY};askLean();},{passive:true});
document.addEventListener("pointerup",e=>{if(e.pointerType!=="mouse"){ptr=null;askLean();}},{passive:true});
document.addEventListener("pointercancel",()=>{ptr=null;askLean();},{passive:true});
document.addEventListener("pointerdown",e=>{
  if(A.init()&&!audioReady){audioReady=true;A.setVolume(prefs.vol/100);HB.emit("audio");}
  A.resume();
  lastTouch=performance.now();stats.taps++;
  if(drifting){drifting=false;updateTuning();}
  if(S.pendingMoon) moonfall();
  measure();ptr={x:e.clientX,y:e.clientY};askLean();
  const k=e.target.closest&&e.target.closest(".key");
  if(!k||k.disabled) return;
  k.classList.add("down");A.thunk(1,0.85+(k.offsetLeft%7)*0.05);buzz(8);
  const plain=k.id==="finedn"||k.id==="fineup"||k.closest(".chips")||k.closest(".drawer");
  const eat=plain?0:setTimeout(()=>{
    k.classList.add("eaten");A.gulp();buzz([30,40,70]);
    if(!eatNoted){eatNoted=true;addLine("cue","(the key held on a moment longer than you did)");}
  },2200);
  const up=()=>{
    clearTimeout(eat);
    setTimeout(()=>k.classList.remove("down"),S.phase>=2&&!S.returned?150:50);
    if(k.classList.contains("eaten")) setTimeout(()=>{k.classList.remove("eaten");A.thunk(0.5,0.6);},900);
    window.removeEventListener("pointerup",up);window.removeEventListener("pointercancel",up);
    const pEcho=plain?0:S.letIn?0.45:S.returned?0.03:S.phase>=2?0.2:S.phase>=1?0.09:0.03;
    if(Math.random()<pEcho) setTimeout(()=>{k.classList.add("ghostdown");A.thunk(0.4,0.7);buzz(5);setTimeout(()=>k.classList.remove("ghostdown"),170);},650+Math.random()*450);
  };
  window.addEventListener("pointerup",up);window.addEventListener("pointercancel",up);
},true);

/* ================= power, volume, settings ================= */
function setPower(on){
  if(on===power) return;
  power=on;
  if(power){const first=!S.everOn;S.everOn=true;if(first) addLine("cue","Receiver on. Drag the dial or press Seek.");}
  else stats.powerCycles++;
  clearTimeout(lockTimer);pendingSt=null;drifting=false;
  if(currentSt) unlock(true);
  stopSpeech();A.stopBed();bedSt=null;
  radio.classList.toggle("on",power);radio.classList.toggle("dead",deadMode());
  $("power").setAttribute("aria-pressed",String(power));
  $("powerlamp").classList.toggle("lit",power);
  updateTuning();drawDial();
  HB.emit("power",power);
}
$("power").addEventListener("click",()=>setPower(!power));
$("volume").addEventListener("input",e=>{prefs.vol=+e.target.value;A.setVolume(prefs.vol/100);});
$("volume").addEventListener("change",savePrefs);
function applyPrefs(){
  $("volume").value=prefs.vol;A.setVolume(prefs.vol/100);
  A.setMix({voice:prefs.voice/100,music:prefs.music/100,static:prefs.static/100,room:prefs.room/100});
  ["voice","music","static","room"].forEach(k=>{$("mix-"+k).value=prefs[k];});
  $("opt-voice").checked=prefs.voiceOn;$("opt-still").checked=prefs.still;$("opt-haptics").checked=prefs.haptics;$("opt-monitor").checked=prefs.monitor;
  radio.dataset.text=prefs.text;
  document.querySelectorAll(".drawer [data-text]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.text===prefs.text)));
  $("log").classList.toggle("open",!!prefs.logOpen);$("logtoggle").setAttribute("aria-expanded",String(!!prefs.logOpen));
}
["voice","music","static","room"].forEach(k=>$("mix-"+k).addEventListener("input",e=>{prefs[k]=+e.target.value;A.setMix({voice:prefs.voice/100,music:prefs.music/100,static:prefs.static/100,room:prefs.room/100});savePrefs();}));
$("opt-voice").addEventListener("change",e=>{prefs.voiceOn=e.target.checked;if(!prefs.voiceOn) stopSpeech();savePrefs();});
$("opt-still").addEventListener("change",e=>{prefs.still=e.target.checked;savePrefs();});
$("opt-haptics").addEventListener("change",e=>{prefs.haptics=e.target.checked;savePrefs();});
$("opt-monitor").addEventListener("change",e=>{prefs.monitor=e.target.checked;savePrefs();});
document.querySelectorAll(".drawer [data-text]").forEach(b=>b.addEventListener("click",()=>{prefs.text=b.dataset.text;savePrefs();applyPrefs();}));
const drawer=$("drawer");
function openDrawer(o){drawer.hidden=!o;$("cog").setAttribute("aria-expanded",String(o));if(o){updateMediaLine();$("drawer-close").focus();}else measure();}
$("cog").addEventListener("click",()=>openDrawer(drawer.hidden));
$("drawer-close").addEventListener("click",()=>openDrawer(false));
$("notes").addEventListener("click",()=>{printNotes();openDrawer(false);});
$("logtoggle").addEventListener("click",()=>{prefs.logOpen=!prefs.logOpen;savePrefs();applyPrefs();measure();});
function updateMediaLine(){
  const t=A.media.tracks.length, c=A.media.clips.length;
  $("medialine").textContent=(t||c)?t+" track"+(t===1?"":"s")+", "+c+" recording"+(c===1?"":"s")+(YOURS.f?", on "+fmt(YOURS.f)+" kHz":""):"Nothing yet. Add music and it gets its own place on the dial.";
}
$("addtracks").addEventListener("change",async e=>{
  const n=await A.addFiles(e.target.files);e.target.value="";
  if(n){placeYours();updateMediaLine();A.restartYours();renderLog();addLine("cue","("+n+" record"+(n===1?"":"s")+" added to your station)");}
});
$("cleartracks").addEventListener("click",async()=>{await A.clearMedia();updateMediaLine();updateTuning();renderLog();drawDial();});
/* call in */
const callrow=$("callrow");
$("call").addEventListener("click",()=>{callrow.hidden=!callrow.hidden;if(!callrow.hidden) $("calltext").focus();measure();});
callrow.addEventListener("submit",e=>{
  e.preventDefault();
  const v=$("calltext").value.trim();
  if(!v) return;
  $("calltext").value="";callrow.hidden=true;measure();callIn(v,null);
});
$("dictate").addEventListener("click",()=>{
  if(!dictCap) return;
  const b=$("dictate");
  if(b.classList.contains("live")){dictCap.stop().catch(()=>{});return;}
  dictCap.start().catch(e=>{if(e&&e.code==="not_granted"){dictCap=null;b.hidden=true;}});
});
$("onair").addEventListener("click",toggleAir);

/* ================= new transmissions from Claude ================= */
$("fresh").addEventListener("click",async()=>{
  const st=currentSt, b=$("fresh");
  if(!st||!sampleCap||st.door||st.you) return;
  b.disabled=true;openDrawer(false);
  const note=addLine("cue","Requesting a new transmission from "+st.name+"…");
  const prompt="You write scripts for an invented shortwave radio station inside a strange, deadpan radio toy. Station: "+st.name+". Premise: "+st.brief+worldLine(st)+
    " Write one new broadcast segment for it: 5 to 7 short spoken lines (fewer if the premise says so), deadpan, dry, absurd but consistent with the premise. No real living people, brands or current events. Output only the spoken lines, one per line, plain text, with no numbering, no stage directions, no quotation marks and no commentary.";
  try{
    const r=await sampleCap(prompt,{modelTier:"quick",cache:false});
    const lines=String(r&&r.text||"").split("\n").map(s=>s.trim().replace(/^[-*\d.)\s]+/,"").replace(/[{}~^]/g,"")).filter(s=>s.length>2&&s.charAt(0)!=="(").slice(0,8);
    if(lines.length>=2){st.fresh.push(mk(null,lines));note.textContent="New transmission received. It follows this segment.";}
    else note.textContent="That came through empty. Try again.";
  }catch(e){
    if(e&&e.code==="not_granted"){sampleCap=null;note.textContent="New transmissions are switched off for this page.";}
    else note.textContent="The ionosphere declined. Try again in a while.";
  }
  setStatus();
});

/* ================= logbook ================= */
function chip(text,cls,id,fn){
  const b=document.createElement("button"), c=document.createElement("span");
  b.className="key "+(cls||"");b.dataset.id=id;c.className="cap";c.textContent=text;b.appendChild(c);
  b.addEventListener("click",fn);return b;
}
function renderLog(){
  const box=$("chips");box.textContent="";
  const lf=LIVING.filter(s=>found.has(s.id)), df=DEAD.filter(s=>found.has(s.id));
  $("count").textContent=lf.length+" of "+LIVING.length+(df.length?" · "+df.length+" elsewhere":"")+(hasYours()?" · yours":"");
  if(!lf.length&&!df.length&&!S.letIn&&!hasYours()){const em=document.createElement("em");em.textContent="Nothing logged yet.";box.appendChild(em);return;}
  for(const st of lf) box.appendChild(chip(fmt(st.f)+" "+st.name,"",st.id,()=>animateTo(st.f)));
  if(hasYours()) box.appendChild(chip(fmt(YOURS.f)+" Yours","yourchip","yours",()=>animateTo(YOURS.f)));
  for(const st of df) box.appendChild(chip(fmt(st.f)+" "+st.name,"ghostchip",st.id,()=>animateTo(st.f)));
  if(S.letIn) box.appendChild(chip("You · logged "+S.youAt,"hischip","you",()=>animateTo(LISTENER.f)));
  setStatus();
}
$("reset").addEventListener("click",()=>{
  Object.assign(S,{phase:0,letIn:false,returned:false,youAt:"",listenMs:0,moonMs:0,moonSegs:0,pendingMoon:false,noteDone:false});
  found=new Set(hasYours()?["yours"]:[]);obsI=0;insI=0;knockNoted=false;erased.length=0;
  ALL.forEach(s=>{s.moonDone=s.wrongDone=s.backDone=s.met=s.homeDone=false;s.fresh=[];});
  LISTENER.hidden=true;LISTENER.max=0.88;LISTENER.lock=3;
  K.setMoon(1,true);setMoonlight();
  try{localStorage.removeItem(KEY);}catch(_){}
  session++;if(currentSt) unlock(true);pendingSt=null;
  tape.textContent="";addLine("cue","(the night starts over)");printNotes();
  renderLog();updateTuning();drawDial();openDrawer(false);
  HB.emit("phase","reset");
});

/* ================= keyboard ================= */
document.addEventListener("keydown",e=>{
  if(e.target.matches&&e.target.matches("input,textarea")){ if(e.key==="Escape") e.target.blur(); return; }
  const k=e.key;
  if(k==="Escape"){openDrawer(false);callrow.hidden=true;return;}
  if(e.target.closest&&e.target.closest("button")&&(k===" "||k==="Enter")) return;
  if(k==="ArrowLeft"||k==="ArrowRight"){cancelAnim();setFreq(freq+(k==="ArrowRight"?1:-1)*(e.shiftKey?10:1));e.preventDefault();}
  else if(k==="ArrowUp"||k==="PageUp"){seek(1);e.preventDefault();}
  else if(k==="ArrowDown"||k==="PageDown"){seek(-1);e.preventDefault();}
  else if(k===" "){setPower(!power);e.preventDefault();}
  else if(k==="n"||k==="N") skip();
  else if(k==="Enter"&&document.activeElement===cv) tapDial(performance.now());
});

/* ================= ticker ================= */
let tickN=0, hiddenAt=0;
setInterval(()=>{
  const dt=220;tickN++;
  if(document.hidden) return;
  if(power||deadMode()) setAudio();
  if(power){
    S.listenMs+=dt;
    if(currentSt) stats.dwell[currentSt.id]=(stats.dwell[currentSt.id]||0)+dt;
    if(S.phase===0&&!S.pendingMoon&&(livingFound()>=4||S.listenMs>270000)) S.pendingMoon=true;
    if(S.phase===1&&(S.moonSegs>=3||S.listenMs-S.moonMs>210000)){S.phase=2;save();HB.emit("phase","wrong");}
  }
  if(tickN%3===0) tickSkin(dt*3);
  if(tickN%40===0) A.nextChord();
  if(tickN%45===0){save();savePrefs();}
  if(tickN%27===0&&S.phase>=1&&!S.returned) eraseMoon();
  const idle=performance.now()-lastTouch;
  if(S.letIn){
    $("powerlamp").classList.toggle("lit",power&&Math.floor(performance.now()/1100)%2===0);
    const a=((performance.now()/1000)*9)%360;
    screws.forEach(s=>s.style.setProperty("--a",a.toFixed(1)+"deg"));
    if(power&&idle>15000&&!drag&&!anim&&Math.abs(freq-LISTENER.f)>3){
      if(!drifting){drifting=true;updateTuning();}
      setFreq(freq+Math.sign(LISTENER.f-freq)*Math.min(4.4,Math.abs(LISTENER.f-freq)));
      if(Math.abs(freq-LISTENER.f)<=3){drifting=false;updateTuning();}
    }
  }else{
    $("powerlamp").classList.toggle("lit",power);
    if(S.phase>=2&&!S.returned&&idle>9000&&Math.random()<0.03) pick(screws).style.setProperty("--a",(Math.random()*360).toFixed(0)+"deg");
  }
},220);
setInterval(()=>{skyLvl=lerp(skyLvl,A.level(),0.4);if(!document.hidden&&HB.view==="set"){drawSky();drawEye();}},100);
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){hiddenAt=Date.now();save();savePrefs();}
  else{A.resume();if(hiddenAt&&Date.now()-hiddenAt>20000) lookedAway();}
});

/* ================= boot ================= */
function start(data){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(KEY)||"null");}catch(_){}
  if(data&&data.S) saved=data.S;
  if(saved&&typeof saved==="object"){
    if(Array.isArray(saved.found)) saved.found.forEach(id=>found.add(id));
    ["phase","letIn","returned","youAt","listenMs","moonMs","moonSegs","noteDone"].forEach(k=>{if(saved[k]!==undefined) S[k]=saved[k];});
  }
  if(data&&typeof data.freq==="number") freq=data.freq;
  freq=clamp(freq||6000,FMIN,FMAX);
  if(S.returned){LISTENER.hidden=false;LISTENER.max=1;LISTENER.lock=6;}
  if(S.letIn) LISTENER.max=1;
  if(S.phase>=1&&!S.returned) K.setMoon(0,true);
  setMoonlight();
  labelEls=[].slice.call(document.querySelectorAll("[data-l]"));
  texEls=[].slice.call(document.querySelectorAll(".tex"));
  document.querySelectorAll(".keys .key,.keys2 .key,.power").forEach((k,i)=>k.style.setProperty("--bd",(-i*0.83)+"s"));
  newOrders();applySkin(0);lastDet=Math.floor(freq/10);
  const ol=$("notelist");D.notes.forEach(n=>{const li=document.createElement("li");li.textContent=n;ol.appendChild(li);});
  applyPrefs();renderLog();setFreq(freq);drawSky();drawEye();measure();
  $("onair").hidden=!A.micSupported();
  A.loadMedia().then(()=>{if(hasYours()) found.add("yours");renderLog();updateTuning();drawDial();});
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{drawDial();measure();});
  window.addEventListener("resize",()=>{drawDial();drawSky();measure();});
  if("speechSynthesis" in window){try{speechSynthesis.getVoices();}catch(_){}}
  const c=window.claude;
  if(c&&typeof c.use==="function"){
    c.use("tts").then(t=>{if(t) ttsCap=t;}).catch(()=>{});
    c.use("sample").then(s=>{if(s){sampleCap=s;$("fresh").hidden=false;setStatus();}}).catch(()=>{});
    c.use("dictation").then(d=>{
      if(!d) return;
      dictCap=d;$("dictate").hidden=false;
      try{
        d.onPartial(o=>{$("calltext").placeholder=o.text||"";});
        d.onFinal(o=>{const i=$("calltext");i.value=(i.value?i.value+" ":"")+o.text;i.placeholder="Say something to the station";});
        d.onState(o=>$("dictate").classList.toggle("live",o.state==="listening"));
      }catch(_){}
    }).catch(()=>{});
  }
}
const hot=window.claude&&window.claude.hot;
if(hot&&hot.snapshot) hot.snapshot(()=>({freq:freq,S:{found:[...found],phase:S.phase,letIn:S.letIn,returned:S.returned,youAt:S.youAt,listenMs:S.listenMs,moonMs:S.moonMs,moonSegs:S.moonSegs,noteDone:S.noteDone}}));
if(hot&&hot.ready) hot.ready(start); else start((hot&&hot.data)||{});
/* what the room is allowed to know about the set */
function skipQuiet(){const st=currentSt;if(!st||st.you||st.door) return;session++;stopSpeech();runStation(st,session,true);}
HB.radio={S:S,stats:stats,prefs:prefs,found:()=>found,LIVING:LIVING,DEAD:DEAD,LISTENER:LISTENER,get power(){return power;},get current(){return currentSt;},get freq(){return freq;},
  redraw:()=>{drawDial();drawSky();drawEye();},deadMode:deadMode,replaced:replaced,clarity:clarity,addLine:addLine,setPower:setPower,tune:f=>animateTo(f),skipQuiet:skipQuiet,sky:skyState,measure:measure,buzz:buzz,savePrefs:savePrefs};
/* a phone is not a mouse: no menus on a long press, and the sound comes back when you do */
document.addEventListener("contextmenu",e=>{if(e.target.closest&&e.target.closest(".key,canvas,.obj,.door")) e.preventDefault();});
/* for the curious: a handle on the night */
HB.debug={state:S,stats:stats,prefs:prefs,tune:f=>setFreq(f),power:setPower,moonfall:moonfall,tap:()=>tapDial(performance.now()),call:t=>callIn(t,null),skip:skip,
  skin:(n,p)=>{skinIdx=((n%SKINS.length)+SKINS.length)%SKINS.length;stageI=0;skinT=0;newOrders();applySkin(p||0);drawDial();},away:lookedAway};
window.hollowband=HB.debug;
})();
