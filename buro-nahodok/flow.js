export function cardCodes(quest) {
  const used = new Set();
  return quest.missions.slice(0, -1).map((mission, index) => {
    const text = `${quest.config.seed}:${mission.id}:${index}`;
    let hash = 2166136261;
    for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    let code = 1000 + hash % 9000;
    while (used.has(code)) code = 1000 + (code - 999) % 9000;
    used.add(code);
    return String(code);
  });
}

export function freshProgress() { return { index: 0, phase: 'intro', startedAt: 0, hints: [] }; }

export function readProgress(value, count) {
  if (!value || !Number.isInteger(value.index) || value.index < 0 || value.index >= count) return freshProgress();
  if (!['intro', 'puzzle', 'find', 'treasure', 'done'].includes(value.phase)) return freshProgress();
  if (value.phase === 'intro' && value.index !== 0) return freshProgress();
  if (value.phase === 'find' && value.index === count - 1) return freshProgress();
  if (['treasure', 'done'].includes(value.phase) && value.index !== count - 1) return freshProgress();
  const result = { index: value.index, phase: value.phase, startedAt: Number.isFinite(value.startedAt) && value.startedAt > 0 ? value.startedAt : 0, hints: Array.isArray(value.hints) ? [...new Set(value.hints.filter(i => Number.isInteger(i) && i >= 0 && i < count))] : [] };
  if (Array.isArray(value.hiddenHints)) {
    const hiddenHints = result.hints.filter(index => value.hiddenHints.includes(index));
    if (hiddenHints.length) result.hiddenHints = hiddenHints;
  }
  if(value.mistakes&&typeof value.mistakes==='object'&&!Array.isArray(value.mistakes)){
    const mistakes={};
    for(const [key,answers] of Object.entries(value.mistakes))if(/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<count&&Array.isArray(answers)){
      const valid=[...new Set(answers.filter(answer=>Number.isInteger(answer)&&answer>=0&&answer<6))];
      if(valid.length)mistakes[key]=valid;
    }
    if(Object.keys(mistakes).length)result.mistakes=mistakes;
  }
  if(Array.isArray(value.assisted)){
    const assisted=[...new Set(value.assisted.filter(index=>Number.isInteger(index)&&index>=0&&index<count))];
    if(assisted.length)result.assisted=assisted;
  }
  if(value.taskInput&&value.taskInput.index===value.index){
    const input=value.taskInput.value;
    if(typeof input==='string'&&/^[0-9А-ЯЁA-Z]{0,8}$/u.test(input))result.taskInput={index:value.index,value:input};
    else if(Array.isArray(input)&&input.length<=6&&input.every(id=>typeof id==='string'&&/^[a-z]{1,16}$/.test(id))&&new Set(input).size===input.length)result.taskInput={index:value.index,value:[...input]};
  }
  if(value.taskAttempts&&typeof value.taskAttempts==='object'&&!Array.isArray(value.taskAttempts)){
    const attempts={};
    for(const [key,n] of Object.entries(value.taskAttempts))if(/^(0|[1-9][0-9]*)$/.test(key)&&Number(key)<count&&Number.isInteger(n)&&n>0&&n<=99)attempts[key]=n;
    if(Object.keys(attempts).length)result.taskAttempts=attempts;
  }
  return result;
}

export function isHintOpen(progress, index) {
  return progress.hints.includes(index) && !progress.hiddenHints?.includes(index);
}

function openHint(progress, index) {
  if (!progress.hints.includes(index)) return { ...progress, hints: [...progress.hints, index] };
  if (!progress.hiddenHints?.includes(index)) return progress;
  const { hiddenHints, ...visible } = progress;
  const remaining = hiddenHints.filter(hidden => hidden !== index);
  if (remaining.length) visible.hiddenHints = remaining;
  return visible;
}

export function toggleHint(progress, index) {
  if (progress?.phase !== 'puzzle' || index !== progress.index) return progress;
  if (isHintOpen(progress, index)) {
    return { ...progress, hiddenHints: [...(progress.hiddenHints || []), index] };
  }
  return openHint(progress, index);
}

/** A partially assembled puzzle is saved, but is never counted as solved. */
export function puzzleInput(mission,progress){
  const task=mission?.interaction;if(!task)return null;
  const supplied=progress.taskInput?.index===progress.index?progress.taskInput.value:undefined;
  if(task.type==='code')return typeof supplied==='string'?[...supplied.toUpperCase()].filter(ch=>task.alphabet.includes(ch)).slice(0,task.length).join(''):'';
  return Array.isArray(supplied)?[...new Set(supplied.filter(id=>task.items.some(item=>item.id===id)))].slice(0,task.type==='switches'?task.items.length:task.count):[];
}
export function setPuzzleInput(quest,progress,value){
  if(progress?.phase!=='puzzle')return progress;
  const mission=quest.missions[progress.index];if(!mission?.interaction)return progress;
  const next={...progress,taskInput:{index:progress.index,value}};
  return {...next,taskInput:{index:progress.index,value:puzzleInput(mission,next)}};
}
export function taskStatus(mission,value){
  const task=mission.interaction;if(!task)return {complete:false,correct:false};
  if(task.type==='code')return {complete:typeof value==='string'&&value.length===task.length,correct:value===task.answer};
  if(!Array.isArray(value))return {complete:false,correct:false};
  if(task.type==='switches'){
    const lamps=[...task.initial];for(const id of value){const item=task.items.find(item=>item.id===id);if(item)for(const index of item.mask)lamps[index]=!lamps[index];}
    return {complete:true,correct:lamps.every(Boolean),lamps};
  }
  const complete=value.length===task.count;
  return {complete,correct:complete&&(task.type==='pick'?task.answer.every(id=>value.includes(id)):task.answer.every((id,i)=>value[i]===id))};
}
export function attemptTask(quest,progress){
  if(progress?.phase!=='puzzle')return {correct:false,progress,incomplete:true};
  const mission=quest.missions[progress.index];if(!mission?.interaction)return {correct:false,progress,incomplete:true};
  const status=taskStatus(mission,puzzleInput(mission,progress));
  if(!status.complete)return {correct:false,progress,incomplete:true};
  if(status.correct)return answerMission(quest,progress,mission.answerIndex);
  const attempts=Math.min(99,(progress.taskAttempts?.[progress.index]||0)+1);
  const next = { ...progress, taskAttempts: { ...progress.taskAttempts, [progress.index]: attempts } };
  return { correct: false, progress: attempts === 2 ? openHint(next, progress.index) : next };
}

/** Track a genuine attempt without advancing, so retries and help survive refresh. */
export function attemptMission(quest, progress, answerIndex) {
  if(!progress||progress.phase!=='puzzle'||!Number.isInteger(progress.index))return {correct:false,progress};
  const mission=quest.missions[progress.index];
  if(!mission||!Number.isInteger(answerIndex)||answerIndex<0||answerIndex>=mission.choices.length)return {correct:false,progress};
  const result=answerMission(quest,progress,answerIndex);
  if(result.correct)return result;
  const previous=progress.mistakes?.[progress.index]||[];
  const tried=[...new Set([...previous,answerIndex])];
  const next = { ...progress, mistakes: { ...progress.mistakes, [progress.index]: tried } };
  const reachedThreshold = previous.length === 1 && tried.length === 2;
  return { correct: false, progress: reachedThreshold ? openHint(next, progress.index) : next };
}

/** Help is an explicit choice; opening the explanation does not complete a puzzle. */
export function solveWithHelp(quest, progress) {
  if(!progress||progress.phase!=='puzzle'||!Number.isInteger(progress.index)||!quest.missions[progress.index])return {correct:false,progress};
  const result=answerMission(quest,progress,quest.missions[progress.index].answerIndex);
  return result.correct?{correct:true,progress:{...result.progress,assisted:[...new Set([...(progress.assisted||[]),progress.index])]}}:result;
}

export function answerMission(quest, progress, answerIndex) {
  if (progress.phase !== 'puzzle') return { correct: false, progress };
  const mission = quest.missions[progress.index];
  if (!Number.isInteger(answerIndex) || answerIndex !== mission.answerIndex) return { correct: false, progress };
  return { correct: true, progress: { ...progress, phase: progress.index === quest.missions.length - 1 ? 'treasure' : 'find' } };
}

export function confirmCard(quest, progress, code) {
  if (quest.config.mode === 'screen' || progress.phase !== 'find' || String(code).trim() !== cardCodes(quest)[progress.index]) return { correct: false, progress };
  return { correct: true, progress: { ...progress, index: progress.index + 1, phase: 'puzzle' } };
}

export function continueScreenQuest(quest, progress) {
  if (quest.config.mode !== 'screen' || !progress || progress.phase !== 'find'
    || !Number.isInteger(progress.index) || progress.index < 0 || progress.index >= quest.missions.length - 1) {
    return { correct: false, progress };
  }
  return { correct: true, progress: { ...progress, index: progress.index + 1, phase: 'puzzle' } };
}
