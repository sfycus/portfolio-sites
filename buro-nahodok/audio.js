// An original, quiet sixteen-beat score. Each station has its own celesta phrase.
// The notes are synthesized locally; no recordings or network requests are used.
const audioHolidayPhrases = [
  [[74,1],[78,.5],[81,.5],[76,2],[79,1],[78,1],[74,2],[73,.5],[71,.5],[74,2],[78,1],[76,1],[74,3]],
  [[76,1],[79,.5],[83,.5],[81,2],[78,1],[76,1],[74,2],[78,.5],[79,.5],[81,2],[83,1],[79,1],[78,3]],
  [[71,1],[74,.5],[78,.5],[76,2],[73,1],[71,1],[69,2],[73,.5],[76,.5],[78,2],[74,1],[73,1],[74,3]],
  [[78,1],[81,.5],[86,.5],[83,2],[81,1],[78,1],[79,2],[81,.5],[78,.5],[76,2],[74,1],[78,1],[74,3]]
];
const audioHolidayChords = [[50,57,66],[47,54,62],[43,50,59],[45,52,59]];
const audioHolidayHarmony = [[0,1,2,3],[2,0,1,3],[1,2,0,3],[0,2,3,0]];
const audioHolidayBeat = 60 / 76;
const audioHolidayClamp = (value, fallback) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
const audioHolidayFrequency = midi => 440 * 2 ** ((midi - 69) / 12);
const audioHolidayEscape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

/**
 * Construction is silent and creates no AudioContext or timers. Only an explicit
 * setEnabled(true), called from a user gesture, creates/resumes the context.
 * setScene can subsequently pause/resume an already permitted soundtrack.
 */
export function createHolidayAudio(audioOptions = {}) {
  let audioContext = null, audioMaster = null, audioFilter = null;
  let audioEnabled = false, audioUnlocked = false, audioUnavailable = false;
  let audioVolume = audioHolidayClamp(audioOptions.volume, .28);
  let audioScene = {station:0, active:false, ducked:false};
  let audioPlaying = false, audioError = null, audioTimer = null;
  let audioRequest = 0, audioOrigin = 0, audioCycle = 0, audioEventIndex = 0;
  let audioEvents = [], audioLastState = '';
  const audioVoices = new Set();
  const audioTimers = audioOptions.timers || {
    setTimeout: (...args) => globalThis.setTimeout(...args),
    clearTimeout: id => globalThis.clearTimeout(id)
  };
  const audioFactory = audioOptions.audioContextFactory || (() => {
    const audioConstructor = globalThis.AudioContext || globalThis.webkitAudioContext;
    return audioConstructor ? new audioConstructor() : null;
  });
  const audioState = () => ({enabled:audioEnabled, volume:audioVolume, unavailable:audioUnavailable,
    playing:audioPlaying, error:audioError, station:audioScene.station, active:audioScene.active, ducked:audioScene.ducked});
  function audioEmit() {
    const audioSnapshot = audioState(), audioSerialized = JSON.stringify(audioSnapshot);
    if (audioSerialized === audioLastState) return;
    audioLastState = audioSerialized;
    try { audioOptions.onChange?.(audioSnapshot); } catch {
      // If the host UI fails, leave no music loop running beyond its controls.
      audioEnabled = false;
      audioUnlocked = false;
      audioUnavailable = true;
      audioError = 'unavailable';
      audioHalt();
      try { audioLevel(); } catch { /* The audio device may also have disappeared. */ }
    }
  }
  function audioDisconnect(audioNode) {
    try { audioNode?.disconnect(); } catch { /* Already disconnected. */ }
  }
  function audioLevel() {
    if (!audioMaster || !audioContext) return;
    const audioNow = audioContext.currentTime;
    audioMaster.gain.cancelScheduledValues(audioNow);
    audioMaster.gain.setTargetAtTime(audioEnabled && audioScene.active ? audioVolume * (audioScene.ducked ? .28 : 1) : 0, audioNow, .035);
  }
  function audioHalt() {
    if (audioTimer !== null) audioTimers.clearTimeout(audioTimer);
    audioTimer = null;
    audioPlaying = false;
    const audioNow = audioContext?.currentTime || 0;
    for (const audioVoice of audioVoices) {
      try {
        audioVoice.gain.gain.cancelScheduledValues(audioNow);
        audioVoice.gain.gain.setTargetAtTime(0, audioNow, .008);
        audioVoice.oscillator.stop(audioNow + .035);
      } catch {
        audioDisconnect(audioVoice.oscillator);
        audioDisconnect(audioVoice.gain);
      }
    }
    audioVoices.clear();
  }
  function audioFail() {
    audioEnabled = false;
    audioUnlocked = false;
    audioUnavailable = true;
    audioError = 'unavailable';
    audioHalt();
    try { audioLevel(); } catch { /* The audio device may have disappeared. */ }
    audioEmit();
  }
  function audioPermitted() {
    return audioEnabled && audioUnlocked && audioScene.active && audioVolume > 0 && audioContext?.state === 'running';
  }
  function audioTone(audioMidi, audioStart, audioDuration, audioStrength, audioKind = 'bell') {
    const audioOscillator = audioContext.createOscillator(), audioGain = audioContext.createGain();
    const audioVoice = {oscillator:audioOscillator, gain:audioGain};
    audioVoices.add(audioVoice);
    audioOscillator.onended = () => {
      audioVoices.delete(audioVoice);
      audioDisconnect(audioOscillator);
      audioDisconnect(audioGain);
    };
    try {
      audioOscillator.type = audioKind === 'bell' ? 'triangle' : 'sine';
      audioOscillator.frequency.setValueAtTime(audioHolidayFrequency(audioMidi), audioStart);
      audioGain.gain.setValueAtTime(0, audioStart);
      audioGain.gain.linearRampToValueAtTime(audioStrength, audioStart + (audioKind === 'harmony' ? .16 : .012));
      audioGain.gain.exponentialRampToValueAtTime(.0001, audioStart + audioDuration);
      audioOscillator.connect(audioGain);
      audioGain.connect(audioFilter);
      audioOscillator.start(audioStart);
      audioOscillator.stop(audioStart + audioDuration + .02);
    } catch (audioException) {
      try { audioOscillator.stop(); } catch { /* It may not have started. */ }
      audioDisconnect(audioOscillator);
      audioDisconnect(audioGain);
      audioVoices.delete(audioVoice);
      throw audioException;
    }
  }
  function audioBell(audioMidi, audioStart, audioDuration, audioStrength = .075) {
    audioTone(audioMidi, audioStart, audioDuration, audioStrength);
    // A short, quiet upper partial gives the triangle its soft bell-like strike.
    audioTone(audioMidi + 12, audioStart, Math.min(.5, audioDuration), audioStrength * .14, 'partial');
  }
  function audioPhrase() {
    const audioResult = [];
    let audioBeat = 0;
    for (const [audioMidi, audioLength] of audioHolidayPhrases[audioScene.station]) {
      audioResult.push({beat:audioBeat, midi:audioMidi, length:Math.min(1.7, audioLength * audioHolidayBeat + .35), kind:'bell'});
      audioBeat += audioLength;
    }
    audioHolidayHarmony[audioScene.station].forEach((audioChord, audioIndex) => {
      for (const audioMidi of audioHolidayChords[audioChord]) audioResult.push({beat:audioIndex * 4, midi:audioMidi, length:3.05, kind:'harmony'});
    });
    return audioResult.sort((audioA, audioB) => audioA.beat - audioB.beat);
  }
  function audioSchedule() {
    audioTimer = null;
    if (!audioPermitted()) { audioHalt(); audioEmit(); return; }
    try {
      const audioNow = audioContext.currentTime;
      // A sleeping/background tab never catches up by playing a burst of notes.
      if (audioOrigin + (audioCycle * 16 + audioEvents[audioEventIndex].beat) * audioHolidayBeat < audioNow - .2) {
        audioHalt();
        audioOrigin = audioNow + .045;
        audioCycle = 0;
        audioEventIndex = 0;
      }
      audioPlaying = true;
      while (audioOrigin + (audioCycle * 16 + audioEvents[audioEventIndex].beat) * audioHolidayBeat <= audioNow + .18) {
        const audioEvent = audioEvents[audioEventIndex];
        const audioStart = Math.max(audioNow + .005, audioOrigin + (audioCycle * 16 + audioEvent.beat) * audioHolidayBeat);
        if (audioEvent.kind === 'harmony') audioTone(audioEvent.midi, audioStart, audioEvent.length, .026, 'harmony');
        else audioBell(audioEvent.midi, audioStart, audioEvent.length);
        audioEventIndex += 1;
        if (audioEventIndex === audioEvents.length) { audioEventIndex = 0; audioCycle += 1; }
      }
      audioTimer = audioTimers.setTimeout(audioSchedule, 90);
      audioEmit();
    } catch { audioFail(); }
  }
  function audioUpdate() {
    try {
      audioLevel();
      if (!audioPermitted()) audioHalt();
      else if (!audioPlaying) {
        audioEvents = audioPhrase();
        audioOrigin = audioContext.currentTime + .045;
        audioCycle = 0;
        audioEventIndex = 0;
        audioSchedule();
      }
      audioEmit();
    } catch { audioFail(); }
  }
  function audioContextChanged() {
    if (audioContext?.state === 'closed') { audioFail(); return; }
    audioUpdate();
  }
  return {
    async setEnabled(audioNextEnabled) {
      const audioThisRequest = ++audioRequest;
      audioError = null;
      audioEnabled = Boolean(audioNextEnabled) && !audioUnavailable;
      if (!audioEnabled) { audioUpdate(); return false; }
      try {
        if (!audioContext) {
          audioContext = audioFactory();
          if (!audioContext) { audioFail(); return false; }
          audioMaster = audioContext.createGain();
          audioFilter = audioContext.createBiquadFilter();
          audioFilter.type = 'lowpass';
          audioFilter.frequency.setValueAtTime(2900, audioContext.currentTime);
          audioFilter.Q.setValueAtTime(.45, audioContext.currentTime);
          audioMaster.gain.setValueAtTime(0, audioContext.currentTime);
          audioFilter.connect(audioMaster);
          audioMaster.connect(audioContext.destination);
          if (audioContext.addEventListener) audioContext.addEventListener('statechange', audioContextChanged);
          else audioContext.onstatechange = audioContextChanged;
        }
        // Keep resume inside this explicit gesture method, before the first await.
        const audioResume = audioContext.resume();
        audioEmit();
        await audioResume;
        if (audioThisRequest !== audioRequest || !audioEnabled) return false;
        if (audioContext.state !== 'running') throw new Error('Audio is suspended');
        audioUnlocked = true;
        audioUpdate();
        return audioEnabled;
      } catch {
        if (audioThisRequest !== audioRequest) return false;
        audioEnabled = false;
        audioUnlocked = false;
        audioError = audioUnavailable ? 'unavailable' : 'blocked';
        audioHalt();
        try { audioLevel(); } catch { audioFail(); }
        audioEmit();
        return false;
      }
    },
    setVolume(audioNextVolume) {
      audioVolume = audioHolidayClamp(audioNextVolume, audioVolume);
      audioUpdate();
    },
    setScene(audioNextScene = {}) {
      const audioStation = Number.isInteger(audioNextScene.station) ? Math.max(0, Math.min(3, audioNextScene.station)) : audioScene.station;
      if (audioStation !== audioScene.station) audioHalt();
      audioScene = {station:audioStation,
        active:typeof audioNextScene.active === 'boolean' ? audioNextScene.active : audioScene.active,
        ducked:typeof audioNextScene.ducked === 'boolean' ? audioNextScene.ducked : audioScene.ducked};
      audioUpdate();
    },
    celebrate({stationComplete:audioStationComplete = false} = {}) {
      if (!audioPermitted()) return false;
      try {
        const audioNotes = audioStationComplete ? [74,78,81,86] : [81,86];
        audioNotes.forEach((audioMidi, audioIndex) => audioBell(audioMidi, audioContext.currentTime + .015 + audioIndex * .14, .85, .064));
        return true;
      } catch { audioFail(); return false; }
    },
    stop() {
      audioRequest += 1;
      audioEnabled = false;
      audioUpdate();
    },
    state:audioState
  };
}

/** HTML for the app's delegated click/input handlers; safe across full rerenders. */
export function holidayAudioControls(audioCurrentState = {}, {idPrefix:audioIdPrefix = 'holiday'} = {}) {
  const audioControlId = `${String(audioIdPrefix).replace(/[^a-zA-Z0-9_-]/g, '') || 'holiday'}-music-volume`;
  const audioChecked = Boolean(audioCurrentState.enabled);
  const audioDisabled = audioCurrentState.unavailable ? ' disabled' : '';
  const audioStatus = audioCurrentState.unavailable ? 'Музыка недоступна в этом браузере.' : audioCurrentState.error === 'blocked' ? 'Не удалось включить музыку. Попробуйте ещё раз.' : audioCurrentState.enabled ? audioCurrentState.volume===0 ? 'Музыка включена · громкость 0%' : audioCurrentState.ducked ? 'Музыка тише, пока звучит голос.' : audioCurrentState.playing ? 'Играет новогодняя мелодия' : 'Музыка на паузе' : 'Музыка выключена';
  return `<div class="holiday-audio" role="group" aria-label="Музыка">
    <button type="button" class="music-toggle" data-action="music-toggle" aria-pressed="${audioChecked}"${audioDisabled}>${audioChecked ? 'Выключить музыку' : 'Включить музыку'}</button>
    <label for="${audioControlId}">Громкость музыки</label>
    <input id="${audioControlId}" name="music-volume" type="range" min="0" max="100" step="1" value="${Math.round(audioHolidayClamp(audioCurrentState.volume, .28) * 100)}" aria-label="Громкость музыки"${audioDisabled}>
    <span class="music-status" role="status">${audioHolidayEscape(audioStatus)}</span>
  </div>`;
}
