const services = [
  {id:'diagnostic',group:'care',name:'Диагностика',description:'Проверка узлов и список работ до ремонта',price:900,minutes:30},
  {id:'basic',group:'care',name:'Базовое ТО',description:'Тормоза, передачи, крепёж, смазка цепи',price:3400,minutes:90},
  {id:'full',group:'care',name:'Большое ТО',description:'Полная мойка, настройка и проверка узлов',price:6800,minutes:180},
  {id:'brakes',group:'repair',name:'Тормоза',description:'Настройка одного тормоза и проверка колодок',price:1100,minutes:35},
  {id:'wheel',group:'repair',name:'Колесо',description:'Правка восьмёрки и проверка натяжения спиц',price:1600,minutes:50},
  {id:'tube',group:'repair',name:'Камера / покрышка',description:'Замена камеры или покрышки на одном колесе',price:850,minutes:25},
  {id:'gears',group:'setup',name:'Переключение',description:'Точная настройка переднего и заднего узла',price:1450,minutes:45},
  {id:'fit',group:'setup',name:'Посадка',description:'Базовая настройка руля, седла и положения',price:2200,minutes:60},
  {id:'tubeless',group:'setup',name:'Бескамерная система',description:'Установка и герметизация двух колёс',price:2600,minutes:70}
];
const nf=new Intl.NumberFormat('ru-RU');
const rub=n=>`${nf.format(n)} ₽`;
const dateISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const humanDate=iso=>new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${iso}T12:00:00`));
const selectionKey='roam-selected-services-v1';
const bookingsKey='roam-visit-plans-v1';
let selected=new Set();
let bookings=[];
try { const data=JSON.parse(localStorage.getItem(selectionKey)||'[]');if(Array.isArray(data)) selected=new Set(data.filter(id=>services.some(s=>s.id===id))); } catch {}
try { const data=JSON.parse(localStorage.getItem(bookingsKey)||'[]');if(Array.isArray(data)) bookings=data; } catch {}
const serviceList=document.querySelector('#service-list');
const chosenServices=document.querySelector('#chosen-services');
const status=document.querySelector('#booking-status');
const bikeType=document.querySelector('#bike-type');
let currentFilter='all';
let selectedTime='12:00';
const writeSelection=()=>{try{localStorage.setItem(selectionKey,JSON.stringify([...selected]));}catch{}};
const writeBookings=()=>{try{localStorage.setItem(bookingsKey,JSON.stringify(bookings));return true;}catch{status.textContent='Не удалось сохранить запись: браузер блокирует хранилище.';return false;}};
function selectedItems(){return services.filter(item=>selected.has(item.id));}
function quote(){const items=selectedItems();const work=items.reduce((sum,item)=>sum+item.price,0);const minutes=items.reduce((sum,item)=>sum+item.minutes,0);const electric=bikeType.value==='electric'&&items.length?800:0;return {items,work,minutes,electric,total:work+electric};}
function renderServices(){
  serviceList.replaceChildren();
  services.filter(item=>currentFilter==='all'||item.group===currentFilter).forEach(item=>{
    const label=document.createElement('label');label.className='service-card';label.classList.toggle('is-selected',selected.has(item.id));
    const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(item.id);input.setAttribute('aria-label',`Добавить: ${item.name}, ${rub(item.price)}`);
    input.addEventListener('change',()=>{if(input.checked)selected.add(item.id);else selected.delete(item.id);writeSelection();renderServices();renderQuote();});
    const body=document.createElement('div');const title=document.createElement('h3');title.textContent=item.name;const desc=document.createElement('p');desc.textContent=item.description;body.append(title,desc);
    const meta=document.createElement('div');meta.className='service-meta';const price=document.createElement('strong');price.textContent=rub(item.price);const duration=document.createElement('span');duration.textContent=`${item.minutes} МИН`;meta.append(price,duration);
    label.append(input,body,meta);serviceList.append(label);
  });
}
function renderQuote(){
  const data=quote();chosenServices.replaceChildren();
  if(!data.items.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='УСЛУГИ ПОКА НЕ ВЫБРАНЫ';chosenServices.append(empty);}
  else data.items.forEach(item=>{const row=document.createElement('div');const name=document.createElement('span');name.textContent=item.name;const price=document.createElement('b');price.textContent=rub(item.price);row.append(name,price);chosenServices.append(row);});
  if(data.electric){const row=document.createElement('div');const name=document.createElement('span');name.textContent='Электровелосипед';const price=document.createElement('b');price.textContent=rub(data.electric);row.append(name,price);chosenServices.append(row);}
  document.querySelector('#work-price').textContent=rub(data.work+data.electric);
  document.querySelector('#work-time').textContent=data.minutes>=60?`${Math.floor(data.minutes/60)} ч ${data.minutes%60} мин`:`${data.minutes} мин`;
  document.querySelector('#estimate-total').textContent=rub(data.total);
  document.querySelector('#booking-services').textContent=data.items.length?data.items.map(s=>s.name).join(', '):'Пока не выбраны';
  document.querySelector('#booking-total').textContent=rub(data.total);
  document.querySelector('#download-quote').disabled=!data.items.length;
}
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  currentFilter=button.dataset.filter;
  document.querySelectorAll('.filter').forEach(other=>{const active=other===button;other.classList.toggle('active',active);other.setAttribute('aria-pressed',String(active));});
  renderServices();
}));
bikeType.addEventListener('change',renderQuote);
renderServices();renderQuote();

function downloadText(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.querySelector('#download-quote').addEventListener('click',()=>{
  const data=quote();if(!data.items.length)return;
  const lines=['ROAM WORKSHOP / ПРЕДВАРИТЕЛЬНАЯ СМЕТА','',`Велосипед: ${bikeType.selectedOptions[0].textContent}`,...data.items.map(item=>`${item.name} — ${rub(item.price)} / ${item.minutes} мин`),...(data.electric?[`Доплата за электровелосипед — ${rub(data.electric)}`]:[]),'',`Работа мастера: ${data.minutes} мин`,`Итого работы: ${rub(data.total)}`,'','Запчасти оплачиваются отдельно после согласования.'];
  downloadText('roam-smeta.txt',lines.join('\n'));
});

const bookingDate=document.querySelector('#booking-date');
const today=new Date();bookingDate.min=dateISO(today);
const firstOpen=new Date(today);firstOpen.setDate(firstOpen.getDate()+1);if(firstOpen.getDay()===1)firstOpen.setDate(firstOpen.getDate()+1);bookingDate.value=dateISO(firstOpen);
document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>{
  selectedTime=button.dataset.time;
  document.querySelectorAll('[data-time]').forEach(other=>{const active=other===button;other.classList.toggle('active',active);other.setAttribute('aria-pressed',String(active));});
}));
function downloadVisit(item){const lines=['ROAM WORKSHOP / ПЛАН ВИЗИТА','',`Дата: ${humanDate(item.date)}`,`Время: ${item.time}`,`Имя: ${item.name}`,`Телефон: ${item.phone}`,`Велосипед: ${item.bikeLabel}`,`Работы: ${item.serviceNames.join(', ')}`,`Предварительная стоимость: ${rub(item.total)}`,`Комментарий: ${item.note||'—'}`,'','План сохранён локально и не является подтверждённой записью мастерской.'];downloadText(`roam-${item.date}.txt`,lines.join('\n'));}
function renderBookings(){
  const wrap=document.querySelector('#saved-bookings'),list=document.querySelector('#booking-list');wrap.hidden=bookings.length===0;document.querySelector('#booking-count').textContent=`/ ${bookings.length}`;list.replaceChildren();
  bookings.slice().reverse().forEach(item=>{
    const row=document.createElement('article');row.className='booking-row';const title=document.createElement('strong');title.textContent=`${humanDate(item.date)} · ${item.time}`;
    const detail=document.createElement('p');detail.textContent=`${item.name} · ${item.serviceNames.join(', ')} · ${rub(item.total)}`;
    const actions=document.createElement('div');actions.className='booking-actions';
    const download=document.createElement('button');download.type='button';download.textContent='Скачать';download.setAttribute('aria-label',`Скачать план визита ${humanDate(item.date)}`);download.addEventListener('click',()=>downloadVisit(item));
    const remove=document.createElement('button');remove.type='button';remove.textContent='Удалить';remove.setAttribute('aria-label',`Удалить план визита ${humanDate(item.date)}`);remove.addEventListener('click',()=>{bookings=bookings.filter(b=>b.id!==item.id);if(writeBookings()){renderBookings();status.textContent='План визита удалён.';}});
    actions.append(download,remove);row.append(title,detail,actions);list.append(row);
  });
}
renderBookings();
document.querySelector('#booking-form').addEventListener('submit',event=>{
  event.preventDefault();const data=quote();
  if(!data.items.length){status.textContent='Сначала выберите хотя бы одну услугу.';document.querySelector('#services').scrollIntoView({behavior:'smooth'});return;}
  if(!bookingDate.value||bookingDate.value<bookingDate.min){status.textContent='Выберите сегодняшнюю или будущую дату.';bookingDate.focus();return;}
  if(new Date(`${bookingDate.value}T12:00:00`).getDay()===1){status.textContent='В понедельник мастерская закрыта. Выберите другой день.';bookingDate.focus();return;}
  const name=document.querySelector('#customer-name').value.trim(),phone=document.querySelector('#customer-phone').value.trim(),note=document.querySelector('#customer-note').value.trim();
  if(!name||!phone){status.textContent='Заполните имя и телефон.';return;}
  bookings.push({id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,date:bookingDate.value,time:selectedTime,name,phone,note,bikeLabel:bikeType.selectedOptions[0].textContent,serviceNames:data.items.map(s=>s.name),total:data.total});
  if(writeBookings()){renderBookings();status.textContent='План визита сохранён в этом браузере. Мастерская пока не получила вашу запись.';document.querySelector('#booking-form').reset();bookingDate.value=dateISO(firstOpen);selectedTime='12:00';document.querySelectorAll('[data-time]').forEach(button=>{const active=button.dataset.time==='12:00';button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});renderQuote();}
});
