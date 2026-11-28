// Jingle Bells / The One Horse Open Sleigh — J. Pierpont (1857).
// A locally synthesized instrumental arrangement of the familiar chorus;
// no lyrics, recordings, downloaded samples or network requests are used.
// Source: Library of Congress, https://www.loc.gov/item/2023812429/.
const audioHolidayChorus = [
  [76,.5],[76,.5],[76,1], [76,.5],[76,.5],[76,1],
  [76,.5],[79,.5],[72,.75],[74,.25],[76,2],
  [77,.5],[77,.5],[77,.75],[77,.25],
  [77,.5],[76,.5],[76,.5],[76,.25],[76,.25],
  [76,.5],[74,.5],[74,.5],[76,.5],[74,1],[79,1],
  [76,.5],[76,.5],[76,1], [76,.5],[76,.5],[76,1],
  [76,.5],[79,.5],[72,.75],[74,.25],[76,2],
  [77,.5],[77,.5],[77,.75],[77,.25],
  [77,.5],[76,.5],[76,.5],[76,.5],
  [79,.5],[79,.5],[77,.5],[74,.5],[72,2]
];
// C, F and G major; each two-beat bar has a plucked root/fifth bass
// and soft offbeat chords. The stations move the same hook into four keys.
const audioHolidayChords = [[60,64,67],[60,65,69],[59,62,67]];
const audioHolidayRoots = [48,53,43];
const audioHolidayHarmony = [0,0,0,0,1,0,2,2,0,0,0,0,1,0,2,0];
const audioHolidayStations = [
  {transpose:0, melody:.096, sleigh:.019, offbeats:true},
  {transpose:2, melody:.092, sleigh:.017, offbeats:true},
  {transpose:5, melody:.088, sleigh:.018, offbeats:false},
  {transpose:7, melody:.086, sleigh:.016, offbeats:true}
];
const audioHolidayBeat = 60 / 108;
const audioHolidayCycleBeats = 32;
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
  function audioTone(audioMidi, audioStart, audioDuration, audioStrength, audioKind = 'bell', audioRatio = 1) {
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
      audioOscillator.frequency.setValueAtTime(audioHolidayFrequency(audioMidi) * audioRatio, audioStart);
      audioGain.gain.setValueAtTime(0, audioStart);
      audioGain.gain.linearRampToValueAtTime(audioStrength, audioStart + (audioKind === 'harmony' ? .035 : audioKind === 'sleigh' || audioKind === 'bass' ? .004 : .008));
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
  function audioBell(audioMidi, audioStart, audioDuration, audioStrength = .096) {
    audioTone(audioMidi, audioStart, audioDuration, audioStrength);
    // A short, quiet upper partial gives the melody a clear little bell strike.
    audioTone(audioMidi + 12, audioStart, Math.min(.5, audioDuration), audioStrength * .14, 'partial');
  }
  function audioSleigh(audioStart, audioStrength) {
    // Four inharmonic, high sine partials make a brief sleigh-bell jingle.
    // Their combined peak is below .044, even at the strongest accent.
    // Every partial uses the same tracked/faded/stopped voice lifecycle.
    [[1,1,.11],[1.414,.62,.085],[1.937,.44,.07],[2.637,.25,.055]].forEach(([audioRatio, audioLevel, audioLength]) => {
      audioTone(98, audioStart, audioLength, audioStrength * audioLevel, 'sleigh', audioRatio);
    });
  }
  function audioPhrase() {
    const audioResult = [], audioStation = audioHolidayStations[audioScene.station];
    let audioBeat = 0;
    for (const [audioMidi, audioLength] of audioHolidayChorus) {
      audioResult.push({beat:audioBeat, midi:audioMidi + audioStation.transpose,
        length:Math.min(1.28, audioLength * audioHolidayBeat * .9 + .10),
        strength:audioStation.melody, kind:'bell'});
      audioBeat += audioLength;
    }
    audioHolidayHarmony.forEach((audioChord, audioIndex) => {
      const audioBar = audioIndex * 2;
      for (const audioOffset of [0,1]) {
        audioResult.push({beat:audioBar + audioOffset,
          midi:audioHolidayRoots[audioChord] + audioStation.transpose + (audioOffset ? 7 : 0),
          length:.24, strength:.055, kind:'bass'});
        for (const audioMidi of audioHolidayChords[audioChord]) {
          audioResult.push({beat:audioBar + audioOffset + .5, midi:audioMidi + audioStation.transpose,
            length:.36, strength:.018, kind:'harmony'});
        }
      }
    });
    for (let audioBeat = 0; audioBeat < audioHolidayCycleBeats; audioBeat += .5) {
      if (audioBeat % 1 && !audioStation.offbeats) continue;
      audioResult.push({beat:audioBeat, strength:audioStation.sleigh * (audioBeat % 1 ? .64 : 1), kind:'sleigh'});
    }
    return audioResult.sort((audioA, audioB) => audioA.beat - audioB.beat);
  }
  function audioSchedule() {
    audioTimer = null;
    if (!audioPermitted()) { audioHalt(); audioEmit(); return; }
    try {
      const audioNow = audioContext.currentTime;
      // A sleeping/background tab never catches up by playing a burst of notes.
      if (audioOrigin + (audioCycle * audioHolidayCycleBeats + audioEvents[audioEventIndex].beat) * audioHolidayBeat < audioNow - .2) {
        audioHalt();
        audioOrigin = audioNow + .045;
        audioCycle = 0;
        audioEventIndex = 0;
      }
      audioPlaying = true;
      while (audioOrigin + (audioCycle * audioHolidayCycleBeats + audioEvents[audioEventIndex].beat) * audioHolidayBeat <= audioNow + .18) {
        const audioEvent = audioEvents[audioEventIndex];
        const audioStart = Math.max(audioNow + .005, audioOrigin + (audioCycle * audioHolidayCycleBeats + audioEvent.beat) * audioHolidayBeat);
        if (audioEvent.kind === 'sleigh') audioSleigh(audioStart, audioEvent.strength);
        else if (audioEvent.kind === 'bell') audioBell(audioEvent.midi, audioStart, audioEvent.length, audioEvent.strength);
        else audioTone(audioEvent.midi, audioStart, audioEvent.length, audioEvent.strength, audioEvent.kind);
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
          audioFilter.frequency.setValueAtTime(7500, audioContext.currentTime);
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
        const audioNotes = (audioStationComplete ? [72,76,79,84] : [79,84]).map(audioMidi => audioMidi + audioHolidayStations[audioScene.station].transpose);
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
  const audioStatus = audioCurrentState.unavailable ? 'Музыка недоступна в этом браузере.' : audioCurrentState.error === 'blocked' ? 'Не удалось включить музыку. Попробуйте ещё раз.' : audioCurrentState.enabled ? audioCurrentState.volume===0 ? 'Музыка включена · громкость 0%' : audioCurrentState.ducked ? 'Музыка тише, пока звучит голос.' : audioCurrentState.playing ? 'Новогодние бубенцы · Jingle Bells' : 'Музыка на паузе' : 'Музыка выключена';
  return `<div class="holiday-audio" role="group" aria-label="Музыка">
    <button type="button" class="music-toggle" data-action="music-toggle" aria-pressed="${audioChecked}"${audioDisabled}>${audioChecked ? 'Выключить музыку' : 'Включить музыку'}</button>
    <label for="${audioControlId}">Громкость музыки</label>
    <input id="${audioControlId}" name="music-volume" type="range" min="0" max="100" step="1" value="${Math.round(audioHolidayClamp(audioCurrentState.volume, .28) * 100)}" aria-label="Громкость музыки"${audioDisabled}>
    <span class="music-status" role="status">${audioHolidayEscape(audioStatus)}</span>
  </div>`;
}
