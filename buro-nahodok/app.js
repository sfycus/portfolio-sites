import { LOCATIONS, AGE_GROUPS, THEMES, validateConfig, encodeConfig, decodeConfig, createQuest } from './engine.js?v=1.15.0-beta.1';
import { cardCodes, freshProgress, readProgress, answerMission, confirmCard, continueScreenQuest, attemptMission, solveWithHelp, isHintOpen, toggleHint, puzzleInput, setPuzzleInput, undoPuzzleInput, attemptTask } from './flow.js?v=1.15.0-beta.1';
import { createHolidayAudio, holidayAudioControls } from './audio.js?v=1.15.0-beta.1';
import { objectKind, objectState, renderObjectPuzzle, applyObjectAction, createObjectDrag } from './objects.js?v=1.15.0-beta.1';
import { createQuestMotion } from './motion.js?v=1.15.0-beta.1';
import { holidayStage, holidayWorld, holidayWorkbench, stationReward } from './stage.js?v=1.15.0-beta.1';

const app = document.querySelector('#app');
document.body.classList.add('winter-ui');
const printRoot = document.querySelector('#print-root');
const RELEASE = { version: '1.15.0-beta.1', feedbackUrl: 'https://t.me/sfycus' };
const IS_PURCHASED = document.body.dataset.sales === 'full';
const IS_SHARED = document.body.dataset.shared === 'true';
const DRAFT_KEY = 'bureau:draft:v1';
const LAST_GAME_KEY = 'bureau:last-game:v1';
const FORMAT_KEY = 'bureau:format:v1';
let storageAvailable = true;
const storageMemory = new Map();
const storage = {
  get(key) {
    if (storageMemory.has(key)) return JSON.parse(storageMemory.get(key));
    try {
      const saved = localStorage.getItem(key);
      if (saved === null) return null;
      const value = JSON.parse(saved);
      storageMemory.set(key, saved);
      return value;
    } catch { return null; }
  },
  set(key, value) {
    const saved = JSON.stringify(value);
    storageMemory.set(key, saved);
    try { localStorage.setItem(key, saved); } catch { storageAvailable = false; }
  }
};
try { localStorage.setItem('bureau:check', '1'); localStorage.removeItem('bureau:check'); } catch { storageAvailable = false; }
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const place = id => LOCATIONS.find(item => item.id === id);
const isLocalAddress = () => ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
const pluralWord = (n, one, few, many) => n % 100 >= 11 && n % 100 <= 14 ? many : n % 10 === 1 ? one : n % 10 >= 2 && n % 10 <= 4 ? few : many;
const randomSeed = () => { const n = new Uint32Array(1); if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(n); else n[0] = Date.now(); return n[0] % 2147483646 + 1; };
const isScreenMode = config => config.mode === 'screen';
const DEFAULT_ROUTE = ['books','sofa','toys','desk','bed','wardrobe','shoes','mirror'];
function savedFormat() {
  const saved=storage.get(FORMAT_KEY);
  if(!saved||saved.v!==1||!AGE_GROUPS.some(g=>g.id===saved.age)||!THEMES.some(t=>t.id===saved.theme)||!['screen','cards'].includes(saved.mode)||!Number.isInteger(saved.count)||saved.count<4||saved.count>8)return null;
  return {v:1,age:saved.age,theme:saved.theme,mode:saved.mode,count:saved.count};
}
const currentFormat = () => ({v:1,age:draft.age,theme:draft.theme,mode:isScreenMode(draft)?'screen':'cards',count:draft.route.length});
const formatDescription = format => `${AGE_GROUPS.find(g=>g.id===format.age).title} · ${format.mode==='screen'?'в браузере':'с карточками'} · ${format.count} ${pluralWord(format.count,'загадка','загадки','загадок')} · ${THEMES.find(t=>t.id===format.theme).title}`;
function initialDraft() {
  const format=savedFormat()||{age:'8-10',theme:'winter',mode:'screen',count:6};
  return {v:1,edition:3,name:'',age:format.age,theme:format.theme,mode:format.mode,route:DEFAULT_ROUTE.slice(0,format.count),seed:randomSeed(),giftNote:'',step:1};
}
function loadDraft() {
  const saved = storage.get(DRAFT_KEY), fallback = initialDraft();
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return fallback;
  try {
    // Recover fields independently: an unfinished note must not erase the route or puzzle seed.
    const text=(value,max)=>typeof value==='string'?[...value.normalize('NFC').replace(/[\p{C}\p{Zl}\p{Zp}]/gu,'').trim()].slice(0,max).join(''):'';
    const name=text(saved.name,24);
    const config = validateConfig({v:1,name:name||'Исследователь',giftNote:text(saved.giftNote,120),
      age:AGE_GROUPS.some(g=>g.id===saved.age)?saved.age:fallback.age,
      theme:THEMES.some(t=>t.id===saved.theme)?saved.theme:fallback.theme,
      mode:saved.mode==='screen'?'screen':'cards',
      edition:saved.edition===undefined?undefined:[2,3].includes(saved.edition)?saved.edition:3,
      seed:Number.isSafeInteger(saved.seed)&&saved.seed>=1&&saved.seed<=2147483647?saved.seed:fallback.seed,
      route:['books','sofa','desk','bed']});
    let pendingRoute = Array.isArray(saved.route) && saved.route.length <= 8 && new Set(saved.route).size === saved.route.length && saved.route.every(id=>typeof id==='string' && place(id)) ? [...saved.route] : [...fallback.route];
    if(config.mode==='screen'&&pendingRoute.length<4)pendingRoute=[...fallback.route];
    const screenOrder=Array.isArray(saved.screenOrder)&&saved.screenOrder.length===LOCATIONS.length&&new Set(saved.screenOrder).size===LOCATIONS.length&&saved.screenOrder.every(id=>typeof id==='string'&&place(id))?[...saved.screenOrder]:undefined;
    const restoredStep = [1,2,3].includes(saved.step) ? saved.step : 1;
    return {...config,name,route:pendingRoute,...(screenOrder?{screenOrder}:{}),step:name ? Math.min(restoredStep,pendingRoute.length>=4?3:2) : 1};
  }
  catch { return {...fallback, name:typeof saved.name === 'string' ? saved.name.slice(0,24).replace(/[\p{C}]/gu,'') : ''}; }
}
let draft = loadDraft();
let step = draft.step;
let quest = null;
let progress = null;
let isDemo = false;
let ready = false;
let toastTimer;
let lastFocus = null;
let largeReading=storage.get('bureau:large-reading:v1')===true;
function applyReadingSize(){document.body.classList[largeReading?'add':'remove']('large-reading');}
applyReadingSize();
function saveDraft() { draft.step = step; storage.set(DRAFT_KEY, draft); }
function notify(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('visible'),3500); }
function svg(content, cls='') { return `<svg class="${cls}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`; }
const drawings = {
  books:'<path d="M8 11h8v29H8zm10-4h8v33h-8zm10 6l7-2 8 27-7 2zM8 18h8m2-3h8M8 34h8m2 0h8"/>',
  sofa:'<path d="M10 24V14a4 4 0 014-4h20a4 4 0 014 4v10M9 23H6v15h36V23h-4a4 4 0 00-4 4v4H14v-4a4 4 0 00-5-4zM12 38v4m24-4v4M24 12v17"/>',
  wardrobe:'<path d="M10 7h28v35H10zM24 7v35m-5-20v6m10-6v6M8 42h32"/>',
  shoes:'<path d="M7 24l11 3 4 7h19v7H6v-9zM10 12l10 3 3 7h17v7H25m-5 3l4-3M12 23l3-5"/>',
  desk:'<path d="M5 22h38v5H5zM10 27v15m28-15v15M13 9h11v13H13zm17 1l6 12m-4-13l5 12"/>',
  bed:'<path d="M7 13v28m34-20v20M7 21h29a5 5 0 015 5v10H7M12 15h10v7H12zM8 36h32"/>',
  toys:'<path d="M8 24h32v18H8zM6 19h36v5H6zM19 29h10M14 19V9l8 3v7m4 0l2-12 9 3-2 9"/>',
  mirror:'<path d="M24 5c-10 0-15 7-15 17s5 17 15 17 15-7 15-17S34 5 24 5zM17 15l9-5M17 23l14-8M24 39v4m-9 0h18"/>',
  drawer:'<path d="M10 7h28v35H10zM10 24h28m-19-9h10m-10 17h10M8 42h32"/>',
  blanket:'<path d="M9 8h30v31H9zM9 16h30M9 31h30M17 8v31M31 8v31m-22 0v5m7-5v5m8-5v5m8-5v5m7-5v5"/>',
  screen:'<rect x="5" y="7" width="38" height="27" rx="3"/><path d="M17 42h14m-7-8v8M11 14h26M11 21h16"/>',
  gift:'<path d="M8 20h32v8H8zM11 28v15h26V28M24 20v23M24 20C9 20 9 6 16 7c7 0 8 13 8 13zm0 0c15 0 15-14 8-13-7 0-8 13-8 13z"/>',
  up:'<path d="M12 29l12-12 12 12"/>', down:'<path d="M12 19l12 12 12-12"/>',
};
const icon = (id, cls='') => svg(drawings[id] || drawings.gift, cls);
const brand = () => `<span class="brand-symbol">${svg('<path d="M6 10l12-4 13 5 11-4v31l-11 4-13-5-12 4zM18 6v31m13-26v31M21 20l7 9m0-9l-7 9"/>')}</span><span class="brand-name">Бюро находок<span class="brand-sub">новогодняя почта</span></span>`;
function shell(content, mode='home') {
  objectDrag.cancel();questMotion.setActive(false);questAudio?.setScene({active:false});
  document.body.dataset.screen=mode;
  app.innerHTML=`${!storageAvailable ? '<div class="storage-notice">Сохранение доступно только в этой вкладке. Не закрывайте и не обновляйте вкладку.</div>' : ''}<div class="wrap"><header class="header"><button class="brand" data-action="home" aria-label="Бюро находок, на главную">${brand()}</button><div class="header-right"><span class="quiet beta-label">${IS_PURCHASED?'Полная версия':'Открытый тест · бесплатно'}</span>${IS_PURCHASED&&!IS_SHARED&&location.protocol!=='file:'?'<a class="text-button" href="/access">Моя покупка</a>':''}<button class="text-button" data-action="${mode==='home'?'create':'home'}">${mode==='home'?(draft.name?'Продолжить подготовку':'Собрать квест'):'На главную'}</button></div></header>${content}<footer class="footer"><span>Бюро находок · новогодние приключения дома</span><div class="footer-links">${RELEASE.feedbackUrl?`<a href="${escape(RELEASE.feedbackUrl)}" target="_blank" rel="noopener noreferrer">Оставить отзыв</a>`:'<button class="footer-button" data-action="beta-info">Об открытом тесте</button>'}<button class="footer-button" data-action="data-info">Как хранятся данные</button></div></footer></div>`;
}
function mapArt() {
  return `<figure class="holiday-art"><img class="holiday-photo" src="./assets/christmas-room.jpg" width="3000" height="2000" alt="Настоящая ёлка с золотыми огнями и подарками в уютной комнате" fetchpriority="high"><figcaption class="photo-caption">Здесь начинается маленькое чудо</figcaption><div class="holiday-envelope" aria-hidden="true"><span>Секретная новогодняя почта</span><b>Кому: тому,<br>кто ждёт чудес</b><i>Открыть перед праздником</i><span class="envelope-stamp">✦</span></div><span class="holiday-seal" aria-hidden="true">Подарок<br>где-то<br>рядом!</span></figure>`;
}
function resumableDraft() {
  for(const config of [storage.get(LAST_GAME_KEY),draft]) {
    try { const q=createQuest(config); const saved=readProgress(storage.get(`bureau:progress:v1:${q.id}`),q.missions.length); if(!['intro','done'].includes(saved.phase))return {quest:q,progress:saved}; } catch {}
  }
  return null;
}
function renderHome() {
  quest=null;
  const resume=resumableDraft();
  shell(`<main>${resume?`<section class="resume-banner" aria-label="Начатая игра"><div><b>${escape(resume.quest.config.name)}, игра уже начата</b><p>Можно продолжить с сохранённого места.</p></div><button class="button small" data-action="resume-home">Продолжить игру</button></section>`:''}<section class="hero"><div class="hero-copy"><span class="eyebrow red"><span aria-hidden="true">✦</span> ${IS_PURCHASED?'Новогодний квест · полная версия':'Новогодний квест · бесплатно'}</span><h1>Спрячьте подарок.<br><em>Добавьте чудо.</em></h1><p class="lead">Ребёнок решает загадки в браузере и находит спрятанный вами подарок.</p><p class="hero-description">Играйте целиком на экране или добавьте поиск бумажных карточек по дому. Формат выбираете вы — принтер не обязателен.</p><div class="actions"><button class="button" data-action="create">${draft.name?'Продолжить подготовку':'Создать игру'}</button><button class="text-button" data-action="demo">Попробовать без настройки</button></div><div class="hero-facts"><span>5–13 лет</span><span>4–8 загадок</span><span>С карточками или без</span></div></div>${mapArt()}</section><section class="how" aria-label="Как это работает"><div class="how-intro"><span class="eyebrow">Всё по шагам</span><h2>От настроек<br> до сюрприза</h2></div><div class="how-item"><span class="step-mark">1</span><div><h3>Выберите формат</h3><p>Только загадки в браузере — или поиск карточек с кодами по дому.</p></div></div><div class="how-item"><span class="step-mark">2</span><div><h3>Спрячьте подарок</h3><p>Приложение покажет, что подготовить именно для вашей игры.</p></div></div><div class="how-item"><span class="step-mark">3</span><div><h3>Нажмите «Запустить»</h3><p>Передайте ребёнку устройство. В игре есть подсказки, помощь и пауза.</p></div></div></section><section class="bottom-band"><div class="faq-intro"><span class="eyebrow red">Перед первым чудом</span><h2>Вопросы<br> из родительского<br> <em>чата</em></h2><img src="./assets/christmas-details.jpg" width="3000" height="4491" alt="Красные подарочные коробки и золотые ёлочные шары" loading="lazy"></div><div class="faq"><details><summary>Можно совсем без карточек и принтера?</summary><p>Да. Выберите «В браузере»: ребёнок будет решать загадки на экране. Бумажные карточки и их коды не нужны. Только в финале появится место, где вы спрятали подарок.</p></details><details><summary>А если хочется ходить по тайникам?</summary><p>Выберите «С карточками». Приложение подготовит коды и план: карточки нужно распечатать или написать от руки, затем разложить по выбранным местам. Последнее место — для подарка.</p></details><details><summary>Что нужно приготовить?</summary><p>Для игры в браузере — устройство и спрятанный подарок. Для варианта с карточками дополнительно понадобятся от 3 до 7 бумажных листков. Взрослый помогает читать и проверяет безопасность места.</p></details><details><summary>Как дать игру ребёнку на другом устройстве?</summary><p>В последнем шаге подготовки раскройте «Открыть на другом устройстве или сохранить». Там можно скачать готовый HTML-файл. На компьютере он открывается в браузере без интернета; работу такого файла на конкретном телефоне проверьте заранее. Локальная ссылка на этот компьютер для передачи не подходит.</p></details><details><summary>Если закрыть игру, всё пропадёт?</summary><p>${storageAvailable?'Прогресс сохраняется в этом браузере. Вернитесь по той же ссылке или нажмите «Продолжить игру» на главной.':'Сейчас сохранение доступно только в памяти вкладки. Не закрывайте и не обновляйте её до конца игры.'} На другом устройстве прогресс начинается заново.</p></details></div></section></main>`);
}
const wizard = () => `<nav class="wizard" aria-label="Этапы подготовки">${['Формат и возраст',isScreenMode(draft)?'Подарок':'Тайники','Запуск'].map((label,i)=>`<button data-action="step" data-step="${i+1}" class="${step===i+1?'current':''}" ${i+1>step?'disabled':''} ${step===i+1?'aria-current="step"':''}><span class="wizard-number">${i+1}</span>${label}</button>`).join('')}</nav>`;
function notebook() {
  const screen=isScreenMode(draft), count=draft.route.length;
  return `<aside class="notebook"><span class="eyebrow">Ваша игра</span><h2>${escape(draft.name || 'Для вашего ребёнка')}</h2><dl><div><dt>Формат</dt><dd>${screen?'В браузере':'С карточками'}</dd></div><div><dt>Возраст</dt><dd>${escape(AGE_GROUPS.find(g=>g.id===draft.age)?.title||'')}</dd></div><div><dt>Загадки</dt><dd>${count}</dd></div><div><dt>Бумажные карточки</dt><dd>${screen?'Не нужны':Math.max(0,count-1)+' шт.'}</dd></div></dl><div class="notebook-tip"><b>Как это будет</b><p>${screen?'Ребёнок решит загадки на экране. В финале игра подскажет, где вы спрятали подарок.':'Каждая загадка откроет тайник с бумажной карточкой. Её код откроет следующую загадку.'}</p></div><p>${step===3?'Передайте ребёнку уже запущенную игру: подготовка содержит место подарка и ответы.':'Все настройки можно изменить до запуска. Загадки подбираются по возрасту.'}</p></aside>`;
}
function settingsForm() {
  const screen=isScreenMode(draft), format=savedFormat();
  return `<form id="settings-form" novalidate>${format?`<div class="saved-format-note"><span><b>Формат для новых квестов</b>${escape(formatDescription(format))}</span><button type="button" class="text-button" data-action="forget-format">Забыть формат</button></div>`:''}
    <fieldset class="form-section mode-fieldset"><legend class="label">Как вы хотите играть?</legend><div class="mode-options">
      <label class="mode-label"><input type="radio" name="mode" value="screen" aria-label="В браузере, без карточек" ${screen?'checked':''}><span class="mode-box">${icon('screen','mode-icon')}<span class="mode-tag">Без печати</span><b>В браузере</b><small>Все загадки — на экране. Взрослому нужно только спрятать подарок.</small><span class="mode-selected" aria-hidden="true">${screen?'Выбрано':'Выбрать'}</span></span></label>
      <label class="mode-label"><input type="radio" name="mode" value="cards" aria-label="С бумажными карточками" ${screen?'':'checked'}><span class="mode-box">${icon('books','mode-icon')}<span class="mode-tag">С поиском по дому</span><b>С карточками</b><small>Ребёнок ищет бумажные карточки в тайниках и вводит их коды в игру.</small><span class="mode-selected" aria-hidden="true">${screen?'Выбрать':'Выбрано'}</span></span></label>
    </div><p class="mode-explanation">${screen?'Печатать карточки и вводить их коды не понадобится. Место подарка откроется после последней загадки.':'Карточки можно распечатать или переписать от руки. Их план появится перед запуском.'}</p></fieldset>
    <section class="form-section"><label class="label" for="child-name">Имя ребёнка</label><p class="label-note">Можно использовать домашнее прозвище.</p><input class="input" id="child-name" name="child-name" maxlength="24" autocomplete="off" value="${escape(draft.name)}" placeholder="Например, Саша" aria-describedby="name-error"><p id="name-error" class="field-error" role="alert"></p></section>
    <fieldset class="form-section simple-fieldset"><legend class="label">Сколько лет ребёнку?</legend><div class="segments">${AGE_GROUPS.map(g=>`<label class="radio-label"><input type="radio" name="age" value="${g.id}" ${draft.age===g.id?'checked':''}><span class="radio-box"><b>${g.title}</b><small>${g.id==='5-7'?'Читаем вместе':g.id==='8-10'?'Счёт и шифры':'Логика посложнее'}</small></span></label>`).join('')}</div></fieldset>
    <details class="extra-settings" id="extra-settings" ${draft.giftNote?'open':''}><summary>История и личная записка <span>Необязательно</span></summary><div class="extra-settings-body"><fieldset class="form-section simple-fieldset"><legend class="label">История</legend><div class="themes">${THEMES.map(t=>`<label class="theme-label"><input type="radio" name="theme" value="${t.id}" ${draft.theme===t.id?'checked':''}><span class="theme-box"><b>${escape(t.title)}</b><small>${escape(t.description)}</small></span></label>`).join('')}</div></fieldset><section class="form-section"><label class="label" for="gift-note">Записка в финале</label><input class="input" id="gift-note" name="gift-note" type="text" aria-describedby="note-error" maxlength="120" value="${escape(draft.giftNote)}" placeholder="Мы знали, что у тебя всё получится!"><p id="note-error" class="field-error" role="alert"></p><p class="label-note note-description">До 120 символов. Ребёнок увидит записку вместе с последним тайником.</p></section></div></details>
    <div class="form-bottom"><span class="save-note">${storageAvailable?'Настройки сохраняются автоматически':'Не закрывайте и не обновляйте вкладку'}</span><button type="submit" class="button">${screen?'Выбрать место подарка':'Выбрать тайники'}</button></div></form>`;
}
function setScreenRoute(giftId,count=draft.route.length) {
  const safeCount=Number.isInteger(count)&&count>=4&&count<=8?count:6;
  const gift=place(giftId)?giftId:'wardrobe';
  if(!draft.screenOrder)draft.screenOrder=[...new Set([...draft.route,...LOCATIONS.map(p=>p.id)])];
  const candidates=draft.screenOrder.filter(id=>id!==gift);
  draft.route=[...candidates.slice(0,safeCount-1),gift];
}
function formatPreference() {
  const saved=savedFormat(),matches=saved&&JSON.stringify(saved)===JSON.stringify(currentFormat());
  return `<section class="format-preference" aria-label="Формат для следующих игр"><div><h3>В следующий раз — быстрее</h3><p>Запомните возраст, историю, формат и число загадок. Имя, записка и место подарка в этот шаблон не входят.</p><p class="format-status" role="status">${matches?'Этот формат уже запомнен.':saved?'Для новых квестов сейчас сохранён другой формат.':'Новый квест можно будет начать с этих настроек.'}</p></div><div class="actions"><button class="button paper small" data-action="remember-format" ${matches?'disabled':''}>${matches?'Формат запомнен':saved?'Обновить формат':'Запомнить формат'}</button>${saved?'<button class="text-button" data-action="forget-format">Забыть формат</button>':''}</div></section>`;
}
function routeForm() {
  if(isScreenMode(draft)) {
    const gift=draft.route.at(-1), count=draft.route.length;
    const lengths=[...new Set([4,6,8,count])].sort((a,b)=>a-b);
    return `<section><h2 class="section-heading">Выберите один тайник</h2><p class="section-description">Спрячьте здесь подарок перед началом. Это место появится только после последней загадки.</p><div class="location-grid gift-grid">${LOCATIONS.map(p=>`<label class="location-label"><input type="radio" name="gift-location" value="${p.id}" aria-label="${escape(p.title)}" ${gift===p.id?'checked':''}><span class="location-box">${icon(p.id)}<b>${escape(p.title)}</b><span class="check" aria-hidden="true">${gift===p.id?'✓':''}</span></span></label>`).join('')}</div><div class="selected-gift-note"><b>${escape(place(gift).title)}</b><p>${escape(place(gift).safety)}</p></div><fieldset class="form-section simple-fieldset length-fieldset"><legend class="label">Какой длины будет квест?</legend><div class="segments length-options">${lengths.map(n=>`<label class="radio-label"><input type="radio" name="question-count" value="${n}" aria-label="${n} ${pluralWord(n,'загадка','загадки','загадок')}" ${count===n?'checked':''}><span class="radio-box"><b>${n===4?'Короткий':n===6?'Обычный':n===8?'Большой':'Ваш вариант'}</b><small>${n} ${pluralWord(n,'загадка','загадки','загадок')}</small></span></label>`).join('')}</div></fieldset><p class="browser-mode-note">${icon('screen','small-inline-icon')}Вся игра проходит на экране. Между загадками ничего искать и вводить не нужно.</p><p class="field-error" id="route-error" role="alert"></p><div class="form-bottom"><button class="text-button" data-action="step" data-step="1">Назад</button><button class="button" data-action="prepare">К запуску игры</button></div></section>`;
  }
  return `<section><h2 class="section-heading">Выберите от 4 до 8 мест</h2><p class="section-description">В каждом месте, кроме последнего, будет карточка с кодом. В последнем — подарок. Порядок можно изменить ниже.</p><div class="location-grid">${LOCATIONS.map(p=>`<label class="location-label"><input type="checkbox" name="location" value="${p.id}" ${draft.route.includes(p.id)?'checked':''}><span class="location-box">${icon(p.id)}<b>${escape(p.title)}</b><span class="check" aria-hidden="true">${draft.route.includes(p.id)?'✓':''}</span></span></label>`).join('')}</div><div class="notice">Выбирайте безопасные места, доступные ребёнку с пола. Не используйте горячие, острые и тяжёлые предметы.</div><h3 class="label route-list-title">Порядок поиска · ${draft.route.length} ${pluralWord(draft.route.length,'место','места','мест')}</h3><ol class="route-list">${draft.route.map((id,i)=>`<li class="route-row"><span class="route-order">${i+1}</span><span class="route-title">${escape(place(id).title)}<small>${i===draft.route.length-1?'Здесь будет подарок':`Карточка № ${i+1}`}</small></span><span class="order-buttons"><button class="icon-button" data-action="move" data-id="${id}" data-direction="-1" aria-label="Поднять тайник «${escape(place(id).title)}»" ${i===0?'disabled':''}>${icon('up')}</button><button class="icon-button" data-action="move" data-id="${id}" data-direction="1" aria-label="Опустить тайник «${escape(place(id).title)}»" ${i===draft.route.length-1?'disabled':''}>${icon('down')}</button></span></li>`).join('')}</ol><p class="field-error" id="route-error" role="alert"></p><div class="form-bottom"><button class="text-button" data-action="step" data-step="1">К настройкам</button><button class="button" data-action="prepare">Подготовить игру</button></div></section>`;
}
function prepareView() {
  const q=createQuest(draft), screen=isScreenMode(q.config), codes=screen?[]:cardCodes(q), gift=place(draft.route.at(-1));
  const prior=readProgress(storage.get(`bureau:progress:v1:${q.id}`),q.missions.length);
  const resume=!['intro','done'].includes(prior.phase);
  const readyText=screen?'Подарок спрятан в выбранном месте. Можно начинать.':'Карточки разложены, подарок спрятан. Все места безопасны, взрослый будет рядом.';
  const plan=screen?`<div class="prep-summary browser-prep">${icon('screen','prep-mode-icon')}<div><h2>Всё готово для игры в браузере</h2><p>${q.missions.length} ${pluralWord(q.missions.length,'загадка','загадки','загадок')} на экране · без бумажных карточек</p></div></div><h3 class="label">Спрячьте подарок в этом месте</h3><div class="gift-spot">${icon(gift.id,'location-symbol')}<div><b>${escape(gift.title)}</b><p>${escape(gift.safety)}</p><button class="edit-link" data-action="step" data-step="2">Выбрать другое место</button></div></div><ol class="launch-instructions"><li>Спрячьте подарок, пока ребёнок не видит.</li><li>Нажмите «Запустить игру» и передайте ребёнку устройство.</li><li>Помогайте читать при необходимости. Место подарка откроется в финале.</li></ol>`:`<div class="prep-summary"><span class="big">${q.missions.length-1}+1</span><div><h2>Карточки и подарок</h2><p>${q.missions.length-1} ${pluralWord(q.missions.length-1,'карточка','карточки','карточек')} в тайниках, подарок — в последнем месте.</p></div></div><div class="print-choice"><h3 class="label">Как подготовить карточки?</h3><p>Распечатайте готовый лист или напишите коды на бумаге.</p><div class="actions"><button class="button paper" data-action="print">Распечатать карточки</button><button class="text-button" data-action="handwrite">Переписать коды вручную</button></div></div><h3 class="label" tabindex="-1" id="cards-plan">Куда положить карточки</h3>${q.missions.slice(0,-1).map((m,i)=>`<div class="prep-row"><span class="route-order">${i+1}</span><div class="prep-place"><b>${escape(place(m.locationId).title)}</b><span>Карточка № ${i+1} · ${escape(place(m.locationId).safety)}</span></div><span class="code-ticket" aria-label="Код карточки ${i+1}: ${codes[i]}">${codes[i]}</span></div>`).join('')}<div class="prep-row final">${icon('gift','brand-symbol')}<div class="prep-place"><b>Подарок: ${escape(gift.title)}</b><span>Карточка здесь не нужна. ${escape(gift.safety)}</span></div></div><p class="privacy-note">Без принтера: напишите по одному коду на каждом из ${codes.length} листков и разложите по плану выше.</p><button class="edit-link" data-action="step" data-step="2">Изменить маршрут</button>`;
  return `<section>${draft.theme==='winter'&&draft.edition!==3?'<div class="notice">Доступно новое приключение «Дело о пропавшем адресе». Нажмите «Подобрать другие загадки», чтобы перейти на него. Подготовленные раньше карточки сохранят свой прежний маршрут.</div>':''}${plan}<div class="prep-tools"><button class="text-button" data-action="preview-question">Попробовать первую загадку</button><button class="text-button" data-action="shuffle-puzzles">Подобрать другие загадки</button><p>Проба не запускает квест и не меняет прогресс ребёнка.</p></div><div class="start-panel"><h3>${resume?'Продолжим с сохранённого места?':'Можно начинать?'}</h3>${resume?'<p>Прогресс этой игры сохранён. При продолжении решённые загадки повторять не придётся.</p>':''}<label class="ready-check"><input type="checkbox" id="ready-check" ${ready?'checked':''}><span>${readyText}</span></label><button class="button red-button start-game-button" data-action="play" ${ready?'':'disabled'}>${resume?'Продолжить игру':prior.phase==='done'?'Сыграть ещё раз':'Запустить игру'} · ${escape(draft.name)}</button><p class="ready-helper" id="ready-helper" ${ready?'hidden':''}>Сначала отметьте галочкой, что ${screen?'подарок спрятан':'карточки и подарок готовы'}.</p>${resume?'<button class="text-button restart-link" data-action="restart-request">Начать этот квест заново</button>':''}</div><details class="answer-key"><summary>Ответы к загадкам · только взрослому</summary><ol>${q.missions.map(m=>`<li><b>${escape(m.title)}:</b> ${escape(m.choices[m.answerIndex])}. ${escape(m.explanation)}</li>`).join('')}</ol></details><details class="transfer-section"><summary>Открыть на другом устройстве или сохранить</summary><div class="download-section"><p>Скачанный HTML-файл содержит готовую игру и фотографии. На компьютере его можно открыть в браузере без интернета.</p><div class="actions"><button class="button paper small" data-action="download">Скачать игру .html</button><button class="text-button" data-action="copy-link">Скопировать ссылку</button></div><p>${isLocalAddress()?'Ссылка с этого локального адреса работает только на этом компьютере при запущенном сервере. Для передачи используйте скачанный файл. На телефоне заранее проверьте, открывает ли его браузер.':'Ссылка работает у тех, кому доступен этот сайт. Для игры без доступа к сайту передайте HTML-файл; на телефоне заранее проверьте его открытие.'}</p><p class="privacy-note">Ссылка и файл содержат имя, место подарка и записку. Передавайте их только участникам игры.</p></div></details>${formatPreference()}<div class="prepare-back"><button class="text-button" data-action="step" data-step="1">Изменить формат игры</button></div></section>`;
}
function renderEditor(focusHeading=false) {
  const screen=isScreenMode(draft);
  const titles=['Как будем играть?',screen?'Где будет подарок?':'Выберите домашние тайники',screen?'Осталось спрятать подарок':'Подготовьте карточки и подарок'];
  const descriptions=['Выберите формат и возраст — загадки подстроятся под ребёнка.',screen?'Нужен только один тайник. Между загадками ребёнок остаётся у экрана.':'Загадки проведут ребёнка по выбранным местам в указанном порядке.',screen?'Проверьте место, спрячьте сюрприз и запускайте игру.':'Распечатайте карточки или перепишите коды, затем разложите их по плану.'];
  shell(`<main><div class="editor-head"><div><span class="eyebrow red">Для взрослого · шаг ${step} из 3</span><h1 tabindex="-1" id="editor-title">${titles[step-1]}</h1><p>${descriptions[step-1]}</p></div><div class="editor-tools"><button class="button paper small" data-action="new-quest">Новый квест</button></div></div>${wizard()}<div class="editor-grid"><div>${step===1?settingsForm():step===2?routeForm():prepareView()}</div>${notebook()}</div></main>`,'editor');
  if (focusHeading) document.querySelector('#editor-title')?.focus({preventScroll:true});
}
function progressKey(){return `bureau:${isDemo?'demo':'progress'}:v1:${quest.id}`;}
function saveProgress(){storage.set(progressKey(),progress);}
// HOLIDAY_RENDERER_START — also copied into the public four-puzzle sample at build time.
const winterEscape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function winterCourier(url='./assets/robin-postman.png'){return `<img class="courier-art" src="${winterEscape(url)}" width="384" height="384" alt="Снегирь-почтальон в красном шарфе с письмом">`;}
function winterDrawing(item){
  const colors={red:'#b52d42',blue:'#4268a3',gold:'#dcad44',green:'#2c735d',white:'#f9faf5'};
  const color=item.silhouette?'#263e54':colors[item.color]||'#b52d42',ink='#263e54',gold=item.silhouette?'#263e54':colors.gold;
  const pattern=item.pattern==='stripe'?'<path d="M31 45h38M30 58h40M34 71h32" stroke="#fff8e5" stroke-width="6"/>':item.pattern==='star'?'<path d="m50 40 4 9 10 1-8 7 2 10-8-5-8 5 2-10-8-7 10-1z" fill="#fff2c5"/>':'';
  if(item.kind==='symbols')return item.symbols.map((kind,i)=>`<g transform="translate(${i*32},22) scale(.34)">${winterDrawing({kind})}</g>`).join('');
  if(item.kind==='bird')return `<path d="m21 70-13 13 25-2" fill="#263e54"/><ellipse cx="51" cy="57" rx="31" ry="27" fill="#263e54"/><path d="M34 52c-4 34 40 42 45 8-9-15-26-19-45-8" fill="#b52d42"/><circle cx="63" cy="30" r="19" fill="#263e54"/><path d="m80 28 14 5-14 5" fill="#dcad44"/><circle cx="68" cy="27" r="3" fill="white"/><circle cx="69" cy="27" r="1.5" fill="#263e54"/><path d="m45 17 9-14 27 16z" fill="#b52d42"/><path d="m45 18 35 2" stroke="#fff8e5" stroke-width="7" stroke-linecap="round"/><circle cx="53" cy="4" r="5" fill="#fff8e5"/><path d="m36 51 19 13-20 3" fill="#47678a"/><path d="M42 82v8m16-8v8M36 92h11m5 0h11" stroke="#263e54" stroke-width="3" stroke-linecap="round"/>`;
  if(item.kind==='star')return `<path d="m50 12 11 25 27 3-20 19 6 28-24-14-24 14 6-28-20-19 27-3z" fill="${item.silhouette?color:gold}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
  if(item.kind==='moon')return `<path d="M63 16A35 35 0 1 0 80 72 34 34 0 0 1 63 16" fill="${gold}" stroke="${ink}" stroke-width="3"/>`;
  if(item.kind==='bell')return `<path d="M43 24v-5a7 7 0 0 1 14 0v5M26 70c11-11 6-36 24-36s13 25 24 36l4 6H22z" fill="${color}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M43 81a7 7 0 0 0 14 0" fill="${gold}" stroke="${ink}" stroke-width="3"/>${item.silhouette?'':'<path d="m40 45-4 18" stroke="#fff7e3" stroke-width="4" stroke-linecap="round"/>'}`;
  if(item.kind==='ball')return `<path d="M45 20v-6h10v6" fill="${gold}" stroke="${ink}" stroke-width="3"/><circle cx="50" cy="57" r="32" fill="${color}" stroke="${ink}" stroke-width="3"/>${pattern}`;
  if(item.kind==='mitten')return `<path d="M36 81V58l-7-10c-8-12 2-20 10-10l4 5V26c0-19 29-18 29 1v35c0 9-4 15-8 19z" fill="${color}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>${pattern}<path d="M35 80h30v10H35z" fill="${gold}" stroke="${ink}" stroke-width="3"/>`;
  if(item.kind==='tree')return `<path d="M45 75h10v17H45z" fill="#b28253"/><path d="m50 12 22 27H62l19 26H67l20 21H13l20-21H19l19-26H28z" fill="${item.silhouette?color:colors.green}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="m33 51 33 9M28 72l40 7" stroke="#f3dd9d" stroke-width="4"/>`;
  if(item.kind==='gift'||item.kind==='parcel')return `<rect x="19" y="35" width="62" height="49" rx="3" fill="${color}" stroke="${ink}" stroke-width="3"/><path d="M16 31h68v14H16z" fill="${color}" stroke="${ink}" stroke-width="3"/><path d="M46 32h9v52h-9z" fill="${gold}"/><path d="M50 31C22 32 28 7 44 20l6 10c8-25 34-16 20-4-5 4-12 5-20 5" fill="none" stroke="${gold}" stroke-width="6"/>`;
  if(item.kind==='ribbon')return `<path d="M48 47C11 59 13 13 39 29l11 15c23-38 54-10 26 2-7 3-17 2-26 1l-8 36-12-9-7 4 14-29m16-2 22 30-14-1-8 9-7-35" fill="${color}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="46" r="8" fill="${gold}" stroke="${ink}" stroke-width="3"/>`;
  if(item.kind==='card')return `<path d="m19 26 61-7 7 59-61 7z" fill="#fff9e8" stroke="${ink}" stroke-width="3"/><path d="m33 40 34-4m-33 17 25-3m-24 16 34-4" stroke="${color}" stroke-width="4"/>`;
  if(item.kind==='envelope')return `<rect x="13" y="27" width="74" height="52" rx="3" fill="#fff9e8" stroke="${ink}" stroke-width="3"/><path d="m14 29 36 28 36-28M15 77l24-24m46 24L61 53" fill="none" stroke="${ink}" stroke-width="3"/>`;
  if(item.kind==='snowball')return `<circle cx="50" cy="${85-33*(item.size||1)}" r="${33*(item.size||1)}" fill="#fff" stroke="#65839b" stroke-width="3"/><path d="M32 84h37" stroke="#c3d6e3" stroke-width="3"/>`;
  if(item.kind==='snowman')return `<circle cx="50" cy="67" r="23" fill="white" stroke="${ink}" stroke-width="3"/><circle cx="50" cy="33" r="15" fill="white" stroke="${ink}" stroke-width="3"/><path d="M36 43h29v8H36z" fill="${color}"/><path d="M49 31h15l-15 6" fill="#d78039"/><circle cx="45" cy="28" r="2"/><circle cx="50" cy="62" r="2"/><circle cx="50" cy="72" r="2"/>`;
  if(item.kind==='flake'){
    const count=item.spokes||6;
    return Array.from({length:count},(_,i)=>`<g transform="rotate(${i*360/count} 50 50)"><path d="M50 50V12m0 15-10-10m10 10 10-10m-10 24-12-9m12 9 12-9" stroke="${item.silhouette?ink:'#49799e'}" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>`).join('');
  }
  if(item.kind==='house')return `<path d="M23 43h54v43H23z" fill="#f1e4c6" stroke="${ink}" stroke-width="3"/><path d="m14 44 36-30 36 30z" fill="${color}" stroke="${ink}" stroke-width="3"/><path d="M23 43h54" stroke="white" stroke-width="5"/>${item.door==='round'?'<circle cx="51" cy="72" r="10" fill="#4268a3"/>':'<path d="M41 62h20v20H41z" fill="#4268a3"/>'}${item.roof?`<g transform="translate(35 12) scale(.3)">${winterDrawing({kind:item.roof})}</g>`:''}${item.symbols?item.symbols.map((kind,i)=>`<g transform="translate(${25+i*26} 43) scale(.24)">${winterDrawing({kind})}</g>`).join(''):''}${item.number?`<text x="50" y="56" text-anchor="middle" fill="${ink}" font-size="17" font-weight="800">${winterEscape(item.number)}</text>`:''}`;
  if(item.kind==='bag')return `<path d="m33 22 8 14c-33 17-34 52 9 52s42-35 9-52l8-14z" fill="#d9c19a" stroke="${ink}" stroke-width="3"/><path d="M35 37h30" stroke="${color}" stroke-width="6"/><path d="M37 53h28v20H37z" fill="#fff9e8" stroke="${ink}" stroke-width="2"/>`;
  if(item.kind==='holes')return Array.from({length:16},(_,i)=>`<rect x="${12+i%4*19}" y="${12+Math.floor(i/4)*19}" width="19" height="19" fill="#fff" stroke="#45637d" stroke-width="1.5"/>${item.cells.includes(i)?`<circle cx="${21.5+i%4*19}" cy="${21.5+Math.floor(i/4)*19}" r="4" fill="#b52d42"/>`:''}`).join('');
  if(item.kind==='sleigh')return `<path d="m18 40 9 30h44l13-27-26 5-4-21H36v18z" fill="${color}" stroke="${ink}" stroke-width="3"/><path d="m24 70-5 14h54q16 0 14-13M33 70l-4 14m35-14-5 14" fill="none" stroke="${gold}" stroke-width="5" stroke-linecap="round"/><g transform="translate(25 -4) scale(.54)">${winterDrawing({kind:'gift',color:'green'})}</g>`;
  return '';
}
function winterIcon(item,extra=''){
  return `<svg class="winter-icon ${extra}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${winterDrawing(item)}</svg>`;
}
function winterTile(item){
  const description=item.kind==='house'&&item.roof?`; на крыше ${item.roof==='star'?'звезда':'луна'}, ${item.door==='round'?'круглая':'квадратная'} дверь`:'';
  return `${winterIcon(item)}<span>${winterEscape(item.label)}${description?`<span class="visually-hidden">${winterEscape(description)}</span>`:''}</span>${item.value?`<b class="toy-tag">${winterEscape(item.value)}</b>`:''}${item.edge?`<small class="fragment-edge">${winterEscape(item.edge)}</small>`:''}`;
}
function winterGrid(cells,columns=3,extra=''){
  return `<div class="winter-grid ${extra}" style="--columns:${columns}" role="group">${cells.map(cell=>`<span>${winterEscape(cell)}</span>`).join('')}</div>`;
}
function winterVisual(mission){
  const v=mission.visual;if(!v||v.type==='none')return '';
  let content='',caption='';
  if(v.type==='legend'){
    content=`<p class="inspect-instruction">Нажми на бирку, чтобы рассмотреть её ближе.</p><div class="toy-legend">${v.items.map((item,i)=>`<button type="button" class="toy-tile clue-tile" data-action="inspect-clue" data-clue="${i}" aria-label="Рассмотреть: ${winterEscape(item.label)}" aria-expanded="false" aria-controls="clue-detail">${winterTile(item)}</button>`).join('')}</div><div id="clue-detail" class="clue-detail" role="status" hidden></div><div class="stamped-envelope"><span class="winter-board-label">Оттиски на письме · слева направо</span><div class="toy-target">${v.target.map(item=>`<div>${winterIcon(item)}<span class="visually-hidden">${winterEscape(item.label)}</span></div>`).join('')}</div></div>`;
  }else if(v.type==='row')content=`<p class="inspect-instruction">Нажми на домик, чтобы рассмотреть детали.</p><div class="toy-legend houses">${v.items.map((item,i)=>`<button type="button" class="toy-tile clue-tile" data-action="inspect-clue" data-clue="${i}" aria-label="Рассмотреть: ${winterEscape(item.label)}" aria-expanded="false" aria-controls="clue-detail">${winterTile(item)}</button>`).join('')}</div><div id="clue-detail" class="clue-detail" role="status" hidden></div>`;
  else if(v.type==='envelope')content=`<div class="stamped-envelope"><span class="winter-board-label">Картинки вместо адреса</span><div class="toy-target">${v.symbols.map(kind=>winterIcon({kind})).join('')}</div></div>`;
  else if(v.type==='garland')content=`<div class="toy-garland">${v.items.map(item=>`<span>${winterIcon(item)}<span class="visually-hidden">${winterEscape(item.label)}; </span></span>`).join('')}<span class="missing-toy" aria-label="Пустое место">?</span></div>`;
  else if(v.type==='shadow')content=`<div class="shadow-tag">${winterIcon(v.item)}</div>`;
  else if(v.type==='layers')content=`<div class="layer-card" role="img" aria-label="Снежинку частично закрывает ёлка, нижние ветви ёлки закрывает подарок${v.ribbon?', угол подарка закрывает лента':''}">${winterIcon({kind:'flake'},'layer-flake')}${winterIcon({kind:'tree'},'layer-tree')}${winterIcon({kind:'gift'},'layer-gift')}${v.ribbon?winterIcon({kind:'ribbon'},'layer-ribbon'):''}</div>`;
  else if(v.type==='grid')content=winterGrid(v.cells,v.columns);
  else if(v.type==='sorter')content=`<div class="sorter-machine"><span class="sorter-step">1. Меняем крайние</span><span class="sorter-step">2. Меняем первые две</span><div class="sorter-display"><small>На выходе</small><b>${winterEscape(v.output)}</b></div></div>`;
  else if(v.type==='stencils')content=`<div class="stencil-layout"><div><b>Табличка</b>${winterGrid(v.cells)}</div>${v.masks.map((mask,i)=>`<div><b>Решётка ${i+1} ${i===0?'↑':'↓'}</b>${winterGrid(Array.from({length:9},(_,j)=>mask.includes(j)?'○':'■'),3,'mask-grid')}<span class="visually-hidden">Отверстия в клетках ${mask.map(n=>n+1).join(', ')}, счёт по строкам.</span></div>`).join('')}</div><p class="winter-board-note">○ — отверстие · ■ — лёд · стрелки нужно совместить</p>`;
  else if(v.type==='fold')content=`<div class="fold-layout"><div><b>Лист 4 × 4</b>${winterIcon({kind:'holes',cells:[]})}</div><div class="fold-directions">Левую половину направо<br>Затем нижнюю наверх</div><div><b>После сгибов</b><div class="folded-paper"><span>●</span><span></span><span></span><span></span></div></div></div>`;
  else if(v.type==='cube')content=`<div class="cube-net" role="img" aria-label="Развёртка: ряд варежка, ёлка, колокольчик, снеговик. Звезда над ёлкой, подарок под ёлкой.">${[{kind:'star',x:2,y:1},{kind:'mitten',x:1,y:2},{kind:'tree',x:2,y:2},{kind:'bell',x:3,y:2},{kind:'snowman',x:4,y:2},{kind:'gift',x:2,y:3}].map(item=>`<div style="grid-column:${item.x};grid-row:${item.y}">${winterIcon(item)}</div>`).join('')}</div>`;
  else if(v.type==='gates')content=`<div class="delivery-rules"><span><b>Дом А</b>С подарком Б<br>не проехать</span><span><b>Дом Б</b>Дорога<br>свободна</span><span><b>Дом В</b>С подарком А<br>не проехать</span></div>`;
  else if(v.type==='clock')content=`<div class="departure-board"><span>Вылет 31 декабря</span><b>${winterEscape(v.start)}</b><span>В пути ${winterEscape(v.duration)} минут</span></div>`;
  else if(v.type==='snowman')content=`<div class="winter-mini-scene">${winterIcon({kind:'snowman'})}<span>Собираем снизу вверх</span></div>`;
  else if(v.type==='torn')content=`<div class="winter-mini-scene">${winterIcon({kind:'envelope'})}<span>Адрес снова станет целым</span></div>`;
  else content=`<div class="winter-mini-scene">${winterIcon({kind:v.type==='sleigh'?'sleigh':'gift'})}</div>`;
  return `<div class="winter-puzzle-board">${content}${caption}</div>`;
}
function winterClueDetail(mission,index){
  const visual=mission.visual;if(!['legend','row'].includes(visual?.type)||!Number.isInteger(index)||index<0||index>=visual.items.length)return '';
  return `<div class="inspected-toy">${winterTile(visual.items[index])}</div><span>Нажми на эту картинку ещё раз или выбери другую.</span>`;
}
function inspectWinterClue(mission,target){
  const detail=document.querySelector('#clue-detail');if(!detail)return;
  const open=target.getAttribute('aria-expanded')!=='true',html=winterClueDetail(mission,Number(target.dataset.clue));
  if(!html)return;
  for(const button of document.querySelectorAll?.('[data-action="inspect-clue"]')||[])button.setAttribute('aria-expanded','false');
  target.setAttribute('aria-expanded',String(open));detail.hidden=!open;detail.innerHTML=open?html:'';
}
function winterDescription(item){
  if(!item)return '';
  const names={tree:'ёлка',star:'звезда',bell:'колокольчик',ball:'шар',mitten:'варежка',gift:'подарок',snowman:'снеговик',moon:'луна'};
  if(item.symbols)return 'знаки слева направо: '+item.symbols.map(x=>names[x]||x).join(', ');
  if(item.kind==='flake')return `${item.spokes||6} длинных лучей`;
  if(item.kind==='holes')return 'отверстия: '+item.cells.map(i=>`строка ${Math.floor(i/4)+1}, столбец ${i%4+1}`).join('; ');
  if(item.kind==='house'&&item.roof)return `на крыше ${names[item.roof]}, ${item.door==='round'?'круглая':'квадратная'} дверь`;
  return '';
}
function winterChoices(mission,tried=[],action='answer'){
  return `<div class="choices ${mission.choiceArt?'illustrated-choices':mission.choices.every(c=>c.length<=16)?'compact-choices':''}" role="group" aria-label="Варианты ответа">${mission.choices.map((choice,i)=>{const description=winterDescription(mission.choiceArt?.[choice]);return `<button type="button" class="choice ${tried.includes(i)?'tried-choice':''}" data-action="${action}" data-answer="${i}" ${tried.includes(i)?'disabled':''} aria-label="${winterEscape(choice)}${description?' — '+winterEscape(description):''}${tried.includes(i)?' — этот вариант уже проверили':''}">${mission.choiceArt?.[choice]?winterIcon(mission.choiceArt[choice]):`<span class="choice-letter" aria-hidden="true">${'АБВГДЕ'[i]}</span>`}<span>${winterEscape(choice)}</span></button>`;}).join('')}</div>`;
}
function winterPassport(missions,solved,expanded=false,showJournal=true){
  const labels=['Почта','Ёлка','Мастерская','Сани'],kinds=['envelope','tree','gift','sleigh'];
  const found=labels.map((_,index)=>missions.every((m,i)=>m.station?.index!==index||i<solved));
  const count=found.filter(Boolean).length;
  const journal=expanded&&showJournal?`<h3 class="journal-title">Записки Снегиря</h3><ol class="fragment-journal">${labels.map((label,i)=>{const station=missions.find(m=>m.station?.index===i)?.station;return found[i]?`<li class="journal-entry unlocked"><span class="journal-number">${i+1}</span><div><h3>${winterEscape(station?.clueTitle||label)}</h3><p>${winterEscape(station?.clueText||'Фрагмент найден. Снегирь бережно хранит его в пропуске.')}</p></div></li>`:`<li class="journal-entry locked"><span class="journal-number">${i+1}</span><div><h3>${label}</h3><p>Записка откроется, когда завершишь эту станцию.</p></div></li>`;}).join('')}</ol>`:'';
  const exportId=showJournal?'passport-export-journal':'passport-export-card';
  const pieces=`<div class="passport-fragments">${labels.map((label,i)=>`<span class="address-fragment ${found[i]?'found':''}" aria-label="${label}: ${found[i]?'фрагмент найден':'ещё ищем'}">${winterIcon({kind:kinds[i]})}<span>${label}</span><b>${found[i]?'✓':i+1}</b></span>`).join('')}</div>`;
  return expanded?`<div class="passport-sheet"><p class="passport-kicker">Почтовый пропуск · дело о пропавшем адресе</p>${pieces}${journal}<p>Найдено фрагментов: ${count} из 4. ${count===4?'Адресная бирка восстановлена!':'Заверши задания каждой станции, чтобы вернуть все четыре части бирки.'}</p>${!showJournal?'<button type="button" class="text-button" data-action="passport">Открыть записки Снегиря</button>':''}<div class="passport-export"><button type="button" class="button paper small" data-action="save-passport" data-export-status="${exportId}" aria-describedby="${exportId}">Сохранить пропуск .png</button><p>На память о приключении.</p><p id="${exportId}" class="export-status" role="status" aria-live="polite"></p></div></div>`:`<div class="holiday-passport"><button type="button" class="passport-summary" data-action="passport" aria-label="Открыть почтовый пропуск: найдено ${count} из 4 фрагментов"><span>Собираем адрес подарка</span><b>Фрагменты ${count}/4</b></button>${pieces}</div>`;
}
function restoreTaskFocus(target){
  const key=target.dataset.focus;
  const selector=key?`[data-focus="${key}"]`:`[data-action="${target.dataset.action}"]${target.dataset.value?`[data-value="${target.dataset.value}"]`:''}`;
  const control=document.querySelector(selector)||document.querySelector(`[data-focus="item-${target.dataset.value||''}"]`)||document.querySelector('[data-action="task-clear"]');
  (control?.disabled?document.querySelector('.task-item'):control)?.focus({preventScroll:true});
}
function winterControls(mission,value){
  const task=mission.interaction;if(!task)return '';
  if(task.type==='code')return `<form id="puzzle-form" class="puzzle-input-form" novalidate><label for="puzzle-code">Код из ${task.length} цифр</label><input class="input puzzle-code-input" id="puzzle-code" name="puzzle-code" type="text" inputmode="numeric" autocomplete="off" maxlength="${task.length}" value="${winterEscape(value)}" aria-describedby="answer-feedback" placeholder="${'·'.repeat(task.length)}"><p class="task-progress" id="task-progress" aria-live="polite">Набрано ${value.length} из ${task.length}</p><div class="puzzle-keypad" role="group" aria-label="Цифры для кода">${[...'1234567890'].map(ch=>`<button type="button" data-action="task-key" data-focus="key-${ch}" data-value="${ch}">${ch}</button>`).join('')}<button type="button" class="key-erase" data-action="task-back" data-focus="erase">Стереть</button></div><button type="submit" class="button">Проверить код</button></form>`;
  if(task.type==='switches'){
    const lamps=[...task.initial];for(const id of value){const item=task.items.find(item=>item.id===id);if(item)for(const index of item.mask)lamps[index]=!lamps[index];}
    return `<div class="switch-puzzle"><div class="switch-lamps" aria-live="polite">${lamps.map((on,i)=>`<span class="switch-lamp ${on?'lit':''}" role="img" aria-label="${['Левая','Средняя','Правая'][i]} лампа ${on?'горит':'не горит'}">${winterIcon({kind:'ball',color:on?'gold':'blue'})}<small>${on?'Горит':'Не горит'}</small></span>`).join('')}</div><p class="lamp-status" role="status">${lamps.every(Boolean)?'Все три горят — можно проверить!':`Горят ${lamps.filter(Boolean).length} из 3`}</p><div class="switch-buttons">${task.items.map(item=>`<button class="button paper" type="button" data-action="task-toggle" data-focus="switch-${item.id}" data-value="${item.id}" aria-pressed="${value.includes(item.id)}"><b>${winterEscape(item.label)}</b><span>${item.mask.map(n=>['Левая','Средняя','Правая'][n]).join(' + ')}</span></button>`).join('')}</div><button class="button" type="button" data-action="task-check">Проверить гирлянду</button></div>`;
  }
  return `<div class="sequence-puzzle"><p class="sequence-instruction">${task.type==='order'?'Нажимай по порядку. Чтобы убрать шаг, нажми на него ещё раз.':`Отметь ${task.count} посылки. Повторное нажатие снимает отметку.`}</p><p class="task-progress" aria-live="polite">${task.type==='order'?'Собрано шагов':'Выбрано посылок'}: ${value.length} из ${task.count}</p><div class="task-items">${task.items.map(item=>`<button type="button" class="task-item ${value.includes(item.id)?'selected':''}" data-focus="item-${item.id}" data-action="task-toggle" data-value="${item.id}" aria-pressed="${value.includes(item.id)}">${winterTile(item)}${value.includes(item.id)?`<span class="item-selected">${task.type==='order'?'Шаг '+(value.indexOf(item.id)+1):'Выбрано'}</span>`:''}</button>`).join('')}</div><div class="task-submit-row"><button type="button" class="button" data-action="task-check">${task.type==='pick'?'Проверить посылки':'Проверить порядок'}</button><button type="button" class="text-button undo-task" data-action="task-undo" data-focus="undo" ${value.length?'':'disabled'}>${task.type==='order'?'Убрать последний шаг':'Снять последнюю отметку'}</button><button type="button" class="text-button" data-action="task-clear" data-focus="reset">Сначала</button></div></div>`;
}
function winterPuzzlePrompt(mission,progress){
  const kind=objectKind(mission);
  if(kind&&progress&&!objectState(mission,progress).opened)return 'Снегирь оставил для тебя письмо. Открой конверт и прочитай поручение.';
  if(kind==='stamps')return 'На письме остались оттиски игрушек. Найди штампы такой же формы и поставь их на нужные места слева направо.';
  if(kind==='ornament')return mission.prompt+' Возьми подходящую игрушку и повесь её на свободное место.';
  if(kind==='assembly')return mission.prompt.replace(/Нажимай на обрывки по порядку\./u,'Переложи обрывки на письмо, чтобы восстановить адрес.').replace(/Нажимай[^.]*\./u,'Разложи предметы на столе в нужном порядке.');
  if(kind==='route')return mission.prompt.replace(/Введи цифры трёх клеток, в которых остановился\./u,'Перемещай сани по соседним клеткам. На карте останется твой маршрут.');
  if(kind==='cargo')return mission.prompt.replace(/Отметь две подходящие посылки и проверь загрузку\./u,'Выбери две подходящие посылки и загрузи сани.')+' Переложи выбранные посылки на сани.';
  return mission.prompt;
}
function winterPuzzleSurface(mission,progress,tried=[]){
  if(objectKind(mission))return renderObjectPuzzle(mission,progress,winterIcon);
  const value=puzzleInput(mission,progress);
  return winterVisual(mission)+`<div id="live-workbench">${holidayWorkbench(mission,value,true)}</div>`+(mission.interaction?winterControls(mission,value):winterChoices(mission,tried));
}
function missionReadingText(mission,value,progress){
  if(progress&&objectKind(mission)&&!objectState(mission,progress).opened)return mission.title+'. '+winterPuzzlePrompt(mission,progress);
  const v=mission.visual,task=mission.interaction,parts=[mission.title,winterPuzzlePrompt(mission)];
  const symbolNames={tree:'ёлка',star:'звезда',bell:'колокольчик',ball:'шар',mitten:'варежка',gift:'подарок',snowman:'снеговик',moon:'луна'};
  if(v?.type==='legend')parts.push('Бирки: '+v.items.map(t=>`${t.label}: ${t.value}`).join('. '),'Картинки на письме слева направо: '+v.target.map(t=>t.label).join(', '));
  if(v?.type==='row')parts.push(v.items.map(t=>`${t.label}. ${winterDescription(t)}`).join('. '));
  if(v?.type==='envelope')parts.push('На письме: '+v.symbols.map(x=>symbolNames[x]||x).join(', '));
  if(v?.type==='garland')parts.push('Гирлянда слева направо: '+v.items.map(t=>t.label).join(', ')+', пустое место.');
  if(v?.type==='shadow')parts.push(v.item.label);
  if(v?.type==='grid'||v?.type==='stencils'){
    const columns=v.columns||3;
    for(let row=0;row<v.cells.length/columns;row++)parts.push(`Строка ${row+1}: `+v.cells.slice(row*columns,(row+1)*columns).join(', '));
    if(v.type==='stencils')v.masks.forEach((mask,i)=>parts.push(`Решётка ${i+1}, стрелка ${i===0?'вверх':'вниз'}. Отверстия в клетках ${mask.map(n=>n+1).join(', ')}. Клетки считаем по строкам.`));
  }
  if(v?.type==='sorter')parts.push('Номер на выходе: '+[...v.output].join(', '));
  if(v?.type==='cube')parts.push('Развёртка: ряд слева направо — варежка, ёлка, колокольчик, снеговик. Звезда над ёлкой. Подарок под ёлкой.');
  if(!task)parts.push('Варианты: '+mission.choices.map((choice,i)=>`${i+1}. ${choice}. ${winterDescription(mission.choiceArt?.[choice])}`).join('. '));
  else if(objectKind(mission)){if(task.items)parts.push('Предметы: '+task.items.map(item=>item.label).join(', '));parts.push(objectKind(mission)==='route'?'Нажимай на соседние клетки карты. Можно отменить последний шаг.':'Выбери предмет, затем нажми на его место. Предметы также можно перетаскивать. Когда всё готово, проверь сборку.');}
  else if(task.type==='code')parts.push(`Введи код. Количество цифр: ${task.length}.`);
  else if(task.type==='switches'){
    const lamps=[...task.initial];for(const id of Array.isArray(value)?value:[]){const item=task.items.find(x=>x.id===id);if(item)for(const index of item.mask)lamps[index]=!lamps[index];}
    parts.push('Сейчас: '+lamps.map((lit,i)=>`${['левая','средняя','правая'][i]} лампа ${lit?'горит':'не горит'}`).join(', '));
  }else parts.push('Предметы: '+task.items.map(t=>t.label).join(', '),task.type==='order'?'Выбирай предметы по порядку.':`Отметь предметы. Нужно выбрать ${task.count}.`);
  return parts.filter(Boolean).join('. ').replace(/\.{2,}/g,'.');
}
function readAloudControls(){
  return '<div class="read-aloud-controls"><button type="button" class="text-button" data-action="read-quest" aria-pressed="false" aria-describedby="read-status">Прочитать вслух</button><p id="read-status" class="read-status" role="status" aria-live="polite"></p></div>';
}
/** Uses only a Russian voice advertised as a local device service. No autoplay. */
function createQuestReader({speech=globalThis.speechSynthesis,Utterance=globalThis.SpeechSynthesisUtterance,onChange=()=>{}}={}){
  let current=null,serial=0,speaking=false,message='',activeKind=null;
  const state=()=>({speaking,message});
  const update=(active,text)=>{speaking=active;message=text;onChange(state(),activeKind);};
  const stop=()=>{serial++;current=null;activeKind=null;try{if(speech&&typeof speech.cancel==='function')speech.cancel();}catch{}update(false,'');};
  function toggle(text,kind='quest'){
    if(speaking&&activeKind===kind){stop();return;}
    if(speaking)stop();activeKind=kind;
    if(!speech||typeof speech.speak!=='function'||typeof Utterance!=='function'){update(false,'Этот браузер не поддерживает чтение вслух. Можно прочитать задание вместе со взрослым.');return;}
    let voice;try{voice=speech.getVoices().find(item=>item.localService===true&&/^ru(?:[-_]|$)/i.test(item.lang));}catch{}
    if(!voice){update(false,'Русский голос устройства недоступен. Можно прочитать задание вместе со взрослым.');return;}
    stop();activeKind=kind;const token=++serial;
    try{
      current=new Utterance(String(text).slice(0,6000));current.voice=voice;current.lang=voice.lang;current.rate=.88;current.pitch=1;
      current.onend=()=>{if(serial===token){current=null;update(false,kind==='hint'?'Подсказка прочитана. Можно слушать ещё раз.':'Задание прочитано. Можно слушать ещё раз.');}};
      current.onerror=event=>{if(serial===token){current=null;update(false,['canceled','interrupted'].includes(event.error)?'':'Не удалось включить голос. Попробуй ещё раз или прочитай вместе со взрослым.');}};
      update(true,'Читает голос устройства. Можно остановить чтение.');speech.speak(current);
    }catch{if(serial===token){current=null;update(false,'Не удалось включить голос. Попробуй ещё раз или прочитай вместе со взрослым.');}}
  }
  return {state,stop,toggle,kind:()=>activeKind};
}
function hintReadingControls(open){
  return `<div class="hint-audio" id="hint-audio" ${open?'':'hidden'}><button type="button" class="text-button" data-action="read-hint" aria-pressed="false" aria-describedby="hint-read-status">Прочитать подсказку</button><p class="read-status" id="hint-read-status" role="status" aria-live="polite"></p></div>`;
}
function syncReaderControls(state,kind='quest'){
  for(const [source,action,id,label,stopLabel] of [['quest','read-quest','read-status','Прочитать вслух','Остановить чтение'],['hint','read-hint','hint-read-status','Прочитать подсказку','Остановить подсказку']]){
    const button=document.querySelector(`[data-action="${action}"]`),status=document.querySelector('#'+id),active=state.speaking&&kind===source;
    if(button){button.textContent=active?stopLabel:label;button.setAttribute('aria-pressed',String(active));}
    if(status)status.textContent=kind===source?state.message:'';
  }
}

function buildPassportSVG(missions,solved){
  if(!Array.isArray(missions)||!missions.length)throw new TypeError('Для почтового пропуска нужны задания четырёх станций.');
  const labels=['Почта','Ёлка','Мастерская','Сани'];
  const kinds=['envelope','tree','gift','sleigh'];
  const accents=['#b52d42','#2c735d','#4268a3','#b52d42'];
  const tints=['#f7e9e5','#e9f0e6','#e7edf4','#f7e9e5'];
  const positions=labels.map((_,index)=>missions.reduce((found,mission,i)=>{
    if(mission?.station?.index===index)found.push(i);
    return found;
  },[]));
  if(positions.some(found=>!found.length))throw new TypeError('В почтовом пропуске должны быть все четыре станции.');
  const completeMissions=Number.isInteger(solved)?Math.max(0,Math.min(solved,missions.length)):0;
  const found=positions.map(indices=>indices.every(index=>index<completeMissions));
  const count=found.filter(Boolean).length;
  const complete=count===4;
  const status=complete?'Дело раскрыто':'Приключение продолжается';
  const note=complete?'Все четыре фрагмента собраны. Новогодняя почта благодарит тебя!':'Каждая новая печать приближает нас к разгадке.';
  const holes=[...Array.from({length:12},(_,i)=>`<circle cx="${10+i*20}" cy="0" r="5"/><circle cx="${10+i*20}" cy="252" r="5"/>`),...Array.from({length:12},(_,i)=>`<circle cx="0" cy="${16+i*20}" r="5"/><circle cx="240" cy="${16+i*20}" r="5"/>`)].join('');
  const masks=labels.map((_,i)=>`<mask id="passport-stamp-${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="252"><rect width="240" height="252" fill="white"/><g fill="black">${holes}</g></mask>`).join('');
  const stamps=labels.map((label,i)=>{
    const active=found[i],accent=active?accents[i]:'#858c81';
    const mark=active?'<path d="m-7 0 5 5 10-11" fill="none" stroke="#fffdf8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>':`<text x="0" y="5" text-anchor="middle" font-size="15" font-weight="700" fill="#536253">${i+1}</text>`;
    return `<g transform="translate(${78+i*268} 377)">
      <g mask="url(#passport-stamp-${i})"><rect width="240" height="252" fill="${active?tints[i]:'#e9e9df'}"/><rect x="8" y="8" width="224" height="236" fill="none" stroke="${accent}" stroke-width="1.5"/><rect x="18" y="57" width="204" height="126" fill="${active?'#fffdf8':'#f0f0e8'}"/></g>
      <text x="22" y="39" fill="${accent}" font-size="13" font-weight="700" letter-spacing="2">СТАНЦИЯ 0${i+1}</text>
      <g transform="translate(211 31)"><circle r="13" fill="${active?accent:'#d1d5c8'}"/>${mark}</g>
      <g transform="translate(64 61) scale(1.12)"${active?'':' filter="url(#passport-muted)" opacity=".38"'}>${winterDrawing({kind:kinds[i],color:i===2?'blue':'red'})}</g>
      <text x="120" y="207" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="27" fill="#243e35">${winterEscape(label)}</text>
      <text x="120" y="231" text-anchor="middle" font-size="14" fill="${active?accent:'#626d60'}">${active?'Печать получена':'Ещё ищем фрагмент'}</text>
    </g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850" role="img" aria-labelledby="passport-title passport-description">
    <title id="passport-title">Почтовый пропуск — ${winterEscape(status)}</title>
    <desc id="passport-description">Бюро находок. Дело о пропавшем адресе. Найдено фрагментов: ${count} из 4. ${labels.map((label,i)=>`${winterEscape(label)}: ${found[i]?'печать получена':'ещё ищем'}`).join('. ')}.</desc>
    <defs>
      <pattern id="passport-airmail" width="92" height="92" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="92" height="92" fill="#fffdf8"/><rect width="24" height="92" fill="#b52d42"/><rect x="46" width="24" height="92" fill="#4268a3"/></pattern>
      <filter id="passport-muted" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/></filter>
      ${masks}
    </defs>
    <rect width="1200" height="850" fill="#f6f2e8"/>
    <rect x="18" y="18" width="1164" height="814" rx="4" fill="url(#passport-airmail)"/>
    <rect x="34" y="34" width="1132" height="782" rx="2" fill="#fffdf8"/>
    <rect x="49" y="49" width="1102" height="752" rx="1" fill="none" stroke="#d4d7c9"/>
    <g fill="#243e35" font-family="Arial, Helvetica, sans-serif">
      <g transform="translate(73 78) scale(.61)">${winterDrawing({kind:'envelope'})}</g>
      <text x="145" y="104" font-family="Georgia, 'Times New Roman', serif" font-size="31">Бюро находок</text>
      <text x="146" y="128" font-size="12" letter-spacing="2.5" fill="#687269">НОВОГОДНЯЯ ПОЧТА</text>
      <g transform="translate(1034 122) rotate(9)" fill="#4268a3" stroke="#4268a3">
        <path d="M-190-19h110m-120 19h120m-110 19h110" stroke-width="2" fill="none"/>
        <circle r="57" fill="none" stroke-width="2"/><circle r="49" fill="none" stroke-width="1"/>
        <text x="0" y="-13" text-anchor="middle" stroke="none" font-size="11" letter-spacing="1.4">СЕВЕРНАЯ</text>
        <text x="0" y="13" text-anchor="middle" stroke="none" font-family="Georgia, 'Times New Roman', serif" font-size="24">ПОЧТА</text>
        <path d="m-7 30 7-6 7 6m-7-6v13" stroke-width="1.5" fill="none"/>
      </g>
      <text x="78" y="237" font-family="Georgia, 'Times New Roman', serif" font-size="65" letter-spacing="-1.5">Почтовый пропуск</text>
      <text x="81" y="279" font-size="23" fill="#b52d42">Дело о пропавшем адресе</text>
      <path d="M80 311h1040" stroke="#d4d7c9"/>
      <text x="80" y="345" font-size="21" fill="#536253">Четыре станции — четыре части потерянного адреса.</text>
      ${stamps}
      <path d="M80 667h1040" stroke="#d4d7c9"/>
      <g transform="translate(128 731)"><circle r="43" fill="${complete?'#e9f0e6':'#f6f2e8'}" stroke="${complete?'#2c735d':'#d4d7c9'}" stroke-width="2"/><text x="0" y="10" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34">${count}<tspan font-size="22"> / 4</tspan></text></g>
      <text x="198" y="718" font-family="Georgia, 'Times New Roman', serif" font-size="${complete?40:36}" fill="${complete?'#2c735d':'#243e35'}">${winterEscape(status)}</text>
      <text x="200" y="750" font-size="17" fill="#536253">${winterEscape(note)}</text>
      <text x="600" y="788" text-anchor="middle" font-size="11" letter-spacing="2" fill="#687269">ОСОБАЯ ДОСТАВКА · МАЛЕНЬКОЕ ЧУДО УЖЕ РЯДОМ</text>
    </g>
  </svg>`;
}

function completionSummary(missions,progress){
  const total=missions.length,solved=['treasure','done'].includes(progress.phase)?total:Math.min(total,Math.max(0,progress.index+(progress.phase==='find'?1:0)));
  const winter=missions.every(m=>Number.isInteger(m.station?.index));
  const fragments=winter?[0,1,2,3].filter(index=>missions.some(m=>m.station.index===index)&&missions.every((m,i)=>m.station.index!==index||i<solved)).length:0;
  return `<section class="quest-results" aria-label="Итоги приключения"><h2>Вот что получилось</h2><dl><div><dt>Загадок разгадано</dt><dd>${solved} из ${total}</dd></div>${winter?`<div><dt>Фрагментов собрано</dt><dd>${fragments} из 4</dd></div>`:''}</dl><p>${winter&&fragments===4?'Адресная бирка цела. Спасибо от всей новогодней почты!':'Каждая разгаданная загадка приблизила нас к сюрпризу.'}</p></section>`;
}
async function downloadPassportPNG(missions,solved){
  const svg=buildPassportSVG(missions,solved);
  if(typeof Image!=='function')throw new Error('Этот браузер не умеет сохранять пропуск картинкой. Он остаётся доступен в игре.');
  const picture=new Image();
  try{
    await new Promise((resolve,reject)=>{picture.onload=resolve;picture.onerror=()=>reject(new Error('Не удалось подготовить картинку. Попробуйте ещё раз.'));picture.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);});
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=850;
    const context=canvas.getContext?.('2d');if(!context||typeof canvas.toBlob!=='function')throw new Error('Этот браузер не умеет сохранять PNG. Пропуск остаётся доступен в игре.');
    context.drawImage(picture,0,0,1200,850);
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Не удалось собрать PNG. Попробуйте ещё раз.')),'image/png'));
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='buro-passport.png';
    try{document.body.append(anchor);anchor.click();}catch(error){URL.revokeObjectURL(url);throw error;}finally{anchor.remove();}
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    let preview='';try{if(typeof canvas.toDataURL==='function')preview=canvas.toDataURL('image/png');}catch{}
    return {filename:'buro-passport.png',width:1200,height:850,...(preview?{preview}:{})};
  }finally{picture.onload=null;picture.onerror=null;}
}
function createPassportSaver(){
  let busy=false;
  return {async save(missions,solved,button,status){
    if(busy)return {saved:false,ignored:true};
    busy=true;const label=button.textContent;button.disabled=true;button.textContent='Готовим картинку…';if(status)status.textContent='';
    try{const result=await downloadPassportPNG(missions,solved);if(status){status.textContent='Картинка готова. Проверьте загрузки браузера: buro-passport.png.';if(result.preview?.startsWith('data:image/png;'))status.insertAdjacentHTML?.('beforeend',`<img class="passport-preview" src="${winterEscape(result.preview)}" alt="Почтовый пропуск с найденными фрагментами">`);}return {saved:true};}
    catch(error){if(status)status.textContent=error.message||'Не удалось сохранить картинку. Попробуйте ещё раз.';return {saved:false};}
    finally{busy=false;button.disabled=false;button.textContent=label;}
  }};
}

// HOLIDAY_RENDERER_END

const objectDrag=createObjectDrag({root:app,onAction:performObjectAction});
function performObjectAction(target){
  if(progress?.phase!=='puzzle'||document.querySelector('.dialog-backdrop'))return;
  const data=target.dataset||target;
  const result=applyObjectAction(quest,progress,{action:data.action,value:data.value,slot:data.slot});
  if(!result.handled)return;
  progress=result.progress;saveProgress();renderGame(!!result.correct);celebrateQuestResult(result);
  const feedback=document.querySelector('#answer-feedback');
  if(result.feedback&&feedback){feedback.textContent=result.feedback;if(data.action==='object-check')feedback.focus();}
  if(!result.correct&&data.action!=='object-check'){
    const control=result.focus?document.querySelector(`[data-focus="${result.focus}"]`):null;
    if(control)control.focus({preventScroll:true});else restoreTaskFocus({dataset:data});
  }
}
const questMotion=createQuestMotion({root:app,enabled:storage.get('bureau:motion:v1')!==false,onChange:syncMotionControls});
function syncMotionControls(state){const enabled=state.enabled&&!state.reduced;for(const button of app.querySelectorAll('[data-action="motion-toggle"]')){button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',state.reduced?'Анимация отключена настройками устройства':enabled?'Выключить анимацию':'Включить анимацию');button.disabled=state.reduced;button.textContent=state.reduced?'Без движения':'Анимация';}const shell=app.querySelector('.game-shell');if(shell){shell.setAttribute('data-motion',enabled?'on':'off');shell.classList[state.allowed?'remove':'add']('motion-suspended');}}
function syncQuestMotion(){objectDrag.sync();questMotion.sync(app);questMotion.setActive(document.body.dataset.screen==='game'&&!!progress&&progress.phase!=='done'&&!document.hidden&&!document.querySelector('.dialog-backdrop'));syncMotionControls(questMotion.state());}
function celebrateQuestResult(result){if(!result.correct)return;document.querySelector('.station-reward')?.classList.add('motion-arrival');document.querySelector('.earned-stamp')?.classList.add('motion-arrival');const stationComplete=!!quest.missions[progress.index]?.station?.isLast;questAudio.celebrate({stationComplete});questMotion.celebrate({stationComplete,final:progress.phase==='treasure'});}
const questAudio=createHolidayAudio({volume:Math.max(0,Math.min(1,Number(storage.get('bureau:music-volume:v1')??0.32))),onChange:syncQuestAudio});
const questReader=createQuestReader({onChange(state,kind){syncReaderControls(state,kind);syncQuestSoundscape();}});
function syncQuestAudio(state){const root=document.querySelector('#quest-audio');if(!root||document.activeElement?.name==='music-volume')return;const focused=document.activeElement?.dataset?.action==='music-toggle';root.innerHTML=holidayAudioControls(state);if(focused)root.querySelector('[data-action="music-toggle"]')?.focus({preventScroll:true});}
function syncQuestSoundscape(){syncQuestMotion();questAudio.setScene({station:quest?.missions[progress?.index]?.station?.index||0,active:document.body.dataset.screen==='game'&&!!progress&&!['intro','done'].includes(progress.phase)&&!document.hidden&&!document.querySelector('.dialog-backdrop'),ducked:questReader.state().speaking});}
function syncWorkbench(mission){const root=document.querySelector('#live-workbench');if(root)root.innerHTML=holidayWorkbench(mission,puzzleInput(mission,progress),true);}
let readerContext='';
const passportSaver=createPassportSaver();
function answerRecap(m,open=false){return `<details class="answer-recap" ${open?'open':''}><summary>Загадка разгадана · посмотреть решение</summary><p><b>${escape(m.choices[m.answerIndex])}</b></p><p>${escape(m.explanation)}</p>${m.station?`<p class="stamp-story">${escape(m.station.reward)}</p>`:''}</details>`;}
function gameFrame(content) {
  document.body.dataset.screen='game';
  const count=quest.missions.length;
  const solved=['treasure','done'].includes(progress.phase)?count:progress.index+(progress.phase==='find'?1:0);
  const screen=isScreenMode(quest.config), storybook=quest.config.theme==='winter';
  const caption=isDemo?'Пробная игра: подарок готовить не нужно.':progress.phase==='done'?'Игра завершена. Можно создать новый квест с другим сюрпризом.':progress.phase==='treasure'?'Проверь указанный тайник вместе со взрослым.':screen?'Играем на экране. Место подарка откроется в финале.':'Ищем карточки спокойно. Взрослый остаётся рядом.';
  const topline=`<div class="game-topline"><span class="quiet">Загадка ${Math.min(progress.index+1,count)} из ${count}</span><div class="dots" aria-label="Разгадано загадок: ${solved} из ${count}">${Array.from({length:count},(_,i)=>`<span class="dot ${i<solved?'complete':i===progress.index?'active':''}"></span>`).join('')}</div></div>`;
  const audio=`<div id="quest-audio" class="quest-audio">${holidayAudioControls(questAudio.state())}</div>`;
  const passport=quest.config.edition===3&&storybook?winterPassport(quest.missions,solved):'';
  const desk=`${topline}${content}<p class="game-caption">${caption}</p>`;
  const world=`${holidayWorld(quest.missions,progress)}${passport}${audio}`;
  const main=storybook?`<div class="adventure-layout"><aside class="adventure-world">${world}</aside><section class="adventure-desk">${desk}</section></div>`:`${audio}${desk}`;
  const motionState=questMotion.state(), motionOn=motionState.enabled&&!motionState.reduced;
  const header=`<div><span class="game-wordmark">Бюро находок</span>${isDemo?'<span class="game-demo">Демо · 4 задания</span>':''}<span class="game-build">${RELEASE.version.replace('-beta.1','')}</span></div><div class="game-tools"><button class="game-tool" data-action="reading-size" aria-pressed="${largeReading}">${largeReading?'Обычный текст':'Крупный текст'}</button><button class="game-tool motion-toggle" data-action="motion-toggle" aria-pressed="${motionOn}" aria-label="${motionOn?'Выключить анимацию':'Включить анимацию'}">Анимация</button><button class="game-tool" data-action="game-help">Как играть</button>${progress.phase!=='done'?'<button class="game-tool" data-action="pause">Пауза</button>':''}</div>`;
  const viewKey=`${quest.id}:${isDemo}:${storybook}`, worldKey=`${viewKey}:${progress.index}:${progress.phase}`;
  const liveDesk=app.querySelector('.adventure-desk'),liveWorld=app.querySelector('.adventure-world');
  if(storybook&&app.dataset.questView===viewKey&&liveDesk&&liveWorld){
    liveDesk.innerHTML=desk;
    if(app.dataset.worldView!==worldKey)liveWorld.innerHTML=world;
    app.querySelector('.game-header').innerHTML=header;
  }else{
    app.innerHTML=`${!storageAvailable?'<div class="storage-notice">Сохранение доступно только в этой вкладке. Не закрывайте и не обновляйте вкладку.</div>':''}<div class="game-shell ${storybook?'storybook-game':''}"><div class="snowfall" aria-hidden="true"><i></i><i></i><i></i></div><header class="game-header">${header}</header><main class="game-main">${main}</main></div>`;
  }
  if(app.dataset.worldView!==worldKey)app.querySelector('.quest-scene')?.classList.add('scene-arriving');
  app.dataset.questView=viewKey;app.dataset.worldView=worldKey;
  document.querySelector('.game-card h1, .game-card h2')?.setAttribute('tabindex','-1');
  syncQuestSoundscape();
}
function renderGame(focus=false) {
  const nextContext=`${quest.id}:${progress.index}:${progress.phase}`;if(nextContext!==readerContext){questReader.stop();readerContext=nextContext;}
  const m=quest.missions[progress.index];
  const winter=quest.config.theme==='winter';
  const holiday=quest.config.edition===3&&winter;
  const screen=isScreenMode(quest.config);
  if(progress.phase==='intro') {
    gameFrame(`<article class="game-card"><div class="intro-seal">${winter?'Новогодняя<br>почта<br>Особая доставка':'Секретная<br>экспедиция'}</div>${holiday?`<div class="intro-courier">${winterCourier()}</div>`:''}<span class="eyebrow red">${escape(THEMES.find(t=>t.id===quest.config.theme).title)}</span><h1>${holiday?'Дело о пропавшем<br>адресе':winter?'Пришло письмо<br>с сюрпризом!':'Есть секретное дело!'}</h1><p class="game-prompt">${escape(quest.intro)}${isDemo?'<span class="demo-intro-note">Это пробная игра из четырёх заданий. Настоящий подарок готовить не нужно.</span>':''}</p><p>${holiday?(screen?'Открывай письма, собирай посылки, развешивай игрушки и управляй санями. Карточки печатать не нужно.':'Решай новогодние задания на экране, а затем ищи домашние карточки с кодами.') :screen?'Нажимай на верный ответ. Если будет сложно — открой подсказку. Печатать карточки и вводить коды с карточек не нужно.':'Выбирай ответы, находи указанные тайники и вводи четыре цифры с карточек. В последнем месте будет подарок.'}</p><button class="button" data-action="start">Начать приключение</button></article>`);
  } else if(progress.phase==='puzzle') {
    const tried=(progress.mistakes?.[progress.index]||[]).filter(index=>index!==m.answerIndex&&index<m.choices.length);
    const attempts=m.interaction?(progress.taskAttempts?.[progress.index]||0):tried.length;
    const feedback=attempts>=2?'Давай воспользуемся подсказкой. Можно также разобрать задачу вместе со взрослым.':attempts?'Предыдущий ответ не подошёл. Можно изменить его и проверить ещё раз.':'';
    const legacyFeedback=tried.length===1?'Этот вариант уже проверили. Попробуй другой или открой подсказку.':feedback;
    gameFrame(`<article class="game-card ${m.station?'holiday-game-card':''}">${m.station?m.station.step===1?`<div class="courier-note"><div class="courier-portrait">${winterCourier()}</div><div><span class="courier-label">Снегирь на связи</span><p>${escape(m.station.story)}</p></div></div>`:`<p class="courier-mini">${escape(m.station.story)}</p>`:''}<span class="eyebrow red">${m.station?escape(m.station.title)+' · ':''}Загадка ${progress.index+1}</span><h1>${escape(m.title)}</h1>${readAloudControls()}<p class="game-prompt">${escape(winterPuzzlePrompt(m,progress))}</p>${winterPuzzleSurface(m,progress,tried)}<p class="feedback attempt-feedback" id="answer-feedback" tabindex="-1" role="status" aria-live="polite">${escape(m.interaction?feedback:legacyFeedback)}</p><div class="puzzle-help-area"><div class="puzzle-help"><button class="hint-button" data-action="hint" aria-expanded="${isHintOpen(progress,progress.index)}" aria-controls="mission-hint">${isHintOpen(progress,progress.index)?'Скрыть подсказку':'Нужна подсказка?'}</button><button class="hint-button" data-action="assist">Разобрать вместе</button></div><p class="hint-text" id="mission-hint" ${isHintOpen(progress,progress.index)?'':'hidden'}>${escape(m.hint)}</p>${hintReadingControls(isHintOpen(progress,progress.index))}</div></article>`);
  } else if(progress.phase==='find') {
    if(screen) {
      gameFrame(`<article class="game-card answer-success">${stationReward(quest.missions,progress)}<div class="answer-tick" aria-hidden="true">✓</div><span class="eyebrow red">Загадка ${progress.index+1} разгадана</span><h1>${m.station?(m.station.isLast?'Фрагмент найден!':'Посылка готова!'):'Верно!'}</h1>${m.station?`<div class="earned-stamp">${winterIcon({kind:['envelope','tree','gift','sleigh'][m.station.index]})}<b>${escape(m.station.stamp)}</b></div><p class="stamp-story">${escape(m.station.reward)}</p>`:''}<p class="correct-answer">Ответ: <b>${escape(m.choices[m.answerIndex])}</b></p><p class="answer-explanation">${escape(m.explanation)}</p><p class="success-next-note">Впереди ещё ${quest.missions.length-progress.index-1} ${pluralWord(quest.missions.length-progress.index-1,'загадка','загадки','загадок')}. Продолжаем?</p><button class="button" data-action="next-screen">Следующая загадка</button></article>`);
    } else {
    const p=place(m.locationId);
    gameFrame(`<article class="game-card">${answerRecap(m)}<span class="eyebrow red">Верно! Вот следующая зацепка</span>${icon(p.id,'location-symbol')}<h1>${escape(p.title)}</h1><p class="game-prompt">${escape(p.hint)}</p>${isDemo?'<div class="notice">В настоящем квесте здесь будет карточка с кодом. Сейчас её можно пропустить.</div><button class="button" data-action="demo-card">Продолжить без карточки</button>':`<p>Найди там карточку № ${progress.index+1}. На ней четыре цифры.</p><form id="code-form" novalidate><label for="card-code" class="label" style="text-align:center;margin-top:24px">Код с карточки</label><input class="input game-code" id="card-code" name="code" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" aria-describedby="code-feedback" placeholder="····"><p class="feedback" style="text-align:center" id="code-feedback" role="status" aria-live="polite"></p><button class="button" type="submit">Проверить код</button></form>`}</article>`);
    }
  } else if(progress.phase==='treasure') {
    const p=place(m.locationId);
    gameFrame(`<article class="game-card"><span class="eyebrow red">Последняя загадка разгадана</span>${icon('gift','location-symbol')}<h1>${isDemo?'Здесь будет<br>подарок':'Сюрприз ждёт!'}</h1><h2>${escape(p.title)}</h2>${isDemo?'':`<p class="game-prompt">${escape(p.hint)}</p>`}${quest.config.giftNote?`<p class="hint-text">${escape(quest.config.giftNote)}</p>`:''}${holiday?stationReward(quest.missions,progress)+answerRecap(m,true)+winterPassport(quest.missions,quest.missions.length,true,false)+'<p class="restored-address">Все печати собраны · адрес восстановлен</p>':''}<p>${isDemo?'Это пример финального тайника. В вашей игре здесь будет место, которое выберет взрослый. Настоящий подарок искать сейчас не нужно.':screen?'Все загадки решены! Поищи подарок в указанном месте и возвращайся.':'Больше кодов не нужно. Найди свой подарок и возвращайся!'}</p><button class="button red-button" data-action="finish">${isDemo?'Завершить пробную игру':'Подарок найден!'}</button></article>`);
  } else if(isDemo) {
    gameFrame(`<article class="game-card ending"><div class="success-ribbon" aria-hidden="true">✦ ✦ ✦</div><span class="eyebrow">Пробный маршрут пройден</span><h1>Теперь —<br>ваше приключение</h1>${completionSummary(quest.missions,progress)}<p class="game-prompt">Вы попробовали загадки на экране. Теперь можно создать свою игру: без карточек или с поиском по домашним тайникам.</p><button class="button" data-action="create">Собрать свой квест</button><button class="hint-button" data-action="demo-restart">Попробовать ещё раз</button><button class="hint-button" data-action="home">На главную</button></article>`);
  } else {
    gameFrame(`<article class="game-card ending"><div class="success-ribbon" aria-hidden="true">✦ ✦ ✦</div><span class="eyebrow">${screen?'Все загадки разгаданы':'Все тайники найдены'}</span><h1>${escape(quest.config.name)},<br>подарок нашёлся!</h1><p class="game-prompt">${escape(quest.ending)}</p>${completionSummary(quest.missions,progress)}<div class="certificate-line"></div><button class="button" data-action="certificate">Распечатать диплом</button>${!IS_SHARED?'<button class="button paper next-adventure" data-action="new-quest">Подготовить новый квест</button>':''}<button class="hint-button" data-action="home" style="display:block;margin:15px auto 0">На главную</button></article>`);
  }
  syncReaderControls(questReader.state(),questReader.kind());
  if(focus){window.scrollTo(0,0);document.querySelector('.game-card h1, .game-card h2')?.focus({preventScroll:true});}
}
function showError(message){shell(`<main class="empty-state"><span class="eyebrow red">Не получилось открыть квест</span><h1>Кажется, потерялась часть карты</h1><p>${escape(message)}</p><button class="button" data-action="home">На главную</button></main>`);}
function route() {
  questReader.stop();
  closeDialog();
  const hash=location.hash.slice(1);
  if(IS_SHARED&&!hash.startsWith('play=')){
    shell('<main class="empty-state"><span class="eyebrow red">Семейный квест</span><h1>Откройте ссылку от взрослого</h1><p>Для начала игры нужна полная ссылка с настройками. Подготовка и скачивание доступны владельцу покупки.</p><a class="button" href="/">Бюро находок</a></main>');return;
  }
  if(hash==='create'){quest=null;isDemo=false;ready=false;renderEditor();return;}
  if(hash==='demo'){isDemo=true;quest=createQuest({v:1,edition:3,name:'Саша',age:'8-10',theme:'winter',mode:'screen',route:['books','sofa','toys','wardrobe'],seed:20261124,giftNote:'Сюрприз — это ещё и время, которое мы провели вместе.'});progress=readProgress(storage.get(progressKey()),quest.missions.length);renderGame();return;}
  if(hash.startsWith('play=')){
    try {isDemo=false;quest=createQuest(decodeConfig(hash.slice(5)));storage.set(LAST_GAME_KEY,quest.config);progress=readProgress(storage.get(progressKey()),quest.missions.length);renderGame();}
    catch(error){showError(error.message);}
    return;
  }
  renderHome();
}
function navigate(hash){if(location.hash===hash){route();}else location.hash=hash;window.scrollTo(0,0);}
function updateDraftField(target){
  if(target.name==='child-name')draft.name=target.value;
  if(target.name==='gift-note')draft.giftNote=target.value;
  if(target.name==='age')draft.age=target.value;
  if(target.name==='theme')draft.theme=target.value;
  saveDraft();
}
function syncSidebar(){const old=app.querySelector('.notebook');if(old)old.outerHTML=notebook();}
function setStep(value){step=value;ready=false;saveDraft();renderEditor(true);window.scrollTo(0,0);}
function makePrintCards(){
  const q=createQuest(draft), codes=cardCodes(q);
  printRoot.innerHTML=`<div class="print-document"><header><h1>Карточки квеста · ${escape(q.config.name)}</h1><p>Взрослому: разрежьте карточки и разложите в указанные места. Подарок спрячьте ${escape(place(q.config.route.at(-1)).title.toLowerCase())}. Сохраните план подготовки в приложении.</p></header><div class="print-grid">${q.missions.slice(0,-1).map((m,i)=>`<section class="print-card"><small>Взрослому: ${escape(place(m.locationId).title)}</small><h2>Секретная карточка № ${i+1}</h2><p>Карточка нашлась? Отлично! Введи эти цифры в игру.</p><div class="code">${codes[i]}</div><small>Бюро находок · ${escape(q.config.name)}</small></section>`).join('')}</div></div>`;
}
function downloadBlob(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function downloadGame(button){
  button.disabled=true;const old=button.textContent;button.textContent='Готовим файл…';
  try {
    const token=encodeConfig(draft);
    let html;
    if(document.body.dataset.portable==='true'){
      html='<!doctype html>\n'+document.documentElement.outerHTML;
      const doc=new DOMParser().parseFromString(html,'text/html');doc.body.dataset.startQuest=token;doc.querySelector('#app').replaceChildren();doc.querySelector('#print-root').replaceChildren();doc.querySelector('#toast').replaceChildren();doc.querySelectorAll('.dialog-backdrop').forEach(el=>el.remove());html='<!doctype html>\n'+doc.documentElement.outerHTML;
    } else {
      const response=await fetch(new URL('./portable.html',location.href)).catch(()=>{throw new Error('Не удалось загрузить файл игры. Проверьте, что локальный квест запущен, и попробуйте ещё раз.');});
      if(!response.ok)throw new Error('Не удалось загрузить файл игры. Попробуйте ещё раз.');
      const contents=await response.text().catch(()=>{throw new Error('Не удалось прочитать файл игры. Попробуйте скачать его ещё раз.');});
      html=contents.replace('data-start-quest=""',`data-start-quest="${token}"`);
      if(!html.includes(`data-start-quest="${token}"`))throw new Error('Файл игры ещё не подготовлен.');
    }
    downloadBlob(html,'bureau-quest.html','text/html;charset=utf-8');notify('Игра готова к скачиванию: bureau-quest.html.');
  }catch(error){notify(error.message||'Не удалось скачать игру.');}
  finally{button.disabled=false;button.textContent=old;}
}
async function copyLink(){
  let url=new URL(location.href);
  if(url.protocol==='file:'){notify('Локальный файл нельзя передать ссылкой. Передайте сам HTML-файл.');return;}
  const request=(copyLink.request||0)+1;copyLink.request=request;
  const sourceHash=location.hash,sourceView=app.children[0];
  const isLatest=()=>copyLink.request===request;
  const canPresent=()=>isLatest()&&location.hash===sourceHash&&app.children[0]===sourceView;
  let token;try{token=encodeConfig(draft);}catch(error){notify(error.message||'Не удалось подготовить ссылку. Проверьте настройки квеста.');return;}
  if(IS_PURCHASED&&!IS_SHARED){
    try{
      const response=await fetch('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
      if(!response.ok)throw new Error('Не удалось подготовить семейную ссылку. Откройте свою покупку и повторите попытку.');
      const data=await response.json();url=new URL(data.url);
      if(url.origin!==location.origin||!url.pathname.startsWith('/shared/'))throw new Error('Не удалось проверить ссылку на игру.');
    }catch(error){if(canPresent())notify(error instanceof TypeError?'Не удалось связаться с магазином. Проверьте интернет и повторите попытку.':error.message||'Не удалось подготовить ссылку. Повторите попытку.');return;}
  }
  if(!isLatest())return;
  url.hash='play='+token;
  if(IS_PURCHASED&&!IS_SHARED&&canPresent()){
    showDialog('Семейная ссылка на игру',isLocalAddress()?'Эта проверочная ссылка работает только на текущем компьютере. После размещения сайта её можно будет открыть на устройстве ребёнка.':'По этой ссылке ребёнок откроет подготовленный квест. Код вашей покупки ему не нужен.',`<label class="label" for="share-url">Ссылка для участников</label><input id="share-url" class="input" value="${escape(url.href)}" readonly><div class="actions"><button class="button" data-action="close-dialog">Готово</button></div>`);
    document.querySelector('#share-url')?.select();
  }
  try{await navigator.clipboard.writeText(url.href);if(canPresent())notify(isLocalAddress()?'Ссылка скопирована. Она работает только на этом компьютере.':'Ссылка скопирована. Получателю нужен доступ к этому сайту.');}
  catch{if(canPresent()){showDialog('Ссылка на квест',isLocalAddress()?'Эта ссылка работает только на этом компьютере. Для другого устройства скачайте файл игры.':'Выделите и скопируйте ссылку. Она содержит имя, маршрут и финальную записку.',`<label class="label" for="share-url">Ссылка для участников</label><input id="share-url" class="input" value="${escape(url.href)}" readonly><div class="actions"><button class="button" data-action="close-dialog">Готово</button></div>`);document.querySelector('#share-url')?.select();}}
}
function showDialog(title,text,controls){
  objectDrag.cancel();questMotion.setActive(false);questAudio.setScene({active:false});
  closeDialog();lastFocus=document.activeElement;
  const wrap=document.createElement('div');wrap.className='dialog-backdrop';wrap.innerHTML=`<section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><h2 id="dialog-title">${escape(title)}</h2><p>${escape(text)}</p>${controls}</section>`;
  document.body.append(wrap);wrap.querySelector('button,input')?.focus();
}
function closeDialog(){const dialog=document.querySelector('.dialog-backdrop');if(dialog){dialog.remove();lastFocus?.focus?.();}}
function handleAction(target){
  const action=target.dataset.action;
  if(action.startsWith('object-')){performObjectAction(target);return;}
  if(IS_SHARED&&['create','new-quest','confirm-new-quest','return-setup','prepare','play','print','download','copy-link','restart-prepared','preview-question','preview-answer','shuffle-puzzles','confirm-shuffle','remember-format','forget-format'].includes(action)){notify('Подготовка доступна взрослому в его покупке. Продолжайте играть по семейной ссылке.');return;}
  if(action==='motion-toggle'){questMotion.setEnabled(!questMotion.state().enabled);storage.set('bureau:motion:v1',questMotion.state().enabled);syncMotionControls(questMotion.state());return;}
  if(action==='music-toggle'){questAudio.setEnabled(!questAudio.state().enabled).then(()=>syncQuestSoundscape());return;}
  if(action==='inspect-clue'&&progress?.phase==='puzzle'){inspectWinterClue(quest.missions[progress.index],target);return;}
  if(action==='passport'&&quest){questReader.stop();const solved=['treasure','done'].includes(progress.phase)?quest.missions.length:progress.index+(progress.phase==='find'?1:0);showDialog('Твой почтовый пропуск','Четыре станции — четыре части потерянной адресной бирки.',winterPassport(quest.missions,solved,true)+'<button class="button" data-action="close-dialog">Продолжить приключение</button>');const heading=document.querySelector('.dialog h2');heading?.setAttribute('tabindex','-1');heading?.focus({preventScroll:true});const dialog=document.querySelector('.dialog');if(dialog)dialog.scrollTop=0;return;}
  if(action==='save-passport'&&quest){const completed=['treasure','done'].includes(progress.phase)?quest.missions.length:progress.index+(progress.phase==='find'?1:0);return passportSaver.save(quest.missions,completed,target,document.querySelector('#'+target.dataset.exportStatus));}
  if(action==='read-hint'&&progress?.phase==='puzzle'&&isHintOpen(progress,progress.index)){questReader.toggle('Подсказка. '+quest.missions[progress.index].hint,'hint');return;}
  if(action==='read-quest'&&progress?.phase==='puzzle'){questReader.toggle(missionReadingText(quest.missions[progress.index],puzzleInput(quest.missions[progress.index],progress),progress));return;}
  if(action==='reading-size'){largeReading=!largeReading;storage.set('bureau:large-reading:v1',largeReading);applyReadingSize();renderGame();document.querySelector('[data-action="reading-size"]')?.focus();return;}
  if(action==='assist'&&progress?.phase==='puzzle'){questReader.stop();
    const mission=quest.missions[progress.index];
    showDialog('Разберём вместе','Можно показать этот экран взрослому и обсудить решение. Продолжение откроется, когда нажмёте «Теперь понятно».',`<p class="help-answer">Ответ: <b>${escape(mission.choices[mission.answerIndex])}</b></p><p class="help-explanation">${escape(mission.explanation)}</p><div class="actions"><button class="button" data-action="assist-confirm">Теперь понятно</button><button class="text-button" data-action="close-dialog">Подумать ещё</button></div>`);return;
  }
  if(action==='assist-confirm'&&progress?.phase==='puzzle'){const result=solveWithHelp(quest,progress);if(result.correct){progress=result.progress;saveProgress();closeDialog();renderGame(true);celebrateQuestResult(result);}return;}
  if(action==='preview-question'){
    const mission=createQuest(draft).missions[0];
    showDialog('Попробуйте первую загадку','Это проверка для взрослого. Тайник, готовность и сохранённая игра останутся на месте.',`<h3 class="preview-title">${escape(mission.title)}</h3><p class="preview-prompt">${escape(mission.prompt)}</p>${winterVisual(mission)}${mission.interaction?'<p>В предпросмотре выберите готовый ответ из списка ниже.</p>':''}${winterChoices(mission,[],'preview-answer')}<p id="preview-feedback" class="hint-text" role="status"></p><button class="button" data-action="close-dialog">Вернуться к подготовке</button>`);return;
  }
  if(action==='preview-answer'){
    const mission=createQuest(draft).missions[0],index=Number(target.dataset.answer);
    document.querySelector('#preview-feedback').textContent=index===mission.answerIndex?'Верно! '+mission.explanation:'Пока не сходится. '+mission.hint;return;
  }
  if(action==='shuffle-puzzles'){showDialog('Подобрать другие загадки?','Имя, возраст, формат и тайники сохранятся. Этот квест получит новый набор. Сохранения уже начатых игр останутся доступны по прежним ссылкам.','<div class="actions"><button class="button" data-action="confirm-shuffle">Подобрать новый набор</button><button class="text-button" data-action="close-dialog">Оставить как есть</button></div>');return;}
  if(action==='confirm-shuffle'){const previous=draft.seed;draft.seed=randomSeed();if(draft.seed===previous)draft.seed=previous===2147483647?1:previous+1;draft.edition=3;ready=false;saveDraft();closeDialog();renderEditor(true);notify('Новый набор загадок готов. Имя, формат и место подарка сохранены.');return;}
  if(action==='home'){if(IS_SHARED){location.assign('/');return;}navigate('');return;}
  if(action==='create'){step=draft.name?draft.step||1:1;navigate('#create');return;}
  if(action==='demo'){navigate('#demo');return;}
  if(action==='resume-home'){const saved=resumableDraft();if(saved)navigate('#play='+encodeConfig(saved.quest.config));return;}
  if(action==='next-screen'){const result=continueScreenQuest(quest,progress);if(result.correct){progress=result.progress;saveProgress();renderGame(true);}return;}
  if(action==='handwrite'){document.querySelector('#cards-plan')?.scrollIntoView?.({block:'start'});document.querySelector('#cards-plan')?.focus();notify('Перепишите по одному коду на каждом листке и разложите карточки по этому плану.');return;}
  if(action==='game-help'){showDialog('Как играть',quest.config.edition===3&&quest.config.theme==='winter'?'Пройди четыре станции новогодней почты. В одних заданиях выбирай картинку, в других вводи код или нажимай на предметы по порядку. Свой ответ можно изменить до проверки. За каждое решение ты получаешь печать. Если трудно, открой подсказку или «Разобрать вместе». В финале восстановится адрес подарка.':isScreenMode(quest.config)?'Решай загадки по очереди: нажимай на верный ответ, затем на «Следующая загадка». Между заданиями ничего искать и вводить не нужно. Если трудно, открой подсказку. В финале появится место подарка.':'Выбери верный ответ. Игра покажет тайник: найди там бумажную карточку и введи её четыре цифры. Последняя загадка приведёт к подарку — карточка там не нужна.', '<button class="button" data-action="close-dialog">Понятно, играем</button>');return;}
  if(action==='return-setup'&&!isDemo&&quest){draft={...quest.config,route:[...quest.config.route],step:3};step=3;ready=false;saveDraft();closeDialog();navigate('#create');return;}
  if(action==='remember-format'){storage.set(FORMAT_KEY,currentFormat());renderEditor();document.querySelector('[data-action="forget-format"]')?.focus({preventScroll:true});notify(storageAvailable?'Формат сохранён для новых квестов.':'Формат запомнен в этой вкладке.');return;}
  if(action==='forget-format'){storage.set(FORMAT_KEY,null);renderEditor();(document.querySelector('[data-action="remember-format"]')||document.querySelector('#editor-title'))?.focus({preventScroll:true});notify('Шаблон удалён. Текущий квест сохранён.');return;}
  if(action==='new-quest'){showDialog('Собрать новый квест?',`Текущий черновик будет заменён. Чтобы вернуться к прежнему квесту, сначала сохраните его ссылку или HTML-файл.${storageAvailable?' Прогресс по сохранённой ссылке останется в этом браузере.':' Не закрывайте и не обновляйте вкладку: прогресс хранится только в её памяти.'}`,'<div class="actions"><button class="button" data-action="confirm-new-quest">Создать новый квест</button><button class="text-button" data-action="close-dialog">Отмена</button></div>');return;}
  if(action==='confirm-new-quest'){draft=initialDraft();step=1;ready=false;saveDraft();closeDialog();if(location.hash==='#create')renderEditor(true);else navigate('#create');window.scrollTo(0,0);return;}
  if(action==='demo-restart'&&isDemo){progress=freshProgress();saveProgress();renderGame(true);return;}
  if(action==='step'){const value=Number(target.dataset.step);if(value>=1&&value<step)setStep(value);return;}
  if(action==='move'){
    const i=draft.route.indexOf(target.dataset.id), next=i+Number(target.dataset.direction);
    if(i>=0&&next>=0&&next<draft.route.length){[draft.route[i],draft.route[next]]=[draft.route[next],draft.route[i]];delete draft.screenOrder;saveDraft();renderEditor();const focus=app.querySelector(`[data-action="move"][data-id="${target.dataset.id}"][data-direction="${target.dataset.direction}"]`);(focus&&!focus.disabled?focus:app.querySelector(`[data-action="move"][data-id="${target.dataset.id}"]:not(:disabled)`))?.focus();}
    return;
  }
  if(action==='prepare'){try{validateConfig(draft);setStep(3);}catch(error){document.querySelector('#route-error').textContent=error.message;}return;}
  if(action==='print'){if(!isScreenMode(draft)){makePrintCards();window.print();}return;}
  if(action==='download'){downloadGame(target);return;}
  if(action==='copy-link'){copyLink();return;}
  if(action==='play'&&ready){
    const prepared=createQuest(draft);
    const previous=readProgress(storage.get(`bureau:progress:v1:${prepared.id}`),prepared.missions.length);
    if(previous.phase==='done'){
      showDialog('Эта игра уже пройдена',`${isScreenMode(draft)?'Подарок снова спрятан?':'Карточки и подарок снова на своих местах?'} Новый запуск сбросит прогресс только этого квеста.`, '<div class="actions"><button class="button" data-action="restart-prepared">Начать заново</button><button class="text-button" data-action="close-dialog">Вернуться к подготовке</button></div>');
    }else navigate('#play='+encodeConfig(draft));
    return;
  }
  if(action==='restart-request'){if(!ready){notify(isScreenMode(draft)?'Сначала подтвердите, что подарок спрятан.':'Сначала подтвердите, что карточки и подарок готовы.');return;}showDialog('Начать квест заново?',`${isScreenMode(draft)?'Снова спрячьте подарок в выбранном месте.':'Карточки и подарок должны снова лежать на своих местах.'} Прогресс этого квеста будет сброшен.`,'<div class="actions"><button class="button" data-action="restart-prepared">Начать заново</button><button class="text-button" data-action="close-dialog">Отмена</button></div>');return;}
  if(action==='restart-prepared'&&ready){const prepared=createQuest(draft);storage.set(`bureau:progress:v1:${prepared.id}`,freshProgress());closeDialog();navigate('#play='+encodeConfig(draft));return;}
  if(action==='start'){progress={...progress,phase:'puzzle',startedAt:progress.startedAt||Date.now()};saveProgress();renderGame(true);return;}
  if(['task-key','task-back','task-toggle','task-clear','task-check','task-undo'].includes(action)&&progress?.phase==='puzzle'){
    const mission=quest.missions[progress.index],task=mission.interaction;if(!task)return;
    let value=puzzleInput(mission,progress);
    if(action==='task-check'){
      const result=attemptTask(quest,progress);progress=result.progress;saveProgress();renderGame(result.correct);celebrateQuestResult(result);
      if(result.incomplete){const feedback=document.querySelector('#answer-feedback');feedback.textContent=task.type==='code'?`Нужно ввести ${task.length} цифры. Пока код не полный.`:`Сначала выбери все элементы: ${task.count}.`;feedback.focus();}
      else if(!result.correct)document.querySelector('#answer-feedback')?.focus();
      return;
    }
    if(action==='task-undo'){progress=undoPuzzleInput(quest,progress);saveProgress();renderGame();restoreTaskFocus(target);return;}
    if(action==='task-clear')value=task.type==='code'?'':[];
    if(action==='task-key'&&task.type==='code')value=(value+target.dataset.value).slice(0,task.length);
    if(action==='task-back'&&task.type==='code')value=value.slice(0,-1);
    if(action==='task-toggle'&&task.type!=='code'){
      const id=target.dataset.value;if(!task.items.some(item=>item.id===id))return;
      if(value.includes(id))value=value.filter(item=>item!==id);
      else if(value.length<(task.type==='switches'?task.items.length:task.count))value=[...value,id];
      else {document.querySelector('#answer-feedback').textContent='Все места заняты. Нажми на выбранный элемент, чтобы убрать его.';document.querySelector('#answer-feedback').focus();return;}
    }
    progress=setPuzzleInput(quest,progress,value);saveProgress();renderGame();
    restoreTaskFocus(target);return;
  }
  if(action==='answer'){
    if(quest.missions[progress.index]?.interaction)return;
    const result=attemptMission(quest,progress,Number(target.dataset.answer));
    progress=result.progress;saveProgress();renderGame(result.correct);celebrateQuestResult(result);
    if(!result.correct)document.querySelector('#answer-feedback')?.focus();
    return;
  }
  if(action==='hint'){
    progress=toggleHint(progress,progress.index);saveProgress();const hint=document.querySelector('#mission-hint'),open=isHintOpen(progress,progress.index);hint.hidden=!open;const audio=document.querySelector('#hint-audio');if(audio)audio.hidden=!open;if(!open&&questReader.kind()==='hint')questReader.stop();target.setAttribute('aria-expanded',String(open));target.textContent=open?'Скрыть подсказку':'Нужна подсказка?';if(open)hint.scrollIntoView?.({block:'nearest',behavior:'smooth'});return;
  }
  if(action==='demo-card'&&isDemo){const result=confirmCard(quest,progress,cardCodes(quest)[progress.index]);progress=result.progress;saveProgress();renderGame(true);return;}
  if(action==='finish'&&progress.phase==='treasure'){progress.phase='done';saveProgress();renderGame(true);return;}
  if(action==='certificate'&&!isDemo){
    printRoot.innerHTML=`<article class="certificate-print"><p>БЮРО НАХОДОК</p><h1>Диплом<br>исследователя</h1><h2>${escape(quest.config.name)}</h2><p>Разгадано загадок: ${quest.missions.length}.<br>${isScreenMode(quest.config)?'Все загадки решены, место подарка найдено.':'Все тайники найдены, маршрут пройден, подарок получен.'}</p><p style="margin-top:40px">${quest.config.theme==='winter'?'С Новым годом! До следующего приключения!':'До следующего приключения!'}</p></article>`;window.print();return;
  }
  if(action==='pause'){questReader.stop();showDialog('Игра на паузе',storageAvailable?'Прогресс сохраняется в этом браузере. Можно сделать перерыв и вернуться по той же ссылке.':'Прогресс хранится в памяти этой вкладки. Можно вернуться на главную и снова открыть ту же игру. Не закрывайте и не обновляйте вкладку.',`<div class="actions"><button class="button" data-action="close-dialog">Продолжить игру</button><button class="text-button" data-action="home">На главную</button>${!isDemo&&!IS_SHARED?'<button class="text-button" data-action="return-setup">Подготовка для взрослого</button>':''}</div>`);return;}
  if(action==='beta-info'){showDialog('Открытый тест', 'В тестовой версии все функции бесплатны. Попробуйте подготовить квест и пройти его с ребёнком. После игры расскажите тому, кто пригласил вас в тест: был ли понятен запуск, подошла ли сложность и на каком устройстве вы играли. Если что-то не сработало, опишите последний успешный шаг. Имя ребёнка и ссылку на его квест присылать не нужно.', '<button class="button" data-action="close-dialog">Понятно</button>');return;}
  if(action==='data-info'){showDialog('Как хранятся данные', 'Приложение хранит имя или прозвище, настройки и прогресс в вашем браузере. Оно не отправляет введённые данные на сервер. Ссылка и скачанный файл содержат имя, место подарка или маршрут и финальную записку — передавайте их только участникам игры. Достаточно прозвища; фамилия и адрес не нужны. Очистка данных браузера может удалить сохранения. При предупреждении о недоступном сохранении не закрывайте и не обновляйте вкладку.', '<button class="button" data-action="close-dialog">Понятно</button>');return;}
  if(action==='close-dialog'){closeDialog();syncQuestSoundscape();return;}
}
document.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(!target||target.disabled)return;event.preventDefault();handleAction(target);});
app.addEventListener('input',event=>{const target=event.target;if(target.name==='music-volume'){const volume=Number(target.value)/100;questAudio.setVolume(volume);storage.set('bureau:music-volume:v1',volume);return;}if(target.name==='puzzle-code'&&progress?.phase==='puzzle'){progress=setPuzzleInput(quest,progress,target.value);target.value=puzzleInput(quest.missions[progress.index],progress);const counter=document.querySelector('#task-progress');if(counter)counter.textContent=`Набрано ${target.value.length} из ${quest.missions[progress.index].interaction.length}`;syncWorkbench(quest.missions[progress.index]);saveProgress();return;}if(['child-name','gift-note'].includes(target.name)){updateDraftField(target);syncSidebar();target.removeAttribute('aria-invalid');document.querySelector(target.name==='gift-note'?'#note-error':'#name-error').textContent='';}});
app.addEventListener('change',event=>{
  const target=event.target;
  if(['age','theme'].includes(target.name)){updateDraftField(target);syncSidebar();}
  if(target.name==='mode'){draft.mode=target.value;if(isScreenMode(draft))setScreenRoute(draft.route.at(-1),draft.route.length);saveDraft();renderEditor();app.querySelector(`input[name="mode"][value="${target.value}"]`)?.focus({preventScroll:true});}
  if(target.name==='gift-location'||target.name==='question-count'){setScreenRoute(target.name==='gift-location'?target.value:draft.route.at(-1),target.name==='question-count'?Number(target.value):draft.route.length);saveDraft();renderEditor();app.querySelector(`input[name="${target.name}"][value="${target.value}"]`)?.focus({preventScroll:true});}
  if(target.name==='location'){
    if(target.checked){if(draft.route.length>=8){target.checked=false;notify('В одном квесте может быть до 8 тайников.');return;}draft.route.push(target.value);}else{draft.route=draft.route.filter(id=>id!==target.value);}
    delete draft.screenOrder;saveDraft();renderEditor();app.querySelector(`input[name="location"][value="${target.value}"]`)?.focus({preventScroll:true});
  }
  if(target.id==='ready-check'){ready=target.checked;app.querySelector('[data-action="play"]').disabled=!ready;const helper=app.querySelector('#ready-helper');if(helper)helper.hidden=ready;}
});
app.addEventListener('submit',event=>{
  event.preventDefault();
  if(event.target.id==='settings-form'){
    try{validateConfig({...draft,route:['books','sofa','desk','bed']});setStep(2);}catch(error){const isNote=error.message.startsWith('Записка');if(isNote){const extra=document.querySelector('#extra-settings');if(extra)extra.open=true;}const input=document.querySelector(isNote?'#gift-note':'#child-name');input.setAttribute('aria-invalid','true');document.querySelector(isNote?'#note-error':'#name-error').textContent=error.message;input.focus();}
  }
  if(event.target.id==='puzzle-form'){handleAction({dataset:{action:'task-check'}});return;}
  if(event.target.id==='code-form'){
    const input=document.querySelector('#card-code');const result=confirmCard(quest,progress,input.value);
    if(result.correct){progress=result.progress;saveProgress();renderGame(true);}else{input.setAttribute('aria-invalid','true');document.querySelector('#code-feedback').textContent='Код не совпал. Проверь четыре цифры на найденной карточке.';input.select();}
  }
});
document.addEventListener('keydown',event=>{
  const dialog=document.querySelector('.dialog-backdrop');if(!dialog)return;
  if(event.key==='Escape'){event.preventDefault();closeDialog();syncQuestSoundscape();}
  if(event.key==='Tab'){const items=[...dialog.querySelectorAll('button,a,input,select,textarea,summary,[tabindex]')].filter(el=>!el.disabled&&el.getAttribute('tabindex')!=='-1'&&(!el.getClientRects||el.getClientRects().length>0));if(!items.length){event.preventDefault();return;}const first=items[0],last=items.at(-1);if(!items.includes(document.activeElement)){event.preventDefault();(event.shiftKey?last:first).focus();}else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
});
window.addEventListener('hashchange',route);
window.addEventListener('pagehide',()=>{questReader.stop();questAudio.stop();objectDrag.cancel();questMotion.setActive(false);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)questReader.stop();syncQuestSoundscape();});
if(document.body.dataset.startQuest&&!location.hash)history.replaceState(null,'','#play='+document.body.dataset.startQuest);
route();
