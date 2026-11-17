const units = [
  {id:'A-0204',rooms:1,area:39.6,floor:2,building:'A',price:9200000,view:'Тихий двор'},
  {id:'B-0403',rooms:1,area:43.2,floor:4,building:'B',price:10100000,view:'Набережная'},
  {id:'C-0602',rooms:1,area:47.8,floor:6,building:'C',price:10900000,view:'Город'},
  {id:'D-0301',rooms:2,area:57.1,floor:3,building:'D',price:12800000,view:'Тихий двор'},
  {id:'A-0705',rooms:2,area:61.4,floor:7,building:'A',price:13900000,view:'Набережная'},
  {id:'B-0502',rooms:2,area:66.8,floor:5,building:'B',price:15100000,view:'Сад'},
  {id:'C-0801',rooms:2,area:70.3,floor:8,building:'C',price:16200000,view:'Набережная'},
  {id:'D-0903',rooms:3,area:78.5,floor:9,building:'D',price:17700000,view:'Город'},
  {id:'A-1002',rooms:3,area:82.1,floor:10,building:'A',price:18800000,view:'Набережная'},
  {id:'B-1101',rooms:3,area:87.9,floor:11,building:'B',price:20400000,view:'Два фасада'},
  {id:'C-1202',rooms:3,area:91.2,floor:12,building:'C',price:21600000,view:'Набережная'},
  {id:'D-1201',rooms:3,area:96.4,floor:12,building:'D',price:23100000,view:'Два фасада'}
];

const $ = (selector) => document.querySelector(selector);
const grid = $('#unitGrid');
const money = (value) => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(value) + ' ₽';
const area = (value) => new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}).format(value);
const safeRead = (key) => {try {const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data:[]} catch {return []}};
const state = {rooms:'all',budget:24000000,sort:'price-asc',visible:6,favorites:new Set(safeRead('hem-favorites')),compare:new Set(safeRead('hem-compare'))};
let toastTimer;

function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3400)}
function saveState(){localStorage.setItem('hem-favorites',JSON.stringify([...state.favorites]));localStorage.setItem('hem-compare',JSON.stringify([...state.compare]))}
function planSvg(unit){
  const seed=unit.rooms;
  const shade=['#d7dfd4','#ccd8c8','#e1dfd0'][seed-1];
  const names=seed===1?'<text x="64" y="71">КОМНАТА</text><text x="56" y="148">КУХНЯ</text>':seed===2?'<text x="55" y="74">СПАЛЬНЯ</text><text x="169" y="87">ГОСТИНАЯ</text><text x="58" y="150">КУХНЯ</text>':'<text x="48" y="75">СПАЛЬНЯ</text><text x="130" y="80">СПАЛЬНЯ</text><text x="212" y="75">КУХНЯ</text><text x="136" y="152">ГОСТИНАЯ</text>';
  return `<svg viewBox="0 0 310 240" role="img" aria-label="Схема квартиры ${unit.id}, ${unit.rooms} комнаты"><rect x="3" y="3" width="304" height="234" fill="none" stroke="#b5c2b5" stroke-width="1"/><rect x="28" y="28" width="255" height="160" fill="${shade}" stroke="#334c43" stroke-width="7"/><path d="${seed===1?'M170 28V158M27 108H170':seed===2?'M143 28V188M27 110H143M143 128H282':'M118 28V188M200 28V188M27 115H118M200 125H282'}" fill="none" stroke="#536a5e" stroke-width="5"/><path d="M96 188v-24m0 0a24 24 0 0 1 24 24" fill="none" stroke="#e9ebe4" stroke-width="5"/><path d="M64 24h60M203 24h56M286 62v65" stroke="#8eafa4" stroke-width="10"/><g fill="#52675a" font-size="8" font-family="Arial" letter-spacing="1">${names}</g><text x="28" y="220" fill="#748475" font-size="9" font-family="Arial" letter-spacing="2">HEM / ${unit.id}</text></svg>`
}
function filteredUnits(){
  const items=units.filter(u=>(state.rooms==='all'||u.rooms===Number(state.rooms))&&u.price<=state.budget);
  if(state.sort==='price-asc')items.sort((a,b)=>a.price-b.price);
  if(state.sort==='area-desc')items.sort((a,b)=>b.area-a.area);
  if(state.sort==='floor-asc')items.sort((a,b)=>a.floor-b.floor||a.price-b.price);
  return items;
}
function renderUnits(){
  const items=filteredUnits();
  $('#priceValue').textContent=money(state.budget);
  $('#resultsCount').textContent=`Найдено: ${items.length}`;
  if(!items.length){grid.innerHTML='<div class="empty-state"><h3>Пока нет совпадений</h3><p>Попробуйте увеличить бюджет или выбрать другую комнатность.</p><button class="button button-outline" type="button" id="resetFilters">Сбросить фильтры ↗</button></div>';$('#resetFilters').addEventListener('click',resetFilters)}
  else grid.innerHTML=items.slice(0,state.visible).map(u=>`<article class="unit-card"><div class="unit-head"><span class="unit-code">Корпус ${u.building} / № ${u.id}</span><button type="button" class="fav-btn" data-favorite="${u.id}" aria-label="${state.favorites.has(u.id)?'Убрать из избранного':'В избранное'} ${u.id}" aria-pressed="${state.favorites.has(u.id)}">${state.favorites.has(u.id)?'♥':'♡'}</button></div><div class="unit-art">${planSvg(u)}</div><div class="unit-info"><h3 class="unit-title">${u.rooms}-комнатная · ${area(u.area)} м²</h3><div class="unit-detail"><span>${u.floor} этаж</span><span>Вид: ${u.view.toLowerCase()}</span></div><div class="unit-bottom"><div class="unit-price"><small>Стоимость</small>${money(u.price)}</div><button class="compare-btn" type="button" data-compare="${u.id}" aria-pressed="${state.compare.has(u.id)}">${state.compare.has(u.id)?'Убрать −':'Сравнить +'}</button></div></div></article>`).join('');
  $('#showMore').hidden=items.length<=state.visible;
  updateCompareTray();
}
function resetFilters(){state.rooms='all';state.budget=24000000;state.visible=6;$('#priceMax').value=24000000;document.querySelectorAll('.filter-btn').forEach(b=>{const on=b.dataset.rooms==='all';b.classList.toggle('active',on);b.setAttribute('aria-pressed',on)});renderUnits()}
function toggleFavorite(id){state.favorites.has(id)?state.favorites.delete(id):state.favorites.add(id);saveState();renderUnits();showToast(state.favorites.has(id)?'Квартира добавлена в избранное':'Квартира убрана из избранного')}
function toggleCompare(id){if(state.compare.has(id))state.compare.delete(id);else if(state.compare.size<3)state.compare.add(id);else{showToast('Можно сравнить не больше трёх квартир');return}saveState();renderUnits();if($('#compareDialog').open)renderCompare()}
function updateCompareTray(){const tray=$('#compareTray');tray.hidden=state.compare.size===0;$('#compareCount').textContent=state.compare.size;$('#compareNames').textContent=[...state.compare].join(' · ')}
function renderCompare(){const selected=[...state.compare].map(id=>units.find(u=>u.id===id)).filter(Boolean);$('#compareContent').innerHTML=selected.length?`<div class="compare-table-wrap"><table class="compare-table"><thead><tr><th>Параметр</th>${selected.map(u=>`<th>${u.id}<br><button type="button" data-remove="${u.id}">Убрать</button></th>`).join('')}</tr></thead><tbody><tr><td>Комнаты</td>${selected.map(u=>`<td>${u.rooms}</td>`).join('')}</tr><tr><td>Площадь</td>${selected.map(u=>`<td>${area(u.area)} м²</td>`).join('')}</tr><tr><td>Этаж</td>${selected.map(u=>`<td>${u.floor}</td>`).join('')}</tr><tr><td>Вид</td>${selected.map(u=>`<td>${u.view}</td>`).join('')}</tr><tr><td>Цена</td>${selected.map(u=>`<td>${money(u.price)}</td>`).join('')}</tr><tr><td>Расчёт</td>${selected.map(u=>`<td><button type="button" data-calc="${u.id}">Рассчитать ↗</button></td>`).join('')}</tr></tbody></table></div>`:'<div class="compare-table-wrap">Вы пока не выбрали квартиры для сравнения.</div>'}
function updateCalculator(){const price=Math.max(1000000,Number($('#calcPrice').value)||1000000),down=Number($('#calcDown').value),years=Number($('#calcYears').value),rate=Math.max(0,Number($('#calcRate').value)||0);const principal=price*(1-down/100),periods=years*12,monthlyRate=rate/100/12;const payment=monthlyRate===0?principal/periods:principal*monthlyRate/(1-Math.pow(1+monthlyRate,-periods));$('#downPct').textContent=`${down}%`;$('#downAmount').textContent=`Первый взнос: ${money(price*down/100)}`;$('#monthlyPayment').textContent=money(Number.isFinite(payment)?Math.ceil(payment):0);$('#loanAmount').textContent=`Сумма кредита ${money(principal)} · ${years} лет`}
function downloadFavorites(){const selected=units.filter(u=>state.favorites.has(u.id));if(!selected.length){showToast('Сначала добавьте квартиры в избранное');return}const content=['HEM — избранные квартиры','',...selected.map(u=>`${u.id} · ${u.rooms}-комнатная · ${area(u.area)} м² · ${u.floor} этаж · ${u.view} · ${money(u.price)}`),'','Подборка не является бронированием.'].join('\n');const blob=new Blob([content],{type:'text/plain;charset=utf-8'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='hem-izbrannoe.txt';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);showToast('Подборка скачана')}

grid.addEventListener('click',event=>{const favorite=event.target.closest('[data-favorite]');const compare=event.target.closest('[data-compare]');if(favorite)toggleFavorite(favorite.dataset.favorite);if(compare)toggleCompare(compare.dataset.compare)});
document.querySelectorAll('.filter-btn').forEach(button=>button.addEventListener('click',()=>{state.rooms=button.dataset.rooms;state.visible=6;document.querySelectorAll('.filter-btn').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active)});renderUnits()}));
$('#sort').addEventListener('change',event=>{state.sort=event.target.value;renderUnits()});
$('#priceMax').addEventListener('input',event=>{state.budget=Number(event.target.value);state.visible=6;renderUnits()});
$('#showMore').addEventListener('click',()=>{state.visible+=6;renderUnits()});
$('#downloadFavorites').addEventListener('click',downloadFavorites);
$('#compareOpen').addEventListener('click',()=>{renderCompare();$('#compareDialog').showModal()});
$('#compareClose').addEventListener('click',()=>$('#compareDialog').close());
$('#compareDialog').addEventListener('click',event=>{if(event.target===$('#compareDialog'))$('#compareDialog').close();const remove=event.target.closest('[data-remove]');const calc=event.target.closest('[data-calc]');if(remove)toggleCompare(remove.dataset.remove);if(calc){const unit=units.find(u=>u.id===calc.dataset.calc);$('#calcPrice').value=unit.price;updateCalculator();$('#compareDialog').close();$('#finance').scrollIntoView({behavior:'smooth'});showToast(`Расчёт для квартиры ${unit.id}`)}});
['calcPrice','calcDown','calcYears','calcRate'].forEach(id=>$('#'+id).addEventListener('input',updateCalculator));
renderUnits();updateCalculator();
