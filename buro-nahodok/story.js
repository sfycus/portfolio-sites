const chapterEscape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const chapterBook=[
  {title:'Письма из метели',goal:'Помоги Северной почте восстановить записи.',next:'Огонёк на площади',bridge:'Первая часть бирки найдена. На ней знак большой ёлки. Снегирь зовёт на площадь: её праздничный свет поможет увидеть следующий след.',memory:'Начало адресной бирки',icon:'envelope'},
  {title:'Свет большой ёлки',goal:'Верни праздничный свет и помоги украсить площадь.',next:'Тёплая мастерская',bridge:'На площади снова светло. Второй фрагмент указывает на мастерскую, где для нашей посылки приготовили ленту и открытку.',memory:'Вторая часть бирки',icon:'tree'},
  {title:'Особая посылка',goal:'Помоги мастеру подготовить новогоднюю доставку.',next:'Пора к саням',bridge:'Дела мастерской закончены. Третий фрагмент отправляет нас к саням: там нужно проверить дорогу и завершить доставку.',memory:'Третья часть бирки',icon:'gift'},
  {title:'Первая доставка года',goal:'Помоги саням добраться до получателя.',next:'Адрес восстановлен',bridge:'Четыре части бирки снова вместе. Снегирь передал маршрут вознице. Новогодняя посылка добралась до своего адресата!',memory:'Последняя часть бирки',icon:'sleigh'},
];
function chapterSolved(missions,progress){return ['treasure','done'].includes(progress?.phase)?missions.length:Math.min(missions.length,Math.max(0,(progress?.index||0)+(progress?.phase==='find'?1:0)));}
function chapterFound(missions,progress){const solved=chapterSolved(missions,progress);return chapterBook.map((_,stage)=>missions.some(m=>m.station?.index===stage)&&missions.every((m,i)=>m.station?.index!==stage||i<solved));}

/** Story panels derive only from completed missions, never from a future answer or gift location. */
export function questChapter(missions,progress){
  const mission=missions?.[progress?.index||0];if(!mission?.station)return '';
  const stage=mission.station.index,chapter=chapterBook[stage];if(!chapter)return '';
  const found=chapterFound(missions,progress),step=mission.station.step||1,total=mission.station.total||1;
  if(found.every(Boolean))return '<section class="quest-chapter" aria-label="Текущая глава"><span class="chapter-kicker">Четыре главы пройдены</span><h2>Особая доставка завершена</h2><p>Адресная бирка снова цела. Снегирь благодарит тебя за помощь!</p></section>';
  return `<section class="quest-chapter" aria-label="Текущая глава"><span class="chapter-kicker">Глава ${stage+1} из 4 · поручение ${step} из ${total}</span><h2>${chapter.title}</h2><p class="chapter-objective"><span aria-hidden="true">✦</span><b>${chapter.goal}</b></p>${stage>0&&found[stage-1]?`<p class="chapter-memory"><span aria-hidden="true">✓</span><span>${chapterEscape(chapterBook[stage-1].memory)} — в пропуске.</span></p>`:''}</section>`;
}
export function questChapterTransition(missions,progress){
  const mission=missions?.[progress?.index];if(!mission?.station||!['find','treasure','done'].includes(progress.phase))return '';
  const chapter=chapterBook[mission.station.index];if(!chapter)return '';
  const last=mission.station.isLast!==false;
  return `<section class="chapter-next" aria-label="Продолжение истории"><span class="chapter-kicker">${last?'Глава завершена':'Поручение выполнено'}</span><h3>${last?chapter.next:'Ещё одно дело на этой станции'}</h3><p>${last?chapter.bridge:'Снегирь бережно записал результат. На этой станции осталось ещё одно поручение: выполним его и получим следующий фрагмент адреса.'}</p></section>`;
}
export function questInventory(missions,progress){
  if(!missions?.some(m=>m.station))return '';
  const found=chapterFound(missions,progress);
  return `<ul class="chapter-inventory" aria-label="Части адресной бирки" data-fragments="${found.filter(Boolean).length}">${chapterBook.map((chapter,index)=>`<li class="${found[index]?'is-found':'is-locked'}"><span aria-hidden="true">${found[index]?'✓':'◇'}</span><span>${chapter.memory}</span><b>${found[index]?'Найдена':'Ещё ищем'}</b></li>`).join('')}</ul>`;
}
export function questStoryBrief(missions){
  if(!missions?.some(m=>m.station))return '';
  return `<section class="quest-story-brief"><p><b>Четыре главы, ${missions.length} поручений.</b> Каждая завершённая глава возвращает одну часть адреса. Ошибаться можно: предметы переставляются, шаги отменяются, а Снегирь подскажет.</p></section>`;
}
