// Original code-drawn winter decorations. No remote assets, text, controls or tracking.
const festivePine = (x,y,angle=0,scale=1) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})"><path d="M0 0C31 6 57 9 91 2" fill="none" stroke="#3a5c42" stroke-width="4" stroke-linecap="round"/><path d="M12 2 5-9m9 12L5 15m20-11L18-9m9 14L19 21m18-15L32-9m7 15L32 25m17-18L46-8m5 15L47 26m17-19L62-8m3 15L61 24m17-18L77-7m2 12L76 21m10-17L89-5" fill="none" stroke="#254a38" stroke-width="5" stroke-linecap="round"/><path d="M12 2 7-7m18 12L21-7m17 13L35-7m16 14L49-6m17 13L65-6m14 11L80-5M14 6l-6 7m20-6-5 10m16-8-4 11m17-10-2 11m16-12-2 10m15-12-1 10" fill="none" stroke="#638368" stroke-width="1.6" stroke-linecap="round" opacity=".85"/></g>`;

const festiveFlake = `<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M0-18V18M-15.6-9 15.6 9M-15.6 9 15.6-9M-4-14 0-10 4-14M-4 14 0 10 4 14M-14-3-8-4-9-10M14 3 8 4 9 10M-9 10-8 4-14 3M9-10 8-4 14-3"/><path d="m0-7 6 3.5v7L0 7l-6-3.5v-7Z"/></g>`;

function festiveGarland(){
  const branches=Array.from({length:12},(_,i)=>festivePine(i*128-36,21+(i%2)*3,i%2?-12:8,1.47)).join('');
  const lights=Array.from({length:23},(_,i)=>`<g class="festive-lamp" style="--festive-lamp:${i}" transform="translate(${18+i*65} ${32+(i%3)*7})"><path d="M0-12v9" stroke="#6a6040" stroke-width="1.6"/><ellipse cy="2" rx="4.3" ry="6.8" fill="${['#e9c67f','#cb6654','#eddaad'][i%3]}"/><ellipse cx="-1.2" cy=".3" rx="1.1" ry="2.5" fill="#fff3c7" opacity=".8"/></g>`).join('');
  return `<svg class="festive-garland" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1480 85" aria-hidden="true" focusable="false"><path d="M-25 12Q350 52 740 21T1510 14" fill="none" stroke="#192f26" stroke-width="8"/>${branches}${lights}</svg>`;
}

function festiveHanging(side){
  const mirrored=side==='right';
  return `<svg class="festive-hanging festive-hanging--${side}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 215" aria-hidden="true" focusable="false"><g transform="${mirrored?'translate(150 0) scale(-1 1)':'translate(0 0)'}">${festivePine(-8,35,35,1.25)}${festivePine(-8,49,63,1)}<path d="M53 36v63M94 47v91M27 53v105" fill="none" stroke="#cdb985" stroke-width="1.2"/><g class="festive-swing" style="--festive-delay:-2s" transform="translate(53 116)"><path d="M-4-15h8v5h-8Z" fill="#be995a"/><circle r="16" fill="#a93931" stroke="#f0c58a" stroke-width="1.2"/><path d="M-12-7c7 4 14 4 24 0M-14 1c9 4 18 4 28 0M-11 9c6 2 13 2 22 0" fill="none" stroke="#d97a59" stroke-width="1.6"/><ellipse cx="-6" cy="-7" rx="3" ry="4" fill="#fff1d3" opacity=".4"/></g><g class="festive-paper-flake" transform="translate(94 161)">${festiveFlake}</g><g class="festive-small-star" transform="translate(27 173)"><path d="m0-11 3.2 6.5 7.2 1-5.2 5.1 1.2 7.2L0 5.4-6.4 9.8l1.2-7.2-5.2-5.1 7.2-1Z" fill="#dfbc72" stroke="#a28350" stroke-width="1"/></g></g></svg>`;
}

function festiveGifts(){
  return `<svg class="festive-gift-stack" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 238 150" aria-hidden="true" focusable="false"><ellipse cx="122" cy="138" rx="106" ry="7" fill="#071e1a" opacity=".22"/><g transform="translate(90 42) rotate(5)"><path d="M0 22h104v70H0Z" fill="#9a3c31"/><path d="M-5 13h114v21H-5Z" fill="#bb5040"/><path d="M44 14h14v78H44Z" fill="#dfbf78"/><path d="M51 14C15 12 12-11 33-7c16 3 18 21 18 21Zm0 0C85 8 92-13 73-8 58-4 51 14 51 14Z" fill="none" stroke="#e6c784" stroke-width="7" stroke-linejoin="round"/></g><g transform="translate(25 81) rotate(-7)"><path d="M0 13h91v49H0Z" fill="#2c5744"/><path d="M-5 3h101v18H-5Z" fill="#46715a"/><path d="M38 4h15v58H38Z" fill="#c1a25e"/><path d="M45 4C20 3 17-14 29-14 40-13 45 4 45 4Zm0 0C69 0 78-16 64-13 54-10 45 4 45 4Z" fill="none" stroke="#d6ba79" stroke-width="6"/><path d="m67 25 14 3-3 16-14-3Z" fill="#f6e9c5" stroke="#bfa36e"/><path d="m73 30 4 1m-6 4 5 1" stroke="#9a6c42"/></g><g transform="translate(180 110) rotate(12)">${festivePine(-4,0,-8,.65)}</g></svg>`;
}

function festiveTracks(){
  return `<svg class="festive-tracks" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 72" aria-hidden="true" focusable="false"><g fill="#60787c" opacity=".46">${Array.from({length:7},(_,i)=>`<g transform="translate(${13+i*26} ${37-Math.sin(i*.7)*14}) rotate(${-12+i*4})"><ellipse cx="-4" cy="5" rx="3" ry="6"/><ellipse cx="5" cy="-5" rx="3" ry="6"/></g>`).join('')}</g></svg>`;
}

export function decorMarkup(mode='game'){
  const variant=['game','home','public','scene'].includes(mode)?mode:'game';
  return `<div class="festive-decor festive-decor--${variant}" aria-hidden="true">${festiveGarland()}${festiveHanging('left')}${festiveHanging('right')}${variant==='scene'?festiveTracks():festiveGifts()}<span class="festive-paper-star festive-paper-star--one">✶</span><span class="festive-paper-star festive-paper-star--two">✧</span></div>`;
}
