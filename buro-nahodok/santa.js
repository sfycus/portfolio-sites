const santaEscape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const santaName=value=>[...String(value??'').replace(/[\u0000-\u001f\u007f]/g,'').replace(/\s+/gu,' ').trim()].slice(0,24).join('')||'Дорогой друг';
const santaCount=value=>Number.isInteger(value)?Math.max(1,Math.min(8,value)):4;
const santaTasks=count=>count===1?'поручение':count<5?'поручения':'поручений';
const santaReady='Нажми «Смотреть поздравление», чтобы послушать новогоднее письмо.';
const santaRecordedName=({name,postal=true}={})=>postal!==false&&santaName(name).toLocaleLowerCase('ru')==='юля';
const santaMaleNames=new Set(['yuri','yury','pavel','dmitri','dmitry','dmitriy','alexey','alexei','alexej','mikhail','maxim','nikolai','nikolay','alexander','aleksandr','artem','artyom','boris','roman','sergey','sergei','юрий','павел','дмитрий','алексей','михаил','максим','николай','александр','артём','артем','борис','роман','сергей']);
const santaFemaleNames=new Set(['female','woman','женский','женская','женщина','milena','anna','irina','katya','svetlana','tatyana','natalya','alena','elena','oksana','ekaterina','alexandra','милена','анна','ирина','катя','светлана','татьяна','наталья','алёна','алена','елена','оксана','екатерина','александра']);
function santaMaleVoice(voice){const names=String(voice?.name||'').normalize('NFC').toLowerCase().split(/[^\p{L}]+/u);return names.some(name=>santaMaleNames.has(name))&&!names.some(name=>santaFemaleNames.has(name));}
function santaPhrases({name,completedCount=4,postal=true}={}){
  const child=santaName(name),count=santaCount(completedCount);
  return [
    {text:`Хо-хо-хо!.. Здравствуй, ${child}! Это я, Дед Мороз.`,pause:650},
    ...(postal?[{text:'Снегирь рассказал мне о твоём новогоднем приключении.',pause:400},{text:'Все четыре части адреса снова вместе!',pause:550}]:[{text:'Все загадки разгаданы. Это отличная работа!',pause:450}]),
    {text:santaRecordedName({name:child,postal})?'Вот это работа!':`Позади ${count} ${santaTasks(count)}. Вот это работа!`,pause:400},
    {text:'Желаю тебе чудес, верных друзей и радостных открытий.',pause:650},
    {text:`С Новым годом, ${child}!`,pause:0},
  ];
}

/** The greeting uses bundled audio or a device voice, without an external generation request. */
export function santaMessage({name,completedCount=4,postal=true}={}){
  return santaPhrases({name,completedCount,postal}).map(phrase=>phrase.text).join(' ');
}

export function renderSantaFinale({name,completedCount=4,postal=true,videoUrl='./assets/ded-moroz.mp4',posterUrl='./assets/ded-moroz-poster.jpg',audioUrl='./assets/ded-moroz-yulia.mp3'}={}){
  const child=santaName(name),message=santaMessage({name:child,completedCount,postal});
  const recorded=santaRecordedName({name:child,postal});
  const audio=recorded?`<audio data-santa-audio preload="none"><source src="${santaEscape(audioUrl)}" type="audio/mpeg"></audio>`:'';
  const note=recorded?'Для имени Юля подготовлена отдельная мужская озвучка поздравления.':'Голос зависит от русских голосов, установленных на устройстве. Если подходящего голоса нет, поздравление можно прочитать вместе.';
  return `<section class="santa-finale" data-santa-finale aria-label="Поздравление Деда Мороза"><span class="eyebrow red">Особое новогоднее письмо</span><h2>${santaEscape(child)}, с Новым годом!</h2><p class="santa-copy">Для тебя приготовлено анимированное поздравление Деда Мороза. Нажми кнопку, чтобы посмотреть и послушать его.</p><div class="santa-stage"><video data-santa-video muted loop playsinline preload="none" poster="${santaEscape(posterUrl)}" aria-label="Анимированный Дед Мороз у новогодней ёлки"><source src="${santaEscape(videoUrl)}" type="video/mp4">Поздравление можно прочитать ниже.</video></div>${audio}<div class="santa-controls"><button type="button" class="button" data-action="santa-play">Смотреть поздравление</button><button type="button" class="text-button" data-action="santa-stop" disabled>Остановить</button><button type="button" class="text-button" data-action="santa-replay" disabled>Ещё раз</button></div><p class="santa-status" data-santa-status role="status" aria-live="polite">${santaReady}</p><details class="santa-transcript" open><summary>Текст поздравления</summary><p>${santaEscape(message)}</p></details><details class="santa-voice-note"><summary>Взрослым об озвучке</summary><p>${note}</p></details></section>`;
}

/** Construction is silent. Only play(), invoked by a visible button, starts media. */
export function createSantaPlayer({root,speech=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,onBeforePlay=()=>{},onChange=()=>{},timers}={}){
  const santaTimers=timers||{setTimeout:(...args)=>globalThis.setTimeout(...args),clearTimeout:id=>globalThis.clearTimeout(id)};
  const santaDocument=root?.ownerDocument||globalThis.document;
  const santaWindow=santaDocument?.defaultView||globalThis;
  let santaVideo=null,santaVideoError=null,santaBound=false,santaDestroyed=false,santaTimer=null,santaPhraseTimer=null,santaSerial=0,santaUtterance=null,santaStarted=false;
  let santaAudio=null,santaAudioEnded=null,santaAudioError=null,santaPlaybackMode='none';
  let santaSettings={name:'Дорогой друг',completedCount:4,postal:true,active:false,motionEnabled:true};
  let santaSnapshot={playing:false,speaking:false,message:santaReady,voiceAvailable:false,name:santaSettings.name};
  let santaLastJSON=JSON.stringify(santaSnapshot);
  const state=()=>({...santaSnapshot});
  function santaControls(){
    if(santaDestroyed)return;
    const status=root?.querySelector?.('[data-santa-status]');if(status)status.textContent=santaSnapshot.message;
    for(const button of root?.querySelectorAll?.('[data-action="santa-play"]')||[])button.disabled=santaSnapshot.playing;
    for(const button of root?.querySelectorAll?.('[data-action="santa-stop"]')||[])button.disabled=!santaSnapshot.playing;
    for(const button of root?.querySelectorAll?.('[data-action="santa-replay"]')||[])button.disabled=!santaStarted;
  }
  function santaEmit(){
    santaControls();const serialized=JSON.stringify(santaSnapshot);if(serialized===santaLastJSON)return;
    santaLastJSON=serialized;try{onChange(state());}catch{/* A host status update must not start or duplicate playback. */}
  }
  function santaLocalVoices(){
    let voices=[];try{voices=typeof speech?.getVoices==='function'?speech.getVoices():[];}catch{}
    return Array.isArray(voices)?voices.filter(voice=>voice?.localService===true&&/^ru(?:[-_]|$)/i.test(voice.lang||'')):[];
  }
  const santaPickVoice=local=>local.find(santaMaleVoice)||local[0]||null;
  const santaVoice=()=>santaPickVoice(santaLocalVoices());
  const santaHasRecording=()=>santaRecordedName(santaSettings)&&!!santaAudio&&santaAudio.isConnected!==false&&typeof santaAudio.play==='function';
  function santaUnbindAudio(){santaAudio?.removeEventListener?.('ended',santaAudioEnded);santaAudio?.removeEventListener?.('error',santaAudioError);santaAudioEnded=null;santaAudioError=null;}
  function santaPauseVideo(video=santaVideo){
    try{video?.pause?.();}catch{}
    try{if(video)video.currentTime=0;}catch{/* An unloaded video may not expose a seekable timeline yet. */}
  }
  function santaHalt(message){
    const hadWork=santaSnapshot.playing||santaSnapshot.speaking||santaUtterance!==null||santaTimer!==null||santaPhraseTimer!==null;
    santaSerial++;
    if(santaTimer!==null)santaTimers.clearTimeout(santaTimer);santaTimer=null;
    if(santaPhraseTimer!==null)santaTimers.clearTimeout(santaPhraseTimer);santaPhraseTimer=null;
    const ownedSpeech=santaUtterance!==null||(santaSnapshot.speaking&&santaPlaybackMode==='device');santaUtterance=null;
    if(ownedSpeech)try{speech?.cancel?.();}catch{}
    santaUnbindAudio();santaPauseVideo(santaAudio);santaPlaybackMode='none';
    santaPauseVideo();santaSnapshot={...santaSnapshot,playing:false,speaking:false,...(message&&hadWork?{message}:{})};santaEmit();
  }
  function stop(){santaHalt('Поздравление остановлено. Нажми «Ещё раз», чтобы начать сначала.');}
  function santaLifecycle(){if(santaSnapshot.playing||santaSnapshot.speaking)stop();}
  function santaVisibility(){if(santaDocument?.hidden)santaLifecycle();}
  function santaVoicesChanged(){const available=santaHasRecording()||(!!santaVoice()&&typeof Utterance==='function'&&typeof speech?.speak==='function');if(available!==santaSnapshot.voiceAvailable){santaSnapshot={...santaSnapshot,voiceAvailable:available};santaEmit();}}
  function santaBind(){
    if(santaBound)return;santaBound=true;
    santaDocument?.addEventListener?.('visibilitychange',santaVisibility);
    santaWindow?.addEventListener?.('pagehide',santaLifecycle);santaWindow?.addEventListener?.('blur',santaLifecycle);
    speech?.addEventListener?.('voiceschanged',santaVoicesChanged);
  }
  function santaWatchdog(serial,delay){
    if(santaTimer!==null)santaTimers.clearTimeout(santaTimer);
    santaTimer=santaTimers.setTimeout(()=>{if(serial===santaSerial)santaHalt(santaSnapshot.speaking?'Поздравление остановлено. Полный текст можно прочитать ниже.':'Поздравление закончено. С Новым годом! Можно посмотреть ещё раз.');},delay);
  }
  function santaSpeakPhrase(context,index){
    if(context.serial!==santaSerial||!santaSnapshot.playing||!santaSnapshot.speaking)return false;
    if(santaDocument?.hidden){stop();return false;}
    try{
      const utterance=new Utterance(context.phrases[index].text);santaUtterance=utterance;
      utterance.voice=context.voice;utterance.lang=context.voice.lang;utterance.rate=.78;utterance.pitch=context.pitch;
      utterance.onend=()=>{
        if(context.serial!==santaSerial||santaUtterance!==utterance)return;
        santaUtterance=null;
        if(index+1===context.phrases.length){santaHalt('Поздравление закончено. С Новым годом! Можно послушать ещё раз.');return;}
        santaPhraseTimer=santaTimers.setTimeout(()=>{if(context.serial!==santaSerial)return;santaPhraseTimer=null;santaSpeakPhrase(context,index+1);},context.phrases[index].pause);
      };
      utterance.onerror=event=>{if(context.serial===santaSerial&&santaUtterance===utterance)santaHalt(['canceled','interrupted'].includes(event?.error)?'Поздравление остановлено. Его можно включить ещё раз.':'Голос устройства не смог прочитать поздравление. Текст остаётся ниже.');};
      speech.speak(utterance);return true;
    }catch{
      const failed=santaUtterance;santaUtterance=null;
      if(failed){failed.onend=null;failed.onerror=null;try{speech?.cancel?.();}catch{}}
      if(santaPhraseTimer!==null)santaTimers.clearTimeout(santaPhraseTimer);santaPhraseTimer=null;
      santaSnapshot={...santaSnapshot,speaking:false,voiceAvailable:false,message:'Голос устройства недоступен. Посмотри анимацию и прочитай поздравление ниже.'};
      if(!context.canMove){santaHalt('Не удалось включить голос устройства. Текст поздравления остаётся ниже.');return false;}
      if(santaTimer!==null)santaWatchdog(context.serial,24000);santaEmit();return false;
    }
  }
  function sync(options={}){
    if(santaDestroyed)return state();santaBind();
    const next={name:santaName(options.name??santaSettings.name),completedCount:santaCount(options.completedCount??santaSettings.completedCount),postal:options.postal??santaSettings.postal,active:options.active===true,motionEnabled:options.motionEnabled!==false};
    const video=root?.querySelector?.('[data-santa-video]')||null;
    const audio=santaRecordedName(next)?root?.querySelector?.('[data-santa-audio]')||null:null;
    const changed=video!==santaVideo||audio!==santaAudio||next.name!==santaSettings.name||next.completedCount!==santaSettings.completedCount||next.postal!==santaSettings.postal||next.motionEnabled!==santaSettings.motionEnabled;
    if(changed||!next.active||santaDocument?.hidden||video?.isConnected===false)santaHalt();
    if(audio!==santaAudio){santaUnbindAudio();santaAudio=audio;santaStarted=false;if(audio){audio.autoplay=false;audio.loop=false;audio.muted=false;audio.volume=1;}}
    if(video!==santaVideo){
      santaVideo?.removeEventListener?.('error',santaVideoError);santaVideo=video;santaStarted=false;
      if(video){
        video.muted=true;video.loop=true;video.playsInline=true;video.autoplay=false;
        santaVideoError=()=>{if(santaVideo===video&&santaSnapshot.playing)santaHalt('Не удалось открыть видеоряд. Текст поздравления остаётся ниже.');};
        video.addEventListener?.('error',santaVideoError);
      }else santaVideoError=null;
    }
    santaSettings=next;
    santaSnapshot={...santaSnapshot,name:next.name,voiceAvailable:santaHasRecording()||(!!santaVoice()&&typeof Utterance==='function'&&typeof speech?.speak==='function')};
    santaEmit();return state();
  }
  function play(){
    if(santaDestroyed||!santaSettings.active||santaDocument?.hidden||!santaVideo||santaVideo.isConnected===false)return Promise.resolve(false);
    santaHalt();const serial=++santaSerial,video=santaVideo;
    const localVoices=santaLocalVoices(),voice=santaPickVoice(localVoices),canSpeak=!!voice&&typeof Utterance==='function'&&typeof speech?.speak==='function';
    const canMove=santaSettings.motionEnabled&&typeof video.play==='function';santaStarted=true;
    if(santaHasRecording()){
      const audio=santaAudio;santaPlaybackMode='recorded';
      for(const [name,value] of Object.entries({'voice-name':'Anatoly','voice-locale':'ru-RU','voice-rate':'','voice-pitch':'','voice-mode':'recorded','local-voices':JSON.stringify(localVoices.map(item=>item.name||''))}))video.setAttribute?.('data-santa-'+name,value);
      santaSnapshot={...santaSnapshot,playing:true,speaking:true,voiceAvailable:true,message:'Дед Мороз поздравляет тебя. Можно остановить поздравление.'};
      try{onBeforePlay();}catch{santaHalt('Не удалось начать поздравление. Текст остаётся ниже.');return Promise.resolve(false);}
      if(serial!==santaSerial)return Promise.resolve(false);
      santaAudioEnded=()=>{if(serial===santaSerial&&santaAudio===audio&&audio.ended!==false)santaHalt('Поздравление закончено. С Новым годом! Можно послушать ещё раз.');};
      santaAudioError=()=>{if(serial===santaSerial&&santaAudio===audio)santaHalt('Не удалось включить именную озвучку. Попробуй ещё раз или прочитай поздравление ниже.');};
      audio.addEventListener?.('ended',santaAudioEnded);audio.addEventListener?.('error',santaAudioError);
      let audioRequest,videoRequest;
      try{audioRequest=audio.play();if(canMove)videoRequest=video.play();}catch{santaHalt('Не удалось включить именную озвучку. Попробуй ещё раз или прочитай поздравление ниже.');return Promise.resolve(false);}
      if(serial!==santaSerial)return Promise.resolve(false);
      santaWatchdog(serial,60000);santaEmit();
      return Promise.all([Promise.resolve(audioRequest),Promise.resolve(videoRequest)]).then(()=>serial===santaSerial&&santaSnapshot.playing,()=>{if(serial===santaSerial)santaHalt('Браузер не смог включить именное поздравление. Попробуй ещё раз или прочитай текст ниже.');return false;});
    }
    santaPlaybackMode=canSpeak?'device':'silent';
    const pitch=santaMaleVoice(voice) ? .58 : .55;
    for(const [name,value] of Object.entries({'voice-name':voice?.name||'','voice-locale':voice?.lang||'','voice-rate':canSpeak?'.78':'','voice-pitch':canSpeak?String(pitch):'','voice-mode':canSpeak?'device':'silent','local-voices':JSON.stringify(localVoices.map(item=>item.name||''))}))video.setAttribute?.('data-santa-'+name,value);
    if(!canSpeak&&!canMove){santaSnapshot={...santaSnapshot,voiceAvailable:false,message:'Анимация отключена, а русский голос устройства недоступен. Прочитай именное поздравление ниже.'};santaEmit();return Promise.resolve(false);}
    santaSnapshot={...santaSnapshot,playing:true,speaking:false,voiceAvailable:canSpeak,message:canSpeak?'Дед Мороз поздравляет тебя. Можно остановить поздравление.':'Русский голос устройства недоступен. Посмотри анимацию и прочитай именное поздравление ниже.'};
    try{onBeforePlay();}catch{santaHalt('Не удалось начать поздравление. Текст остаётся ниже.');return Promise.resolve(false);}
    if(serial!==santaSerial)return Promise.resolve(false);
    let videoRequest;
    try{if(canMove)videoRequest=video.play();}catch{santaHalt('Не удалось включить видеоряд. Попробуй ещё раз или прочитай поздравление ниже.');return Promise.resolve(false);}
    if(canSpeak){
      santaSnapshot={...santaSnapshot,speaking:true};santaSpeakPhrase({serial,voice,pitch,canMove,phrases:santaPhrases(santaSettings)},0);
    }
    if(serial!==santaSerial)return Promise.resolve(false);
    santaWatchdog(serial,santaSnapshot.speaking?60000:24000);
    santaEmit();
    return Promise.resolve(videoRequest).then(()=>serial===santaSerial&&santaSnapshot.playing,()=>{if(serial===santaSerial)santaHalt('Браузер не смог включить видео. Попробуй ещё раз или прочитай поздравление ниже.');return false;});
  }
  function destroy(){
    if(santaDestroyed)return;santaHalt();santaDestroyed=true;
    santaVideo?.removeEventListener?.('error',santaVideoError);
    santaDocument?.removeEventListener?.('visibilitychange',santaVisibility);
    santaWindow?.removeEventListener?.('pagehide',santaLifecycle);santaWindow?.removeEventListener?.('blur',santaLifecycle);
    speech?.removeEventListener?.('voiceschanged',santaVoicesChanged);santaVideo=null;
    santaUnbindAudio();santaAudio=null;
  }
  return {sync,play,stop,destroy,state};
}
