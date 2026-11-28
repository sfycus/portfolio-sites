import { puzzleInput, setPuzzleInput, attemptTask, attemptMission } from './flow.js';

const objectEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

/** The pictured evidence chooses the mechanic; no answer metadata is used. */
export function objectKind(mission) {
  const visual = mission?.visual, task = mission?.interaction;
  if (visual?.type === 'row' && task?.type === 'code' && visual.items?.every(item=>item.kind==='house'&&/^\d$/.test(String(item.number)))) return 'mailboxes';
  if (visual?.type === 'envelope' && !task && Array.isArray(mission.choices) && mission.choices.every(choice=>mission.choiceArt?.[choice]?.kind==='house')) return 'mailboxes';
  if (visual?.type === 'fold' && !task && Array.isArray(mission.choices) && mission.choices.every(choice=>Array.isArray(mission.choiceArt?.[choice]?.cells))) return 'snowflake';
  if (visual?.type === 'clock' && task?.type === 'code' && /^\d{2}:\d{2}$/.test(visual.start)) return 'clock';
  if (visual?.type === 'legend' && task?.type === 'code' && Array.isArray(visual.items) && Array.isArray(visual.target)) return 'stamps';
  if (['garland','shadow'].includes(visual?.type) && !task && Array.isArray(mission.choices)) return 'ornament';
  if (task?.type === 'order' && Array.isArray(task.items)) return 'assembly';
  if (visual?.type === 'grid' && task?.type === 'code' && visual.cells?.some(cell => String(cell).includes('СТАРТ'))) return 'route';
  if (task?.type === 'pick' && Array.isArray(task.items)) return 'cargo';
  return null;
}

function objectHouses(mission) {
  return mission.interaction ? mission.visual.items : mission.choices.map(label=>({...mission.choiceArt[label],label}));
}
function objectLetters(mission) {
  const count=mission.interaction?.length||1;
  const clues=[...String(mission.prompt||'').matchAll(/Письмо\s+\d:\s*([^]*?)(?=Письмо\s+\d:|Введи|$)/g)].map(match=>match[1].trim());
  return Array.from({length:count},(_,index)=>({id:`letter${index}`,kind:'envelope',label:`Письмо ${index+1}`,clue:clues[index]||mission.prompt,symbols:mission.visual.symbols}));
}
function objectClockStart(mission) {
  const [hour,minute]=mission.visual.start.split(':').map(Number);
  return (hour*60+minute)%1440;
}
function objectClockSlots(total) {
  const wrapped=((total%1440)+1440)%1440;
  return ['hour'+Math.floor(wrapped/60),'minute'+wrapped%60];
}
function objectClockTotal(slots) {return Number(slots[0].slice(4))*60+Number(slots[1].slice(6));}
function objectClockText(slots) {return String(Number(slots[0].slice(4))).padStart(2,'0')+':'+String(Number(slots[1].slice(6))).padStart(2,'0');}

function objectItems(mission, kind) {
  if (kind === 'mailboxes') return objectLetters(mission);
  if (kind === 'snowflake') return Array.from({length:16},(_,cell)=>({id:`hole${cell}`,cell,label:`Строка ${Math.floor(cell/4)+1}, столбец ${cell%4+1}`}));
  if (kind === 'clock') return [...Array.from({length:24},(_,n)=>({id:'hour'+n,label:String(n)})),...Array.from({length:60},(_,n)=>({id:'minute'+n,label:String(n)}))];
  if (kind === 'stamps') return mission.visual.items.map((item,index) => ({...item,id:`stamp${index}`}));
  if (kind === 'ornament') return mission.choices.map((label,index) => ({...(mission.choiceArt?.[label] || {kind:'ball'}),label,id:`choice${index}`}));
  if (kind === 'route') return mission.visual.cells.map((label,index) => ({id:`cell${index}`,label:String(label),cell:index}));
  return (mission.interaction?.items || []).map(item => ({...item}));
}
function objectSlotCount(mission, kind) {
  const count=kind==='mailboxes'?objectHouses(mission).length:kind==='snowflake'?4:kind==='clock'?2:kind==='ornament'?1:['stamps','route'].includes(kind)?mission.interaction.length:mission.interaction.count;
  return Number.isInteger(count)?Math.max(1,Math.min(6,count)):1;
}
function objectInitialSlots(mission,progress,kind,items,size) {
  const value=puzzleInput(mission,progress);
  if(kind==='clock') {
    if(typeof value==='string'&&/^\d{4}$/.test(value)&&Number(value.slice(0,2))<24&&Number(value.slice(2))<60)return ['hour'+Number(value.slice(0,2)),'minute'+Number(value.slice(2))];
    return objectClockSlots(objectClockStart(mission));
  }
  if(kind==='mailboxes'&&typeof value==='string') {
    const slots=Array(size).fill(''),houses=objectHouses(mission);
    [...value].forEach((number,index)=>{const target=houses.findIndex(house=>String(house.number)===number);if(target>=0&&items[index])slots[target]=items[index].id;});return slots;
  }
  if(kind==='stamps'&&typeof value==='string')return [...value].map(char=>items.find(item=>String(item.value)===char)?.id||'').slice(0,size);
  if(kind==='route'&&typeof value==='string')return [...value].map(char=>items.find(item=>item.label===char)?.id||'').slice(0,size);
  return Array.isArray(value)?value.slice(0,size):[];
}

/** A bounded, answer-independent view of the saved objects on the current desk. */
export function objectState(mission,progress) {
  const kind=objectKind(mission);if(!kind||!progress)return null;
  const items=objectItems(mission,kind),size=objectSlotCount(mission,kind),saved=progress.sceneState?.index===progress.index?progress.sceneState:null;
  const supplied=saved&&Array.isArray(saved.slots)?saved.slots:objectInitialSlots(mission,progress,kind,items,size);
  const slots=Array(size).fill(''),seen=new Set();
  for(let index=0;index<size;index++) {
    const id=supplied[index];if(typeof id!=='string'||!items.some(item=>item.id===id))continue;
    if(['assembly','cargo','mailboxes','snowflake'].includes(kind)&&seen.has(id))continue;
    if(kind==='clock'&&!(index===0?/^hour(?:[0-9]|1[0-9]|2[0-3])$/:/^minute(?:[0-9]|[1-5][0-9])$/).test(id))continue;
    if(kind==='route'&&(index>0&&!slots[index-1]||!/^\d$/.test(items.find(item=>item.id===id).label)))continue;
    slots[index]=id;seen.add(id);
  }
  if(kind==='clock'&&!slots.every(Boolean))slots.splice(0,2,...objectInitialSlots(mission,progress,kind,items,size));
  const selected=kind==='clock'?(/^undo-?(?:1|5|60)$/.test(saved?.selected||'')?saved.selected:''):typeof saved?.selected==='string'&&items.some(item=>item.id===saved.selected)?saved.selected:'';
  const filled=slots.filter(Boolean).length,required=kind==='mailboxes'?items.length:size;
  const revealed=kind==='mailboxes'?[...new Set((Array.isArray(saved?.revealed)?saved.revealed:[]).filter(id=>items.some(item=>item.id===id)))].slice(0,3):[];
  const legacyClock=kind==='clock'&&typeof puzzleInput(mission,progress)==='string'&&puzzleInput(mission,progress).length===4;
  return {kind,items,size,required,slots,selected,filled,revealed,opened:saved?saved.opened===true:kind==='clock'?legacyClock:filled>0};
}
function objectWithState(quest,progress,state) {
  const sceneState={index:progress.index,opened:state.opened,selected:state.selected,slots:[...state.slots],...(state.kind==='mailboxes'?{revealed:[...state.revealed]}:{})};
  let next={...progress,sceneState};
  if(state.kind==='ornament'||state.kind==='snowflake'||state.kind==='mailboxes'&&!quest.missions[progress.index].interaction)return next;
  let value;
  if(state.kind==='clock')value=objectClockText(state.slots).replace(':','');
  else if(state.kind==='mailboxes') {
    const houses=objectHouses(quest.missions[progress.index]);
    value=state.slots.filter(Boolean).length===state.required?state.items.map(item=>String(houses[state.slots.indexOf(item.id)]?.number||'')).join(''):'';
  } else if(state.kind==='stamps')value=state.slots.every(Boolean)?state.slots.map(id=>String(state.items.find(item=>item.id===id).value)).join(''):'';
  else if(state.kind==='route')value=state.slots.filter(Boolean).map(id=>state.items.find(item=>item.id===id).label).join('');
  else value=state.slots.filter(Boolean);
  return setPuzzleInput(quest,next,value);
}
function objectPlace(state,id,slot) {
  const next={...state,slots:[...state.slots],selected:''};
  if(state.kind!=='stamps') {const previous=state.slots.indexOf(id);if(previous>=0&&previous!==slot)next.slots[previous]=state.slots[slot];}
  next.slots[slot]=id;return next;
}
function objectIncorrectPattern(quest,progress,mission) {
  const tried=progress.mistakes?.[progress.index]||[];
  const untried=mission.choices.findIndex((_,index)=>index!==mission.answerIndex&&!tried.includes(index));
  const answer=untried>=0?untried:mission.choices.findIndex((_,index)=>index!==mission.answerIndex);
  return attemptMission(quest,progress,answer);
}

/** All object operations preserve the existing canonical puzzle checker. */
export function applyObjectAction(quest,progress,{action,value,slot}={}) {
  const mission=quest?.missions?.[progress?.index],state=objectState(mission,progress);
  const accepted=['object-open','object-select','object-slot','object-place','object-remove','object-check','object-undo','object-reset','object-step','object-envelope','object-hole','object-clock'];
  if(!state||progress?.phase!=='puzzle'||!accepted.includes(action))return {handled:false,progress};
  const firstFocus=state.kind==='route'?'object-route-'+state.items.find(item=>/^\d$/.test(item.label))?.id:state.kind==='mailboxes'?'object-envelope-'+state.items[0].id:state.kind==='snowflake'?'object-hole-hole0':state.kind==='clock'?'object-clock-five-plus':'object-item-'+state.items[0]?.id;
  const reply=(next,feedback='',focus='')=>({handled:true,progress:objectWithState(quest,progress,next),feedback,...(focus?{focus}:{})});
  if(action==='object-open')return reply({...state,opened:true},'Письмо открыто. Можно приступать.',firstFocus);
  if(!state.opened)return {handled:true,progress,feedback:'Сначала открой письмо Снегиря.',focus:'object-open'};
  if(action==='object-check') {
    if(state.filled!==state.required)return {...reply(state,state.kind==='snowflake'?'Наметь четыре отверстия на развёрнутом листе.':'Сначала заполни все места. Можно переставлять предметы и убирать лишние.'),correct:false,incomplete:true};
    const prepared=objectWithState(quest,progress,state);let result;
    if(state.kind==='ornament')result=attemptMission(quest,prepared,Number(state.slots[0].slice('choice'.length)));
    else if(state.kind==='mailboxes'&&!mission.interaction)result=attemptMission(quest,prepared,state.slots.findIndex(Boolean));
    else if(state.kind==='snowflake') {
      const holes=state.slots.map(id=>Number(id.slice(4))).sort((a,b)=>a-b);
      const index=mission.choices.findIndex(choice=>{const cells=[...mission.choiceArt[choice].cells].sort((a,b)=>a-b);return cells.length===holes.length&&cells.every((cell,i)=>cell===holes[i]);});
      result=index>=0?attemptMission(quest,prepared,index):objectIncorrectPattern(quest,prepared,mission);
    } else result=attemptTask(quest,prepared);
    return {handled:true,...result,feedback:result.correct?'':result.incomplete?'Сначала собери ответ целиком.':state.kind==='clock'?'Проверь, сколько минут осталось до полуночи и сколько займёт полёт после неё.':state.kind==='snowflake'?'Пока отверстия не совпадают после двух сгибов. Каждый сгиб отражает отверстие как зеркало.':'Пока не сходится. Переставь предметы или открой подсказку.'};
  }
  if(action==='object-reset')return reply({...state,slots:state.kind==='clock'?objectClockSlots(objectClockStart(mission)):Array(state.size).fill(''),selected:''},state.kind==='clock'?'Вернули время вылета.':'Можно собрать заново.',firstFocus);
  if(action==='object-undo') {
    if(state.kind==='clock') {
      if(!state.selected)return {handled:true,progress,feedback:'Сначала передвинь стрелки.'};
      const delta=Number(state.selected.slice(4));return reply({...state,slots:objectClockSlots(objectClockTotal(state.slots)-delta),selected:''},'Последний перевод стрелок отменён.',firstFocus);
    }
    const slots=[...state.slots],last=slots.reduce((found,id,index)=>id?index:found,-1);if(last>=0)slots[last]='';
    return reply({...state,slots,selected:''},last>=0?'Последний предмет возвращён на стол.':'На столе пока ничего не собрано.');
  }
  if(action==='object-envelope') {
    if(state.kind!=='mailboxes'||!state.items.some(item=>item.id===value))return {handled:true,progress};
    const revealed=state.revealed.includes(value)?state.revealed.filter(id=>id!==value):[...state.revealed,value];
    return reply({...state,revealed},revealed.includes(value)?'Письмо раскрыто. Прочитай приметы получателя.':'Письмо сложено.','object-envelope-'+value);
  }
  if(action==='object-clock') {
    if(state.kind!=='clock')return {handled:true,progress};
    const delta={'hour-plus':60,'hour-minus':-60,'five-plus':5,'five-minus':-5,'minute-plus':1,'minute-minus':-1}[value];
    if(!delta)return {handled:true,progress};
    const next={...state,slots:objectClockSlots(objectClockTotal(state.slots)+delta),selected:'undo'+delta};
    return reply(next,'На часах '+objectClockText(next.slots)+'.','object-clock-'+value);
  }
  if(action==='object-hole') {
    if(state.kind!=='snowflake'||!state.items.some(item=>item.id===value))return {handled:true,progress};
    const chosen=state.slots.filter(Boolean);let next;
    if(chosen.includes(value))next=chosen.filter(id=>id!==value);
    else if(chosen.length<state.required)next=[...chosen,value];
    else return {handled:true,progress,feedback:'Уже четыре отверстия. Нажми на лишнее, чтобы убрать его.'};
    return reply({...state,slots:[...next,...Array(state.required-next.length).fill('')]},`Намечено отверстий: ${next.length} из ${state.required}.`,'object-hole-'+value);
  }
  if(action==='object-step') {
    if(state.kind!=='route')return {handled:true,progress};
    const target=state.items.find(item=>item.id===value);if(!target||!/^\d$/.test(target.label))return {handled:true,progress,feedback:'Выбери соседнюю клетку с цифрой.'};
    const path=state.slots.filter(Boolean);if(path.length>=state.size)return {handled:true,progress,feedback:'Маршрут собран. Проверь его или убери последний шаг.'};
    const start=mission.visual.cells.findIndex(cell=>String(cell).includes('СТАРТ')),current=path.length?state.items.find(item=>item.id===path.at(-1)).cell:start,columns=mission.visual.columns||3;
    const distance=Math.abs(Math.floor(current/columns)-Math.floor(target.cell/columns))+Math.abs(current%columns-target.cell%columns);
    if(distance!==1)return {handled:true,progress,feedback:'Сани летят по одной соседней клетке. По диагонали нельзя.'};
    const slots=[...state.slots];slots[path.length]=target.id;return reply({...state,slots,selected:''},`Шаг ${path.length+1}: клетка ${target.label}.`,'object-route-'+target.id);
  }
  if(['route','snowflake','clock'].includes(state.kind))return {handled:true,progress};
  if(action==='object-select') {
    const item=state.items.find(item=>item.id===value);if(!item)return {handled:true,progress};
    if(state.kind==='mailboxes'&&!state.revealed.includes(value))return {handled:true,progress,feedback:'Сначала раскрой письмо и прочитай приметы.'};
    const selected=state.selected===value?'':value;return reply({...state,selected},selected?`Выбрано: ${item.label}. Теперь нажми на нужное место.`:'Предмет отпущен.');
  }
  const targetSlot=typeof slot==='number'?slot:/^\d$/.test(String(slot))?Number(slot):-1;
  if(!Number.isInteger(targetSlot)||targetSlot<0||targetSlot>=state.size)return {handled:true,progress};
  if(action==='object-remove') {const slots=[...state.slots];slots[targetSlot]='';return reply({...state,slots,selected:''},'Предмет возвращён на стол.',`object-slot-${targetSlot}`);}
  const itemId=action==='object-place'?value:state.selected;
  if(!itemId) {
    const occupied=state.slots[targetSlot];if(occupied)return reply({...state,selected:occupied},'Предмет выбран. Нажми на другое место, чтобы переставить его.',`object-slot-${targetSlot}`);
    return {handled:true,progress,feedback:'Сначала выбери предмет на столе, затем нажми на это место.',focus:'object-item-'+state.items[0]?.id};
  }
  if(!state.items.some(item=>item.id===itemId))return {handled:true,progress};
  if(state.kind==='mailboxes'&&!state.revealed.includes(itemId))return {handled:true,progress,feedback:'Сначала раскрой письмо и прочитай приметы.'};
  return reply(objectPlace(state,itemId,targetSlot),'Предмет на месте. Можно продолжать.',`object-slot-${targetSlot}`);
}

function objectToken(item,state,iconFn) {
  const selected=state.selected===item.id, placed=state.slots.includes(item.id);
  const value=state.kind==='stamps'?`<span class="object-token-value">${objectEscape(item.value)}</span>`:'';
  return `<button type="button" class="object-token${selected?' object-picked':''}${placed?' object-used':''}" data-action="object-select" data-object-item="${objectEscape(item.id)}" data-value="${objectEscape(item.id)}" data-focus="object-item-${objectEscape(item.id)}" aria-pressed="${selected}" aria-label="Взять: ${objectEscape(item.label)}${state.kind==='stamps'?', номер '+objectEscape(item.value):''}"><span class="object-token-symbol">${iconFn(item)}</span>${value}<span class="object-token-label">${objectEscape(item.label)}</span>${placed&&state.kind!=='stamps'?'<small>Уже на месте</small>':''}</button>`;
}

function objectSlot(mission,state,index,iconFn,label='') {
  const id=state.slots[index], item=state.items.find(item=>item.id===id), target=state.kind==='stamps'?mission.visual.target[index]:null;
  const selected=!!id&&state.selected===id;
  return `<div class="object-slot-wrap">${target?`<span class="object-target-symbol">${iconFn(target)}<span class="visually-hidden">Оттиск ${index+1}: ${objectEscape(target.label)}</span></span>`:''}<button type="button" class="object-slot${id?' object-filled':' object-empty'}${selected?' object-picked':''}" data-action="object-slot" data-object-slot="${index}" data-slot="${index}" data-focus="object-slot-${index}"${id?` data-object-item="${objectEscape(id)}" data-value="${objectEscape(id)}"`:''} aria-label="${objectEscape(label||'Место '+(index+1))}${item?': '+objectEscape(item.label):': пусто'}"><span class="object-slot-label">${objectEscape(label||'Место '+(index+1))}</span>${item?`${iconFn(item)}<span class="object-slot-item-label">${objectEscape(state.kind==='stamps'?item.value:item.label)}</span>`:'<span class="object-slot-placeholder" aria-hidden="true">+</span>'}</button>${item?`<button class="object-remove" type="button" data-action="object-remove" data-slot="${index}" data-focus="object-remove-${index}" aria-label="Убрать ${objectEscape(item.label)} с места ${index+1}">Убрать</button>`:''}</div>`;
}

function objectAssemblyPreview(mission,state,iconFn) {
  const assembly=mission.visual?.type||'parcel';
  const chosen=state.slots.map(id=>state.items.find(item=>item.id===id));
  return `<div class="object-assembly" data-assembly="${objectEscape(assembly)}"><div class="object-build-preview" role="img" aria-label="${state.filled?'Собранные предметы: '+objectEscape(chosen.filter(Boolean).map(item=>item.label).join(', ')):'Здесь появится твоя работа'}">${chosen.some(Boolean)?chosen.map((item,index)=>item?`<div class="object-build-item" style="--object-layer:${index}" data-object-kind="${objectEscape(item.kind)}">${iconFn(item)}<span>${objectEscape(item.label)}</span></div>`:'').join(''):'<div class="object-build-empty">'+iconFn({kind:assembly==='snowman'?'snowball':assembly==='torn'?'envelope':assembly==='layers'?'card':'gift'})+'<span>Здесь появится твоя работа</span></div>'}</div></div>`;
}

function objectMailWorkspace(mission,state,iconFn) {
  const houses=objectHouses(mission);
  const envelopes=`<div class="object-envelope-row" role="group" aria-label="Письма получателей">${state.items.map(item=>{
    const open=state.revealed.includes(item.id);
    return `<article class="object-envelope${open?' is-open':''}"><button type="button" class="object-envelope-open" data-action="object-envelope" data-value="${item.id}" data-focus="object-envelope-${item.id}" aria-expanded="${open}" aria-label="${open?'Сложить':'Открыть'} ${objectEscape(item.label.toLowerCase())}">${iconFn({kind:'envelope'})}<span class="object-envelope-number">${objectEscape(item.label)}</span><span>${open?'Сложить':'Прочитать приметы'}</span></button>${open?`<div class="object-envelope-body"><p class="object-letter-clue">${objectEscape(item.clue)}</p>${item.symbols?`<div class="object-letter-symbols" aria-label="Знаки на конверте">${item.symbols.map(kind=>iconFn({kind})).join('')}</div>`:''}${objectToken(item,state,iconFn)}</div>`:''}</article>`;
  }).join('')}</div>`;
  const slots=`<div class="object-mail-slots" data-house-count="${houses.length}" role="group" aria-label="Почтовые ящики домов">${houses.map((house,index)=>{
    const id=state.slots[index],item=state.items.find(letter=>letter.id===id),roof=house.roof==='star'?'звезда':house.roof==='moon'?'луна':'',door=house.door==='round'?'круглая дверь':house.door==='square'?'квадратная дверь':'';
    return `<div class="object-mailbox"><div class="object-house-sign">${iconFn(house)}<b>${objectEscape(house.label)}</b>${roof||door?`<small>${objectEscape([roof,door].filter(Boolean).join(', '))}</small>`:''}</div><button type="button" class="object-slot${item?' object-filled':' object-empty'}" data-action="object-slot" data-slot="${index}" data-object-slot="${index}" data-focus="object-slot-${index}"${item?` data-object-item="${item.id}" data-value="${item.id}"`:''} aria-label="Ящик ${objectEscape(house.label)}: ${item?objectEscape(item.label):'пусто'}">${item?iconFn(item):'<span class="object-slot-placeholder" aria-hidden="true">+</span>'}<span>${item?objectEscape(item.label):'Положить письмо'}</span></button>${item?`<button type="button" class="object-remove" data-action="object-remove" data-slot="${index}" data-focus="object-remove-${index}" aria-label="Забрать ${objectEscape(item.label.toLowerCase())} из ящика ${objectEscape(house.label)}">Забрать</button>`:''}</div>`;
  }).join('')}</div>`;
  return `<div class="object-mail-route">${envelopes}${slots}</div>`;
}
function objectSnowflakeWorkspace(state) {
  const guide=`<div class="object-fold-guide" aria-label="Как сложили бумагу"><div class="object-fold-step"><span class="object-fold-mark fold-horizontal" aria-hidden="true"></span><p>Сначала сложили<br>слева направо</p></div><div class="object-fold-step"><span class="object-fold-mark fold-vertical" aria-hidden="true"></span><p>Потом сложили<br>снизу вверх</p></div><div class="object-fold-step"><span class="object-folded-mini" aria-hidden="true"><i class="mini-punched"></i><i></i><i></i><i></i></span><p>На сложенном листе<br>отверстие сверху слева</p></div></div>`;
  const grid=`<div class="object-paper-grid" role="group" aria-label="Развёрнутый лист: четыре строки и четыре столбца">${state.items.map(item=>{
    const punched=state.slots.includes(item.id);
    return `<button type="button" class="object-hole${punched?' is-punched':''}" data-action="object-hole" data-value="${item.id}" data-focus="object-hole-${item.id}" aria-pressed="${punched}" aria-label="${objectEscape(item.label)}${punched?', отверстие намечено':''}"><span class="object-hole-mark" aria-hidden="true">${punched?'✦':'·'}</span></button>`;
  }).join('')}<span class="object-paper-axis axis-horizontal" aria-hidden="true"></span><span class="object-paper-axis axis-vertical" aria-hidden="true"></span></div>`;
  return `<div class="object-snowflake">${guide}<p class="object-instruction">Разверни лист в уме и наметь четыре отверстия. Повторное нажатие убирает отметку.</p>${grid}</div>`;
}
function objectClockWorkspace(mission,state) {
  const hour=Number(state.slots[0].slice(4)),minute=Number(state.slots[1].slice(6)),time=objectClockText(state.slots);
  const numbers=Array.from({length:12},(_,index)=>{const number=index+1;return `<span class="object-clock-number" style="--number-angle:${number*30}deg"><span>${number}</span></span>`;}).join('');
  const controls=[['hour-minus','−1 час','Уменьшить время на один час'],['hour-plus','+1 час','Увеличить время на один час'],['five-minus','−5 минут','Уменьшить время на пять минут'],['five-plus','+5 минут','Увеличить время на пять минут'],['minute-minus','−1 минута','Уменьшить время на одну минуту'],['minute-plus','+1 минута','Увеличить время на одну минуту']];
  return `<div class="object-clock"><div class="object-clock-mission"><span>Вылет <b>${objectEscape(mission.visual.start)}</b></span><span>В пути <b>${objectEscape(mission.visual.duration)} минут</b></span></div><div class="object-clock-face" role="img" aria-label="Часы показывают ${time}">${numbers}<span class="object-clock-hand hour-hand hour" style="--hand-angle:${hour%12*30+minute*.5}deg"></span><span class="object-clock-hand minute-hand minute" style="--hand-angle:${minute*6}deg"></span><span class="object-clock-center"></span></div><p class="object-clock-day">Новогодняя ночь · время прибытия</p><output class="object-clock-readout" aria-live="polite" aria-label="Выбранное время прибытия">${time}</output><div class="object-clock-controls" role="group" aria-label="Передвинуть стрелки">${controls.map(([value,label,aria])=>`<button type="button" data-action="object-clock" data-value="${value}" data-focus="object-clock-${value}" aria-label="${aria}">${label}</button>`).join('')}</div></div>`;
}

/** Rendered controls are the mechanic, rather than a second numeric answer form. */
export function renderObjectPuzzle(mission,progress,iconFn=()=> '') {
  const state=objectState(mission,progress); if(!state)return '';
  const {kind}=state;
  if(!state.opened) return `<section class="object-puzzle" data-object-kind="${kind}" aria-label="Письмо с заданием"><div class="object-letter"><span class="object-letter-label">Северная почта · лично тебе</span><button type="button" class="object-open-button" data-action="object-open" data-focus="object-open" aria-label="Открыть письмо Снегиря">${iconFn({kind:'envelope'})}<span class="object-seal" aria-hidden="true">С</span><span>Открыть письмо Снегиря</span></button><p class="object-letter-note">Снегирь оставил тебе поручение. Нажми на письмо, чтобы узнать, что нужно сделать.</p></div></section>`;
  const instructions={mailboxes:'Раскрой письма, прочитай приметы получателей и разнеси конверты по нужным домам. Можно перетащить письмо или выбрать его и нажать на ящик.',snowflake:'У каждого сгиба есть зеркальная пара. Отметь на большом листе четыре места, где окажутся отверстия после разворота.',clock:'Переведи стрелки с времени вылета на время прибытия. Кнопки двигают их на час, пять минут или одну минуту.',stamps:'Выбери штамп на столе и нажми на место под таким же оттиском. Можно перетаскивать штампы.',ornament:'Выбери подходящую игрушку и нажми на пустое место. Или перетащи её прямо на ветку.',assembly:mission.visual?.type==='torn'?'Соедини обрывки в правильном порядке. Выбери обрывок, затем его место на письме.':mission.visual?.type==='snowman'?'Собери снеговика снизу вверх. Выбери ком и поставь его на нужное место.':mission.visual?.type==='layers'?'Собери открытку по образцу. Выбери наклейку и её место в порядке слоёв.':'Расставь предметы по порядку: выбери предмет, затем место. Для перестановки можно перетаскивать.',route:'Управляй санями: нажимай на соседние клетки по маршруту из письма. Каждый ход — одна клетка.',cargo:'Переложи две посылки на сани. Выбери коробку, затем свободное место. Весы покажут общий вес.'};
  let workspace='';
  if(kind==='mailboxes')workspace=objectMailWorkspace(mission,state,iconFn);
  else if(kind==='snowflake')workspace=objectSnowflakeWorkspace(state);
  else if(kind==='clock')workspace=objectClockWorkspace(mission,state);
  else if(kind==='route') {
    const path=state.slots.filter(Boolean),start=mission.visual.cells.findIndex(cell=>String(cell).includes('СТАРТ')),current=path.at(-1)||'cell'+start;
    workspace=`<div class="object-route" style="--object-columns:${mission.visual.columns||3}" role="group" aria-label="Карта полёта саней">${state.items.map(item=>{const isStart=item.cell===start,visited=path.includes(item.id),here=current===item.id;return `<button type="button" class="object-cell${isStart?' object-start':''}${visited?' object-visited':''}${here?' object-current':''}" data-action="object-step" data-value="${item.id}" data-focus="object-route-${item.id}" aria-label="${isStart?'Старт':`Клетка ${objectEscape(item.label)}`}${here?', сани здесь':''}" ${isStart?'disabled':''}>${here?`<span class="object-route-sleigh">${iconFn({kind:'sleigh'})}</span>`:''}<b>${isStart?'СТАРТ':objectEscape(item.label)}</b>${visited?`<span class="object-path-number">Шаг ${path.lastIndexOf(item.id)+1}</span>`:''}</button>`;}).join('')}</div><ol class="object-path" aria-label="Проложенный маршрут">${state.slots.map((id,index)=>`<li>${index+1}. ${id?objectEscape(state.items.find(item=>item.id===id).label):'…'}</li>`).join('')}</ol>`;
  } else {
    if(kind==='assembly'&&mission.visual?.type==='layers')workspace+=`<div class="object-reference"><p class="object-letter-label">Образец открытки</p><div class="layer-card" role="img" aria-label="Снежинку частично закрывает ёлка, нижние ветви ёлки закрывает подарок${mission.visual.ribbon?', угол подарка закрывает лента':''}">${iconFn({kind:'flake'},'layer-flake')}${iconFn({kind:'tree'},'layer-tree')}${iconFn({kind:'gift'},'layer-gift')}${mission.visual.ribbon?iconFn({kind:'ribbon'},'layer-ribbon'):''}</div></div>`;
    if(kind==='assembly')workspace+=objectAssemblyPreview(mission,state,iconFn);
    if(kind==='ornament'&&mission.visual.type==='garland')workspace+=`<div class="object-garland" aria-label="Узор гирлянды">${mission.visual.items.map(item=>`<span>${iconFn(item)}<span class="visually-hidden">${objectEscape(item.label)}; </span></span>`).join('')}</div>`;
    if(kind==='ornament'&&mission.visual.type==='shadow')workspace+=`<div class="object-shadow-target" role="img" aria-label="${objectEscape(mission.visual.item.label)}">${iconFn(mission.visual.item)}</div>`;
    if(kind==='cargo') {
      const total=state.slots.reduce((sum,id)=>sum+(parseFloat(state.items.find(item=>item.id===id)?.value)||0),0);
      workspace+=`<div class="object-scale">${iconFn({kind:'sleigh'})}<span>На санях</span><b class="object-cargo-total" aria-live="polite">${total} кг</b></div>`;
    }
    const labels=kind==='ornament'?['Место на ёлке']:kind==='cargo'?['Первая посылка','Вторая посылка']:mission.visual?.type==='snowman'?['Нижний ком','Средний ком','Верхний ком']:[];
    workspace+=`<div class="object-slots" role="group" aria-label="${kind==='stamps'?'Места для штампов':kind==='cargo'?'Грузовые места':kind==='ornament'?'Ветка для игрушки':'Порядок сборки'}">${state.slots.map((_,index)=>objectSlot(mission,state,index,iconFn,labels[index])).join('')}</div><div class="object-tray" role="group" aria-label="Предметы на столе">${state.items.map(item=>objectToken(item,state,iconFn)).join('')}</div>`;
  }
  const selected=state.items.find(item=>item.id===state.selected);
  const checkLabel=kind==='mailboxes'?'Доставить письма':kind==='snowflake'?'Развернуть снежинку':kind==='clock'?'Запустить новогодние часы':kind==='stamps'?'Поставить почтовую печать':kind==='ornament'?'Зажечь огни на ёлке':kind==='route'?'Отправить сани':kind==='cargo'?'Проверить загрузку':mission.visual?.type==='torn'?'Прочитать адрес':'Проверить работу';
  return `<section class="object-puzzle" data-object-kind="${kind}" aria-label="Предметная загадка"><div class="object-letter is-open"><span class="object-letter-label">Письмо Снегиря открыто</span><p class="object-letter-note">${objectEscape(instructions[kind])}</p></div><div class="object-workspace">${workspace}</div><p class="object-status" id="object-status" role="status" aria-live="polite">${selected?'В руках: '+objectEscape(selected.label)+'. Нажми на нужное место.':state.kind==='clock'?'Выбрано время прибытия: '+objectClockText(state.slots)+'.':state.kind==='snowflake'?`Намечено отверстий: ${state.filled} из ${state.required}.`:state.kind==='mailboxes'?`Разнесено писем: ${state.filled} из ${state.required}.`:`Готово мест: ${state.filled} из ${state.size}.`}</p><div class="object-controls"><button type="button" class="button" data-action="object-check" data-focus="object-check">${checkLabel}</button><button type="button" class="text-button" data-action="object-undo" data-focus="object-undo" ${kind==='clock'?state.selected?'':'disabled':state.filled?'':'disabled'}>${kind==='clock'?'Отменить перевод':kind==='route'?'Шаг назад':kind==='snowflake'?'Убрать отверстие':'Убрать последний'}</button><button type="button" class="text-button" data-action="object-reset" data-focus="object-reset">Собрать заново</button></div></section>`;
}

/** Mouse/touch dragging is optional: the same visible buttons always support taps and keys. */
export function createObjectDrag({root,onAction=()=>{}}={}) {
  let objectRoot=root, objectDocument=root?.ownerDocument||globalThis.document, objectWindow=objectDocument?.defaultView||globalThis;
  let objectDrag=null, objectDestroyed=false, objectBound=false, objectClickUntil=0;
  function objectClearTarget() {objectDrag?.drop?.classList?.remove('object-drop-target');if(objectDrag)objectDrag.drop=null;}
  function cancel() {
    if(!objectDrag)return;
    const current=objectDrag;objectClearTarget();objectDrag=null;
    current.ghost?.remove?.();
    try {current.source.releasePointerCapture?.(current.pointerId);} catch {}
  }
  function objectHit(x,y) {
    const target=objectDocument?.elementFromPoint?.(x,y)?.closest?.('[data-object-slot]');
    return target&&!target.disabled&&objectRoot?.contains?.(target)?target:null;
  }
  function objectDown(event) {
    if(objectDestroyed||objectDrag||event.isPrimary===false||event.button!==undefined&&event.button!==0)return;
    const source=event.target?.closest?.('[data-object-item]');
    if(!source||source.disabled||!objectRoot?.contains?.(source))return;
    const value=source.dataset?.objectItem;if(!value)return;
    objectDrag={source,value,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,dragging:false,ghost:null,drop:null};
    try {source.setPointerCapture?.(event.pointerId);}catch{}
  }
  function objectMove(event) {
    if(!objectDrag||event.pointerId!==objectDrag.pointerId)return;
    const distance=Math.hypot(event.clientX-objectDrag.startX,event.clientY-objectDrag.startY);
    if(!objectDrag.dragging&&distance<8)return;
    if(!objectDrag.dragging) {
      objectDrag.dragging=true;
      const ghost=objectDocument?.createElement?.('div');
      if(ghost){ghost.className='object-drag-ghost';ghost.setAttribute?.('aria-hidden','true');ghost.innerHTML=objectDrag.source.innerHTML;ghost.style.pointerEvents='none';ghost.style.position='fixed';ghost.style.transform='translate(-50%, -50%)';for(const node of ghost.querySelectorAll?.('[id]')||[])node.removeAttribute?.('id');objectDocument.body?.append?.(ghost);objectDrag.ghost=ghost;}
    }
    event.preventDefault?.();
    if(objectDrag.ghost){objectDrag.ghost.style.left=event.clientX+'px';objectDrag.ghost.style.top=event.clientY+'px';}
    const drop=objectHit(event.clientX,event.clientY);
    if(drop!==objectDrag.drop){objectClearTarget();if(objectDrag){objectDrag.drop=drop;drop?.classList?.add('object-drop-target');}}
  }
  function objectUp(event) {
    if(!objectDrag||event.pointerId!==objectDrag.pointerId)return;
    const current=objectDrag,drop=current.dragging?objectHit(event.clientX,event.clientY):null;
    cancel();
    if(!current.dragging)return;
    objectClickUntil=Date.now()+400;event.preventDefault?.();
    if(drop)onAction({action:'object-place',value:current.value,slot:Number(drop.dataset.objectSlot)});
  }
  function objectCancelEvent(event){if(!event||!objectDrag||event.pointerId===undefined||event.pointerId===objectDrag.pointerId)cancel();}
  function objectClick(event){if(Date.now()<objectClickUntil){event.preventDefault?.();event.stopImmediatePropagation?.();objectClickUntil=0;}}
  function objectHidden(){if(objectDocument?.hidden)cancel();}
  function sync() {
    if(objectDestroyed||!objectRoot)return;
    if(objectDrag&&!objectRoot.contains?.(objectDrag.source))cancel();
    if(objectBound)return;
    objectRoot.addEventListener?.('pointerdown',objectDown);
    objectRoot.addEventListener?.('pointermove',objectMove);
    objectRoot.addEventListener?.('pointerup',objectUp);
    objectRoot.addEventListener?.('pointercancel',objectCancelEvent);
    objectRoot.addEventListener?.('lostpointercapture',objectCancelEvent);
    objectRoot.addEventListener?.('click',objectClick,true);
    objectDocument?.addEventListener?.('visibilitychange',objectHidden);
    objectWindow?.addEventListener?.('blur',cancel);
    objectWindow?.addEventListener?.('pagehide',cancel);
    objectBound=true;
  }
  function destroy() {
    if(objectDestroyed)return;cancel();objectDestroyed=true;
    if(objectBound){objectRoot.removeEventListener?.('pointerdown',objectDown);objectRoot.removeEventListener?.('pointermove',objectMove);objectRoot.removeEventListener?.('pointerup',objectUp);objectRoot.removeEventListener?.('pointercancel',objectCancelEvent);objectRoot.removeEventListener?.('lostpointercapture',objectCancelEvent);objectRoot.removeEventListener?.('click',objectClick,true);objectDocument?.removeEventListener?.('visibilitychange',objectHidden);objectWindow?.removeEventListener?.('blur',cancel);objectWindow?.removeEventListener?.('pagehide',cancel);}
    objectBound=false;
  }
  return {sync,destroy,cancel};
}
