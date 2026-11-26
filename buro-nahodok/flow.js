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
  return result;
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
  const hints=tried.length>=2?[...new Set([...progress.hints,progress.index])]:[...progress.hints];
  return {correct:false,progress:{...progress,hints,mistakes:{...progress.mistakes,[progress.index]:tried}}};
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
