/* Hollowband Receiver — sound.
   The audio graph, the instruments, a theme for every station, the voices, the room, the world outside it,
   your own tracks, your microphone. Everything here is reached through HB.sound; radio.js and room.js decide
   what should be heard, this file makes it.

   Three places a sound can come from, and it matters which:
     the set      static, music, voices; heard close when you sit at it, dull and smaller from across the room
     the room     the goose, the lamp, the kettle, the clock, the letterbox
     outside      the bell, the foghorn, the sea, the wires; through the window, late, because sound is slow */
(function(){
"use strict";
const HB=window.HB=window.HB||{};
/* a small bus, so the room and the radio can hear about each other */
const subs={};
HB.on=function(ev,fn){(subs[ev]=subs[ev]||[]).push(fn);return function(){subs[ev]=(subs[ev]||[]).filter(f=>f!==fn);};};
HB.emit=function(ev,a,b){(subs[ev]||[]).slice().forEach(f=>{try{f(a,b);}catch(e){if(window.console) console.error(e);}});};

const S=HB.sound={};
let ctx=null, master, analyser, radioOut, radioLP, fx, conv, wet, NB, nbp, noiseGain, staticMix, musicMix, voiceMix, roomMix, roomBus, airBus, airLP, airGain, res=[], whistle, whistle2, whistleGain;
let bedGain, bedTrim, vIn, vHP, vLP, vGain, vSend, wowDepth, bedStop=null, bedName="", winOpen=false, deadAir=false;
const mix={voice:1,music:1,static:1,room:1};
const mf=m=>440*Math.pow(2,(m-69)/12);
const mood=()=>HB.mood?HB.mood():"normal";
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const setT=(p,v,tc)=>p.setTargetAtTime(v,ctx.currentTime,tc||0.1);
S.ctx=()=>ctx;

/* ---------------- graph ---------------- */
let vol=0.7;
S.init=function(){
  if(ctx) return true;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return false;
  try{ctx=new AC();}catch(_){ctx=null;return false;}
  const lim=ctx.createDynamicsCompressor();lim.threshold.value=-8;lim.knee.value=6;lim.ratio.value=8;lim.attack.value=0.004;lim.release.value=0.2;
  master=ctx.createGain();master.gain.value=vol;master.connect(lim);lim.connect(ctx.destination);
  /* the set */
  radioOut=ctx.createGain();radioLP=ctx.createBiquadFilter();radioLP.type="lowpass";radioLP.frequency.value=2300;radioOut.gain.value=0.62;
  radioOut.connect(radioLP);radioLP.connect(master);
  analyser=ctx.createAnalyser();analyser.fftSize=256;radioOut.connect(analyser);
  fx=ctx.createGain();fx.connect(radioOut);
  conv=ctx.createConvolver();
  const irLen=Math.floor(ctx.sampleRate*3), ir=ctx.createBuffer(2,irLen,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<irLen;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/irLen,2.6);}
  conv.buffer=ir;wet=ctx.createGain();wet.gain.value=0.22;fx.connect(conv);conv.connect(wet);wet.connect(master);
  NB=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
  const d=NB.getChannelData(0);for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  /* static, and the chord it hums */
  const src=ctx.createBufferSource();src.buffer=NB;src.loop=true;
  nbp=ctx.createBiquadFilter();nbp.type="bandpass";nbp.frequency.value=1700;nbp.Q.value=0.45;
  noiseGain=ctx.createGain();noiseGain.gain.value=0;
  staticMix=ctx.createGain();staticMix.connect(radioOut);
  src.connect(nbp);nbp.connect(noiseGain);noiseGain.connect(staticMix);
  const resMix=ctx.createGain();resMix.gain.value=3;resMix.connect(noiseGain);
  for(let i=0;i<3;i++){const f=ctx.createBiquadFilter();f.type="bandpass";f.Q.value=40;f.frequency.value=CHORDS[0][i]*2;src.connect(f);f.connect(resMix);res.push(f);}
  src.start();
  whistle=ctx.createOscillator();whistle.frequency.value=900;whistle2=ctx.createOscillator();whistle2.frequency.value=600;
  whistleGain=ctx.createGain();whistleGain.gain.value=0;
  const w2=ctx.createGain();w2.gain.value=0.5;
  whistle.connect(whistleGain);whistle2.connect(w2);w2.connect(whistleGain);whistleGain.connect(staticMix);whistle.start();whistle2.start();
  /* music */
  musicMix=ctx.createGain();musicMix.connect(fx);
  bedGain=ctx.createGain();bedGain.gain.value=0;bedTrim=ctx.createGain();bedGain.connect(bedTrim);bedTrim.connect(musicMix);
  /* voices: a narrow band, a little valve warmth, a little tape wow */
  vIn=ctx.createGain();
  vHP=ctx.createBiquadFilter();vHP.type="highpass";vHP.frequency.value=280;
  vLP=ctx.createBiquadFilter();vLP.type="lowpass";vLP.frequency.value=3400;
  const shaper=ctx.createWaveShaper(), cu=new Float32Array(1024);
  for(let i=0;i<1024;i++){const x=i/511.5-1;cu[i]=Math.tanh(1.7*x)/Math.tanh(1.7);}
  shaper.curve=cu;
  vGain=ctx.createGain();voiceMix=ctx.createGain();vSend=ctx.createGain();vSend.gain.value=0;
  vIn.connect(vHP);vHP.connect(vLP);vLP.connect(shaper);shaper.connect(vGain);vGain.connect(voiceMix);voiceMix.connect(radioOut);vGain.connect(vSend);vSend.connect(conv);
  const wow=ctx.createOscillator();wow.frequency.value=0.55;wowDepth=ctx.createGain();wowDepth.gain.value=0.0035;wow.connect(wowDepth);wow.start();
  /* the room, and the air outside it */
  roomMix=ctx.createGain();roomMix.connect(master);
  roomBus=ctx.createGain();roomBus.connect(roomMix);
  const rs=ctx.createGain();rs.gain.value=0.14;roomBus.connect(rs);rs.connect(conv);
  airBus=ctx.createGain();airLP=ctx.createBiquadFilter();airLP.type="lowpass";airLP.frequency.value=650;airGain=ctx.createGain();airGain.gain.value=0.2;
  airBus.connect(airLP);airLP.connect(airGain);airGain.connect(roomMix);
  const as=ctx.createGain();as.gain.value=0.3;airGain.connect(as);as.connect(conv);
  S.setMix(mix);
  setInterval(worldTick,500);
  return true;
};
S.resume=()=>{if(ctx&&ctx.state==="suspended") ctx.resume().catch(()=>{});};
S.setVolume=v=>{vol=v;if(master) setT(master.gain,v,0.03);};
S.setMix=m=>{
  Object.assign(mix,m);
  if(!ctx) return;
  setT(voiceMix.gain,mix.voice*0.8,0.05);setT(musicMix.gain,mix.music*1.5,0.05);setT(staticMix.gain,mix.static,0.05);setT(roomMix.gain,mix.room,0.05);
};
S.level=function(){
  if(!analyser) return 0;
  const b=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(b);
  let s=0;for(let i=0;i<b.length;i++){const v=(b[i]-128)/128;s+=v*v;}
  return Math.min(1,Math.sqrt(s/b.length)*4);
};
/* sitting at the set, or leaning back from it */
S.setDistance=function(far){
  if(!ctx) return;
  setT(radioLP.frequency,far?2300:18000,0.25);setT(radioOut.gain,far?0.62:1,0.25);setT(roomBus.gain,far?1:0.5,0.25);
};
S.setWindow=function(open){winOpen=!!open;airNow();};
function airNow(){if(!ctx) return;setT(airLP.frequency,winOpen?3600:650,0.3);setT(airGain.gain,deadAir?0:winOpen?0.85:0.2,0.4);}

/* What the set should sound like right now.
   o: {power, dead, s (0..1 nearness to a station), d (kHz off), locked, clarity (0..1), inside} */
let fadePhase=Math.random()*10;
S.tune=function(o){
  if(!ctx) return;
  const t=ctx.currentTime, far=1-o.s;
  let n=0, w=0, b=0;
  if(o.power){
    /* the static thins as you close on a station and all but goes once you are on it */
    n=o.locked?0.004+(1-o.clarity)*0.07:0.004+0.075*far*far;
    w=o.locked?0:(o.s>0?0.02*o.s*far*2:0);
    b=o.locked?0.35+0.65*o.clarity:o.s*o.s*0.8;
    n*=0.85+Math.random()*0.3;
  }else if(o.dead){
    n=o.locked?0.006:0.012+0.012*far;
    b=o.locked?o.clarity:o.s*o.s*0.7;
    n*=0.7+Math.random()*0.6;
  }
  noiseGain.gain.setTargetAtTime(n,t,o.dead?0.5:0.08);
  nbp.frequency.setTargetAtTime(o.dead?360:1700,t,0.4);
  whistleGain.gain.setTargetAtTime(w,t,0.05);
  const wf=Math.max(150,Math.min(4200,150+Math.abs(o.d)*90));
  whistle.frequency.setTargetAtTime(wf,t,0.03);whistle2.frequency.setTargetAtTime(wf*2/3,t,0.03);
  bedGain.gain.setTargetAtTime(b,t,0.25);
  wet.gain.setTargetAtTime(o.dead?0.9:0.22,t,0.5);
  /* voices fade a little, the way a distant signal breathes */
  fadePhase+=0.05;
  const fade=1-(o.dead?0.2:0.14)*(0.5+0.5*Math.sin(fadePhase))*(o.inside?0:1);
  vGain.gain.setTargetAtTime((0.3+0.7*o.clarity)*fade,t,0.2);
  vHP.frequency.setTargetAtTime(o.inside?60:o.dead?200:280,t,0.3);
  vLP.frequency.setTargetAtTime(o.inside?9000:o.dead?2300:3000+600*o.clarity,t,0.3);
  vSend.gain.setTargetAtTime(o.inside?0:o.dead?0.7:0.05,t,0.3);
  wowDepth.gain.setTargetAtTime(o.inside?0:o.dead?0.011:0.0035,t,0.5);
};
const CHORDS=[[220,261.63,329.63],[174.61,220,261.63],[196,246.94,293.66],[164.81,196,246.94]];
let harm=0;
S.nextChord=function(){if(!ctx) return;harm++;const ch=CHORDS[harm%CHORDS.length];res.forEach((f,i)=>f.frequency.setTargetAtTime(ch[i]*2,ctx.currentTime,1.6));};

/* ---------------- instruments ---------------- */
function tone(f,when,dur,type,vol,flat,dest){
  if(!ctx) return;
  const o=ctx.createOscillator(), a=ctx.createGain();
  o.type=type;o.frequency.value=f;
  a.gain.setValueAtTime(0.0001,when);a.gain.exponentialRampToValueAtTime(vol,when+0.012);
  if(flat){a.gain.setValueAtTime(vol,when+dur-0.04);a.gain.exponentialRampToValueAtTime(0.0001,when+dur);}
  else a.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  o.connect(a);a.connect(dest||bedGain);o.start(when);o.stop(when+dur+0.05);
}
function shaped(when,att,hold,rel,vol,dest,lp){
  const a=ctx.createGain();
  a.gain.setValueAtTime(0.0001,when);a.gain.linearRampToValueAtTime(vol,when+att);
  a.gain.setValueAtTime(vol,when+att+hold);a.gain.linearRampToValueAtTime(0.0001,when+att+hold+rel);
  if(lp){const f=ctx.createBiquadFilter();f.type="lowpass";f.frequency.value=lp;a.connect(f);f.connect(dest||bedGain);}
  else a.connect(dest||bedGain);
  return a;
}
function voice(type,f,when,dur,dest,cents,g){
  const o=ctx.createOscillator();o.type=type;o.frequency.value=f;if(cents) o.detune.value=cents;
  if(g!==undefined){const x=ctx.createGain();x.gain.value=g;o.connect(x);x.connect(dest);}else o.connect(dest);
  o.start(when);o.stop(when+dur+0.1);return o;
}
/* warm pad: the sound of 6,075 */
function pad(f,when,dur,vol,dest,cents){
  if(!ctx) return;
  const a=shaped(when,dur*0.3,dur*0.3,dur*0.4,vol,dest,1600);
  voice("triangle",f,when,dur,a,cents||0);voice("sine",f,when,dur,a,(cents||0)+7,0.8);
}
function ep(f,when,dur,vol,dest){
  if(!ctx) return;
  const a=ctx.createGain();a.gain.setValueAtTime(0.0001,when);a.gain.exponentialRampToValueAtTime(vol,when+0.008);a.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  a.connect(dest||bedGain);
  voice("sine",f,when,dur,a);voice("sine",f*2,when,dur*0.6,a,0,0.22);voice("sine",f*4,when,dur*0.15,a,0,0.08);
}
function bass(f,when,dur,vol,dest){
  if(!ctx) return;
  const a=shaped(when,0.02,dur*0.5,dur*0.5,vol,dest);
  voice("sine",f,when,dur,a);voice("triangle",f,when,dur,a,0,0.25);
}
function reed(f,when,dur,vol,dest){
  if(!ctx) return;
  const a=shaped(when,0.09,Math.max(0.01,dur-0.3),0.25,vol,dest,1500);
  voice("square",f,when,dur,a,0,0.45);voice("sawtooth",f,when,dur,a,-9,0.5);
}
function organ(f,when,dur,vol,dest){
  if(!ctx) return;
  const a=shaped(when,0.012,Math.max(0.01,dur-0.06),0.06,vol,dest);
  [1,2,3,4].forEach((h,i)=>voice("sine",f*h,when,dur,a,0,[1,0.5,0.28,0.16][i]));
}
function whistled(f,when,dur,vol,dest,cents){
  if(!ctx) return;
  const a=shaped(when,0.05,Math.max(0.01,dur-0.12),0.07,vol,dest);
  const o=voice("sine",f,when,dur,a,cents||0), l=ctx.createOscillator(), lg=ctx.createGain();
  l.frequency.value=5.6;lg.gain.value=f*0.012;l.connect(lg);lg.connect(o.frequency);l.start(when);l.stop(when+dur+0.1);
}
function noiseHit(when,dur,vol,type,freq,dest,q){
  if(!ctx) return;
  const s=ctx.createBufferSource(), f=ctx.createBiquadFilter(), a=ctx.createGain();
  s.buffer=NB;s.loop=true;f.type=type;f.frequency.value=freq;if(q) f.Q.value=q;
  a.gain.setValueAtTime(vol,when);a.gain.exponentialRampToValueAtTime(0.0001,when+dur);
  s.connect(f);f.connect(a);a.connect(dest||bedGain);s.start(when,Math.random());s.stop(when+dur+0.05);
}
/* a note that arrives backwards: swells, then is cut */
function reversed(f,when,dur,vol,dest){
  if(!ctx) return;
  const a=ctx.createGain();a.gain.setValueAtTime(0.0001,when);a.gain.exponentialRampToValueAtTime(vol,when+dur);a.gain.linearRampToValueAtTime(0.0001,when+dur+0.04);
  a.connect(dest||bedGain);voice("triangle",f,when,dur,a);voice("sine",f*2.01,when,dur,a,0,0.3);
}
function bell(f,vol,dec,dest,when){
  if(!ctx) return;
  const t=when||ctx.currentTime+0.02;
  [1,2.0,2.4,3.0,4.2,5.4].forEach((r,i)=>tone(f*r,t,dec/(1+i*0.6)+0.3,"sine",vol/(1+i*0.8),false,dest));
}
function swell(dur,f0,f1,vol,dest){
  if(!ctx) return;
  const t=ctx.currentTime+0.05, src=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), a=ctx.createGain();
  src.buffer=NB;src.loop=true;bp.type="bandpass";bp.Q.value=2.2;
  bp.frequency.setValueAtTime(f0,t);bp.frequency.linearRampToValueAtTime(f1,t+dur);
  a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(vol,t+dur*0.4);a.gain.linearRampToValueAtTime(0,t+dur);
  src.connect(bp);bp.connect(a);a.connect(dest||bedGain);src.start(t);src.stop(t+dur+0.1);
}
function slide(f0,f1,dur,vol){
  if(!ctx) return;
  const t=ctx.currentTime+0.03, o=ctx.createOscillator(), lp=ctx.createBiquadFilter(), a=ctx.createGain();
  o.type="sawtooth";o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  lp.type="lowpass";lp.frequency.value=900;
  a.gain.setValueAtTime(0.0001,t);a.gain.exponentialRampToValueAtTime(vol,t+0.06);a.gain.setValueAtTime(vol,t+dur*0.8);a.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.2);
  o.connect(lp);lp.connect(a);a.connect(bedGain);o.start(t);o.stop(t+dur+0.3);
}
function sustained(partsList,dest){
  const t=ctx.currentTime, nodes=partsList.map(p=>{
    const o=ctx.createOscillator(), a=ctx.createGain();
    o.type=p[1];o.frequency.value=p[0];a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(p[2],t+1.2);
    o.connect(a);a.connect(dest||bedGain);o.start();return [o,a];
  });
  return ()=>{const e=ctx.currentTime;nodes.forEach(n=>{try{n[1].gain.cancelScheduledValues(e);n[1].gain.setTargetAtTime(0,e,0.08);n[0].stop(e+0.5);}catch(_){}});};
}
/* a tone that falls, or climbs, forever and gets nowhere */
function shepard(dir,vol,dest){
  const N=6, os=[];
  for(let i=0;i<N;i++){const o=ctx.createOscillator(), a=ctx.createGain();a.gain.value=0;o.connect(a);a.connect(dest||bedGain);o.start();os.push([o,a,-1]);}
  let p=0;
  const h=setInterval(()=>{
    p=(p+dir*0.0035+1)%1;const t=ctx.currentTime;
    os.forEach((n,i)=>{
      const x=((i+p)%N)/N, f=55*Math.pow(2,x*N), a=Math.exp(-Math.pow((x-0.5)/0.2,2))*vol;
      if(Math.abs(x-n[2])>0.5) n[0].frequency.setValueAtTime(f,t); else n[0].frequency.setTargetAtTime(f,t,0.05);
      n[1].gain.setTargetAtTime(a,t,0.1);n[2]=x;
    });
  },60);
  return ()=>{clearInterval(h);const e=ctx.currentTime;os.forEach(n=>{try{n[1].gain.setTargetAtTime(0,e,0.2);n[0].stop(e+1);}catch(_){}});};
}
function every(ms,fn,first){if(first!==false) fn();const h=setInterval(fn,ms);return ()=>clearInterval(h);}
/* Lantern Rock: one long note and a lower grunt, with enough reed in it to carry on a small speaker */
function horn(T,vol,dest){reed(98,T,2.3,vol,dest);pad(98,T,2.3,vol*1.2,dest);reed(73.4,T+2.1,1.3,vol*0.8,dest);pad(73.4,T+2.1,1.5,vol,dest);}
/* a clock that schedules in audio time, so rhythm survives a busy page */
function seq(stepDur,fn){
  let step=0, next=ctx.currentTime+0.1;
  const h=setInterval(()=>{
    if(next<ctx.currentTime-1) next=ctx.currentTime+0.05;
    while(next<ctx.currentTime+0.3){fn(step,next);step++;next+=typeof stepDur==="function"?stepDur():stepDur;}
  },70);
  return ()=>clearInterval(h);
}
const all=(...f)=>()=>f.forEach(x=>x&&x());

/* Seven notes. D O N T T A P, each letter counted along the scale. In the second half of the night
   it turns up in places it has no business being, and it never resolves until the door is shut. */
const MOTIF=[74,69,67,65,65,69,71], MDUR=[1,1,2,1,1,1,3];
function motif(play,t,unit,tr){let x=t;MOTIF.forEach((n,i)=>{play(mf(n+(tr||0)),x,MDUR[i]*unit);x+=MDUR[i]*unit;});return x;}

/* ---------------- interface sounds ---------------- */
S.thunk=function(vol,pitch){
  if(!ctx) return;
  const t=ctx.currentTime+0.005, o=ctx.createOscillator(), a=ctx.createGain();
  o.type="sine";o.frequency.setValueAtTime(170*(pitch||1),t);o.frequency.exponentialRampToValueAtTime(58,t+0.08);
  a.gain.setValueAtTime(0.26*(vol||1),t);a.gain.exponentialRampToValueAtTime(0.0001,t+0.11);
  o.connect(a);a.connect(fx);o.start(t);o.stop(t+0.14);
  tone(1900*(pitch||1),t,0.02,"square",0.018*(vol||1),false,fx);
};
S.thump=function(delay,vol,toBed){
  if(!ctx) return;
  const dest=toBed?bedGain:fx, t=ctx.currentTime+0.01+(delay||0), o=ctx.createOscillator(), a=ctx.createGain();
  o.type="sine";o.frequency.setValueAtTime(96,t);o.frequency.exponentialRampToValueAtTime(42,t+0.2);
  a.gain.setValueAtTime(0.6*(vol||1),t);a.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
  o.connect(a);a.connect(dest);o.start(t);o.stop(t+0.35);
  tone(700,t,0.03,"triangle",0.05*(vol||1),false,dest);
};
S.tink=function(){if(!ctx) return;const t=ctx.currentTime+0.005;tone(2637,t,0.25,"sine",0.035,false,fx);tone(3520,t,0.18,"sine",0.02,false,fx);};
S.gulp=function(){
  if(!ctx) return;
  const t=ctx.currentTime+0.01, o=ctx.createOscillator(), a=ctx.createGain();
  o.type="sine";o.frequency.setValueAtTime(240,t);o.frequency.exponentialRampToValueAtTime(62,t+0.34);
  a.gain.setValueAtTime(0.0001,t);a.gain.exponentialRampToValueAtTime(0.3,t+0.05);a.gain.exponentialRampToValueAtTime(0.0001,t+0.42);
  o.connect(a);a.connect(fx);o.start(t);o.stop(t+0.5);
};
/* the dial is a comb: every ten kilohertz is a tooth, tuned to whatever is nearest */
let lastPluck=0;
S.pluck=function(n,scale,dead){
  const now=performance.now();
  if(!ctx||now-lastPluck<42) return;
  lastPluck=now;
  const idx=((n%15)+15)%15, f=mf(scale[idx%5]+12*Math.floor(idx/5));
  if(dead) tone(f/2,ctx.currentTime+0.005,1.0,"sine",0.035,false,fx);
  else tone(f,ctx.currentTime+0.005,0.36,"triangle",0.04,false,fx);
};
S.longTone=function(){if(ctx) tone(800,ctx.currentTime+0.05,0.9,"sine",0.14,true);};
S.chime=function(){if(!ctx) return;const t=ctx.currentTime+0.02;tone(880,t,0.5,"sine",0.05,false,bedGain);tone(1174.7,t+0.18,0.7,"sine",0.045,false,bedGain);};
/* the door is shut: the seven notes, and at last the eighth */
S.moonChord=function(){
  if(!ctx) return;
  const end=motif((f,t)=>tone(f,t,1.8,"sine",0.05,false,fx),ctx.currentTime+0.3,0.32);
  bell(mf(84),0.05,5,fx,end);
  [48,55,60,64,67,74].forEach((m,i)=>pad(mf(m),end+i*0.4,11,0.05,fx));
};
S.moonGone=function(){if(!ctx) return;reversed(mf(86),ctx.currentTime+0.05,1.4,0.03,fx);};

/* ---------------- the world outside: things that happen whether or not you are tuned to them ---------------- */
const world={subs:{},bell:0,horn:0,bellAnn:false,hornAnn:false,hour:-1};
S.world={on:function(type,fn){(world.subs[type]=world.subs[type]||[]).push(fn);return function(){world.subs[type]=(world.subs[type]||[]).filter(f=>f!==fn);};}};
function announce(type,T){
  (world.subs[type]||[]).slice().forEach(f=>{try{f(T);}catch(_){}});
  /* By radio a bell arrives at once. Through the window it takes as long as the bay is wide.
     Late in the night that order is the wrong way round, and nobody on the air remarks on it. */
  const wrong=mood()==="wrong";
  if(type==="bell") bell(mood()==="moon"?174.6:196,0.07,4.2,airBus,T+(wrong?-1.6:2.6));
  else horn(T+(wrong?-2.2:4.1),0.11,airBus);
  HB.emit("world",type,T-ctx.currentTime);
}
function worldTick(){
  if(!ctx||ctx.state!=="running") return;
  const now=ctx.currentTime;
  if(!world.bell){world.bell=now+11;world.horn=now+17;}
  while(now>world.bell){world.bell+=21;world.bellAnn=false;}
  while(now>world.horn){world.horn+=30;world.hornAnn=false;}
  if(!world.bellAnn&&world.bell-now<6){world.bellAnn=true;announce("bell",world.bell);}
  if(!world.hornAnn&&world.horn-now<6){world.hornAnn=true;announce("horn",world.horn);}
  /* on the hour, the hour */
  const d=new Date();
  if(d.getMinutes()===59&&d.getSeconds()>=53&&world.hour!==d.getHours()){
    world.hour=d.getHours();
    const n=((d.getHours()+1)%12)||12, T=now+(60-d.getSeconds()-d.getMilliseconds()/1000);
    for(let k=0;k<n;k++) announce("bell",T+k*2.3);
    world.bell=T+n*2.3+14;world.bellAnn=false;
  }
}

/* ---------------- a theme for every station ---------------- */
const BEDS={
  /* Dolores: four chords, a warm pad, a little comping, brushes */
  lounge:()=>{
    const A=[[50,53,57,60],[43,53,59,62],[48,52,55,59],[45,49,55,60]], B=[[50,53,57,64],[49,53,56,59],[48,52,59,62],[48,52,57,62]];
    return seq(0.4,(s,t)=>{
      const bar=Math.floor(s/16), ch=(Math.floor(bar/4)%2?B:A)[bar%4], m=mood(), st=s%16;
      if(st===0){
        ch.forEach((n,k)=>pad(mf(n),t+k*0.07,6.6,0.022,null,m==="wrong"&&k===2?-22:0));
        bass(mf(ch[0]-12),t,3.2,0.05);
      }
      if((st===6||st===10||st===13)&&Math.random()<0.55) ep(mf(rnd(ch.slice(1))+12),t,1.8,0.028);
      if(m==="normal"||m==="back"){
        if(st===4||st===12) noiseHit(t,0.05,0.006,"highpass",7000);
        if(st===8) noiseHit(t,0.14,0.005,"bandpass",3000);
      }
    });
  },
  /* the Coastal Service: a drone, the real foghorn, a buoy, the sea while there is one, and a tune nobody is playing */
  coastal:()=>{
    const ph=[[62,65,64,60,62],[57,60,62,64,62],[69,67,65,64,62],[62,60,57,60,62]];let i=0;
    return all(sustained([[55,"sine",0.05],[82.4,"sine",0.03]]),
      S.world.on("horn",T=>horn(T,0.06)),
      every(6300,()=>{if(Math.random()<0.6) bell(1318,0.022,1.6,bedGain);},false),
      every(8500,()=>{const m=mood();if(m==="normal"||m==="back") swell(5.5,260,680,0.045);},false),
      every(23000,()=>{const t=ctx.currentTime+3;ph[i++%ph.length].forEach((n,k)=>reed(mf(n),t+k*1.5,1.7,0.016));},false));
  },
  /* the Clerk: an interval signal that never quite repeats, and a held note like a tape left running */
  musicbox:()=>{
    const base=[88,91,93,91,86,88];let i=0;
    return all(sustained([[440,"sine",0.005],[659.3,"sine",0.003]]),
      every(21000,()=>{
        const m=mood(), t=ctx.currentTime+0.1, tr=[0,0,-2,3,-5][i++%5]+(m==="moon"?-2:0);
        if(m==="wrong") motif((f,x)=>tone(f*2,x,1.0,"sine",0.06),t,0.34);
        else base.forEach((n,k)=>tone(mf(n+tr),t+k*(m==="moon"?0.5:0.36),0.9,"sine",0.06));
      }));
  },
  /* Stock and Fodder: a small waltz on a harmonium, which loses its major third when the moon goes */
  farm:()=>{
    const roots=[43,43,50,50,43,48,50,43], chords=[[59,62,67],[59,62,67],[57,60,66],[57,60,66],[59,62,67],[60,64,67],[57,60,66],[59,62,67]];
    return all(seq(()=>mood()==="normal"||mood()==="back"?0.6:0.9,(s,t)=>{
        const bar=Math.floor(s/3)%16, minor=!(mood()==="normal"||mood()==="back");
        if(bar>=8) return;
        if(s%3===0) bass(mf(roots[bar]),t,0.8,0.045);
        else chords[bar].forEach(n=>reed(mf(minor&&(n===59||n===66)?n-1:n),t,0.34,0.01));
      }),
      every(7300,()=>{if(Math.random()<0.6) bell(590+Math.random()*40,0.025,0.5,bedGain);},false));
  },
  /* Kettleball: a crowd, a stadium organ, a trombone. All three stop looking when the moon goes. */
  crowd:()=>{
    const src=ctx.createBufferSource(), lp=ctx.createBiquadFilter(), a=ctx.createGain();
    src.buffer=NB;src.loop=true;lp.type="bandpass";lp.frequency.value=520;lp.Q.value=0.9;a.gain.value=0.05;
    src.connect(lp);lp.connect(a);a.connect(bedGain);src.start();
    const live=()=>mood()==="normal"||mood()==="back";
    return all(every(1500,()=>a.gain.setTargetAtTime(live()?0.03+Math.random()*0.06:0.01,ctx.currentTime,0.8)),
      every(14000,()=>{
        if(!live()) return;
        const t=ctx.currentTime+0.1;[60,64,67,72,67,72].forEach((n,k)=>organ(mf(n),t+k*0.17,k===5?0.7:0.15,0.03));
        a.gain.setTargetAtTime(0.12,t+1,0.3);
      },false),
      every(23000,()=>{if(live()) slide(233,147,0.8,0.05);},false),
      ()=>{try{src.stop();}catch(_){}});
  },
  /* the Bureau: seconds, pips, and the chime of an institution on hold */
  ticks:()=>all(sustained([[110,"sine",0.012],[164.8,"sine",0.008]]),
    every(1000,()=>{const s=new Date().getSeconds();tone(s%10===0?1500:1000,ctx.currentTime+0.02,s%10===0?0.18:0.07,"sine",0.045);}),
    every(20000,()=>{
      const t=ctx.currentTime+0.4;
      if(mood()==="wrong") motif((f,x)=>ep(f,x,2.0,0.03),t,0.42); else [76,72,79].forEach((n,k)=>ep(mf(n),t+k*0.45,2.2,0.035));
    },false)),
  /* Vellish: the music from a language tape */
  vellish:()=>every(8200,()=>{
    const t=ctx.currentTime+0.2, sc=[62,63,67,69,70,74], n=3+Math.floor(Math.random()*3);let k=Math.floor(Math.random()*sc.length);
    for(let i=0;i<n;i++){k=Math.max(0,Math.min(sc.length-1,k+rnd([-2,-1,1,1,2])));const f=mf(sc[k]+12);tone(f,t+i*0.42,1.3,"triangle",0.03);tone(f,t+i*0.42+0.3,0.9,"triangle",0.011);}
  },false),
  /* Little Wending: the real bell, and a harmonium working through a hymn it half remembers */
  parish:()=>{
    const hymn=[[53,57,60],[53,58,62],[52,55,60],[53,57,60]];let i=0;
    return all(S.world.on("bell",T=>{const m=mood(), f=m==="moon"?174.6:196;bell(f,0.08,4.5,bedGain,T);if(m==="wrong") bell(f,0.06,4.5,bedGain,T+0.5);}),
      every(6200,()=>{const k=i++%6;if(k>3) return;const t=ctx.currentTime+2.4;hymn[k].forEach(n=>reed(mf(n),t,5.2,0.011));},false));
  },
  /* Lagoon: easy listening that means it */
  lagoon:()=>{
    const CH=[[53,57,60,64],[52,55,59,62],[50,53,57,60],[48,52,55,59]], order=[0,1,2,3,2,1,3,2,1,0], hits=[0,2,3,5,6,8,10,11,13,14];
    return seq(0.4167,(s,t)=>{
      const ch=CH[Math.floor(s/16)%4], st=s%16, m=mood(), thin=m==="wrong";
      if(st===0){ch.forEach((n,k)=>pad(mf(n),t+k*0.05,6.6,0.02));pad(mf(ch[3]+12),t,6.6,0.008);}
      if(st===0||st===10) bass(mf(ch[0]-12),t,1.8,0.06);
      if(thin){ if(s%64===0) motif((f,x)=>ep(f,x,2.4,0.034),t,0.8334); return; }
      const h=hits.indexOf(st);
      if(h>=0&&Math.random()<0.9) ep(mf(ch[order[h]]+12),t,1.9,0.034);
      if(st%2===1) noiseHit(t,0.04,0.004,"highpass",8000);
    });
  },
  /* 16,661: mains hum, and a man whistling. After the moon goes it is the same tune, backwards, and slightly flat.
     Once he is in, there is no tune; only a tone that climbs and never arrives. */
  hum:()=>{
    const tune=[72,76,79,76,74,72,69,72];let rise=null;
    return all(sustained([[50,"sine",0.05],[100,"sine",0.02],[150,"triangle",0.006]]),
      every(14000,()=>{
        if(HB.letIn&&HB.letIn()){if(!rise) rise=shepard(1,0.018);return;}
        if(rise){rise();rise=null;}
        const off=mood()==="moon"||mood()==="wrong", t=ctx.currentTime+1.5, notes=off?tune.slice().reverse():tune, d=off?0.44:0.32;
        notes.forEach((n,k)=>whistled(mf(n+12),t+k*d,d*0.95,0.03,null,off?-28:0));
      }),
      every(4200,()=>{const m=mood();if(m==="moon"||m==="wrong") swell(3.2,420,260,0.05);},false),
      ()=>{if(rise) rise();});
  },
  /* the other band. Open fifths, sighs, and one old instrument each. */
  limbo:(st)=>{
    const R=st.root||38, r=mf(R), mode=st.mode;
    const drone=sustained([[r,"sine",0.07],[r*1.5,"sine",0.045],[r*2.003,"triangle",0.02],[r*3.01,"sine",0.012]]);
    const sigh=every(7600,()=>swell(4.2,620,300,0.055),false);
    let extra;
    if(mode==="rome") extra=every(13000,()=>{const t=ctx.currentTime+0.5;[12,19,17,12].forEach((o,k)=>reed(mf(R+o),t+k*2.3,2.5,0.02));},false);
    else if(mode==="library") extra=every(10000,()=>{const t=ctx.currentTime+0.3;[36,35,31,30,28,24].forEach((o,k)=>tone(mf(R+o),t+k*0.36,1.8,"triangle",0.03));},false);
    else if(mode==="porch") extra=every(9000,()=>{const t=ctx.currentTime+0.3;[24,25,28,31,29,28,24].forEach((o,k)=>tone(mf(R+o),t+k*(0.3+Math.random()*0.25),1.6,"triangle",0.028));if(Math.random()<0.5) pad(mf(R+24),t+2.5,5,0.014);},false);
    else extra=every(6000,()=>{const t=ctx.currentTime+0.1, o=rnd([24,26,28,30,32,34]);reversed(mf(R+o),t,3,0.03);reversed(mf(R+o+4),t+0.8,2.2,0.02);},false);
    return all(drone,sigh,extra);
  },
  /* a door: something knocking, and a tone that falls for as long as you listen */
  door:()=>all(sustained([[41.2,"sine",0.09],[61.7,"sine",0.03]]),shepard(-1,0.03),every(3200,()=>{S.thump(0,0.35,true);S.thump(0.3,0.25,true);},false)),
  /* the eleventh station: yours */
  yours:()=>playYours()
};
/* Level trims per theme, in dB, set from tools/measure_mix.py so that every station's music is audible under its
   voices: music-forward stations (Dolores, Lagoon, the Coast) sit about 3 dB under the speech, talk stations about 7. */
const TRIM={coast:0,clerk:8,dolores:0,farm:1,kettle:7,bureau:6,vellish:9,parish:9,lagoon:-0.5,engineer:-3,roads:-6,library:-6,porch:-6,dominion:-6};
S.trim=TRIM;
S.startBed=function(st){
  if(!ctx) return;
  if(bedName===st.id) return;
  S.stopBed();
  bedTrim.gain.setValueAtTime(Math.pow(10,(TRIM[st.id]||0)/20),ctx.currentTime);
  if(st.bed&&BEDS[st.bed]){bedStop=BEDS[st.bed](st);bedName=st.id;}
};
S.stopBed=function(){if(bedStop){try{bedStop();}catch(_){}bedStop=null;}bedName="";};

/* ---------------- voices ---------------- */
const cache=new Map();           /* sprite name -> AudioBuffer, a few at a time */
const pending=new Map(), revCache=new Map(), norm=new Map();
/* Every voice file is brought to the same speech level as it loads, so voices you drop in yourself need no levelling.
   Speech level: mean power of the 50 ms blocks above -50 dBFS. Target: -19 dBFS. */
function speechGain(buf){
  const d=buf.getChannelData(0), n=Math.max(2,Math.floor(buf.sampleRate*0.05));let sum=0,cnt=0;
  for(let i=0;i+n<=d.length;i+=n){let s=0;for(let j=i;j<i+n;j+=2) s+=d[j]*d[j];s/=n/2;if(s>1e-5){sum+=s;cnt++;}}
  return cnt?Math.max(0.25,Math.min(4,0.1122/Math.sqrt(sum/cnt))):1;
}
let speaking=[], speakDone=null;
S.clip=function(sprite,key){
  const v=window.HB_VOICES&&HB_VOICES.sprites[sprite];
  return v&&v.clips[key]?v.clips[key]:null;
};
S.prepare=function(sprite){
  if(!ctx) return Promise.resolve(false);
  if(cache.has(sprite)){const b=cache.get(sprite);cache.delete(sprite);cache.set(sprite,b);return Promise.resolve(true);}
  if(pending.has(sprite)) return pending.get(sprite);
  const v=window.HB_VOICES&&HB_VOICES.sprites[sprite];
  if(!v) return Promise.resolve(false);
  const p=fetch(v.file).then(r=>{if(!r.ok) throw new Error(r.status);return r.arrayBuffer();})
    .then(ab=>new Promise((res,rej)=>ctx.decodeAudioData(ab,res,rej)))
    .then(buf=>{cache.set(sprite,buf);norm.set(sprite,speechGain(buf));while(cache.size>6) cache.delete(cache.keys().next().value);pending.delete(sprite);return true;})
    .catch(()=>{pending.delete(sprite);return false;});
  pending.set(sprite,p);return p;
};
/* the first second of a line, turned round: on the other band every sentence arrives out of its own echo */
function reversedHead(buf,start,len,key){
  if(revCache.has(key)) return revCache.get(key);
  const sr=buf.sampleRate, a=Math.floor(start*sr), n=Math.max(1,Math.floor(len*sr)), out=ctx.createBuffer(1,n,sr), src=buf.getChannelData(0), d=out.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=src[a+n-1-i]||0;
  revCache.set(key,out);if(revCache.size>20) revCache.delete(revCache.keys().next().value);
  return out;
}
const preLen=(c,o)=>o&&o.dead?Math.max(0.3,Math.min(1.3,c[1]-0.15)):0;
/* parts: [{sprite,key}] in order. o: {rate, dead, double}. Resolves when the last has been spoken, or when something stops it. */
S.say=async function(partsList,o){
  if(!ctx) return false;
  o=o||{};
  const names=[...new Set(partsList.map(p=>p.sprite))];
  const ok=await Promise.all(names.map(S.prepare));
  if(ok.indexOf(false)>=0) return false;
  S.stopVoice();
  const rate=o.rate||1;let t=ctx.currentTime+0.06;
  const first=S.clip(partsList[0].sprite,partsList[0].key), fb=cache.get(partsList[0].sprite);
  if(o.dead&&first&&fb){
    const len=preLen(first,o), src=ctx.createBufferSource(), a=ctx.createGain(), lp=ctx.createBiquadFilter();
    src.buffer=reversedHead(fb,first[0]+0.03,len,partsList[0].sprite+partsList[0].key);lp.type="lowpass";lp.frequency.value=1500;
    a.gain.setValueAtTime(0.0001,t);a.gain.exponentialRampToValueAtTime(0.55*(norm.get(partsList[0].sprite)||1),t+len);a.gain.linearRampToValueAtTime(0.0001,t+len+0.03);
    src.connect(lp);lp.connect(a);a.connect(vIn);a.connect(conv);src.start(t);speaking.push(src);
    t+=len;
  }
  for(const p of partsList){
    const c=S.clip(p.sprite,p.key), buf=cache.get(p.sprite);
    if(!c||!buf) return false;
    const src=ctx.createBufferSource(), ng=ctx.createGain();src.buffer=buf;src.playbackRate.value=rate;wowDepth.connect(src.playbackRate);
    ng.gain.value=norm.get(p.sprite)||1;src.connect(ng);ng.connect(vIn);
    src.start(t,c[0],c[1]);speaking.push(src);
    if(o.double){
      /* late in the night some voices are followed, very closely, by the same voice */
      const s2=ctx.createBufferSource(), g2=ctx.createGain();s2.buffer=buf;s2.playbackRate.value=rate*0.972;g2.gain.value=0.5*(norm.get(p.sprite)||1);
      s2.connect(g2);g2.connect(vIn);s2.start(t+0.11,c[0],c[1]);speaking.push(s2);
    }
    t+=(c[1]-0.08)/rate;
  }
  const ms=(t-ctx.currentTime)*1000;
  return new Promise(res=>{
    const h=setTimeout(()=>{speakDone=null;speaking=[];res(true);},ms);
    speakDone=()=>{clearTimeout(h);res(true);};
  });
};
S.duration=function(partsList,o){
  let d=0;const rate=(o&&o.rate)||1;
  for(const p of partsList){const c=S.clip(p.sprite,p.key);if(!c) return 0;d+=(c[1]-0.08)/rate;}
  const c0=S.clip(partsList[0].sprite,partsList[0].key);
  return (d+preLen(c0,o))*1000;
};
S.stopVoice=function(){
  speaking.forEach(s=>{try{s.stop();}catch(_){}});speaking=[];
  if(speakDone){const f=speakDone;speakDone=null;f();}
};

/* ---------------- the room ---------------- */
const R=S.room={};
function env(a,t,pairs){a.gain.setValueAtTime(0.0001,t);pairs.forEach(p=>a.gain.exponentialRampToValueAtTime(Math.max(0.0001,p[1]),t+p[0]));}
/* a goose, from first principles: a reed, two formants, and an opinion */
R.honk=function(vol,pitch,delay){
  if(!ctx) return;
  const v=(vol||1)*0.2, p=pitch||1, t=ctx.currentTime+0.01+(delay||0);
  const o=ctx.createOscillator(), o2=ctx.createOscillator(), a=ctx.createGain(), f1=ctx.createBiquadFilter(), f2=ctx.createBiquadFilter();
  o.type="sawtooth";o2.type="square";f1.type="bandpass";f1.frequency.value=950*p;f1.Q.value=2.2;f2.type="bandpass";f2.frequency.value=2100*p;f2.Q.value=3;
  [[0,300],[0.07,470],[0.2,400],[0.24,330],[0.44,285]].forEach((q,i)=>{
    if(i===0){o.frequency.setValueAtTime(q[1]*p,t);o2.frequency.setValueAtTime(q[1]*p/2,t);}
    else{o.frequency.exponentialRampToValueAtTime(q[1]*p,t+q[0]);o2.frequency.exponentialRampToValueAtTime(q[1]*p/2,t+q[0]);}
  });
  env(a,t,[[0.025,v],[0.2,v*0.35],[0.26,v*0.9],[0.46,0]]);
  o.connect(f1);o.connect(f2);o2.connect(f1);f1.connect(a);f2.connect(a);a.connect(roomBus);
  o.start(t);o2.start(t);o.stop(t+0.5);o2.stop(t+0.5);
};
R.murmur=function(){R.honk(0.3,0.6);R.honk(0.26,0.66,0.2);};
R.hiss=function(){
  if(!ctx) return;
  const t=ctx.currentTime+0.01, s=ctx.createBufferSource(), hp=ctx.createBiquadFilter(), bp=ctx.createBiquadFilter(), a=ctx.createGain();
  s.buffer=NB;s.loop=true;hp.type="highpass";hp.frequency.value=3200;bp.type="peaking";bp.frequency.value=5600;bp.gain.value=8;
  env(a,t,[[0.06,0.09],[0.55,0.07],[0.9,0]]);
  s.connect(hp);hp.connect(bp);bp.connect(a);a.connect(roomBus);s.start(t);s.stop(t+1);
};
R.pat=function(v){if(!ctx) return;const t=ctx.currentTime+0.005;noiseHit(t,0.05,0.05*(v||1),"lowpass",520,roomBus);tone(140,t,0.05,"sine",0.03*(v||1),false,roomBus);};
R.lamp=function(){if(!ctx) return;const t=ctx.currentTime+0.005;tone(2300,t,0.012,"square",0.03,false,roomBus);tone(1500,t+0.035,0.015,"square",0.025,false,roomBus);};
R.clack=function(){
  if(!ctx) return;
  const t=ctx.currentTime+0.01;
  [[0,1900,0.07],[0.02,2750,0.05],[0.16,1700,0.035]].forEach(q=>tone(q[1],t+q[0],0.09,"triangle",q[2],false,roomBus));
  noiseHit(t,0.06,0.05,"bandpass",3000,roomBus,1.5);noiseHit(t+0.34,0.14,0.035,"lowpass",900,roomBus);
};
R.slide=function(){
  if(!ctx) return;
  const t=ctx.currentTime+0.01, s=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), a=ctx.createGain();
  s.buffer=NB;s.loop=true;bp.type="bandpass";bp.frequency.value=2400;bp.Q.value=0.7;
  env(a,t,[[0.5,0.03],[1.0,0.02],[1.3,0]]);
  s.connect(bp);bp.connect(a);a.connect(roomBus);s.start(t);s.stop(t+1.4);
};
/* someone on the stairs, heard through a door. Returns how long they take. */
let doorLP=null;
R.steps=function(up){
  if(!ctx) return 0;
  if(!doorLP){doorLP=ctx.createBiquadFilter();doorLP.type="lowpass";doorLP.frequency.value=900;doorLP.connect(roomBus);}
  const t=ctx.currentTime+0.05, n=6;
  for(let i=0;i<n;i++){
    const v=up?0.25+0.75*i/(n-1):1-0.8*i/(n-1), at=t+i*0.44, o=ctx.createOscillator(), a=ctx.createGain();
    o.frequency.setValueAtTime(175,at);o.frequency.exponentialRampToValueAtTime(92,at+0.13);
    a.gain.setValueAtTime(0.4*v,at);a.gain.exponentialRampToValueAtTime(0.0001,at+0.18);
    o.connect(a);a.connect(doorLP);o.start(at);o.stop(at+0.2);
    noiseHit(at,0.07,0.22*v,"bandpass",620,doorLP,1.2);
  }
  return n*0.44;
};
R.grain=function(){
  if(!ctx) return;
  const t=ctx.currentTime+0.02;
  for(let i=0;i<46;i++){const at=t+Math.pow(Math.random(),0.7)*0.9;noiseHit(at,0.012,0.03+Math.random()*0.04,"bandpass",2200+Math.random()*3000,roomBus,3);}
  noiseHit(t,0.9,0.015,"highpass",3000,roomBus);
};
R.peck=function(){if(!ctx) return;const t=ctx.currentTime+0.005;noiseHit(t,0.02,0.05,"bandpass",1800,roomBus,2);tone(900,t,0.02,"triangle",0.015,false,roomBus);};
R.drawer=function(open){
  if(!ctx) return;
  const t=ctx.currentTime+0.01, s=ctx.createBufferSource(), bp=ctx.createBiquadFilter(), a=ctx.createGain();
  s.buffer=NB;s.loop=true;bp.type="bandpass";bp.Q.value=1.4;bp.frequency.setValueAtTime(open?500:800,t);bp.frequency.linearRampToValueAtTime(open?800:450,t+0.35);
  env(a,t,[[0.05,0.05],[0.3,0.035],[0.36,0]]);
  s.connect(bp);bp.connect(a);a.connect(roomBus);s.start(t);s.stop(t+0.4);
  const k=t+0.34, o=ctx.createOscillator(), g=ctx.createGain();
  o.frequency.setValueAtTime(140,k);o.frequency.exponentialRampToValueAtTime(70,k+0.08);g.gain.setValueAtTime(0.12,k);g.gain.exponentialRampToValueAtTime(0.0001,k+0.12);
  o.connect(g);g.connect(roomBus);o.start(k);o.stop(k+0.14);
};
R.rattle=function(){
  if(!ctx) return;
  [0,0.11,0.2].forEach((d,i)=>{
    const t=ctx.currentTime+0.01+d, o=ctx.createOscillator(), g=ctx.createGain();
    o.frequency.setValueAtTime(160-i*10,t);o.frequency.exponentialRampToValueAtTime(80,t+0.06);g.gain.setValueAtTime(0.1,t);g.gain.exponentialRampToValueAtTime(0.0001,t+0.09);
    o.connect(g);g.connect(roomBus);o.start(t);o.stop(t+0.1);noiseHit(t,0.03,0.03,"bandpass",1200,roomBus,2);
  });
};
R.flip=function(){if(!ctx) return;noiseHit(ctx.currentTime+0.005,0.08,0.03,"highpass",2400,roomBus);};
R.tick=function(k){if(!ctx) return;const t=ctx.currentTime+0.005;tone(k%2?1480:1240,t,0.014,"square",0.008,false,roomBus);noiseHit(t,0.012,0.008,"highpass",4000,roomBus);};
R.hoot=function(){
  if(!ctx) return;
  const t=ctx.currentTime+0.05;
  [[0,0.36],[0.62,0.16],[0.86,0.34]].forEach(q=>{
    const o=ctx.createOscillator(), a=ctx.createGain();
    o.frequency.setValueAtTime(392,t+q[0]);o.frequency.exponentialRampToValueAtTime(360,t+q[0]+q[1]);
    env(a,t+q[0],[[0.04,0.12],[q[1]*0.8,0.09],[q[1],0]]);
    o.connect(a);a.connect(airBus);o.start(t+q[0]);o.stop(t+q[0]+q[1]+0.05);
  });
};
let kettle=null;
R.kettle={
  start:function(){
    if(!ctx) return;
    R.kettle.stop(true);
    const t=ctx.currentTime, s=ctx.createBufferSource(), lp=ctx.createBiquadFilter(), a=ctx.createGain();
    s.buffer=NB;s.loop=true;lp.type="lowpass";lp.frequency.setValueAtTime(180,t);lp.frequency.linearRampToValueAtTime(1100,t+45);
    a.gain.setValueAtTime(0.0001,t);a.gain.linearRampToValueAtTime(0.02,t+40);
    s.connect(lp);lp.connect(a);a.connect(roomBus);s.start();
    kettle={s:[s],a:[a]};
  },
  /* it whistles in the key of whatever you are listening to */
  whistle:function(midi){
    if(!ctx) return;
    const t=ctx.currentTime, f=mf(midi||81), o=ctx.createOscillator(), o2=ctx.createOscillator(), a=ctx.createGain(), l=ctx.createOscillator(), lg=ctx.createGain(), g2=ctx.createGain();
    o.frequency.setValueAtTime(f*0.7,t);o.frequency.exponentialRampToValueAtTime(f,t+1.8);
    o2.frequency.setValueAtTime(f*1.41,t);o2.frequency.exponentialRampToValueAtTime(f*2.01,t+1.8);g2.gain.value=0.3;
    l.frequency.value=6.3;lg.gain.value=f*0.006;l.connect(lg);lg.connect(o.frequency);
    a.gain.setValueAtTime(0.0001,t);a.gain.exponentialRampToValueAtTime(0.045,t+1.2);
    o.connect(a);o2.connect(g2);g2.connect(a);a.connect(roomBus);o.start();o2.start();l.start();
    if(!kettle) kettle={s:[],a:[]};
    kettle.s.push(o,o2,l);kettle.a.push(a);
  },
  stop:function(quiet){
    if(!ctx||!kettle) return;
    const e=ctx.currentTime;
    kettle.a.forEach(a=>{try{a.gain.cancelScheduledValues(e);a.gain.setTargetAtTime(0,e,0.12);}catch(_){}});
    kettle.s.forEach(s=>{try{s.stop(e+0.8);}catch(_){}});
    kettle=null;
    if(!quiet) swell(1.6,2600,900,0.03,roomBus);
  }
};
/* what the room, and the night outside it, sound like when nothing is happening */
let amb=null;
function initAmb(){
  amb={sea:false,wind:0};
  const s=ctx.createBufferSource(), lp=ctx.createBiquadFilter(), g=ctx.createGain();
  s.buffer=NB;s.loop=true;lp.type="lowpass";lp.frequency.value=240;g.gain.value=0.035;s.connect(lp);lp.connect(g);g.connect(roomBus);s.start();
  const bank=(list,dest)=>{const out=ctx.createGain();out.gain.value=0;out.connect(dest);list.forEach(p=>{const o=ctx.createOscillator(), a=ctx.createGain();o.type=p[2]||"sine";o.frequency.value=p[0];a.gain.value=p[1];o.connect(a);a.connect(out);o.start();});return out;};
  amb.hum=bank([[100,1],[200,0.5],[300,0.25]],radioOut);                 /* the set's transformer */
  amb.buzz=bank([[200,1,"triangle"],[400,0.3]],roomBus);                 /* the lamp */
  amb.him=bank([[300,1],[301.3,1],[449,0.5],[451.2,0.5]],roomBus);       /* someone else, at almost the room's own pitch */
  const r=ctx.createBufferSource(), hp=ctx.createBiquadFilter(), rl=ctx.createBiquadFilter(), ri=ctx.createGain();
  r.buffer=NB;r.loop=true;hp.type="highpass";hp.frequency.value=1500;rl.type="lowpass";rl.frequency.value=6500;
  amb.rain=ctx.createGain();amb.rain.gain.value=0;ri.gain.value=0.45;
  r.connect(hp);hp.connect(rl);rl.connect(amb.rain);amb.rain.connect(airBus);amb.rain.connect(ri);ri.connect(roomBus);r.start();
  /* telegraph wires in a wind: partials of one low string, each coming and going on its own */
  amb.wires=[3,4,5,7,9].map(h=>{const o=ctx.createOscillator(), a=ctx.createGain();o.frequency.value=73*h;a.gain.value=0;o.connect(a);a.connect(airBus);o.start();return a;});
  setInterval(()=>{
    if(!ctx||ctx.state!=="running") return;
    amb.wires.forEach(a=>setT(a.gain,Math.random()<0.6?Math.random()*0.03*(0.3+amb.wind):0,2.5));
    if(amb.sea&&!deadAir) swell(5.5,240,620,0.07,airBus);
  },7000);
}
/* o: {power, lamp, rain 0..1, wind 0..1, him 0..1, sea, dead} */
S.ambience=function(o){
  if(!ctx) return;
  if(!amb) initAmb();
  setT(amb.hum.gain,o.power?0.012:0,0.3);
  setT(amb.buzz.gain,o.lamp?0.004:0,0.08);
  setT(amb.him.gain,(o.him||0)*0.022,1.5);
  setT(amb.rain.gain,(o.rain||0)*0.07,1.5);
  amb.wind=o.wind||0;amb.sea=!!o.sea;
  if(deadAir!==!!o.dead){deadAir=!!o.dead;airNow();}
};

/* ---------------- a meter for the mix: read() gives dBFS RMS per bus. Used by tools/measure_mix.py ---------------- */
S.meter=function(){
  if(!ctx) return null;
  const sink=ctx.createGain();sink.gain.value=0;sink.connect(ctx.destination);
  const mk=node=>{const a=ctx.createAnalyser();a.fftSize=2048;node.connect(a);a.connect(sink);return a;};
  const ans={voice:mk(voiceMix),music:mk(musicMix),static:mk(staticMix),room:mk(roomMix),air:mk(airGain),master:mk(master)}, buf=new Float32Array(2048);
  return function(){const o={};for(const k in ans){ans[k].getFloatTimeDomainData(buf);let s=0;for(let i=0;i<buf.length;i++) s+=buf[i]*buf[i];o[k]=10*Math.log10(s/buf.length+1e-12);}return o;};
};

/* ---------------- your tracks, your microphone ---------------- */
const media={tracks:[],clips:[]};
S.media=media;
function idb(){
  return new Promise((res,rej)=>{
    try{
      const r=indexedDB.open("hollowband",1);
      r.onupgradeneeded=()=>r.result.createObjectStore("media",{keyPath:"id",autoIncrement:true});
      r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
    }catch(e){rej(e);}
  });
}
async function dbPut(o){const d=await idb();return new Promise((res,rej)=>{const q=d.transaction("media","readwrite").objectStore("media").add(o);q.onsuccess=()=>res();q.onerror=()=>rej(q.error);});}
S.loadMedia=async function(){
  (window.HB_TRACKS||[]).forEach(t=>media.tracks.push({name:t.title||t.file,url:t.file}));
  try{
    const d=await idb();
    const rows=await new Promise((res,rej)=>{const q=d.transaction("media").objectStore("media").getAll();q.onsuccess=()=>res(q.result||[]);q.onerror=()=>rej(q.error);});
    rows.forEach(r=>(r.kind==="clip"?media.clips:media.tracks).push({name:r.name,url:URL.createObjectURL(r.blob)}));
  }catch(_){}
  return media;
};
S.addFiles=async function(files){
  let n=0;
  for(const f of files){
    if(!/^audio\//.test(f.type)&&!/\.(mp3|ogg|wav|m4a|flac|opus|aac)$/i.test(f.name)) continue;
    const name=f.name.replace(/\.[^.]+$/,"");
    media.tracks.push({name:name,url:URL.createObjectURL(f)});n++;
    try{await dbPut({kind:"track",name:name,blob:f});}catch(_){}
  }
  return n;
};
S.clearMedia=async function(){
  media.tracks.length=0;media.clips.length=0;(window.HB_TRACKS||[]).forEach(t=>media.tracks.push({name:t.title||t.file,url:t.file}));
  try{const d=await idb();d.transaction("media","readwrite").objectStore("media").clear();}catch(_){}
};
let el=null, elSrc=null;
function playYours(){
  if(!el){
    el=new Audio();el.preload="auto";
    try{
      elSrc=ctx.createMediaElementSource(el);
      const hp=ctx.createBiquadFilter(), lp=ctx.createBiquadFilter(), g=ctx.createGain();
      hp.type="highpass";hp.frequency.value=110;lp.type="lowpass";lp.frequency.value=5200;g.gain.value=0.9;
      elSrc.connect(hp);hp.connect(lp);lp.connect(g);g.connect(bedGain);
    }catch(_){}
  }
  let stopped=false, turn=0, order=[];
  const carrier=sustained([[60,"sine",0.012]]);
  const next=()=>{
    if(stopped) return;
    const haveT=media.tracks.length, haveC=media.clips.length;
    if(!haveT&&!haveC) return;
    let item, kind;
    if(haveC&&(turn%2===0||!haveT)){item=rnd(media.clips);kind="clip";}
    else{if(!order.length) order=media.tracks.slice().sort(()=>Math.random()-0.5);item=order.pop();kind="track";}
    turn++;
    el.src=item.url;
    el.play().then(()=>{if(HB.onTrack) HB.onTrack(item.name,kind);}).catch(()=>setTimeout(next,4000));
  };
  el.onended=()=>setTimeout(next,1200+Math.random()*1500);
  el.onerror=()=>setTimeout(next,3000);
  next();
  return ()=>{stopped=true;carrier();try{el.pause();}catch(_){}};
}
S.restartYours=function(){if(bedName==="yours"){const st={id:"yours",bed:"yours"};S.stopBed();S.startBed(st);}};

let mic=null;
S.micSupported=()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
S.startMic=async function(monitor){
  if(!ctx) throw new Error("no audio");
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  const src=ctx.createMediaStreamSource(stream), an=ctx.createAnalyser();an.fftSize=256;src.connect(an);
  let mon=null;
  if(monitor){mon=ctx.createGain();mon.gain.value=0.9;src.connect(mon);mon.connect(vIn);}
  const rec=new MediaRecorder(stream), chunks=[];
  rec.ondataavailable=e=>{if(e.data&&e.data.size) chunks.push(e.data);};
  rec.start();
  setT(musicMix.gain,mix.music*0.4,0.2);
  mic={stream:stream,src:src,an:an,rec:rec,chunks:chunks,mon:mon,t0:Date.now()};
};
S.micLevel=function(){
  if(!mic) return 0;
  const b=new Uint8Array(mic.an.fftSize);mic.an.getByteTimeDomainData(b);
  let s=0;for(let i=0;i<b.length;i++){const v=(b[i]-128)/128;s+=v*v;}
  return Math.min(1,Math.sqrt(s/b.length)*5);
};
S.onAir=()=>!!mic;
S.stopMic=function(){
  const m=mic;mic=null;
  if(!m) return Promise.resolve(null);
  setT(musicMix.gain,mix.music*1.5,0.4);
  return new Promise(res=>{
    m.rec.onstop=async()=>{
      m.stream.getTracks().forEach(t=>t.stop());
      try{m.src.disconnect();}catch(_){}
      const secs=(Date.now()-m.t0)/1000;
      if(secs<0.7||!m.chunks.length){res(null);return;}
      const blob=new Blob(m.chunks,{type:m.rec.mimeType||"audio/webm"}), d=new Date();
      const name="On air, "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
      media.clips.push({name:name,url:URL.createObjectURL(blob)});
      try{await dbPut({kind:"clip",name:name,blob:blob});}catch(_){}
      res({name:name,secs:secs});
    };
    try{m.rec.stop();}catch(_){res(null);}
  });
};
})();
