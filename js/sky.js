/* Hollowband Receiver — the sky, and the land under it.
   The stars are the real ones (js/stars.js), placed for 50 degrees north at the local sidereal time,
   looking south. The dial offsets that time: on 10,000 kHz, where the Bureau lives, the sky is true to the clock;
   anywhere else it is earlier or later. The moon keeps tonight's real phase.
   On the other band the same sky is drawn as a star atlas: pale paper, ink stars, the figures joined up. */
(function(){
"use strict";
const HB=window.HB=window.HB||{};
const K=HB.sky={beam:0,moonA:1,moonTarget:1};
const RAD=Math.PI/180, LAT=50*RAD, SL=Math.sin(LAT), CL=Math.cos(LAT);
const COL=["#cfdcff","#eef2ff","#fff6e0","#ffe2b8","#ffcfa0"];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
let st=null, figs=null, dust=null, grid=null;

function pts(n){return {n:n,ra:new Float32Array(n),sd:new Float32Array(n),cd:new Float32Array(n)};}
function setPt(o,i,ra,dec){o.ra[i]=ra;o.sd[i]=Math.sin(dec);o.cd[i]=Math.cos(dec);}
function prep(){
  if(st) return;
  const d=(window.HB_STARS&&HB_STARS.s)||[], n=d.length/4;
  st=pts(n);st.mag=new Float32Array(n);st.col=new Uint8Array(n);st.tw=new Float32Array(n);
  for(let i=0;i<n;i++){
    setPt(st,i,d[i*4]/100*RAD,d[i*4+1]/100*RAD);
    const bv=d[i*4+3]/10;
    st.mag[i]=d[i*4+2]/10;st.col[i]=bv<0?0:bv<0.4?1:bv<0.8?2:bv<1.2?3:4;st.tw[i]=Math.random()*6.28;
  }
  figs=((window.HB_STARS&&HB_STARS.l)||[]).map(p=>{const o=pts(p.length/2);for(let i=0;i<o.n;i++) setPt(o,i,p[i*2]/10*RAD,p[i*2+1]/10*RAD);return o;});
  /* the Milky Way: dust scattered along the galactic equator, turned into our coordinates */
  const m=1800;dust=pts(m);dust.a=new Float32Array(m);
  for(let i=0;i<m;i++){
    const l=Math.random()*6.2832, b=(Math.random()+Math.random()+Math.random()-1.5)*0.2*(1+0.9*Math.max(0,Math.cos(l)));
    const xg=Math.cos(b)*Math.cos(l), yg=Math.cos(b)*Math.sin(l), zg=Math.sin(b);
    const xe=-0.0548755604*xg+0.4941094279*yg-0.8676661490*zg, ye=-0.8734370902*xg-0.4448296300*yg-0.1980763734*zg, ze=-0.4838350155*xg+0.7469822445*yg+0.4559837762*zg;
    setPt(dust,i,Math.atan2(ye,xe),Math.asin(ze));dust.a[i]=0.1+Math.random()*0.26;
  }
  /* an atlas grid, for the other side */
  grid=[];
  for(let dec=-20;dec<=60;dec+=20){const o=pts(73);for(let i=0;i<73;i++) setPt(o,i,i*5*RAD,dec*RAD);grid.push(o);}
  for(let ra=0;ra<360;ra+=30){const o=pts(25);for(let i=0;i<25;i++) setPt(o,i,ra*RAD,(-40+i*5)*RAD);grid.push(o);}
}
function lst(offsetH){
  const D=Date.now()/86400000+2440587.5-2451545.0, g=18.697374558+24.06570982441908*D, lon=-new Date().getTimezoneOffset()/60*15;
  return ((((g+lon/15+offsetH)%24)+24)%24)*15*RAD;
}
/* stereographic projection of the southern sky */
function camera(W,a0deg,horizon){const sc=W/1.456, a0=a0deg*RAD;return {sc:sc,sa:Math.sin(a0),ca:Math.cos(a0),cx:W/2,cy:horizon-2*Math.tan(a0/2)*sc};}
const P={x:0,y:0,u:0};
function proj(c,o,i,T){
  const Hh=T-o.ra[i], ch=Math.cos(Hh), sh=Math.sin(Hh), U=SL*o.sd[i]+CL*o.cd[i]*ch;
  if(U<-0.03) return false;
  const E=-o.cd[i]*sh, N=o.sd[i]*CL-o.cd[i]*ch*SL, Y=N*c.sa+U*c.ca, Z=-N*c.ca+U*c.sa;
  if(Z<0.05) return false;
  const k=2/(1+Z)*c.sc;
  P.x=c.cx-E*k;P.y=c.cy-Y*k;P.u=U;return true;
}
function poly(g,c,o,T,W,H){
  let pen=false, lx=0, ly=0;
  for(let i=0;i<o.n;i++){
    if(!proj(c,o,i,T)||P.x<-W||P.x>2*W||P.y>H+40){pen=false;continue;}
    if(pen&&Math.abs(P.x-lx)<W*0.6&&Math.abs(P.y-ly)<H*0.8) g.lineTo(P.x,P.y); else g.moveTo(P.x,P.y);
    pen=true;lx=P.x;ly=P.y;
  }
}

/* ---------- the moon: a lit sphere with its seas, at tonight's phase ---------- */
K.phase=function(){const days=(Date.now()-Date.UTC(2000,0,6,18,14))/86400000;return ((days/29.530588853)%1+1)%1;};
const MARIA=[[-0.28,-0.42,0.27,0.26],[0.22,-0.40,0.17,0.24],[0.38,-0.12,0.2,0.26],[0.72,-0.26,0.09,0.24],[0.62,0.12,0.13,0.2],[0.45,0.30,0.08,0.18],[-0.62,-0.1,0.30,0.2],[-0.18,0.38,0.17,0.2],[-0.52,0.40,0.10,0.2],[0.0,-0.74,0.2,0.1]];
let moonC=null, moonKey="";
function moonCanvas(R){
  const ph=K.phase(), key=Math.round(R)+"|"+ph.toFixed(2);
  if(moonKey===key) return moonC;
  const n=Math.ceil(R*2), c=document.createElement("canvas");c.width=c.height=n;
  const g=c.getContext("2d"), im=g.createImageData(n,n), d=im.data, al=6.2832*ph, sx=Math.sin(al), sz=-Math.cos(al);
  for(let y=0;y<n;y++) for(let x=0;x<n;x++){
    const nx=(x+0.5-R)/R, ny=(y+0.5-R)/R, r2=nx*nx+ny*ny, i=(y*n+x)*4;
    if(r2>1){d[i+3]=0;continue;}
    const nz=Math.sqrt(1-r2);
    let alb=0.9;
    for(const m of MARIA){const dd=((nx-m[0])*(nx-m[0])+(ny-m[1])*(ny-m[1]))/(m[2]*m[2]);alb-=m[3]*Math.exp(-dd*1.5);}
    alb+=0.22*Math.exp(-((nx+0.1)*(nx+0.1)+(ny-0.72)*(ny-0.72))/0.004)+0.14*Math.exp(-((nx+0.33)*(nx+0.33)+(ny+0.13)*(ny+0.13))/0.003);
    alb*=0.95+0.1*((Math.sin(x*12.9898+y*78.233)*43758.5453)%1+1)%1;
    let il=nx*sx+nz*sz;il=il<=0?0:Math.pow(il,0.35);
    const lit=alb*il*(0.85+0.15*nz)*1.3, earth=0.34*alb;
    d[i]=Math.min(255,242*lit+60*earth);d[i+1]=Math.min(255,241*lit+80*earth);d[i+2]=Math.min(255,228*lit+125*earth);
    d[i+3]=255*clamp((1-Math.sqrt(r2))*R,0,1);
  }
  g.putImageData(im,0,0);moonC=c;moonKey=key;return c;
}
K.setMoon=function(target,instant){K.moonTarget=target;if(instant||target<K.moonA) K.moonA=target;};

/* ---------- land ---------- */
const hills=[];for(let i=0;i<=40;i++){const x=i/40;hills.push(x<0.3?-0.06:0.02+0.11*Math.sin((x-0.3)*4.2)+0.045*Math.sin(x*17)+0.025*Math.sin(x*41));}
const hillAt=x=>{const f=clamp(x,0,1)*40, i=Math.floor(f);return lerp(hills[i],hills[Math.min(40,i+1)],f-i);};
const LIGHTS={dolores:[0.47,"#ffcf8a"],farm:[0.57,"#ffe08a"],kettle:[0.69,"#f4f7ff"],bureau:[0.4,"#ffe9c0"],vellish:[0.63,"#cfe4ff"],parish:[0.78,"#ffd9a0"],lagoon:[0.52,"#ff9ec4"]};
const VILLAGE=[[0.735,0.3],[0.75,0.7],[0.765,0.2],[0.795,0.6],[0.81,0.35],[0.825,0.8]];
let shoot=null, drops=[], owlBlink=0, owlTurn=0;

/* s: {kind, freq, dead, phase, returned, letIn, replaced, found, currentId, yours, onAir, lvl, rain, fog, wind} */
K.draw=function(cv,s){
  prep();
  const W=cv.clientWidth, H=cv.clientHeight, dpr=Math.min(window.devicePixelRatio||1,2.5);
  if(!W||!H) return;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const g=cv.getContext("2d");g.setTransform(dpr,0,0,dpr,0,0);
  const t=performance.now()/1000, dm=!!s.dead, win=s.kind==="window", u=win?W/230:1;
  if(K.moonA<K.moonTarget) K.moonA=Math.min(K.moonTarget,K.moonA+0.012);
  const mA=dm?0:K.moonA, ph=K.phase(), frac=(1-Math.cos(6.2832*ph))/2, glow=mA*(0.25+0.75*frac);
  const rain=s.rain||0, fog=s.fog||0, cloud=Math.max(rain,fog*0.6);
  const Hy=H*(win?0.8:0.84);

  /* sky */
  const bg=g.createLinearGradient(0,0,0,H);
  if(dm){bg.addColorStop(0,"#c7cdbd");bg.addColorStop(1,"#e3e1cd");}
  else{bg.addColorStop(0,"rgb("+Math.round(4+7*glow)+","+Math.round(7+9*glow)+","+Math.round(15+15*glow)+")");bg.addColorStop(1,"rgb("+Math.round(13+14*glow+10*cloud)+","+Math.round(19+16*glow+10*cloud)+","+Math.round(33+20*glow+8*cloud)+")");}
  g.fillStyle=bg;g.fillRect(0,0,W,H);

  /* stars */
  const cam=camera(W,win?32:12,Hy), T=lst(((s.freq||10000)-10000)/14000*24), vis=(1-0.8*cloud)*(1-0.4*glow);
  if(dm){
    g.strokeStyle="rgba(35,35,46,.13)";g.lineWidth=0.6;g.beginPath();for(const o of grid) poly(g,cam,o,T,W,H);g.stroke();
    g.strokeStyle="rgba(35,35,46,.5)";g.lineWidth=0.8;g.beginPath();for(const o of figs) poly(g,cam,o,T,W,H);g.stroke();
  }
  g.fillStyle=dm?"#23232e":"#dfe8ff";
  for(let i=0;i<dust.n;i++){
    if(!proj(cam,dust,i,T)||P.x<0||P.x>W||P.y>Hy) continue;
    g.globalAlpha=dust.a[i]*(dm?0.5:vis)*clamp(P.u*5,0.15,1);g.fillRect(P.x,P.y,u,u);
  }
  for(let i=0;i<st.n;i++){
    if(!proj(cam,st,i,T)||P.x<-2||P.x>W+2||P.y>Hy+2||P.y<-2) continue;
    const m=st.mag[i], sz=(m<0.5?2.1:m<1.5?1.7:m<2.6?1.35:m<4?1.05:0.8)*Math.max(1,u*0.9), ext=clamp(P.u*6,0.2,1);
    if(dm){g.globalAlpha=clamp(1.1-m*0.14,0.3,1);g.fillStyle="#23232e";g.beginPath();g.arc(P.x,P.y,sz*0.75,0,6.2832);g.fill();continue;}
    const tw=1-(0.12+0.4*(1-P.u))*(0.5+0.5*Math.sin(t*(1.5+(i%7)*0.4)+st.tw[i]));
    g.globalAlpha=clamp(1.08-m*0.15,0.22,1)*tw*ext*vis;g.fillStyle=COL[st.col[i]];
    g.fillRect(P.x-sz/2,P.y-sz/2,sz,sz);
    if(m<1.6){g.globalAlpha*=0.25;g.fillRect(P.x-sz*1.6,P.y-sz*0.3,sz*3.2,sz*0.6);g.fillRect(P.x-sz*0.3,P.y-sz*1.6,sz*0.6,sz*3.2);}
  }
  g.globalAlpha=1;
  if(!dm){
    if(!shoot&&Math.random()<0.004&&cloud<0.3) shoot={x:Math.random()*W*0.8+W*0.1,y:Math.random()*Hy*0.4,t:0};
    if(shoot){
      shoot.t+=0.12;const k=shoot.t;
      g.strokeStyle="rgba(235,240,255,"+(0.8*(1-k))+")";g.lineWidth=1.2;g.beginPath();
      g.moveTo(shoot.x+k*70,shoot.y+k*26);g.lineTo(shoot.x+k*70-22,shoot.y+k*26-8);g.stroke();
      if(k>=1) shoot=null;
    }
  }

  /* moon */
  const mcx=W*(win?0.3:0.2), mcy=win?H*0.24:H*0.36, R=win?W*0.115:H*0.2;
  if(mA>0.01){
    const halo=g.createRadialGradient(mcx,mcy,R*0.6,mcx,mcy,R*5);
    halo.addColorStop(0,"rgba(200,218,255,"+(0.34*glow)+")");halo.addColorStop(1,"rgba(200,218,255,0)");
    g.fillStyle=halo;g.fillRect(mcx-R*5.2,mcy-R*5.2,R*10.4,R*10.4);
    g.globalAlpha=mA;g.drawImage(moonCanvas(R*dpr),mcx-R,mcy-R,R*2,R*2);g.globalAlpha=1;
  }
  /* cloud */
  if(cloud>0.02&&!dm){
    for(let i=0;i<6;i++){
      const cx=((i*0.21+t*0.004*(1+i%3))%1.3-0.15)*W, cy=H*(0.12+0.11*i%0.6), rr=W*(0.3+0.07*(i%3));
      const cg=g.createRadialGradient(cx,cy,rr*0.1,cx,cy,rr);cg.addColorStop(0,"rgba(22,28,40,"+(0.75*cloud)+")");cg.addColorStop(1,"rgba(22,28,40,0)");
      g.fillStyle=cg;g.fillRect(cx-rr,cy-rr,rr*2,rr*2);
    }
  }

  /* far headland, sea */
  const out=s.phase>=1&&!s.returned, shore=W*0.34, seaTop=Hy+(out?H*0.075:0);
  g.fillStyle=dm?"#93a08f":"rgb("+Math.round(13+10*glow)+","+Math.round(19+12*glow)+","+Math.round(31+16*glow)+")";
  g.beginPath();g.moveTo(0,Hy);g.lineTo(0,Hy-H*0.018);g.quadraticCurveTo(W*0.12,Hy-H*0.04,W*0.26,Hy-H*0.012);g.lineTo(shore,Hy);g.closePath();g.fill();
  g.fillStyle=dm?"#59685a":"#0a0e16";g.fillRect(0,Hy,shore+2,H-Hy);
  g.fillStyle=dm?"#a9b3ad":"rgb("+Math.round(10+12*glow)+","+Math.round(16+16*glow)+","+Math.round(28+22*glow)+")";g.fillRect(0,seaTop,shore+2,H-seaTop);
  if(!dm){
    g.fillStyle="rgba(190,205,235,"+(0.07+0.1*glow)+")";
    for(let i=0;i<7;i++){const yy=seaTop+3+i*((H-seaTop)/8), ww=shore*(0.25+0.5*((i*37)%10)/10), xx=((i*53)%10)/10*(shore-ww)+Math.sin(t*0.6+i)*3;g.fillRect(xx,yy,ww,0.8);}
    if(mA>0.05){
      g.fillStyle="rgba(232,238,255,"+(0.55*glow)+")";
      for(let i=0;i<6;i++){const yy=seaTop+2+i*((H-seaTop-3)/6), ww=(3+i*2.4)*u*(0.7+0.3*Math.sin(t*2+i*1.7));g.fillRect(mcx-ww/2,yy,ww,1);}
    }
  }
  /* Lantern Rock: the light is working */
  const lx=W*0.07, ly=Hy;
  g.fillStyle=dm?"#2b382c":"#04060a";g.beginPath();g.moveTo(lx-9*u,ly+3*u);g.lineTo(lx-3*u,ly-2*u);g.lineTo(lx+4*u,ly-2*u);g.lineTo(lx+11*u,ly+3*u);g.closePath();g.fill();
  g.fillRect(lx-1.6*u,ly-13*u,3.2*u,12*u);g.fillRect(lx-2.6*u,ly-15.5*u,5.2*u,3*u);
  const th=t*6.2832/8, flash=Math.pow(Math.max(0,Math.cos(th)),20), side=Math.sin(th);
  K.beam=dm?0:flash*(1-0.6*fog);
  if(!dm){
    if(Math.abs(side)>0.15&&Math.cos(th)>-0.5){
      const L=(60+50*fog)*u*side, bgc=g.createLinearGradient(lx,0,lx+L,0);
      bgc.addColorStop(0,"rgba(255,236,170,"+(0.22+0.2*fog)+")");bgc.addColorStop(1,"rgba(255,236,170,0)");
      g.fillStyle=bgc;g.beginPath();g.moveTo(lx,ly-14*u);g.lineTo(lx+L,ly-14*u-7*u);g.lineTo(lx+L,ly-14*u+7*u);g.closePath();g.fill();
    }
    g.fillStyle="rgba(255,236,170,"+(0.4+0.6*flash)+")";g.beginPath();g.arc(lx,ly-14*u,(1.5+flash*1.6)*u,0,6.2832);g.fill();
    if(flash>0.04){const gr=g.createRadialGradient(lx,ly-14*u,1,lx,ly-14*u,46*u);gr.addColorStop(0,"rgba(255,236,170,"+(0.34*flash)+")");gr.addColorStop(1,"rgba(255,236,170,0)");g.fillStyle=gr;g.fillRect(lx-46*u,ly-60*u,92*u,92*u);}
  }

  /* the land, in two depths */
  const hy=x=>Hy-hillAt(x)*H*(win?0.5:1);
  g.fillStyle=dm?"#4d5f49":"rgb("+Math.round(8+6*glow)+","+Math.round(11+7*glow)+","+Math.round(18+9*glow)+")";
  g.beginPath();g.moveTo(W*0.3,H);for(let i=12;i<=40;i++){const x=i/40;g.lineTo(x*W,hy(x)-H*0.012-3*u*Math.sin(x*23));}g.lineTo(W,H);g.closePath();g.fill();
  g.fillStyle=dm?"#2f3d2d":"#04060a";
  g.beginPath();g.moveTo(W*0.28,H);for(let i=11;i<=40;i++) g.lineTo(i/40*W,hy(i/40));g.lineTo(W,H);g.closePath();g.fill();
  /* poles and wires along the ridge */
  g.strokeStyle=dm?"rgba(47,61,45,.9)":"rgba(4,6,10,.95)";g.lineWidth=Math.max(0.8,0.9*u);g.beginPath();
  const poles=[0.36,0.6,0.84];
  for(const px of poles){g.moveTo(px*W,hy(px));g.lineTo(px*W,hy(px)-12*u);g.moveTo(px*W-3*u,hy(px)-10.5*u);g.lineTo(px*W+3*u,hy(px)-10.5*u);}
  g.stroke();
  g.lineWidth=0.6;g.beginPath();
  for(let i=0;i<poles.length-1;i++){
    const ax=poles[i]*W, ay=hy(poles[i])-10.5*u, bx=poles[i+1]*W, by=hy(poles[i+1])-10.5*u, sag=5*u+(s.wind||0)*Math.sin(t*9+i)*0.6;
    for(const o of [-2.5*u,2.5*u]){g.moveTo(ax+o,ay);g.quadraticCurveTo((ax+bx)/2+o,(ay+by)/2+sag,bx+o,by);}
  }
  g.stroke();
  if(!dm){
    /* a light for everyone you have found. The Clerk doesn't have one. Never has. */
    const hr=new Date().getHours(), awake=hr>=17&&hr<23?6:hr===23?4:hr<2?2:hr<5?0:hr<8?3:0;
    for(let i=0;i<awake;i++){const v=VILLAGE[i], x=v[0]*W, y=hy(v[0])-(1.5+v[1]*2)*u;g.globalAlpha=(0.35+0.15*Math.sin(t*0.7+i*2))*(1+fog*0.5);g.fillStyle="#ffd9a0";g.fillRect(x,y,1.2*u,1.2*u);}
    g.globalAlpha=1;
    for(const id in LIGHTS){
      if(!s.found||!s.found.has(id)) continue;
      const L=LIGHTS[id], x=L[0]*W, y=hy(L[0])-1.5*u, on=s.currentId===id, a=on?0.75+0.25*(s.lvl||0):0.6;
      g.fillStyle="#04060a";
      if(id==="parish"){g.beginPath();g.moveTo(x-2.5*u,y+2*u);g.lineTo(x,y-10*u);g.lineTo(x+2.5*u,y+2*u);g.closePath();g.fill();}
      if(id==="bureau") g.fillRect(x-2*u,y-8*u,4*u,10*u);
      const yy=id==="parish"?y-3*u:id==="bureau"?y-6*u:y;
      g.globalAlpha=a;g.fillStyle=L[1];
      if(id==="kettle"){g.fillRect(x-5*u,y-5*u,2*u,2*u);g.fillRect(x+3*u,y-5*u,2*u,2*u);}
      else g.fillRect(x-u,yy-u,2*u,2*u);
      if(on||fog>0.2){const rr=(on?9+8*(s.lvl||0):5)*u*(1+fog), gr=g.createRadialGradient(x,yy,0.5,x,yy,rr);gr.addColorStop(0,L[1]);gr.addColorStop(1,"rgba(0,0,0,0)");g.globalAlpha=on?0.35+0.4*(s.lvl||0):0.25*fog;g.fillStyle=gr;g.fillRect(x-rr,yy-rr,rr*2,rr*2);}
      g.globalAlpha=1;
    }
    if(s.yours){
      const x=W*0.865, y=hy(0.865);
      g.strokeStyle="#04060a";g.lineWidth=1.2;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-9*u);g.stroke();
      g.fillStyle=s.onAir?"#ff5a48":"#7dffb0";g.globalAlpha=s.onAir||s.currentId==="yours"?1:0.6;g.beginPath();g.arc(x,y-10*u,1.5*u,0,6.2832);g.fill();g.globalAlpha=1;
    }
  }
  /* the mast */
  const mx=win?W*0.93:W-34, top=win?hy(0.93)-36*u:H*0.2, base=win?hy(0.93)+2:H, mw=(win?5:7)*u;
  g.strokeStyle=dm?"#2f3d2d":"#04060a";g.lineWidth=Math.max(1,1.2*u);g.beginPath();
  g.moveTo(mx-mw,base);g.lineTo(mx,top);g.lineTo(mx+mw,base);
  for(let k=1;k<5;k++){const y=top+(base-top)*k/5, w=mw*k/5;g.moveTo(mx-w,y);g.lineTo(mx+w,y);}
  g.stroke();
  const lampOn=dm||s.letIn?false:(s.replaced?true:Math.floor(t/1.1)%2===0);
  if(lampOn){
    g.fillStyle="#ff5a48";g.beginPath();g.arc(mx,top,1.9*u,0,6.2832);g.fill();
    g.fillStyle="rgba(255,90,72,.22)";g.beginPath();g.arc(mx,top,5.5*u*(1+fog),0,6.2832);g.fill();
  }
  /* fog comes in off the water */
  if(fog>0.02&&!dm){
    const fg=g.createLinearGradient(0,Hy-H*0.3,0,H);fg.addColorStop(0,"rgba(120,135,158,0)");fg.addColorStop(0.55,"rgba(120,135,158,"+(0.55*fog)+")");fg.addColorStop(1,"rgba(120,135,158,"+(0.75*fog)+")");
    g.fillStyle=fg;g.fillRect(0,Hy-H*0.3,W,H);
  }
  /* near roofs, and what sits on them */
  if(win){
    const ry=H*0.925;
    g.fillStyle=dm?"#1f2a22":"#020305";
    g.beginPath();g.moveTo(0,H);g.lineTo(0,ry+10*u);g.lineTo(W*0.3,ry);g.lineTo(W*0.62,ry+13*u);g.lineTo(W*0.82,ry+4*u);g.lineTo(W,ry+11*u);g.lineTo(W,H);g.closePath();g.fill();
    const chx=W*0.2, chy=ry+3*u;
    g.fillRect(chx-8*u,chy-20*u,16*u,24*u);g.fillRect(chx-10*u,chy-22*u,20*u,3.5*u);g.fillRect(chx-4.5*u,chy-28*u,3.5*u,7*u);g.fillRect(chx+1.5*u,chy-27*u,3.5*u,6*u);
    /* owls. Whatever they want, they want it from here. */
    const owls=dm?1:s.letIn?0:s.returned?1:s.phase>=2?3:s.phase>=1?2:1;
    if(owlBlink>0) owlBlink-=0.25; else if(Math.random()<0.018) owlBlink=1;
    if(Math.random()<0.006) owlTurn=owlTurn?0:(Math.random()<0.5?-1:1);
    const seat=[[chx+5*u,chy-22.5*u],[W*0.3-2*u,ry],[W*0.82,ry+4*u]];
    for(let i=0;i<owls;i++){
      const ox=seat[i][0], oy=seat[i][1], k=u*1.05;
      g.fillStyle=dm?"#f1eee0":"#020305";
      g.beginPath();g.ellipse(ox,oy-7*k,4.6*k,7.2*k,0,0,6.2832);g.fill();
      g.beginPath();g.arc(ox,oy-13.5*k,4.3*k,0,6.2832);g.fill();
      g.beginPath();g.moveTo(ox-4*k,oy-15.5*k);g.lineTo(ox-3.2*k,oy-19.5*k);g.lineTo(ox-1*k,oy-16.5*k);g.moveTo(ox+4*k,oy-15.5*k);g.lineTo(ox+3.2*k,oy-19.5*k);g.lineTo(ox+1*k,oy-16.5*k);g.fill();
      const asleep=s.returned&&!dm, shut=asleep||(owlBlink>0.3&&i===0), dx=(i===0?owlTurn:0)*1.2*k;
      if(!shut){
        g.fillStyle=dm?"#23232e":"rgba(255,196,96,.85)";
        g.beginPath();g.arc(ox-1.7*k+dx,oy-13.8*k,0.95*k,0,6.2832);g.arc(ox+1.7*k+dx,oy-13.8*k,0.95*k,0,6.2832);g.fill();
      }
    }
  }
  /* rain: falling, and on the glass */
  if(rain>0.02){
    g.strokeStyle=dm?"rgba(40,44,54,.25)":"rgba(190,205,235,.22)";g.lineWidth=0.8;g.beginPath();
    for(let i=0;i<70*rain;i++){const x=Math.random()*W*1.1, y=Math.random()*H;g.moveTo(x,y);g.lineTo(x-3*u,y+11*u);}
    g.stroke();
    if(win){
      while(drops.length<34*rain) drops.push({x:Math.random(),y:Math.random()*0.3,v:0.002+Math.random()*0.006,r:0.8+Math.random()*1.6});
      g.strokeStyle="rgba(215,225,245,.5)";g.lineWidth=0.8;
      for(const d of drops){
        d.y+=d.v*(Math.random()<0.7?1:0);d.x+=(Math.random()-0.5)*0.0015;
        g.beginPath();g.arc(d.x*W,d.y*H,d.r*u,0.6,2.6);g.stroke();
        g.fillStyle="rgba(215,225,245,.14)";g.fillRect(d.x*W-0.4,d.y*H-9*u*d.v*90,0.8,9*u*d.v*90);
      }
      drops=drops.filter(d=>d.y<1.02);
    }
  }else if(drops.length) drops.length=Math.max(0,drops.length-1);
};
})();
