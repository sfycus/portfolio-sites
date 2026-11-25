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
  return { index: value.index, phase: value.phase, startedAt: Number.isFinite(value.startedAt) && value.startedAt > 0 ? value.startedAt : 0, hints: Array.isArray(value.hints) ? [...new Set(value.hints.filter(i => Number.isInteger(i) && i >= 0 && i < count))] : [] };
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
