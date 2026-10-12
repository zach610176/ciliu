// Optional practice modes and persisted delayed retrieval; no external services.
export function cloze(word){
 const escaped=word.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const pattern=new RegExp(`(?<![A-Za-z])${escaped}(?![A-Za-z])`,'gi');
 const sentence=word.sentences.find(s=>pattern.test(s.en));
 return sentence?sentence.en.replace(new RegExp(pattern.source,'gi'),'_____'):null;
}
export function pendingMemory(day){return Object.keys(day.memory||{}).filter(id=>day.memory[id]===null);}
export function validateMemory(state,words){
 const ids=new Set(words.map(w=>w.id));
 if(state.notes&&(typeof state.notes!=='object'||Array.isArray(state.notes)||Object.entries(state.notes).some(([id,n])=>!ids.has(id)||typeof n!=='string'||n.length>600)))throw Error('记忆提示无效。');
 for(const d of Object.values(state.days)){if(d.memory&&(typeof d.memory!=='object'||Array.isArray(d.memory)||Object.entries(d.memory).some(([id,v])=>!d.done.includes(id)||![null,true,false].includes(v))))throw Error('回忆记录无效。');}
 return state;
}
export function installMemory(api){
 const {esc,btn}=api;
 let mode='meaning';
 function interrupt(){
  const s=api.session(),d=api.day();if(!s||s.mode!=='daily')return;
  const pending=pendingMemory(d);
  if(pending.length&&(pending.length>=3||s.index>=s.ids.length)){
   s.resumeStage=s.stage;s.stage='memory';s.memoryIds=pending;s.memoryIndex=0;s.memoryAnswer='';s.memoryShown=false;
  }
 }
 return {
  started(){interrupt();const s=api.session();if(s?.mode==='daily'&&!s.ids.length&&s.stage!=='memory'){const p=pendingMemory(api.day());if(p.length){s.resumeStage=s.stage;s.stage='memory';s.memoryIds=p;s.memoryIndex=0;s.memoryShown=false;s.memoryAnswer='';}}},
  async after(action){if(action==='grade')interrupt();},
  html(original){
   const s=api.session();if(!s)return original;
   if(s.stage==='memory'){
    const w=api.word(s.memoryIds[s.memoryIndex]);
    return `<div class="card-area memory-area"><h1>隔几个词，再想一次。</h1><p class="muted">不看释义，回忆刚才学过的词。${s.memoryIndex+1} / ${s.memoryIds.length}</p><section class="word-card"><h2 class="word">${esc(w.word)}</h2>${s.memoryShown?`<div class="definition">${esc(api.meaning(w))}</div><p class="hint">你的回忆：${esc(s.memoryAnswer||'暂时想不起来')}</p><p class="hint">意思相近即可，自行核对；这不是自动评分。</p><div class="actions">${btn('memory-yes','想起来了','primary')}${btn('memory-no','没想起来，早点复习','ghost')}</div>`:`<form id="memory-answer"><label for="memory-text">遮住释义后，你能想起什么？</label><textarea id="memory-text" class="input" name="answer" maxlength="600" placeholder="写出词义或一个用法"></textarea><button class="primary">查看答案并核对</button></form><p class="hint">想不起来也可以直接查看，再诚实核对。</p>`}</section>${btn('home','暂时离开','ghost')}<p class="end">完成回忆不等于长期掌握。忘掉的词会在 10 分钟后回到复习队列。</p></div>`;
   }
   if(s.stage==='back'){
    const note=api.state().notes?.[s.word.id]||'';
    const extras=`<section class="panel memory-tools"><h3>换个方式记</h3><p class="hint">主要训练是隔词回忆；下面任选一种辅助。</p><div class="practice-modes">${[['meaning','词义选择'],['spell','遮词拼写'],['cloze','例句填空'],['listen','听音拼写']].map(([id,label])=>btn('memory-mode',label,mode===id?'primary':'ghost',`data-value="${id}" aria-pressed="${mode===id}"`)).join('')}</div><form id="memory-note"><label for="memo">我的联想 / 自己的例句（可选）</label><textarea id="memo" name="memo" class="input" maxlength="600" placeholder="写一句只有你自己懂的提示">${esc(note)}</textarea><button class="ghost">保存我的提示</button></form><p class="hint">提示只存在本机，随学习备份导出；不会作为考试答案。</p></section>`;
    return original+extras;
   }
   if(s.stage==='recall'&&s.memoryMode&&s.memoryMode!=='meaning'){
    const w=s.word,masked=s.memoryMode==='cloze'?cloze(w):null;
    if(s.memoryMode==='cloze'&&!masked)return original;
    return `<div class="card-area"><h1>${s.memoryMode==='listen'?'听音，写出单词。':s.memoryMode==='cloze'?'把词放回例句。':'从词义想起单词。'}</h1><section class="word-card">${s.memoryMode==='listen'?btn('audio','播放英文发音','primary'):s.memoryMode==='cloze'?`<p class="passage">${esc(masked)}</p>`:`<p class="definition">${esc(api.meaning(w))}</p>`}<form id="spell" class="spell"><input class="input" name="answer" aria-label="拼写答案" autocomplete="off" autocapitalize="none" spellcheck="false" required><button class="primary">检查答案</button></form>${btn('memory-skip','想不起来 / 语音不可用，查看答案','ghost')}</section><p class="hint">听音依赖设备英文语音包；不可用时请切回其他方式。</p></div>`;
   }
   return original;
  },
  async action(action,value){
   const s=api.session();
   if(action==='grade'&&s?.mode==='daily'){const d=api.day();d.memory||={};if(!(s.word.id in d.memory))d.memory[s.word.id]=null;}
   if(action==='memory-mode'){
    if(value==='cloze'&&!cloze(s.word)){api.toast('这个词暂无可用的填空例句，请选择其他方式。');return true;}
    mode=value;api.render();return true;
   }
   if(action==='recall'){s.memoryMode=mode;s.spell=mode==='spell'||mode==='listen'||(mode==='cloze'&&!!cloze(s.word));}
   if(action==='memory-skip'){s.correct=false;s.response='';s.stage='rating';api.render();return true;}
   if(action==='memory-yes'||action==='memory-no'){
    if(s?.stage!=='memory'||!s.memoryShown)return true;
    const id=s.memoryIds[s.memoryIndex],d=api.day(),ok=action==='memory-yes'&&!!s.memoryAnswer.trim();
    d.memory[id]=ok;
    if(!ok)api.state().cards[id]=api.schedule(api.state().cards[id],0);
    else {const c=api.state().cards[id];if(c.reps===1&&c.interval>1){c.interval=1;c.due=c.last+86400000;}}
    s.memoryIndex++;s.memoryAnswer='';s.memoryShown=false;
    if(s.memoryIndex>=s.memoryIds.length)s.stage=s.resumeStage;
    api.checkDay(d,api.state().settings);await api.save();api.render();return true;
   }
   return false;
  },
  async submit(form){
   const s=api.session();if(form.id==='memory-answer'){
    s.memoryAnswer=String(new FormData(form).get('answer')||'').trim();s.memoryShown=true;api.render();return true;
   }
   if(form.id==='memory-note'){
    const id=s.word.id;api.state().notes||={};api.state().notes[id]=String(new FormData(form).get('memo')||'').trim().slice(0,600);
    await api.save();api.toast('你的记忆提示已保存。');return true;
   }
   return false;
  }
 };
}
