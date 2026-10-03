export const DAY=86400000;
export const BEIJING_OFFSET=8*60*60*1000;
export function beijingDate(time=Date.now()){return new Date(new Date(time).getTime()+BEIJING_OFFSET);}
export function dateKey(time=Date.now()){return beijingDate(time).toISOString().slice(0,10);}
export function beijingTime(time=Date.now()){return beijingDate(time).toISOString().slice(11,16);}
export function calendarTime(year,month,day){return Date.UTC(year,month,day)-BEIJING_OFFSET;}
export function emptyState(){return {version:1,settings:{minutes:20,newCount:15,reminder:'20:30',notifications:false},cards:{},days:{},assessment:null,test:null};}
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function schedule(prior,grade,now=Date.now()){const c={reps:0,interval:0,ease:2.3,lapses:0,...prior};c.reps++;c.last=now;c.grade=grade;if(grade===0){c.lapses++;c.interval=0;c.due=now+10*60000;c.ease=Math.max(1.3,c.ease-.2);}else{c.interval=grade===1?1:grade===2?(c.interval?Math.max(3,Math.round(c.interval*c.ease)):3):(c.interval?Math.max(7,Math.round(c.interval*(c.ease+.3))):7);c.ease=Math.min(3,Math.max(1.3,c.ease+(grade===1?-.15:grade===3?.1:0)));c.due=now+c.interval*DAY;}return c;}
export const PLAN_VERSION=2;
export function learningProfile(state){
 const rates=state.assessment?.bands.map(b=>b.rate)||[.5,.5,.5,.5];
 const cet4=(rates[0]+rates[1])/2,cet6=(rates[2]+rates[3])/2;
 let stage=!state.assessment?1:cet4<.55?0:(cet4>=.8&&cet6>=.6?2:1);
 const recent=Object.values(state.cards).filter(c=>Number.isFinite(c.last)).sort((a,b)=>b.last-a.last).slice(0,20);
 let reason=state.assessment?'根据四、六级各词群的测评认识比例安排':'尚未测评，先用均衡计划';
 if(recent.length>=8){const success=recent.filter(c=>c.grade>=2).length/recent.length;if(success<.5){stage=Math.max(0,stage-1);reason+='；最近练习较吃力，降低一档';}else if(success>=.85&&recent.length>=15){stage=Math.min(2,stage+1);reason+='；最近练习掌握较好，提高一档';}}
 const base=[[.35,.35,.25,.05],[.1,.4,.35,.15],[.05,.15,.4,.4]][stage];
 const weighted=base.map((weight,b)=>weight*(.8+.4*(1-rates[b])));
 const sum=weighted.reduce((a,b)=>a+b,0);
 return {stage,label:!state.assessment&&recent.length<8?'均衡起步':['基础巩固','四级提升 · 六级衔接','六级进阶'][stage],weights:weighted.map(x=>x/sum),reason};
}
export function selectNewWords(state,words,count,profile=learningProfile(state)){
 const known=new Set((state.assessment?.answers||[]).filter(a=>!a.foil&&a.correct).map(a=>a.id));
 const missed=new Set((state.assessment?.answers||[]).filter(a=>!a.foil&&!a.correct).map(a=>a.id));
 const eligible=words.filter(w=>!Object.hasOwn(state.cards,w.id)&&!known.has(w.id));
 const pools=[0,1,2,3].map(b=>shuffle(eligible.filter(w=>w.band===b)).sort((a,b)=>Number(missed.has(a.id))-Number(missed.has(b.id))));
 const exact=profile.weights.map(w=>w*count),quotas=exact.map(Math.floor);
 for(const b of [0,1,2,3].sort((a,b)=>(exact[b]-quotas[b])-(exact[a]-quotas[a])).slice(0,count-quotas.reduce((a,b)=>a+b,0)))quotas[b]++;
 const selected=[];
 for(let b=0;b<4;b++)for(let n=0;n<quotas[b]&&pools[b].length;n++)selected.push(pools[b].pop());
 while(selected.length<count){const b=[0,1,2,3].filter(b=>pools[b].length).sort((a,b)=>profile.weights[b]-profile.weights[a])[0];if(b===undefined)break;selected.push(pools[b].pop());}
 const four=shuffle(selected.filter(w=>w.band<2)),six=shuffle(selected.filter(w=>w.band>=2)),mixed=[];
 while(four.length||six.length){const pool=mixed.length%2?six:four;mixed.push((pool.length?pool:four.length?four:six).pop().id);}
 return mixed;
}
export function getDay(state,words,now=Date.now()){
 const key=dateKey(now),existing=state.days[key],assessmentAt=state.assessment?.time||0;
 if(existing&&(existing.checked||(existing.planVersion===PLAN_VERSION&&existing.assessmentAt===assessmentAt)))return existing;
 const profile=learningProfile(state);
 const retained=existing?[...existing.done]:[];
 const retainedNew=(existing?.newIds||[]).filter(id=>retained.includes(id));
 const due=Object.keys(state.cards).filter(id=>state.cards[id].due<=now&&!retained.includes(id)).sort((a,b)=>state.cards[a].due-state.cards[b].due).slice(0,25);
 const fresh=selectNewWords(state,words,Math.max(0,state.settings.newCount-retainedNew.length),profile);
 const newIds=[...retainedNew,...fresh],ids=[...new Set([...retained,...due,...fresh])];
 return state.days[key]={...(existing||{}),seconds:existing?.seconds||0,ids,done:retained,checked:existing?.checked||false,context:existing?.context||false,newIds,planVersion:PLAN_VERSION,assessmentAt,profile};
}
export function checkDay(day,settings){if(day.seconds>=settings.minutes*60||(day.ids.length>0&&day.ids.every(id=>day.done.includes(id))&&day.context))day.checked=true;return day.checked;}
export function streak(days,now=Date.now()){let count=0,time=new Date(now).getTime();if(!days[dateKey(time)]?.checked)time-=DAY;while(days[dateKey(time)]?.checked){count++;time-=DAY;}return count;}
export function estimate(answers,words){const real=answers.filter(a=>!a.foil);const bands=[0,1,2,3].map(b=>{const xs=real.filter(a=>a.band===b),n=xs.length,k=xs.filter(a=>a.correct).length;const p=n?k/n:0;const rate=Math.max(0,(p-.25)/.75);const z=1.96,den=1+z*z/(n||1),center=(p+z*z/(2*(n||1)))/den,margin=z*Math.sqrt((p*(1-p)+z*z/(4*(n||1)))/(n||1))/den;return {band:b,n,k,rate,low:Math.max(0,(center-margin-.25)/.75),high:Math.min(1,Math.max(0,(center+margin-.25)/.75))};});const counts=bands.map(b=>words.filter(w=>w.band===b.band).length);const total=Math.round(bands.reduce((s,b,i)=>s+b.rate*counts[i],0));const coverage=level=>{const relevant=words.filter(w=>w.levels.includes(level));return Math.round(relevant.reduce((s,w)=>s+bands[w.band].rate,0)/relevant.length*100);};return {time:Date.now(),total,low:Math.round(bands.reduce((s,b,i)=>s+b.low*counts[i],0)),high:Math.round(bands.reduce((s,b,i)=>s+b.high*counts[i],0)),cet4:coverage(4),cet6:coverage(6),bands,answers,foilErrors:answers.filter(a=>a.foil&&!a.correct).length};}
export function validateBackup(value,words){if(!value||value.app!=='ciliu'||value.version!==1||!value.state)throw Error('这不是词流 v1 备份文件。');const s=value.state;const ids=new Set(words.map(w=>w.id));if(!s.settings||!s.cards||Array.isArray(s.cards)||!s.days||Array.isArray(s.days))throw Error('备份结构不完整。');if(![10,20,30].includes(s.settings.minutes)||!Number.isInteger(s.settings.newCount)||s.settings.newCount<5||s.settings.newCount>30||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.settings.reminder)||typeof s.settings.notifications!=='boolean')throw Error('学习设置无效。');for(const [id,c] of Object.entries(s.cards)){if(!ids.has(id)||!c||!Number.isFinite(c.due)||!Number.isFinite(c.interval)||c.interval<0||!Number.isInteger(c.grade)||c.grade<0||c.grade>3||!Number.isFinite(c.ease)||c.ease<1.3||c.ease>3||!Number.isInteger(c.reps)||c.reps<0||!Number.isInteger(c.lapses)||c.lapses<0)throw Error('单词进度无效。');}for(const [key,d] of Object.entries(s.days)){if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!d||!Number.isFinite(d.seconds)||d.seconds<0||!Array.isArray(d.ids)||!Array.isArray(d.done)||!Array.isArray(d.newIds)||[...d.ids,...d.done,...d.newIds].some(id=>!ids.has(id))||d.done.some(id=>!d.ids.includes(id))||typeof d.checked!=='boolean'||typeof d.context!=='boolean')throw Error('打卡记录无效。');}if(s.assessment&&(!Number.isFinite(s.assessment.time)||!['total','low','high'].every(k=>Number.isInteger(s.assessment[k])&&s.assessment[k]>=0&&s.assessment[k]<=words.length)||s.assessment.low>s.assessment.high||!['cet4','cet6'].every(k=>Number.isFinite(s.assessment[k])&&s.assessment[k]>=0&&s.assessment[k]<=100)||!Array.isArray(s.assessment.bands)||s.assessment.bands.length!==4||s.assessment.bands.some((b,i)=>!b||b.band!==i||!Number.isFinite(b.rate)||b.rate<0||b.rate>1)||!Array.isArray(s.assessment.answers)))throw Error('测评记录无效。');return {...s,version:1,test:null};}
