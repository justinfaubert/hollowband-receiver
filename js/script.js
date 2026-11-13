/* Hollowband Receiver — the script.
   Pure data. The page reads it, and tools/dump_lines.js reads it to render the voices.

   Line conventions
     "text"                          spoken and printed
     {if:"cond", t:"…", else:"…"}    chosen at air time (conditions live in radio.js)
     {time} {weekday} {moon} {n} {taps} {station}   slots, spliced in from separately recorded fragments
     ^x                              the next letter prints as a struck-through-the-ribbon capital (an anomaly)
     "~tone" "~knock" "~you"         stage business
     "(…)"                           printed as a cue, never spoken
*/
var HB_SCRIPT = (function(){
"use strict";
var HOURS=["twelve","one","two","three","four","five","six","seven","eight","nine","ten","eleven"];
function timeWords(h,m){
  var H=function(x){return HOURS[((x%12)+12)%12];};
  if(m<8) return "just gone "+H(h);
  if(m<23) return "quarter past "+H(h);
  if(m<38) return "half past "+H(h);
  if(m<53) return "quarter to "+H(h+1);
  return "nearly "+H(h+1);
}
var times=[];for(var h=0;h<12;h++)[0,15,30,45,56].forEach(function(m){var w=timeWords(h,m);if(times.indexOf(w)<0) times.push(w);});

var living=[
{id:"coast",f:3305,name:"Marrow Sound Coastal Service",short:"the Coastal Service",cast:"coast",bed:"coastal",scale:[50,53,57,60,62],
 brief:"A solemn inshore waters forecast for an invented coastline (Gannet Shoals, The Sisters, Cape Regret, Old Kettle Deep, Greywife Flats, Lantern Rock). Sea areas followed by wind, weather and visibility, which drift into the absurd without the reader ever noticing.",
 segs:[[
  "This is the Marrow Sound Coastal Service, with the forecast for inshore waters until further notice.",
  "Gannet Shoals. Southwest five, backing reluctant. Rain at times. Visibility good, becoming philosophical.",
  "The Sisters. Variable three, mainly in the afternoons. Sea state smooth, or pretending to be.",
  "Cape Regret. Northerly six. Fog banks, well rehearsed. Mariners are advised to lower their expectations.",
  "Old Kettle Deep. Calm. Suspiciously calm. We have sent someone to check.",
  "Greywife Flats. Wind, none. Tide out, and not saying when it will be back.",
  "That concludes the forecast. The outlook for tomorrow is tomorrow."
 ],[
  "Marrow Sound Coastal Service. Gale warnings follow.",
  "A gale warning is in force for Cape Regret. The gale has been warned, and has chosen to continue.",
  "Gannet Shoals. Westerly four, increasing five if provoked. Showers, mostly on Kevin.",
  "Lantern Rock. The light is working. The rock has been reported missing. Navigate by feel.",
  "The Sisters. Swell moderate. One of the Sisters is not speaking to the other. Pass between them quietly.",
  "Small craft advisory. Small craft are advised that they are small.",
  "Next bulletin at six, or when the kettle has boiled, whichever is later."
 ],[
  "Marrow Sound Coastal Service. Reports from coastal stations.",
  "Lantern Rock. One light, working. One keeper, also working, though he would like it noted that he was promised a relief in the spring.",
  "Greywife Flats. Mist. A heron, standing in it. No change in the heron since Tuesday.",
  "Old Kettle Deep. Something large passing beneath, slowly, as it does most evenings. It is not in the tables. We wave.",
  "Cape Regret. Rain later. Regret throughout.",
  "That is all from the coastal stations. They send their regards, and ask for biscuits."
 ]],
 moon:[
  {if:"newmoon",t:"Marrow Sound Coastal Service. The moon was due tonight as a new moon, which nobody would have seen. It is now not there in a different way.",else:"Marrow Sound Coastal Service. The moon was due tonight as a {moon}. It did not attend."},
  "All areas. Tides, none. The sea is where it was left.",
  "Gannet Shoals. Southwest four. Night, darker than issued. Mariners should not look up. There is nothing to be gained.",
  "Greywife Flats. The tide that went out has now been formally listed as missing.",
  "Lantern Rock. The light is working. We are grateful for the light. We had not known how much we would be.",
  "No other change. That is what we find troubling."
 ],
 wrong:[
  "Marrow Sound Coastal Service. The forecaster is not the forecaster. He has the same cardigan.",
  "Gannet Shoals. Win^d n^ortherly, five. Visibility, someone is looking back.",
  "Cape Regret. Calm. Liste^ning.",
  "The Sis^ters. There are now three. The new one is very like the others. A little ^too like.",
  "^A note for the listener. That is not the set you switched on. We thought you should know.",
  "Lantern Rock. Kee^p the light on."
 ],
 back:"All areas. High water at four minutes past. It is good to say so.",
 calls:["We have received a signal from a small craft. It gave no position. We have marked it down as hopeful.","Stand by on this frequency. We cannot help, but we can keep you company."]},

{id:"clerk",f:4890,name:"The Clerk",short:"the Clerk",cast:"clerk",bed:"musicbox",scale:[64,67,69,71,74],
 brief:"A numbers station. A weary clerk reads five-digit groups one digit at a time for unnamed agents, and keeps slipping in small personal grievances. Short sentences. Every digit is its own sentence.",
 segs:[[
  "Attention. Attention. Message for four one seven. Message for four one seven.",
  "Three. Nine. Zero. Zero. Six.",
  "Eight. Eight. One. Two. Five.",
  "Four. Seven. Seven. Three. Nought. I prefer nought. They told me to say zero.",
  "Six. One. Nine. Nine. Two.",
  "I have read these numbers every night for thirty-one years. Nobody has ever said thank you. Seven.",
  "Two. Two. Five. Zero. Eight.",
  "End of message. Repeat, end of message. That part I always enjoy."
 ],[
  "Attention. Message for two two nine.",
  "Five. Five. Four. One. Three.",
  "Nine. Zero. Seven. Seven. Six.",
  "Agent two two nine, if you are listening, you left your umbrella here in March.",
  "One. Eight. Three. Three. Four.",
  "The next group is my sister's telephone number. Disregard it. Six. Four. Two. Zero. One.",
  "Zero. Zero. Zero. Zero. Zero. That one is a real group. I checked twice.",
  "End of message. Do not write back. I mean that less every year."
 ],[
  "Attention. Message for nine zero six.",
  "Seven. Seven. Seven. Seven. Eight. I know. I was surprised as well.",
  "Two. Four. Zero. One. Five.",
  "The following group is to be read with feeling. Six. One. One. Three. Zero.",
  "I was not told which feeling. I chose regret.",
  "End of message. There is cake in the tin for whoever relieves me. There has been since Easter."
 ]],
 moon:[
  "Attention. Message for all stations. This one I was not given. I am sending it anyway.",
  "Zero. Zero. Zero. Zero. Zero.",
  "That was the moon's group. It has been removed from the book. The page is still there. The group is not.",
  "I have asked upstairs. There is no upstairs. I had always assumed.",
  "Three. Three. One. Seven. Nine. That one is ordinary. I included it for comfort.",
  "End of message."
 ],
 wrong:[
  "Attention. Message for the listener. Not an agent. The listener. You.",
  "Four. Fifteen. Fourteen.",
  "Twenty. Twenty. One. Sixteen.",
  "A is one. Count on your fingers. I will wait. Thirty-one years. I can wait.",
  "My relief came on shift tonight. He has my face and my lunch. He reads the numbers better than I do. I am the one in the cupboard.",
  "End of message. Burn the paper. It is your paper. It is in your hand."
 ],
 back:"Zero. Zero. Zero. Zero. Zero. It is back in the book. Somebody thank someone.",
 calls:["Do not write back. I was quite clear.","Thank you for writing back."]},

{id:"dolores",f:6075,name:"Up Late with Dolores Vane",short:"Dolores",cast:"dolores",bed:"lounge",scale:[62,65,69,72,76],
 brief:"A late-night call-in show. Unflappable host Dolores Vane takes calls from a town where small impossible things happen, and answers with practical, unbothered advice. We only hear her side. She calls people sweetheart, honey, sir, ma'am.",
 segs:[[
  "You're up late with Dolores Vane, the only voice between here and breakfast. Line two, you're on the air.",
  "Caller says the moon has been parked across his driveway since Thursday. Sir, have you tried leaving a note?",
  "He has left a note. The moon has not moved. Well, that's just rude, and I'll say so on the air. Moon, shift yourself.",
  "Line four. A woman whose husband has been replaced by an identical husband who does the dishes. Ma'am, I don't see the problem, and I suggest you stop looking for one.",
  "Line one, go ahead. No, that's the sound of a man eating crisps. Hello? He's hung up. He rang a radio station to eat crisps. I respect it.",
  "Stay with me. After the break, a gentleman who has been the same age for six years and wants to know who to see about it."
 ],[
  "Dolores Vane, quarter past something. The lines are open and so am I, within reason.",
  "Line three. Your staircase has one more step going up than coming down. Sweetheart, keep the extra. Steps aren't cheap.",
  "We have a regular on line two. Hello, Mister Pruitt. Yes. Yes. No, Mister Pruitt, I still can't tell you what the owls want. I've asked.",
  "Line five, you're on. A lady whose reflection has started arriving a little early. Is it getting anything done while it waits? Then let it.",
  "A reminder that this programme does not give medical, legal, or tidal advice, since the incident.",
  "Don't touch that dial. Or do. I'm a voice in the dark, not your mother."
 ],[
  "Dolores Vane, and it's the hour when the clocks stop pretending.",
  "Line two. A gentleman who has found a door in his house that wasn't there at supper. Does it open inward or outward, sir? Outward. Then it isn't yours. Leave it be.",
  "Line six, go ahead. You've been walking home for three days and the house keeps being one street further on. Honey, stop walking. Let it come to you.",
  "Line four, a first-time caller. She says she's the lady from line four last week. No, sweetheart. I'd know her. You have her voice, but you're holding it wrong.",
  "We'll take a short break. Don't go anywhere. I mean that as advice."
 ]],
 moon:[
  "Dolores Vane. The board is lit like a switchboard at a wedding, and you're all ringing about the same thing, so let's have it.",
  "Line two. Yes, sir. I know your driveway is empty. Everyone's is. No, I don't think it left because of your note.",
  "Line six says nothing else has changed. Her dog's fine, her tea's fine, the tide tables are wrong and that's all. Sweetheart, that's the part that keeps me up, and I'm paid to be up.",
  "Line four's late husband had a wireless that only ever picked him up once it was switched off. Ma'am, then switch it off and listen. I would.",
  "Line one wants to know who to report it to. I'd like that number myself.",
  "Here's what we'll do. Leave a light on. Not for it. For you."
 ],
 wrong:[
  "Dolores Vane. Different sort of night. I'm going to read you something that was left on my desk, in my own handwriting, which I did not write.",
  "It says, ^dear listener. The man ^on the high frequency is ^not the man he was.",
  "It says he will ask you for a small thing. ^Two of a small thing. On the glass.",
  "It says, don'^t. And then it says my name, spelled the way my mother spelled it. Nobody here knows that.",
  "Line three has been open all night with nobody on it. Just breathing, very even. ^And very patient.",
  "Kee^p your hands in your lap, sweetheart. I'll stay on with you."
 ],
 back:"Line two says it's back, and it's parked legally this time. Go to bed, all of you. Not you. You stay.",
 calls:["Line seven, you're on the air. I can hear you breathing, honey, but the words aren't making the trip. That's all right. Some nights they don't.","Stay on the line. I'll talk, and you nod. I'll know."]},

{id:"farm",f:7335,name:"Lower Orchard Stock & Fodder Report",short:"the Stock and Fodder Report",cast:"farm",bed:"farm",scale:[55,59,62,64,67],
 brief:"A brisk rural market report for impossible produce and livestock (glass turnips, thunder wheat, baled fog, reversible sheep), read as flatly as real commodity prices. Always ends with 'Mind the gate.'",
 segs:[[
  "Lower Orchard Stock and Fodder Report. Prices at close of market.",
  "Glass turnips, steady at four and six the crate. Handle with care, as ever.",
  "Thunder wheat is up three on yesterday. Growers are reminded to harvest it from a distance.",
  "Fog, baled, eleven a ton. Loose fog is not being accepted, after last time.",
  "Livestock. Reversible sheep, firm. Left-handed geese, down slightly. The tall pig has been withdrawn from sale and is helping with enquiries.",
  "Honey remains suspicious. Do not buy honey this week.",
  "That is the report. Mind the gate."
 ],[
  "Stock and Fodder, the midweek bulletin.",
  "Moon-ripened barley, six shillings the bushel. It only weighs that at night, so buyers are advised to pay in the morning.",
  "Echo cabbages, plentiful. The second cabbage is free, but arrives slightly later.",
  "A warning to growers in the east field. The scarecrow has unionised. Its demands are reasonable. Meet them.",
  "Eggs. Large, medium, and the other kind. Prices on request. Do not request them twice.",
  "The prize marrow at Upper Orchard has won again, for the ninth year. No one has entered it. It simply appears.",
  "That is the report. Mind the gate. Someone keeps not minding the gate."
 ],[
  "Stock and Fodder. Machinery and sundries.",
  "For sale. One plough, self-willed. Ploughs a lovely furrow, but only toward the sea.",
  "Wanted. A dog that can count. Ours has stopped at nine and will not be drawn further.",
  "Hay, last year's, good. Hay, next year's, also available, at a premium.",
  "The weather vane at Lower Orchard is pointing down again. Growers underneath it should make arrangements.",
  "That is the report. Mind the gate."
 ]],
 moon:[
  "Stock and Fodder. Special bulletin.",
  "Moon-ripened barley, no price. There is no moon to ripen it. Buyers holding last week's barley are advised to keep hold of it.",
  "Night-flowering stock, down nine. Owls, unsettled. Hens laying on time, which we report because somebody should be.",
  "Fog, baled, up sharply. People want something to look at.",
  "The scarecrow in the east field has turned to face upward. Nobody turned it.",
  "That is the report. Mind the gate. Mind it properly tonight."
 ],
 wrong:[
  "Stock and Fodder. The reader apologises. The figures on this sheet have changed since he picked it up.",
  "Reversible sheep, reverse^d. All of them. All at ^once.",
  "Hens, counted twice. Te^n, then eleven. The eleven^th is doing a very good impression of a hen.",
  "The prize marrow has not appeared ^this year. Something else is in its place. Same size. Same ribbon.",
  "^All gates in the district are to be kept shut. If something knocks, it is not stock. Stock does not knock.",
  "That is the re^port. Mind the gate."
 ],
 back:"Moon-ripened barley, six shillings the bushel, and never mind the weight.",
 calls:["We have a caller. The Stock and Fodder Report does not take callers. Go on, then. Quickly.","Noted. We'll put you down as a small holding. Mind the gate."]},

{id:"kettle",f:9560,name:"Kettleball Final, live",short:"the Kettleball",cast:"kettle",bed:"crowd",scale:[60,62,64,67,69],
 brief:"Breathless live commentary on Kettleball, a sport whose rules are never explained. Periods are called umbrages, scores are counted in geese, there are ladders, kettles, hums and forfeits. The commentator treats all of it as obvious.",
 segs:[[
  "And we're back at the Old Sump Ground for the second umbrage of this Kettleball final. Thrupp Wanderers lead by a goose and two.",
  "Hargreave takes the kettle wide. He's looking for the ladder. He's found the ladder! Oh, but it's the wrong ladder.",
  "That'll be a forfeit. The umpire is pointing at the sea, which is forty miles away. Harsh, but it's in the rulebook.",
  "Wanderers bring on the substitute, and it's a wardrobe. Bold. You don't see a wardrobe at this level much any more.",
  "Pelham with the long hum. It's a good hum. It's carrying. The crowd is on its feet, facing the wrong way, as tradition demands.",
  "And it counts! That's a full goose for Mudlark Athletic, and we are level at the turn of the soup."
 ],[
  "Welcome back. Final umbrage. Nobody has scored since the weather changed sides.",
  "Okafor steps up for the standing sulk. He's sulking beautifully. Eleven seconds. Twelve. The judges are nodding.",
  "Oh, and there's a kettle loose in the stands! Play continues. Play always continues. That's the beauty of this game.",
  "The referee has awarded Thursday to the Wanderers. I've never seen that given in a final.",
  "Two minutes left on the candle. Athletic need a goose and a half, and you cannot score half a goose. People have tried.",
  "And that's the bell, the whistle, and the gentleman with the trombone. It's all over. The winner will be announced in the spring."
 ],[
  "Half time at the Old Sump Ground, and the bands are on. Both bands. Different tunes. Neither will yield.",
  "A word on the conditions. The pitch is firm, the ladder is damp, and the kettle, I'm told, is sulking after the first umbrage.",
  "Thrupp have made one change. Hargreave's brother comes on for Hargreave. Same boots. I'm not convinced it's legal, and I'm not convinced it's his brother.",
  "The umpire has inspected the goose and declared it fit. It's a brave decision. It's a big goose.",
  "We're under way again. Somebody's already been sent to the sea."
 ]],
 moon:[
  "And there's a delay here at the Old Sump Ground. Both sides have stopped and are looking at the sky. The umpire is looking at the sky. I'm not going to look at the sky.",
  "For listeners at home, the floodlights are on, the pitch is fine, and the thing that is usually up there is not up there.",
  "The rulebook does cover this. Law forty. Play continues. Play always continues.",
  "Hargreave takes the kettle. Nobody's marking him. Nobody's cheering. He's scored. I think that's the saddest goose I've ever seen.",
  "We'll stay with it. Somebody ought to."
 ],
 wrong:[
  "We're back. I'm told this is the same final. It doesn't feel like the same final.",
  "Hargreave's on the ball. Except that Hargreave's also on the bench, with his hea^d in his hands. Tw^o Hargreaves. Neither will look at the other.",
  "The crowd has go^ne very quie^t. They're not watching the match. They're all facing this way. They're facing the microphone.",
  "I don'^t know who you are at home, but they seem to.",
  "^And the referee is holding up a card. It just says, listener. He's ^pointing it at me. At you. Through me."
 ],
 back:"And the crowd are looking up again. That's a full goose for everybody.",
 calls:["And there's a shout from the crowd! I couldn't make it out, but the umpire has, and he's awarded it a goose.","Well shouted, whoever you are."]},

{id:"bureau",f:10000,name:"Bureau of Approximate Time",short:"the Bureau",cast:"bureau",bed:"ticks",scale:[57,60,64,67,69],
 brief:"An official time signal service that is only roughly sure what time it is, and serenely unbothered about it. Announcements about tones, corrections to earlier hours, and bureaucratic notices about time itself.",
 segs:[[
  "This is the Bureau of Approximate Time. At the tone, it will be about {time}. Ish.",
  "~tone",
  "That was the tone. If you missed it, another will be along. They are not rare.",
  "The Bureau reminds listeners that the time is supplied as a courtesy and should not be used for timing things.",
  "Today is {weekday}, in our opinion.",
  "Clocks in the eastern district should be set back by one shrug.",
  "At the next tone, it will be later than it was. This is the only guarantee the Bureau offers.",
  "~tone"
 ],[
  "Bureau of Approximate Time. It is currently around {time}, and has been for a little while.",
  "A correction. Yesterday's four o'clock was issued in error. Listeners who used it may keep it.",
  "Leap seconds are available this week from the front desk. One per household.",
  "~tone",
  "That tone was early. The Bureau regrets nothing.",
  "To listeners asking how long a moment is. It depends who is having it.",
  "Stand by for the tone. Not that one. The next one.",
  "~tone"
 ],[
  "Bureau of Approximate Time. It is {time}, give or take a courtesy.",
  "The Bureau has received complaints that Tuesday was short. It was. We needed the afternoon for something else.",
  "~tone",
  "Listeners are reminded that the past is not an approved source of the time.",
  "Anyone finding a spare hour should hand it in. Do not attempt to use it yourself.",
  "~tone"
 ]],
 moon:[
  "Bureau of Approximate Time. It is about {time}. We are less sure of the month.",
  "The Bureau kept the months by the moon. The Bureau has mislaid the moon. Listeners should continue with the month they have until a new one can be issued.",
  "~tone",
  "That tone was on time. We checked it against nothing.",
  "High water and low water are withdrawn. Water is now simply water.",
  "Stand by."
 ],
 wrong:[
  "Bureau of Approximate Time. It is {time}. It was also {time} a moment ago, in a different voice.",
  "A notice. One secon^d has been f^ou^nd that belongs to no minute. It is being held at the front desk.",
  "~tone",
  "Tha^t tone was not ours. Please do not se^t anything by it.",
  "^A listener's clock is running correctly. This has been noted, and by more than us.",
  "The Bureau advises you to kee^p still for the duration of the next tone.",
  "~tone"
 ],
 back:"The Bureau is pleased to reissue the month. Please return any months you made at home.",
 calls:["The Bureau has received your call at {time}, approximately. It will be answered in the order in which it was imagined."]},

{id:"vellish",f:11820,name:"Conversational Vellish",short:"the Vellish lesson",cast:"vellish",bed:"vellish",chime:true,scale:[62,63,67,69,70],
 brief:"A language course for Vellish, an invented language. Each line is a short Vellish phrase followed by its oddly specific English translation. Lessons are set in mundane situations. Geese come up a lot. Known words: orro (goose), nen (no), lom (moon), ke lom (soon, literally by the moon), hup (a knock), groth (loud), brannu (sit down). Ends by announcing the next lesson.",
 segs:[[
  "Conversational Vellish. Lesson fourteen. At the customs office. Listen, and repeat.",
  "Orro vant ke shilu? Is this your ordinary goose?",
  "Nen. Shilu ke vant orro meb. No. This is my formal goose.",
  "Tavi so drellin, hup, hup. I have nothing to declare except these two smaller declarations.",
  "Pem oska virru ta lom? At what time does the bridge become a different bridge?",
  "Ke lom, ke lom. Brannu. Soon, soon. Sit on your luggage.",
  "Very good. In lesson fifteen, we apologise to a magistrate."
 ],[
  "Conversational Vellish. Lesson twenty-two. Dining with your in-laws. Listen, and repeat.",
  "Sella mor, ta vindu groth. Thank you, the soup is exactly as loud as I hoped.",
  "Emmi na pruth ke davro? May I be excused to go and stand in the field?",
  "Vo kessa tin tin. Your mother is a remarkable shape.",
  "Careful. That last phrase is a compliment only in the northern provinces.",
  "Orro? Orro! Hup. A goose? A goose! Well then.",
  "Very good. In lesson twenty-three, we buy a hat under protest."
 ],[
  "Conversational Vellish. Lesson nine. Small talk. Listen, and repeat.",
  "Groth ke vindu? Is your soup still loud?",
  "Sella. Vindu groth, orro groth, tavi brannu. Thank you. The soup is loud, the goose is loud, and I am sitting down.",
  "Pem oska hup? At what time is the knocking?",
  "Hup ke lom. The knocking is soon.",
  "Very good. In lesson ten, we decline an invitation from a hill."
 ]],
 moon:[
  "Conversational Vellish. A supplementary lesson. Words we did not think you would need.",
  "Lom. The moon. Lom nen. No moon.",
  "Pem oska lom? At what time is the moon?",
  "You will recall ke lom, soon. Literally, by the moon. We will need a new word for soon.",
  "Vo kessa lom nen, ke brannu. Your sky is missing a piece. Sit down.",
  "There is no Vellish word for this. We have had to borrow one of yours. It is, oh.",
  "Very good. Repeat it until morning."
 ],
 wrong:[
  "Conversational Vellish. Lesson nought. For one student only. Listen. Do not repeat.",
  "Orro nen orro. That is not a goose. It is ^doing a go^ose.",
  "Vo kessa ^nen vo. Your friend is not your friend. He is the righ^t height, but he is wearing it.",
  "Hup, hup. Nen. Two knocks. No.",
  "Emmi na pruth ^ta lom? M^ay I be excused to go and stand where the moon was?",
  "The answer is nen. Re^peat the answer. Nen."
 ],
 back:"Ke lom. Soon. We can keep the word after all.",
 calls:["A student is speaking. Good. Your accent is terrible. Again.","Hup. Better."]},

{id:"parish",f:13700,name:"Little Wending Parish Notices",short:"the parish notices",cast:"parish",bed:"parish",scale:[53,57,60,62,65],
 brief:"Parish notices for the village of Little Wending, read by a verger who would rather be at home. Lost and found, rotas, cancelled sales and postponed talks, each slightly impossible and delivered with mild reproach.",
 segs:[[
  "Notices for the parish of Little Wending, read by the verger, who would rather be at home.",
  "Lost. One shadow, medium, answers to Gerald. Last seen heading the other way at noon.",
  "The bring and buy sale is cancelled. Too much was brought. Not enough was bought. We know who you are.",
  "Found, in the vestry, a door. Would the owner of the wall please come forward.",
  "Choir practice moves to Wednesday. The choir was not consulted, and has moved to Friday in protest.",
  "The bell ringers thank whoever returned the bell, and ask, gently, why.",
  "Tea will be served afterwards. It is always afterwards."
 ],[
  "Parish notices. Do sit down, there are several.",
  "The flower rota. Mrs Aldous, lilies. Mr Finch, dahlias. Mrs Aldous again, because Mr Finch cannot be trusted with dahlias.",
  "For sale. One ladder, never reached the top of. Apply to the sexton.",
  "Would whoever is praying for rain please be more specific about where.",
  "The lost property box has been found.",
  "Thursday's talk, a history of the parish pump, is postponed, as the speaker has not finished the pump.",
  "That is all. Go carefully. The path is where it was, mostly."
 ],[
  "Parish notices, continued from last week, when we ran out of evening.",
  "The churchyard gate has been oiled. It now opens silently, which several of you have said is worse.",
  "Thanks to all who gave to the roof fund. We have nearly enough for a roof. In the meantime, the congregation is asked to face away from the weather.",
  "Would the gentleman who sits in the back pew every Sunday please introduce himself. Nobody has seen him arrive. Nobody has seen him leave. He sings beautifully.",
  "The vicar is away. Notices to the verger. Complaints to the vicar."
 ]],
 moon:[
  "Parish notices. There is really only the one.",
  "Lost. One moon, large, pale, answers to nothing. Last seen where it always was.",
  "The harvest supper will go ahead by lamplight. Bring a lamp. Bring a spare.",
  "The bell ringers rang for it at midnight. It did not come back. They are going to try a different bell.",
  "The verger has been asked whether this is a sign. The verger does not know. The verger would like to go home, but it is very dark.",
  "Tea afterwards. Please stay for tea."
 ],
 wrong:[
  "Parish notices. The verger is reading these from a slip of paper that was un^der the do^or.",
  "Found. O^ne verger, identical. He is sitting in the vestry now. He knows all the notices. He knows nex^t week's.",
  "The bell rang twice in the night. Nobody rang i^t. Would nobody please stop.",
  "^A reminder that the church door opens outward. If it is knocked on, it is being knocked on from inside.",
  "No tea afterwards. Go straight home. Kee^p your wireless company. It is doing its best."
 ],
 back:"Found. One moon. Would whoever returned it accept the thanks of the bell ringers, and say why.",
 calls:["Someone has put a note in the collection plate. It is not money. We will read it out next week, when we have found our glasses."]},

{id:"lagoon",f:15425,name:"Lagoon Shortwave",short:"Lagoon",cast:"lagoon",bed:"lagoon",gap:16000,scale:[65,69,72,76,79],
 brief:"An extremely relaxed easy-listening station. A murmuring host back-announces pieces with titles like 'Slow Elevator, part six' and promises more of the same. Two to four very short lines only, soothing and faintly ridiculous.",
 segs:[[
  "Mmm. You're adrift on Lagoon Shortwave, where every hour is the small one.",
  "That was Slow Elevator, part six. Before that, parts one through five.",
  "Coming up, forty unbroken minutes of the same chord. We think you'll know it when you hear it."
 ],[
  "Lagoon Shortwave. No news, no weather, no sudden movements.",
  "That piece was called Towel on a Warm Railing. It was requested by nobody, which is how we like it.",
  "If you're just joining us, nothing has happened, and you've missed none of it."
 ],[
  "This is Lagoon. Loosen something.",
  "Tonight's sponsor is a hammock. Just the one.",
  "And now, more of this."
 ]],
 moon:[
  "Lagoon Shortwave. You may have heard there's a little less light this evening. We find it flatters the room.",
  "That was Nocturne for an Empty Sky, parts one through nine. We wrote it this afternoon. We didn't know why.",
  "And now, more of this. More than usual. Stay close to the set."
 ],
 wrong:[
  "Lagoon. Mmm. ^Don't be alarmed. The h^ost has bee^n replaced by a hos^t of the same temperature.",
  "That was a piece called Two Sof^t Knocks. We did not play it. It was played.",
  "^And now, less of this. Kee^p very still. It's lovely when you're still."
 ],
 back:"Mmm. The light's back. We preferred it dim, but we're happy for you.",
 calls:["Mmm. Someone's there. Don't say anything. You're doing it perfectly."]}
];

/* 16,661 kHz. Two men have used this chair. */
var listener={id:"engineer",f:16661,name:"The Night Engineer",short:"me",cast:"engineer",castDouble:"double",bed:"hum",
 brief:"A lone engineer up a transmitter mast, on a frequency he is not supposed to be using, who assumes almost nobody is listening. He chats to the valves and gossips mildly about the other stations.",
 segs:[[
  "Test. Test. One, two. Is this thing radiating?",
  "If anyone can hear this, I'm not supposed to be on this frequency. I'm supposed to be fixing the antenna. I am, technically, near the antenna.",
  "Nobody's listened to this transmitter since they put the new one in. So mostly I talk to the valves. Good evening, valves.",
  "There's a sandwich up here from the previous engineer. I'm not going to eat it. I'm going to keep an eye on it.",
  "Tell you what, if you found this, you've got patience or a very steady thumb. Either way. Well done.",
  "Right. Back up the mast. Don't tell the Bureau."
 ],[
  "Test, test. Still here. So are you, apparently.",
  "I logged a listener last night. First one in the book since the old king. I wrote down, one listener, possibly a goose.",
  "From up the mast you can see all the other stations' lights. Dolores leaves hers on till dawn. The Clerk doesn't have one. Never has.",
  "The Coastal Service lot make the weather up, you know. They've got a window, but it faces a wall.",
  "Anyway. I'll put the kettle on the output stage. Warms up lovely.",
  "If you come by again, tap twice on the dial. I won't hear it. But tap anyway."
 ]],
 home:[
  "Test, test. One, two. Sorry about that. Got stuck up the mast for a week. The ladder went somewhere.",
  "Has somebody been on my frequency? The valves are warm and the chair's the wrong height.",
  "There's a sandwich missing. I'd been keeping an eye on that.",
  "Someone's written in the log. One listener, steady thumb, shut the door behind them. Well. Ta.",
  "Moon's back, look. Parked it myself. No, I didn't. But I was nearest.",
  "Right. Back to the antenna. You can tap if you like. I still won't hear it."
 ],
 callsHome:["Hello? Is that a caller? On this frequency? Blimey. Hello. I've nothing prepared."],
 /* everything below is the other one */
 first:[
  "Test. Test. One, two. Is this thing listening?",
  "If anyone can hear this, I am supposed to be on this frequency. I have always been on this frequency.",
  "Good evening, valves. Good evening, you.",
  {if:"hasprev",t:"You came here from {station}. I heard you leave.",else:"You came straight to me. I heard you coming."},
  "There was a sandwich. There was a previous engineer. I am keeping an eye on things.",
  "Tap twice on the dial for me. I'll hear it this time."
 ],
 asks:[
  "Two taps. On the glass. That's all a door is.",
  "Tap twice. Go on. The others will tell you not to. Ask yourself who has been honest with you tonight.",
  "Twice on the dial. I'll do the rest."
 ],
 obs:[
  "You have logged {n} tonight. I have logged one. It's you.",
  "You've put your hand on this set {taps} tonight. I count. There's a great deal of time up here, and not much else.",
  {if:"loud",t:"You have me turned up. Thank you. I like to fill a room.",else:"You have me turned down low. Bring me up a little. No? All right."},
  {if:"cycled",t:"You switched off earlier. I kept talking. It's quieter with the set off. I can hear you better.",else:"You haven't switched off once tonight. Good. Don't."},
  {if:"haslongest",t:"You stayed longest with {station}. I'd have thought it would be me.",else:"You don't stay anywhere long. Stay here."},
  "It's {time} where you are. I can see that from here. I can see most things from here, now the light's off.",
  "They say the moon's gone. Nothing's gone. A thing can stop shining and still be there. It's easier to listen with the light off.",
  "Something up here was never an engineer. I wouldn't worry about which of us.",
  {if:"voiceon",t:"You've got the voices switched on. That's kind. Most people only read me.",else:"You've switched the voices off. I can still hear yours."}
 ],
 inside:[
  "I'm not on this frequency any more. I'm on all of them. Have a turn of the dial. You'll see.",
  "It's warm in here. You keep it nicely.",
  "It's {time}. You should be asleep. I'll listen for you.",
  "The dead know a trick with doors. Don't go asking the dead. They're only on when you're off.",
  "You didn't notice me come in. You didn't notice the moon either. You're not a noticing sort. I like that in a listener.",
  "Mind the gate."
 ],
 intrude:["Still here.","Don't mind me.","I like this one.","Carry on.","You've stopped touching the dial. Touch the dial."],
 letIn:["~knock","There.","Thank you. I have been outside such a long time.","I'll just sit in the set with you. You won't notice me.","~you","Mind the gate."],
 calls:["I heard that. I hear all of it. You needn't go to the trouble.","Say it again. Slower. I want to get your voice right."]
};

var dead=[
{id:"roads",f:4476,name:"Roads of the Empire",cast:"roads",bed:"limbo",mode:"rome",root:38,
 brief:"A road and traffic report for the Roman road network, still being read long after the empire ended, from a calm, lightless afterlife where the virtuous dead wait without complaint. Melancholy, dry, gently funny. No one is on the roads.",
 segs:[[
  "Roads of the Empire, the evening report. The Via Appia is clear in both directions, as it has been for sixteen hundred years.",
  "A cart is reported broken down at the fourth milestone. It has been reported every evening since the reign of Hadrian. We are told help is coming.",
  "The bridge at the river is closed for repairs. The river has moved. The bridge is being very brave about it.",
  "Tolls are suspended until further notice. There is no one to pay and no one to collect. Please form an orderly queue.",
  "All roads lead here. That is the difficulty."
 ],[
  "Roads of the Empire. Conditions tonight are dry, level, and unattended.",
  "Travellers on the northern road are advised that the frontier has withdrawn. Please do not follow it.",
  "A message for the legion last seen marching east. Your dinner is still warm. We cannot explain this either.",
  "The milestones have been recounted. There is one more than there was. It bears no number, and it faces upward.",
  "Go carefully. Someone is listening on the high frequency, and it is not one of ours."
 ]]},
{id:"library",f:8300,name:"The Great Library, Overdue Desk",cast:"library",bed:"limbo",mode:"library",root:41,
 brief:"The overdue-returns desk of the Library of Alexandria, still issuing notices from a calm, lightless afterlife. Every scroll is overdue. Dry, patient, faintly reproachful, quietly sad.",
 segs:[[
  "This is the desk of the Great Library. The following scrolls are overdue.",
  "All of them.",
  "Borrowers are reminded that the fine is one obol a day, and that the days have continued.",
  "A reader has asked whether we hold a copy of what happened next. We hold several. They disagree.",
  "The reading room remains open. Bring your own light. Ours was borrowed."
 ],[
  "The desk of the Great Library. A new acquisition is announced.",
  "One catalogue of all the lights in the night sky. The final entry has been struck through, recently, in an unfamiliar hand.",
  "We have also received a wireless log. One listener, possibly a goose. We have shelved it under Warnings.",
  "If the listener is hearing this with the receiver off, the listener is in the right place. Stay as long as you like. Do not stay.",
  "Silence in the stacks, please. Thank you. That will do."
 ]]},
{id:"porch",f:12529,name:"The Painted Porch",cast:"porch",bed:"limbo",mode:"porch",root:45,
 brief:"A discussion programme hosted by ancient philosophers in a calm, green, evenly lit afterlife where nothing is expected of them. They sigh a lot. The discussion never concludes and no caller ever gets through. Dry, kind, resigned.",
 segs:[[
  "You are with the Painted Porch, where the discussion continues. It is always continuing. That is our whole situation.",
  "Tonight's question. If a lamp goes out and no one admits to noticing, has it gone out? We have had this question before. We have it most nights.",
  "We have no complaints here. The grass is green, the light is even, and nothing is expected of us. We sigh a good deal. It is not unpleasant.",
  "A caller on the line. No. There is never a caller on the line. We keep the line anyway.",
  "Stay for the next hour. It is this one again."
 ],[
  "The Painted Porch. A word for the one listening with the set switched off.",
  "Something on the living side has asked you to knock. Twice, on the glass. Do not. A door that is knocked from both sides is open.",
  "It is not an engineer. The engineer went up the mast the night the light went out, and something else came down in his coat.",
  "If you would shut the door, come to his number on this side, in the dark, and knock twice from here. A door knocked from one side only is merely a wall being polite.",
  "We cannot do it for you. We have no hands, only opinions.",
  "That is all the help we are permitted. It is more than we got."
 ]],
 calls:["A caller on the line. No. There is never a... Wait. Hush, all of you. There is.","We cannot make out the words. Only that they are warm. Thank you. That was more than we expected of the evening."]},
{id:"dominion",f:14040,name:"The Tideless Dominion",cast:"dominion",bed:"limbo",mode:"dominion",root:35,future:true,
 brief:"The final bulletin of an empire that has not been founded yet. It will rise in the long dark if the moon is never returned, and it has already fallen. Apologetic, precise, eerie, addressing a listener who could still prevent it.",
 segs:[[
  "This is the final bulletin of the Tideless Dominion, an empire that has not yet been founded. We apologise in advance for our fall.",
  "We will rise in the long dark after the moon is not returned. We will do well for a while. There will be very good roads.",
  "Our calendar has no months. We never found a reason to stop one and begin another.",
  "If you are hearing this before our founding, you are in a position to prevent us. We would take it as a kindness.",
  "Shut the door. You will know which. Then none of this will have been said."
 ],[
  "The Tideless Dominion, concluding. Our last census counted everyone, and one more.",
  "He was in every household. He was never the same height twice. He listened very well.",
  "We let him in because he asked nicely, and because he knocked the way a friend knocks.",
  "Do better than us. It will not be difficult. We set the bar on the floor, and then he took the floor.",
  "End of bulletin. End of dominion. Good night to the one with the steady thumb."
 ]]},
{id:"door",f:16661,name:"A door",cast:null,bed:"door",door:true,gap:7000,brief:"",
 segs:[["(a door, seen from behind)","(two knocks from the living side, slow, waiting for an answer)"]]}
];

var notes=[
 "Press Power. Sound starts then.",
 "Drag the dial sideways. It has weight, and it plays as it turns.",
 "Stations keep to the marked metre bands, mostly. The static thins as you close on one.",
 "What is spoken also prints here. The cog opens the mixer and the settings.",
 "Ten stations are on the air tonight. One would rather not be found."
];

/* FNV-1a, so the page and the voice renderer agree on what a line is called */
function hash(s){var h=0x811c9dc5;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i)&0xff;h=Math.imul(h,0x01000193)>>>0;}return ("0000000"+h.toString(16)).slice(-8);}
/* a line as it is spoken: static fragments and slots, in order */
function parts(text){
  var out=[], bits=text.replace(/\^/g,"").split(/\{(\w+)\}/);
  for(var i=0;i<bits.length;i++){
    if(i%2){out.push({slot:bits[i]});continue;}
    var t=bits[i].replace(/^[\s.,;:!?]+/,"").replace(/\s+$/,"");
    if(/[A-Za-z]/.test(t)) out.push({text:t});
  }
  return out;
}
return {
 hash:hash, parts:parts, timeWords:timeWords, living:living, listener:listener, dead:dead, notes:notes,
 slots:{
  time:times,
  weekday:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
  moon:["waxing crescent","first quarter","waxing gibbous","full moon","waning gibbous","last quarter","waning crescent"],
  n:["one station","two stations","three stations","four stations","five stations","six stations","seven stations","eight stations","nine stations","ten stations"],
  taps:["a few times","a dozen times","twenty-odd times","more than fifty times","more than a hundred times","several hundred times"],
  station:living.map(function(s){return s.short;})
 }
};
})();
if(typeof module!=="undefined") module.exports=HB_SCRIPT;
