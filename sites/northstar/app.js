const routes = [
  {id:'khibiny',name:'Хибины · Горный круг',region:'Кольский полуостров',type:'trek',days:4,km:38,price:48900,image:'assets/khibiny-hero.jpg',desc:'Тундра, каменные плато и ночёвки у подножия гор.',packing:['Треккинговые ботинки','Ветрозащитная куртка','Термобельё','Термос','Налобный фонарь']},
  {id:'ladoga',name:'Ладога · Вода и скалы',region:'Карелия',type:'short',days:3,km:26,price:32900,image:'assets/ladoga.jpg',desc:'Тропы вдоль шхер, гранитные мысы и ночёвка на берегу.',packing:['Удобная обувь','Дождевик','Купальные вещи','Термос','Фонарик']},
  {id:'altai',name:'Алтай · Курайский путь',region:'Республика Алтай',type:'trek',days:7,km:74,price:89900,image:'assets/altai-hiker.jpg',desc:'От Курайской степи к ледниковой долине Актру.',packing:['Треккинговые ботинки','Спальный мешок','Тёплая куртка','Термобельё','Солнцезащитные очки']},
  {id:'kamchatka',name:'Камчатка · Огненная земля',region:'Камчатский край',type:'far',days:8,km:52,price:139900,image:'assets/kamchatka.jpg',desc:'Подножие Авачинского вулкана и берег Тихого океана.',packing:['Треккинговые ботинки','Мембранная куртка','Тёплая шапка','Перчатки','Солнцезащитные очки']}
];
const rub = n => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const $ = id => document.getElementById(id);
const date = $('tripDate');
const today = new Date(); today.setHours(0,0,0,0);
const localISO = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
date.min = localISO(today);
const later = new Date(today); later.setDate(later.getDate()+30);
const khibinyDeparture = new Date(2027,6,12);
date.value = localISO(khibinyDeparture>=today?khibinyDeparture:later);
let saved = null;
try { saved = JSON.parse(localStorage.getItem('northstar-plan') || 'null'); } catch (_) {}

function routeCard(r,i){
  const kind = r.type==='short'?'Короткий маршрут':r.type==='far'?'Экспедиция':'Треккинг';
  return '<article class="route-card" data-type="'+r.type+'"><div class="route-art"><img src="'+r.image+'" alt="'+r.region+' — пейзаж маршрута" loading="lazy"><span class="art-number">0'+(i+1)+' / '+r.region+'</span></div><div class="route-card-body"><div class="route-type">'+kind+'</div><h3>'+r.name+'</h3><p class="route-desc">'+r.desc+'</p><div class="route-stats"><span>'+r.days+' '+(r.days===3||r.days===4?'дня':'дней')+'</span><span>'+r.km+' км</span></div><div class="route-bottom"><strong>от '+rub(r.price)+'</strong><button type="button" data-pick="'+r.id+'" aria-label="Выбрать '+r.name+'">↗</button></div></div></article>';
}
$('routeGrid').innerHTML = routes.map(routeCard).join('');
$('tripRoute').innerHTML = routes.map(r=>'<option value="'+r.id+'">'+r.name+'</option>').join('');

document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.filter').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false')});
  button.classList.add('active');button.setAttribute('aria-pressed','true');
  document.querySelectorAll('.route-card').forEach(card=>card.hidden=button.dataset.filter!=='all' && card.dataset.type!==button.dataset.filter);
}));
$('routeGrid').addEventListener('click',event=>{
  const pick=event.target.closest('[data-pick]'); if(!pick)return;
  $('tripRoute').value=pick.dataset.pick; update(); $('plan').scrollIntoView({behavior:'smooth'});
});

function getPlan(){
  const route=routes.find(r=>r.id===$('tripRoute').value)||routes[0];
  const people=Math.min(8,Math.max(1,Number($('tripPeople').value)||1));
  const equipment=$('equipment').checked,transfer=$('transfer').checked;
  const total=people*(route.price+(equipment?2500:0)+(transfer?4500:0));
  return {routeId:route.id,date:date.value,people,equipment,transfer,total,packed:saved && saved.routeId===route.id ? saved.packed||[]:[]};
}
function formatDate(value){if(!value)return 'Дата не выбрана';return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00'))}
function update(){
  const p=getPlan(),r=routes.find(x=>x.id===p.routeId);
  $('summaryTitle').textContent=r.name;
  $('summaryFacts').innerHTML='<div class="summary-fact"><span>Старт</span><b>'+formatDate(p.date)+'</b></div><div class="summary-fact"><span>В пути</span><b>'+r.days+' дн. · '+r.km+' км</b></div><div class="summary-fact"><span>Группа</span><b>'+p.people+' чел.</b></div><div class="summary-fact"><span>Дополнения</span><b>'+(p.equipment?'снаряжение · ':'')+(p.transfer?'трансфер':'')+(!p.equipment&&!p.transfer?'нет':'')+'</b></div>';
  $('summaryPrice').textContent=rub(p.total);
  $('packingList').innerHTML=r.packing.map((item,i)=>'<label class="'+(p.packed.includes(i)?'done':'')+'"><input type="checkbox" data-pack="'+i+'" '+(p.packed.includes(i)?'checked':'')+'><span>'+item+'</span></label>').join('');
}
['tripRoute','tripDate','tripPeople','equipment','transfer'].forEach(id=>$(id).addEventListener('input',()=>{$('tripStatus').textContent='';update()}));
$('tripForm').addEventListener('submit',event=>{event.preventDefault();if(!date.value||date.value<date.min){$('tripStatus').textContent='Выберите дату не раньше сегодняшней.';return;}saved=getPlan();localStorage.setItem('northstar-plan',JSON.stringify(saved));$('tripStatus').textContent='Маршрут сохранён на этом устройстве.';update()});
$('packingList').addEventListener('change',event=>{const box=event.target.closest('[data-pack]');if(!box)return;const p=getPlan();const i=Number(box.dataset.pack);p.packed=box.checked?[...new Set([...p.packed,i])]:p.packed.filter(n=>n!==i);saved=p;localStorage.setItem('northstar-plan',JSON.stringify(saved));update()});
$('downloadPlan').addEventListener('click',()=>{
  const p=getPlan(),r=routes.find(x=>x.id===p.routeId);
  const lines=['СЕВЕРНАЯ ТОЧКА — ПЛАН ПОЕЗДКИ','',r.name,'Старт: '+formatDate(p.date),'Участников: '+p.people,'Длительность: '+r.days+' дн. / '+r.km+' км','Аренда снаряжения: '+(p.equipment?'да':'нет'),'Трансфер: '+(p.transfer?'да':'нет'),'Стоимость группы: '+rub(p.total),'','ВЗЯТЬ С СОБОЙ',...r.packing.map((item,i)=>(p.packed.includes(i)?'[x] ':'[ ] ')+item),'','Сохранено локально. Для бронирования свяжитесь с бюро.'];
  const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='severnaya-tochka-plan.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
if(saved){$('tripRoute').value=saved.routeId||routes[0].id;date.value=saved.date||date.value;$('tripPeople').value=saved.people||2;$('equipment').checked=!!saved.equipment;$('transfer').checked=!!saved.transfer;$('tripStatus').textContent='Ваш сохранённый маршрут восстановлен.'}update();
