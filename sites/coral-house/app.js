const rooms = {
  garden: {name:'Садовый',rate:8400,max:2},
  sea: {name:'Морской',rate:11600,max:3},
  terrace: {name:'С террасой',rate:16900,max:4}
};
const arrival = document.querySelector('#arrival');
const departure = document.querySelector('#departure');
const roomSelect = document.querySelector('#room');
const guestsSelect = document.querySelector('#guests');
const breakfast = document.querySelector('#breakfast');
const transfer = document.querySelector('#transfer');
const status = document.querySelector('#form-status');
const nf = new Intl.NumberFormat('ru-RU');
const money = n => `${nf.format(n)} ₽`;
const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const dateFrom = value => new Date(`${value}T12:00:00`);
const human = value => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(dateFrom(value));
const today = new Date();
const start = new Date(today); start.setDate(start.getDate()+7);
const finish = new Date(start); finish.setDate(finish.getDate()+3);
arrival.min = iso(today); arrival.value = iso(start);
departure.min = iso(new Date(start.getFullYear(),start.getMonth(),start.getDate()+1)); departure.value = iso(finish);
let plans = [];
const storageKey = 'casa-marea-stay-plans-v1';
try { plans = JSON.parse(localStorage.getItem(storageKey) || '[]'); if(!Array.isArray(plans)) plans=[]; } catch { plans=[]; }
function persist() { try {localStorage.setItem(storageKey,JSON.stringify(plans));return true;} catch {status.textContent='Не получилось сохранить план: браузер блокирует локальное хранилище.';return false;} }

function adjustGuestOptions() {
  const max = rooms[roomSelect.value].max;
  [...guestsSelect.options].forEach(option => option.disabled = Number(option.value) > max);
  if (Number(guestsSelect.value) > max) guestsSelect.value = String(max);
  document.querySelectorAll('.room-card').forEach(card => card.classList.toggle('is-chosen',card.dataset.room===roomSelect.value));
}

function estimate() {
  adjustGuestOptions();
  if (!arrival.value || !departure.value) return null;
  const from = dateFrom(arrival.value), to = dateFrom(departure.value);
  const nights = Math.round((to-from)/86400000);
  if (nights < 1 || nights > 30 || arrival.value < arrival.min) {
    document.querySelector('#room-sum').textContent='—';
    document.querySelector('#extra-sum').textContent='—';
    document.querySelector('#total-sum').textContent='—';
    document.querySelector('#estimate-note').textContent='Выберите даты: от одной до тридцати ночей, начиная с сегодняшнего дня.';
    return null;
  }
  const selected = rooms[roomSelect.value];
  let roomTotal = 0;
  let hasSummerRate = false;
  let hasWeekendRate = false;
  for (let day=0;day<nights;day++) {
    const current = new Date(from); current.setDate(current.getDate()+day);
    const month=current.getMonth();
    const seasonal = [5,6,7,8].includes(month) ? 1.2 : 1;
    const weekend = [5,6].includes(current.getDay()) ? 1.1 : 1;
    if (seasonal > 1) hasSummerRate = true;
    if (weekend > 1) hasWeekendRate = true;
    roomTotal += Math.round(selected.rate*seasonal*weekend/100)*100;
  }
  const extraTotal = (breakfast.checked ? nights*1200*Number(guestsSelect.value) : 0) + (transfer.checked ? 2400 : 0);
  document.querySelector('#room-sum').textContent=money(roomTotal);
  document.querySelector('#extra-sum').textContent=money(extraTotal);
  document.querySelector('#total-sum').textContent=money(roomTotal+extraTotal);
  const rateNotes = [];
  if (hasSummerRate) rateNotes.push('для летних ночей учтено +20%');
  if (hasWeekendRate) rateNotes.push('для пятницы и субботы учтено +10%');
  document.querySelector('#estimate-note').textContent=`${nights} ${nights===1?'ночь':nights<5?'ночи':'ночей'} · ${rateNotes.length ? rateNotes.join(', ') : 'базовый тариф'}. Предварительный расчёт, без проверки свободных мест.`;
  return {room:roomSelect.value,roomName:selected.name,guests:Number(guestsSelect.value),arrival:arrival.value,departure:departure.value,nights,breakfast:breakfast.checked,transfer:transfer.checked,roomTotal,extraTotal,total:roomTotal+extraTotal};
}

arrival.addEventListener('change',() => {
  if (!arrival.value) return;
  const next = dateFrom(arrival.value); next.setDate(next.getDate()+1);
  departure.min = iso(next);
  if (departure.value <= arrival.value) { const three = dateFrom(arrival.value); three.setDate(three.getDate()+3); departure.value=iso(three); }
  estimate();
});
[departure,roomSelect,guestsSelect,breakfast,transfer].forEach(input => input.addEventListener('change',estimate));
document.querySelectorAll('.choose-room').forEach(button => button.addEventListener('click',() => {
  roomSelect.value=button.dataset.room;
  estimate();
  document.querySelector('#plan').scrollIntoView({behavior:'smooth'});
  status.textContent=`Выбран номер «${rooms[button.dataset.room].name}». Укажите даты поездки.`;
}));
estimate();

function downloadPlan(plan) {
  const lines = ['CASA MAREA — ПЛАН ПОЕЗДКИ','',`Номер: ${plan.roomName}`,`Даты: ${human(plan.arrival)} — ${human(plan.departure)}`,`Ночей: ${plan.nights}`,`Гостей: ${plan.guests}`,`Завтраки: ${plan.breakfast?'да':'нет'}`,`Трансфер: ${plan.transfer?'да':'нет'}`,`Проживание: ${money(plan.roomTotal)}`,`Дополнительно: ${money(plan.extraTotal)}`,`Итого: ${money(plan.total)}`,'','Этот файл — личный расчёт. Номер не забронирован.'];
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a'); link.href=url;link.download=`casa-marea-${plan.arrival}.txt`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function renderPlans() {
  const wrap=document.querySelector('#saved-plans'),list=document.querySelector('#plan-list');
  wrap.hidden=plans.length===0;
  document.querySelector('#plan-count').textContent=`(${plans.length})`;
  list.replaceChildren();
  plans.slice().reverse().forEach(plan => {
    const row=document.createElement('article'); row.className='saved-plan';
    const title=document.createElement('strong');title.textContent=`${plan.roomName} · ${human(plan.arrival)}`;
    const detail=document.createElement('p');detail.textContent=`${plan.nights} ночей · ${plan.guests} гостей · ${money(plan.total)}`;
    const actions=document.createElement('div');actions.className='plan-actions';
    const download=document.createElement('button');download.type='button';download.textContent='Скачать';download.setAttribute('aria-label',`Скачать план на ${human(plan.arrival)}`);download.addEventListener('click',()=>downloadPlan(plan));
    const remove=document.createElement('button');remove.type='button';remove.textContent='Удалить';remove.setAttribute('aria-label',`Удалить план на ${human(plan.arrival)}`);remove.addEventListener('click',()=>{plans=plans.filter(item=>item.id!==plan.id);if(persist()){renderPlans();status.textContent='План удалён.';}});
    actions.append(download,remove);row.append(title,detail,actions);list.append(row);
  });
}
renderPlans();
document.querySelector('#stay-form').addEventListener('submit',event => {
  event.preventDefault();
  const plan=estimate();
  if(!plan){status.textContent='Проверьте даты поездки.';arrival.focus();return;}
  plans.push({...plan,id:`${Date.now()}-${Math.random().toString(36).slice(2)}`});
  if(persist()){renderPlans();status.textContent='План сохранён в этом браузере. Это предварительный расчёт, а не бронирование.';}
});
