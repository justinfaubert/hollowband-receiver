/* Hollowband Receiver — things that come through the door, and things that were already in the room.
   Pure content. A QSL card is what a station sends back when you tell it you heard it: front designed by the
   station, back filled in by whoever was on shift. i = {freq, time, date, day, sinpo}. */
window.HB_CARDS=(function(){
"use strict";
var ADDR=["The Relief","Top Room","9 Lantern Row","Cape Regret"];
function rear(o){
  var a=(o.addr||ADDR).map(function(x){return "<span>"+x+"</span>";}).join("");
  return '<div class="msg'+(o.typed?" typed":"")+'">'+o.msg+"</div>"+
    (o.stamp?'<div class="stamp" style="--sc:'+o.stamp[2]+'"><b>'+o.stamp[0]+"</b>"+o.stamp[1]+'</div><div class="post">'+o.post.join("<br>")+"</div>":"")+
    '<div class="addr">'+a+"</div>"+(o.foot?'<div class="foot">'+o.foot+"</div>":"");
}
function qsl(i){return "<small>QSL &middot; confirming your reception</small>"+i.freq+" kHz, about "+i.time+", "+i.date+". SINPO "+i.sinpo+".<br>";}

var cards={
coast:{cls:"c-coast",name:"Coastal Service",
 front:function(){return '<div class="c-coast"><div class="flags"></div><div class="k1">Marrow Sound</div><div class="k2">COASTAL SERVICE</div><div class="f">3305</div><div class="k3">kHz &middot; inshore waters &middot; until further notice</div>'+
  '<svg viewBox="0 0 40 60"><path d="M0,58 H40" stroke="#1d2f4f" stroke-width="2"/><path d="M14,58 L17,22 H23 L26,58 Z" fill="#1d2f4f"/><rect x="15.5" y="13" width="9" height="9" fill="#c8402f"/><path d="M13,13 H27 L20,5 Z" fill="#1d2f4f"/><path d="M25,17 L40,10 V25 Z" fill="#f2c14e"/><path d="M15,17 L0,11 V24 Z" fill="#f2c14e" opacity=".55"/><path d="M15,36 H25 M14.5,46 H25.5" stroke="#efe6cf" stroke-width="2.5"/></svg></div>';},
 back:function(i){return rear({msg:qsl(i)+"Your report was received in fair condition, backing damp. Biscuits were not enclosed. 73.",stamp:["3d","INSHORE","#1d2f4f"],post:["MARROW","SOUND",i.date]});}},
clerk:{cls:"c-clerk",name:"The Clerk",
 front:function(){return '<div class="c-clerk"><div class="grp">39006 88125 47730 61992 22508 55413 90776 18334 64201 00000 77778 24015 61130 <b>04890</b> 39006 88125 47730 61992 22508 55413 90776 18334 64201 77778 24015 61130 39006 88125 47730 61992 22508 55413</div><div class="st">DO NOT WRITE BACK</div><div class="k3">THE CLERK</div></div>';},
 back:function(i){return rear({typed:true,msg:qsl(i)+"<br>Six. Eight. Two. Two. One.<br><br>That is not a group.<br>That is thank you.",stamp:["0","NOUGHT","#6b6b66"],post:["NO","RETURN","ADDRESS"]});}},
dolores:{cls:"c-dolores",name:"Dolores Vane",
 front:function(){return '<div class="c-dolores"><div class="k1">Up Late</div><div class="k2">WITH DOLORES VANE</div><div class="k3">The only voice between here and breakfast. Lines open.</div><div class="f">6075 kc</div>'+
  '<svg viewBox="0 0 60 100"><path d="M38,8 A27,27 0 1,0 38,60 A34,34 0 0,1 38,8 Z" fill="#ffd08a"/><path d="M14,72 C14,63 46,63 46,72 L46,78 C46,82 38,82 38,78 L38,75 L22,75 L22,78 C22,82 14,82 14,78 Z" fill="#ffe9d2"/><path d="M30,82 C30,89 24,89 24,94 C24,99 34,99 34,94" fill="none" stroke="#ffe9d2" stroke-width="1.6"/></svg></div>';},
 back:function(i){return rear({msg:qsl(i)+"Honey, I knew somebody was up. Leave a light on, and feed that goose. &mdash; D.V.",stamp:["D","LINES OPEN","#a02a6c"],post:["LATE","NIGHT",i.date]});}},
farm:{cls:"c-farm",name:"Stock & Fodder",
 front:function(){return '<div class="c-farm"><div class="k1">Lower Orchard</div><div class="k2">STOCK &amp; FODDER REPORT</div><div class="rule"></div>'+
  '<svg viewBox="0 0 40 46"><path d="M20,14 C35,14 37,30 20,45 C3,30 5,14 20,14 Z" fill="none" stroke="#7a1f14" stroke-width="1.8"/><path d="M12,22 C16,19 22,19 26,21" fill="none" stroke="#7a1f14" stroke-width="1" opacity=".6"/><path d="M20,14 C16,7 12,4 7,4 M20,14 C20,7 22,3 26,1 M20,14 C24,8 30,6 35,7" fill="none" stroke="#2f5d34" stroke-width="2" stroke-linecap="round"/></svg>'+
  '<div class="f">7335</div><div class="k3">Mind the gate</div></div>';},
 back:function(i){return rear({msg:qsl(i)+"Reception confirmed. Postage paid in turnips. Mind the gate.",stamp:["1","TURNIP","#7a1f14"],post:["LOWER","ORCHARD",i.date]});}},
kettle:{cls:"c-kettle",name:"Kettleball",
 front:function(){return '<div class="c-kettle"><div class="k1">KETTLEBALL</div><div class="k2">FINAL &middot; LIVE &middot; 9560</div>'+
  '<svg viewBox="0 0 56 52"><path d="M8,50 L20,2 M20,50 L32,2 M10.5,40 H22.5 M13,30 H25 M15.5,20 H27.5 M18,10 H30" stroke="#fff" stroke-width="2.2" fill="none"/><path d="M30,48 C27,36 31,30 41,30 C51,30 55,36 52,48 Z" fill="#fff"/><path d="M33,31 C33,22 49,22 49,31" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M52,39 L56,34" stroke="#fff" stroke-width="2.4"/></svg>'+
  '<div class="tl">THRUPP<br>WANDERERS</div><div class="tr">MUDLARK<br>ATHLETIC</div></div>';},
 back:function(i){return rear({msg:qsl(i)+"Your reception has been awarded half a goose, which cannot be scored. Appeals by ladder.",stamp:["&frac12;","GOOSE","#1e4a7a"],post:["OLD SUMP","GROUND",i.date]});}},
bureau:{cls:"c-bureau",name:"The Bureau",
 front:function(i){return '<div class="c-bureau"><div class="k1">BUREAU OF APPROXIMATE TIME</div><div class="k2">FORM QSL/10 &middot; 10 000 kHz &middot; IN OUR OPINION</div><div class="rule"></div>'+
  '<div class="fld" style="top:36%">Time of reception, about<b>'+i.time+'</b></div><div class="fld" style="top:53%">Day, we believe<b>'+i.day+'</b></div><div class="fld" style="top:70%">Later than it was<b>yes</b></div>'+
  '<svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="22" fill="none" stroke="#243a2c" stroke-width="2"/><path d="M25,5V10M25,40V45M5,25H10M40,25H45" stroke="#243a2c" stroke-width="2"/><circle cx="25" cy="25" r="2" fill="#243a2c"/></svg></div>';},
 back:function(i){return rear({typed:true,msg:qsl(i)+"<br>Received at about the time stated, or thereabouts.<br><br>This card is valid until later.",stamp:["~","ABOUT","#243a2c"],post:["ABOUT","NOW","ISH"]});}},
vellish:{cls:"c-vellish",name:"Vellish",
 front:function(){return '<div class="c-vellish"><div class="k1">CONVERSATIONAL</div><div class="k2">VELLISH</div><div class="band"></div><div class="k3">Orro vant ke shilu?<br>Is this your ordinary goose?</div><div class="f">11 820</div>'+
  '<svg viewBox="0 0 70 100"><path d="M6,84 C10,60 30,56 44,62 C56,67 58,82 50,90 C38,98 14,98 6,84 Z" fill="#17443f"/><path d="M42,66 C40,48 44,36 46,28" fill="none" stroke="#17443f" stroke-width="9" stroke-linecap="round"/><ellipse cx="50" cy="27" rx="8" ry="6.5" fill="#17443f"/><path d="M56,24 L68,28 L56,31 Z" fill="#17443f"/><rect x="40" y="6" width="17" height="14" fill="#17443f"/><rect x="35" y="19" width="27" height="3.5" fill="#17443f"/><circle cx="52" cy="26" r="1.3" fill="#e2b23a"/></svg></div>';},
 back:function(i){return rear({msg:qsl(i)+"Sella mor. Orro ke vant meb?<br>(Thank you. Is your goose formal?)",stamp:["1","ORRO","#17443f"],post:["VELL","KE LOM",i.date]});}},
parish:{cls:"c-parish",name:"Little Wending",
 front:function(){return '<div class="c-parish"><div class="k1">Little Wending</div><div class="k2">PARISH NOTICES &middot; 13 700 kc/s</div><div class="rule"></div>'+
  '<svg viewBox="0 0 40 44"><path d="M20,4 C30,6 30,22 34,32 H6 C10,22 10,6 20,4 Z" fill="#231c16"/><circle cx="20" cy="37" r="4" fill="#231c16"/><path d="M20,0 V5" stroke="#231c16" stroke-width="3"/><path d="M2,14 Q-1,22 2,30 M38,14 Q41,22 38,30" fill="none" stroke="#231c16" stroke-width="1.3"/></svg>'+
  '<div class="f">13700</div><div class="k3">Tea afterwards.</div></div>';},
 back:function(i){return rear({msg:qsl(i)+"The verger thanks you for listening, and wonders whether you might also attend. There is tea.",stamp:["2d","WENDING","#231c16"],post:["LITTLE","WENDING",i.date]});}},
lagoon:{cls:"c-lagoon",name:"Lagoon",
 front:function(){return '<div class="c-lagoon"><div class="k2">SHORTWAVE &middot; 15 425</div><div class="k1">LAGOON</div><div class="k3">More of this.</div></div>';},
 back:function(i){return rear({msg:qsl(i)+"<br>Mmm.",stamp:["0","HURRY","#1f6f78"],post:["LAGOON","&nbsp;",i.date]});}},
engineer:{cls:"c-engineer",name:"The night engineer",
 front:function(){return '<div class="c-engineer"><div class="inv">INVOICE No. 0417<br>VALVES, ASSORTED &middot; 6 &middot; 2/9 EA<br>LADDER, EXTENDING &middot; 1 &middot; ON LOAN<br>SANDWICH &middot; 1 &middot; SEE PREVIOUS ENGINEER<br>FUSE WIRE &middot; 30 YDS<br>TEA &middot; SUNDRY<br>CARRIED FORWARD</div>'+
  '<div class="k1">16,661. Yes, you heard right. Don\'t tell the Bureau.</div>'+
  '<svg viewBox="0 0 40 110"><path d="M20,6 L6,106 M20,6 L34,106 M17,28 H23 M14,50 H26 M11,72 H29 M8,94 H32 M17,28 L26,50 L11,72 L32,94 M23,28 L14,50 L29,72 L8,94" fill="none" stroke="#2a3440" stroke-width="1.4" stroke-linecap="round"/><circle cx="20" cy="5" r="3" fill="#b3311f"/></svg></div>';},
 back:function(i){return rear({msg:qsl(i)+"Didn't think the post came up this far. Ta for listening. If you see a ladder, it's mine.",stamp:["?","UNFRANKED","#2a3440"],post:["UP THE","MAST",i.date]});}},
/* the other one's. It did not come through the letterbox. */
"double":{cls:"c-double",name:"16 661",
 front:function(){return '<div class="c-double"><div class="f">16 661</div><div class="k1">CONFIRMING RECEPTION OF YOU</div></div>';},
 back:function(){return rear({typed:true,msg:"&nbsp;",foot:"No stamp was required."});}},
roads:{cls:"c-roads",name:"Roads of the Empire",
 front:function(){return '<div class="c-roads"><div class="k1">VIAE IMPERII</div><div class="f">MMMMCDLXXVI</div>'+
  '<svg viewBox="0 0 30 40"><path d="M5,40 V12 C5,2 25,2 25,12 V40 Z" fill="#2c2a26" opacity=".85"/><text x="15" y="25" text-anchor="middle" font-size="9" font-family="Cinzel,serif" fill="#9b978c">IV</text></svg>'+
  '<div class="k3">ALL ROADS LEAD HERE</div></div>';},
 back:function(){return rear({msg:"<small>QSL &middot; confirming your reception</small>4,476 kHz, in the evening, as always.<br>Delivered by the usual road. It took the usual time.",stamp:["I","AS","#6b675d"],post:["AB VRBE","CONDITA","MMDCCLXXIX"]});}},
library:{cls:"c-library",name:"The Great Library",
 front:function(){return '<div class="c-library"><div class="k1">THE GREAT<br>LIBRARY</div><div class="k2">OVERDUE DESK</div><div class="f">8300</div><div class="k3">This card is also overdue.</div></div>';},
 back:function(){return rear({msg:"<small>QSL &middot; confirming your reception</small>We have filed your report under Warnings. Please return this card within XIV days.",stamp:["1","OBOL","#3d2c12"],post:["RETURNS","DESK","OVERDUE"]});}},
porch:{cls:"c-porch",name:"The Painted Porch",
 front:function(){return '<div class="c-porch"><div class="cols"></div><div class="k1">THE PAINTED<br>PORCH</div><div class="f">12 529</div><div class="k3">The discussion continues.</div></div>';},
 back:function(){return rear({msg:"<small>QSL &middot; confirming your reception</small>We had not expected to be heard. Do not make a habit of the dark side of the dial.<br>Come again.",stamp:["&Phi;","NO HANDS","#b5552f"],post:["THE PORCH","THIS HOUR","AGAIN"]});}},
dominion:{cls:"c-dominion",name:"Not yet",
 front:function(){return '<div class="c-dominion"><div class="k1">THE TIDELESS<br>DOMINION</div><div class="f">14 040 &middot; NOT YET</div></div>';},
 back:function(){return rear({msg:"<small>QSL &middot; confirming your reception</small>Thank you for a report you have not yet sent.",stamp:["0","TIDES","#b9b4a6"],post:["NOT YET","FOUNDED","&nbsp;"]});}},
/* letters */
notice:{cls:"c-notice",name:"Notice of relief",
 front:function(i){return '<div class="c-notice"><b>NOTICE OF RELIEF</b>The previous occupant of the Top Room, 9 Lantern Row, was relieved at about '+i.time+', on a day we are still establishing.<br><br>You are the relief.<br><br>Your own relief is expected in the spring.<br><br>&mdash; Bureau of Approximate Time, Postings</div>';},
 back:function(i){return rear({typed:true,msg:"<small>On approximate service</small>If undelivered, deliver later.",stamp:["~","ABOUT","#243a2c"],post:["BUREAU","POSTINGS",i.date]});}},
overdue:{cls:"c-overdue",name:"Overdue",
 front:function(){return '<div class="c-overdue"><b>Little Wending Lending Library</b>Mr A. Pruitt. The following is <u>OVERDUE</u>:<br>&ldquo;What the Owls Want&rdquo;, in two volumes, the second uncut.<br><br>The fine is one obol a day, and the days have continued.<br><br>If Mr Pruitt is no longer at this address, would the goose please return them.</div>';},
 back:function(i){return rear({typed:true,addr:["Mr A. Pruitt","Top Room","9 Lantern Row","Cape Regret"],msg:"<small>Second notice</small>The first was returned by the goose.",stamp:["2d","WENDING","#231c16"],post:["LITTLE","WENDING",i.date]});}},
pruitt:{cls:"c-pruitt",name:"Greetings from",
 front:function(){return '<div class="c-pruitt"><div class="moon"></div><div class="land"></div><div class="k1">Greetings from <s>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</s></div></div>';},
 back:function(){return rear({msg:"Wish you were here. I am not certain where here is, but the roads are very good and the light is even.<br>The moon is here. I would know it anywhere. It is parked very badly.<br>Is Formal eating? Don't answer the door. &mdash; A.P.",stamp:["0","TIDES","#b9b4a6"],post:["NOT YET","FOUNDED","&nbsp;"]});}}
};

return {
 cards:cards,
 /* propped against the set when you arrive */
 note:[
  "To the relief,",
  "The set is on the desk. Switch it on and turn the dial slowly. It likes that.",
  "Log what you hear. They like to know somebody's there, and they write back.",
  "The goose is Formal. She came with the room. Don't call her Ordinary, she can tell.",
  "Keep a light on.",
  "Whatever the owls want, I never did find out.",
  "A. Pruitt",
  "P.S. If the engineer up the mast asks you for anything, ask Formal first."
 ],
 /* top drawer */
 owls:[
  "Things the owls might want",
  "1. Mice. (No. They have mice.)",
  "2. The moon. (Ditto.)",
  "3. To be let in. (Asked Dolores. She says never, under any circumstances.)",
  "4. Somebody to be up as late as they are.",
  "5. For me to stop asking."
 ],
 /* bottom drawer. It only opens from the other side. */
 things:{
  photo:{
   front:function(){return '<div class="c-photo"><svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-label="A photograph of this room">'+
    '<defs><radialGradient id="ph-v" cx="50%" cy="45%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".62"/></radialGradient>'+
    '<radialGradient id="ph-l" cx="16%" cy="60%" r="42%"><stop offset="0" stop-color="#fff6dc" stop-opacity=".8"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>'+
    '<filter id="ph-b"><feGaussianBlur stdDeviation="1.6"/></filter>'+
    '<filter id="ph-g" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .15  0 0 0 0 .1  0 0 0 .55 0"/></filter></defs>'+
    '<rect width="300" height="200" fill="#a88a63"/>'+
    '<rect x="232" y="8" width="62" height="160" fill="#8f7754"/><circle cx="240" cy="96" r="3" fill="#d8c08a"/>'+
    '<rect x="30" y="12" width="156" height="94" fill="#e6d6b2"/><path d="M108,12V106M30,59H186" stroke="#5a4532" stroke-width="4"/>'+
    '<path d="M150,106 L151,60 C150,49 156,44 163,44 C170,44 175,49 174,60 L176,106 Z" fill="#3e2f22" opacity=".55" filter="url(#ph-b)"/>'+
    '<rect x="0" y="122" width="214" height="9" fill="#5a4030"/><rect x="6" y="131" width="42" height="69" fill="#4a3426"/><rect x="152" y="131" width="58" height="69" fill="#4a3426"/>'+
    '<path d="M86,124 C86,104 96,98 110,98 C124,98 134,104 134,124 Z" fill="#2b2018"/><circle cx="110" cy="88" r="10.5" fill="#2b2018"/>'+
    '<path d="M22,121 L14,98 L34,84" fill="none" stroke="#2f241b" stroke-width="3"/><path d="M30,78 L44,82 L48,96 L30,92 Z" fill="#2f241b"/>'+
    '<path d="M218,186 C214,170 230,164 246,168 C258,171 262,182 254,188 C244,194 224,194 218,186 Z" fill="#f0e7d4"/><path d="M246,170 C246,160 249,152 251,146" stroke="#f0e7d4" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="252" cy="144" r="4.5" fill="#f0e7d4"/><path d="M256,143 L263,145 L256,147 Z" fill="#c9a26a"/>'+
    '<rect width="300" height="200" fill="url(#ph-l)"/><rect width="300" height="200" filter="url(#ph-g)"/><rect width="300" height="200" fill="url(#ph-v)"/></svg></div>';},
   back:function(){return '<div class="msg" style="width:auto;right:6%;border:0;font-size:calc(var(--u)*5.4)">Formal and me, the night the engineer came down off the mast.<br><br>Nobody took this.<br><br>&mdash; A.P.</div>';}
  }
 },
 /* the last page before yours */
 pruittLog:[
  "4,890. The Clerk again. Sent her a card to say thank you. No reply. (She did say.)",
  "6,075. Rang Dolores re: owls. She has asked them. Nothing.",
  "16,661. An engineer, up the mast. Good company. Says he can see my lamp.",
  "Told him I'm to be relieved in the spring. He said, by whom.",
  "Formal doesn't care for him. Geese are funny about heights.",
  "Formal under the desk all evening. Nothing wrong that I can see.",
  "Someone at the door. Not the post."
 ]
};
})();
