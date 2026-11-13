/* Hollowband Receiver — sound.
   The audio graph, the instruments, a theme for every station, the voices, your own tracks, your microphone.
   Everything here is reached through HB.sound; radio.js decides what should be heard, this file makes it. */
(function(){
"use strict";
const HB=window.HB=window.HB||{};
const S=HB.sound={};
let ctx=null, master, analyser, fx, wet, NB, nbp, noiseGain, staticMix, musicMix, voiceMix, res=[], whistle, whistle2, whistleGain;
let bedGain, vIn, vHP, vLP, vGain, vSend, bedStop=null, bedName="";
const mix={voice:1,music:1,static:1};
const mf=m=>440*Math.pow(2,(m-69)/12);
const mood=()=>HB.mood?HB.mood():"normal";
const rnd=a=>a[Math.floor(Math.random()*a.length)];
S.ctx=()=>ctx;

/* ---------------- graph ---------------- */
S.init=function(){
  if(ctx) return true;
  const AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return false;
  try{ctx=new AC();}catch(_){ctx=null;return false;}
  const lim=ctx.createDynamicsCompressor();lim.threshold.value=-8;lim.knee.value=6;lim.ratio.value=8;lim.attack.value=0.004;lim.release.value=0.2;
  master=ctx.createGain();master.gain.value=vol;master.connect(lim);lim.connect(ctx.destination);
  analyser=ctx.createAnalyser();analyser.fftSize=256;master.connect(analyser);
  fx=ctx.createGain();fx.connect(master);
  const conv=ctx.createConvolver(), irLen=Math.floor(ctx.sampleRate*3), ir=ctx.createBuffer(2,irLen,ctx.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<irLen;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/irLen,2.6);}
  conv.buffer=ir;wet=ctx.createGain();wet.gain.value=0.22;fx.connect(conv);conv.connect(wet);wet.connect(master);
  NB=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
  const d=NB.getChannelData(0);for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
  /* static, and the chord it hums */
  const src=ctx.createBufferSource();src.buffer=NB;src.loop=true;
  nbp=ctx.createBiquadFilter();nbp.type="bandpass";nbp.frequency.value=1700;nbp.Q.value=0.45;
  noiseGain=ctx.createGain();noiseGain.gain.value=0;
  staticMix=ctx.createGain();staticMix.connect(master);
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
  bedGain=ctx.createGain();bedGain.gain.value=0;bedGain.connect(musicMix);
  /* voices: a narrow band, like a real signal, opening up or closing down with the situation */
  vIn=ctx.createGain();
  vHP=ctx.createBiquadFilter();vHP.type="highpass";vHP.frequency.value=280;
  vLP=ctx.createBiquadFilter();vLP.type="lowpass";vLP.frequency.value=3400;
  vGain=ctx.createGain();voiceMix=ctx.createGain();vSend=ctx.createGain();vSend.gain.value=0;
  vIn.connect(vHP);vHP.connect(vLP);vLP.connect(vGain);vGain.connect(voiceMix);voiceMix.connect(master);vGain.connect(vSend);vSend.connect(conv);
  S.setMix(mix);
  return true;
};
S.resume=()=>{if(ctx&&ctx.state==="suspended") ctx.resume().catch(()=>{});};
let vol=0.7;
S.setVolume=v=>{vol=v;if(master) master.gain.setTargetAtTime(v,ctx.currentTime,0.03);};
S.setMix=m=>{
  Object.assign(mix,m);
  if(!ctx) return;
  const t=ctx.currentTime;
  voiceMix.gain.setTargetAtTime(mix.voice*1.5,t,0.05);musicMix.gain.setTargetAtTime(mix.music,t,0.05);staticMix.gain.setTargetAtTime(mix.static,t,0.05);
};
S.level=function(){
  if(!analyser) return 0;
  const b=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(b);
  let s=0;for(let i=0;i<b.length;i++){const v=(b[i]-128)/128;s+=v*v;}
  return Math.min(1,Math.sqrt(s/b.length)*4);
};

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
  const fade=1-(o.dead?0.3:0.14)*(0.5+0.5*Math.sin(fadePhase))*(o.inside?0:1);
  vGain.gain.setTargetAtTime((0.3+0.7*o.clarity)*fade,t,0.2);
  vHP.frequency.setTargetAtTime(o.inside?60:o.dead?200:280,t,0.3);
  vLP.frequency.setTargetAtTime(o.inside?9000:o.dead?2300:3000+600*o.clarity,t,0.3);
  vSend.gain.setTargetAtTime(o.inside?0:o.dead?0.7:0.05,t,0.3);
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
function noiseHit(when,dur,vol,type,freq,dest){
  if(!ctx) return;
  const s=ctx.createBufferSource(), f=ctx.createBiquadFilter(), a=ctx.createGain();
  s.buffer=NB;s.loop=true;f.type=type;f.frequency.value=freq;
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
function sustained(partsList){
  const t=ctx.currentTime, nodes=partsList.map(p=>{
    const o=ctx.createOscillator(), a=ctx.createGain();
    o.type=p[1];o.frequency.value=p[0];a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(p[2],t+1.2);
    o.connect(a);a.connect(bedGain);o.start();return [o,a];
  });
  return ()=>{const e=ctx.currentTime;nodes.forEach(n=>{try{n[1].gain.cancelScheduledValues(e);n[1].gain.setTargetAtTime(0,e,0.08);n[0].stop(e+0.5);}catch(_){}});};
}
function every(ms,fn,first){if(first!==false) fn();const h=setInterval(fn,ms);return ()=>clearInterval(h);}
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
S.moonChord=function(){if(!ctx) return;const t=ctx.currentTime+0.2;[50,57,62,66,69,74].forEach((m,i)=>pad(mf(m),t+i*0.5,10,0.05,fx));};
S.moonGone=function(){if(!ctx) return;reversed(mf(86),ctx.currentTime+0.05,1.4,0.03,fx);};

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
  /* the Coastal Service: a drone, a foghorn, a buoy, the sea while there is one, and a tune nobody is playing */
  coastal:()=>{
    const ph=[[62,65,64,60,62],[57,60,62,64,62],[69,67,65,64,62],[62,60,57,60,62]];let i=0;
    return all(sustained([[55,"sine",0.05],[82.4,"sine",0.03]]),
      every(19000,()=>{const t=ctx.currentTime+0.6;pad(98,t,2.6,0.1);pad(73.4,t+0.2,2.8,0.09);}),
      every(6300,()=>{if(Math.random()<0.6) bell(1318,0.022,1.6,bedGain);},false),
      every(8500,()=>{const m=mood();if(m==="normal"||m==="back") swell(5.5,260,680,0.045);},false),
      every(23000,()=>{const t=ctx.currentTime+3;ph[i++%ph.length].forEach((n,k)=>reed(mf(n),t+k*1.5,1.7,0.016));},false));
  },
  /* the Clerk: an interval signal that never quite repeats, and a held note like a tape left running */
  musicbox:()=>{
    const base=[88,91,93,91,86,88];let i=0;
    return all(sustained([[440,"sine",0.005],[659.3,"sine",0.003]]),
      every(21000,()=>{
        const m=mood(), t=ctx.currentTime+0.1, tr=[0,0,-2,3,-5][i++%5]+(m==="moon"?-2:0), notes=m==="wrong"?base.slice().reverse():base;
        notes.forEach((n,k)=>tone(mf(n+tr),t+k*(m==="moon"?0.5:0.36),0.9,"sine",0.06));
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
    every(20000,()=>{const t=ctx.currentTime+0.4, m=mood();(m==="wrong"?[79,72,76]:[76,72,79]).forEach((n,k)=>ep(mf(n),t+k*0.45,2.2,0.035));},false)),
  /* Vellish: the music from a language tape */
  vellish:(st)=>every(8200,()=>{
    const t=ctx.currentTime+0.2, sc=[62,63,67,69,70,74], n=3+Math.floor(Math.random()*3);let k=Math.floor(Math.random()*sc.length);
    for(let i=0;i<n;i++){k=Math.max(0,Math.min(sc.length-1,k+rnd([-2,-1,1,1,2])));const f=mf(sc[k]+12);tone(f,t+i*0.42,1.3,"triangle",0.03);tone(f,t+i*0.42+0.3,0.9,"triangle",0.011);}
  },false),
  /* Little Wending: a bell, and a harmonium working through a hymn it half remembers */
  parish:()=>{
    const hymn=[[53,57,60],[53,58,62],[52,55,60],[53,57,60]];let i=0;
    return all(every(7000,()=>{const m=mood(), f=m==="moon"?174.6:196;bell(f,0.07,4.5,bedGain);if(m==="wrong") bell(f,0.06,4.5,bedGain,ctx.currentTime+0.5);}),
      every(6200,()=>{const k=i++%6;if(k>3) return;const t=ctx.currentTime+2.4;hymn[k].forEach(n=>reed(mf(n),t,5.2,0.011));},false));
  },
  /* Lagoon: easy listening that means it */
  lagoon:()=>{
    const CH=[[53,57,60,64],[52,55,59,62],[50,53,57,60],[48,52,55,59]], order=[0,1,2,3,2,1,3,2,1,0], hits=[0,2,3,5,6,8,10,11,13,14];
    return seq(0.4167,(s,t)=>{
      const ch=CH[Math.floor(s/16)%4], st=s%16, m=mood(), thin=m==="wrong";
      if(st===0){ch.forEach((n,k)=>pad(mf(n),t+k*0.05,6.6,0.02));pad(mf(ch[3]+12),t,6.6,0.008);}
      if(st===0||st===10) bass(mf(ch[0]-12),t,1.8,0.06);
      const h=hits.indexOf(st);
      if(h>=0&&Math.random()<(thin?0.3:0.9)) ep(mf(ch[order[h]]+12),t,1.9,0.034);
      if(!thin&&st%2===1) noiseHit(t,0.04,0.004,"highpass",8000);
    });
  },
  /* 16,661: mains hum, and a man whistling. After the moon goes it is the same tune, backwards, and slightly flat. */
  hum:()=>{
    const tune=[72,76,79,76,74,72,69,72];
    return all(sustained([[50,"sine",0.05],[100,"sine",0.02],[150,"triangle",0.006]]),
      every(14000,()=>{
        if(HB.letIn&&HB.letIn()) return;
        const off=mood()==="moon"||mood()==="wrong", t=ctx.currentTime+1.5, notes=off?tune.slice().reverse():tune, d=off?0.44:0.32;
        notes.forEach((n,k)=>whistled(mf(n+12),t+k*d,d*0.95,0.03,null,off?-28:0));
      },false),
      every(4200,()=>{const m=mood();if(m==="moon"||m==="wrong") swell(3.2,420,260,0.05);},false));
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
  door:()=>all(sustained([[41.2,"sine",0.09],[61.7,"sine",0.03]]),every(3200,()=>{S.thump(0,0.35,true);S.thump(0.3,0.25,true);},false)),
  /* the eleventh station: yours */
  yours:()=>playYours()
};
S.startBed=function(st){
  if(!ctx) return;
  if(bedName===st.id) return;
  S.stopBed();
  if(st.bed&&BEDS[st.bed]){bedStop=BEDS[st.bed](st);bedName=st.id;}
};
S.stopBed=function(){if(bedStop){try{bedStop();}catch(_){}bedStop=null;}bedName="";};

/* ---------------- voices ---------------- */
const cache=new Map();           /* sprite name -> AudioBuffer, a few at a time */
const pending=new Map();
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
    .then(buf=>{cache.set(sprite,buf);while(cache.size>6) cache.delete(cache.keys().next().value);pending.delete(sprite);return true;})
    .catch(()=>{pending.delete(sprite);return false;});
  pending.set(sprite,p);return p;
};
/* parts: [{sprite,key}] in order. Resolves when the last has been spoken, or when something stops it. */
S.say=async function(partsList,o){
  if(!ctx) return false;
  o=o||{};
  const names=[...new Set(partsList.map(p=>p.sprite))];
  const ok=await Promise.all(names.map(S.prepare));
  if(ok.indexOf(false)>=0) return false;
  S.stopVoice();
  const rate=o.rate||1;let t=ctx.currentTime+0.06;
  for(const p of partsList){
    const c=S.clip(p.sprite,p.key), buf=cache.get(p.sprite);
    if(!c||!buf) return false;
    const src=ctx.createBufferSource();src.buffer=buf;src.playbackRate.value=rate;src.connect(vIn);
    src.start(t,c[0],c[1]);speaking.push(src);
    t+=(c[1]-0.08)/rate;
  }
  const ms=(t-ctx.currentTime)*1000;
  return new Promise(res=>{
    const h=setTimeout(()=>{speakDone=null;speaking=[];res(true);},ms);
    speakDone=()=>{clearTimeout(h);res(true);};
  });
};
S.duration=function(partsList,rate){
  let d=0;
  for(const p of partsList){const c=S.clip(p.sprite,p.key);if(!c) return 0;d+=(c[1]-0.08)/(rate||1);}
  return d*1000;
};
S.stopVoice=function(){
  speaking.forEach(s=>{try{s.stop();}catch(_){}});speaking=[];
  if(speakDone){const f=speakDone;speakDone=null;f();}
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
  el.onended=()=>setTimeout(next,kindGap());
  el.onerror=()=>setTimeout(next,3000);
  function kindGap(){return 1200+Math.random()*1500;}
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
  musicMix.gain.setTargetAtTime(mix.music*0.25,ctx.currentTime,0.2);
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
  musicMix.gain.setTargetAtTime(mix.music,ctx.currentTime,0.4);
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
