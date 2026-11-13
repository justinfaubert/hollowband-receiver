#!/usr/bin/env node
/* Lists every fragment of speech the radio can say, as JSON, for tools/render_voices.py.
   usage: node tools/dump_lines.js > /tmp/lines.json */
const S=require("../js/script.js");
const out=[], seen=new Set();
function add(sprite,cast,text){
  const key=S.hash(cast+"|"+text), id=sprite+"|"+key;
  if(seen.has(id)) return; seen.add(id);
  out.push({sprite,cast,text,key});
}
function line(stationId,group,cast,l){
  const variants=typeof l==="string"?[l]:[l.t,l.else].filter(Boolean);
  for(const v of variants){
    if(v[0]==="~"||v[0]==="(") continue;
    for(const p of S.parts(v)){
      if(p.text) add(stationId+"."+group,cast,p.text);
      else for(const val of S.slots[p.slot]) add(stationId+".slots",cast,val);
    }
  }
}
const lines=(id,group,cast,arr)=>(arr||[]).forEach(l=>line(id,group,cast,l));
for(const st of S.living.concat(S.dead)){
  if(!st.cast) continue;
  st.segs.forEach((seg,i)=>lines(st.id,"seg"+i,st.cast,seg));
  lines(st.id,"moon",st.cast,st.moon);
  lines(st.id,"wrong",st.cast,st.wrong);
  lines(st.id,"misc",st.cast,[].concat(st.back||[],st.calls||[]));
}
const L=S.listener;
L.segs.forEach((seg,i)=>lines(L.id,"seg"+i,L.cast,seg));
lines(L.id,"home",L.cast,L.home.concat(L.callsHome));
for(const g of ["first","asks","obs","inside","intrude","letIn","calls"]) lines(L.id,g,L.castDouble,L[g]);
process.stdout.write(JSON.stringify(out,null,1));
