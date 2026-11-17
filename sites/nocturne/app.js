const menu = {
  cocktails: [
    {name:'Midnight Standard', detail:'Бурбон, вишня, вермут, капля горечи', price:820},
    {name:'Лампа у сцены', detail:'Джин, груша, жасмин, сухой тоник', price:790},
    {name:'Blue Note', detail:'Ром, черника, лайм, содовая', price:760},
    {name:'Поздний поезд', detail:'Ржаной виски, кофе, солёная карамель', price:840}
  ],
  food: [
    {name:'Тартар из говядины', detail:'Горчичный айоли, каперсы, хлеб на закваске', price:890},
    {name:'Буррата и томаты', detail:'Базилик, масло зелени, хрустящий хлеб', price:970},
    {name:'Сэндвич с пастрами', detail:'Сыр, маринованный огурец, соус бара', price:780},
    {name:'Тёплый миндальный пирог', detail:'Ванильный крем и сезонные ягоды', price:590}
  ],
  zero: [
    {name:'Тихий квартал', detail:'Груша, розмарин, лимон, игристая вода', price:540},
    {name:'Evening Sun', detail:'Кровавый апельсин, бузина, тоник', price:560},
    {name:'Кофе без спешки', detail:'Эспрессо, свежая сливка, тёмный шоколад', price:390},
    {name:'Чай до рассвета', detail:'Ассам, специи, апельсиновая цедра', price:430}
  ]
};

const menuItems = document.querySelector('#menu-items');
const tabs = [...document.querySelectorAll('.tab')];
function renderMenu(category) {
  menuItems.replaceChildren();
  menu[category].forEach(item => {
    const article = document.createElement('article');
    article.className = 'menu-item';
    const title = document.createElement('h3'); title.textContent = item.name;
    const price = document.createElement('strong'); price.textContent = `${item.price} ₽`;
    const detail = document.createElement('p'); detail.textContent = item.detail;
    article.append(title, price, detail); menuItems.append(article);
  });
  tabs.forEach(tab => {
    const active = tab.dataset.menu === category;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => renderMenu(tab.dataset.menu));
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    renderMenu(next.dataset.menu); next.focus();
  });
});
renderMenu('cocktails');

const key = 'nocturne-bookings-v1';
const bookingDate = document.querySelector('#booking-date');
const bookingEvent = document.querySelector('#booking-event');
const status = document.querySelector('#booking-status');
const savedWrap = document.querySelector('#saved-wrap');
const savedList = document.querySelector('#saved-list');
const count = document.querySelector('#saved-count');
const dateOf = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const today = new Date();
bookingDate.min = dateOf(today);
const firstDate = new Date(today); firstDate.setDate(firstDate.getDate()+1);
bookingDate.value = dateOf(firstDate);
let selectedTime = '20:00';
let bookings = [];
try { bookings = JSON.parse(localStorage.getItem(key) || '[]'); if (!Array.isArray(bookings)) bookings = []; } catch { bookings = []; }
const save = () => { try { localStorage.setItem(key, JSON.stringify(bookings)); return true; } catch { status.textContent='Не удалось сохранить: проверьте настройки хранилища браузера.'; return false; } };
const humanDate = iso => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${iso}T12:00:00`));

document.querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => {
  selectedTime = button.dataset.time;
  document.querySelectorAll('[data-time]').forEach(other => {
    const selected = other === button;
    other.classList.toggle('selected', selected);
    other.setAttribute('aria-pressed', String(selected));
  });
}));

const eventDates = {'Птица и Оркестр':'2026-11-21','Мария Лесная Трио':'2026-11-27','Afterglow Session':'2026-12-04'};
document.querySelectorAll('[data-event]').forEach(button => button.addEventListener('click', () => {
  const eventName = button.dataset.event;
  bookingEvent.value = eventName;
  if (eventDates[eventName] >= bookingDate.min) bookingDate.value = eventDates[eventName];
  document.querySelector('#reserve').scrollIntoView({behavior:'smooth'});
  status.textContent = `Выбран вечер: ${eventName}. Уточните дату и детали.`;
}));

function downloadCalendar(item) {
  const start = `${item.date.replaceAll('-','')}T${item.time.replace(':','')}00`;
  const [hour, minute] = item.time.split(':').map(Number);
  const endHour = String((hour + 2) % 24).padStart(2,'0');
  const end = `${item.date.replaceAll('-','')}T${endHour}${String(minute).padStart(2,'0')}00`;
  const esc = value => String(value).replaceAll('\\','\\\\').replaceAll(',','\\,').replaceAll(';','\\;').replaceAll('\n','\\n');
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Nocturne//Local Booking//RU','BEGIN:VEVENT',`UID:${item.id}@nocturne.local`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${esc(item.event + ' — Nocturne')}`,`DESCRIPTION:${esc(`Столик на ${item.guests} гостей. Личная сохранённая заявка, не подтверждение брони.`)}`,`LOCATION:${esc('Москва, Большой Кисельный пер., 9')}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));
  const a = document.createElement('a'); a.href=url; a.download=`nocturne-${item.date}.ics`; a.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

function renderBookings() {
  savedWrap.hidden = bookings.length === 0;
  count.textContent = `${bookings.length} ${bookings.length === 1 ? 'заявка' : 'заявки'}`;
  savedList.replaceChildren();
  bookings.slice().reverse().forEach(item => {
    const row = document.createElement('div'); row.className='saved-item';
    const title = document.createElement('strong'); title.textContent=`${humanDate(item.date)} · ${item.time}`;
    const description = document.createElement('p'); description.textContent=`${item.event} · ${item.guests} гостей · ${item.name}`;
    const actions = document.createElement('div'); actions.className='saved-actions';
    const calendar = document.createElement('button'); calendar.type='button'; calendar.textContent='В календарь'; calendar.setAttribute('aria-label',`Скачать событие ${humanDate(item.date)}`); calendar.addEventListener('click',() => downloadCalendar(item));
    const remove = document.createElement('button'); remove.type='button'; remove.textContent='Удалить'; remove.setAttribute('aria-label',`Удалить заявку на ${humanDate(item.date)}`); remove.addEventListener('click',() => { bookings=bookings.filter(b=>b.id!==item.id); if(save()){renderBookings();status.textContent='Заявка удалена из этого браузера.';} });
    actions.append(calendar,remove); row.append(title,description,actions); savedList.append(row);
  });
}
renderBookings();

document.querySelector('#booking-form').addEventListener('submit', event => {
  event.preventDefault();
  if (bookingDate.value < bookingDate.min) { status.textContent='Выберите сегодняшнюю или будущую дату.'; bookingDate.focus(); return; }
  const name = document.querySelector('#booking-name').value.trim();
  const phone = document.querySelector('#booking-phone').value.trim();
  if (!name || !phone) {status.textContent='Заполните имя и телефон.';return;}
  const item = {id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,date:bookingDate.value,time:selectedTime,guests:Number(document.querySelector('#booking-guests').value),event:bookingEvent.value,name,phone};
  bookings.push(item);
  if (save()) {renderBookings();status.textContent='Заявка сохранена в этом браузере. Она ещё не отправлена в клуб; добавьте её в календарь, чтобы не забыть.';document.querySelector('#booking-form').reset();bookingDate.value=dateOf(firstDate);}
});
