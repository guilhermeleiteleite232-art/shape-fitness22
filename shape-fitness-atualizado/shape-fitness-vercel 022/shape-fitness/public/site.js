(() => {
'use strict';
const $ = id => document.getElementById(id);
const DAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MSG = {
  home: 'Olá! Conheci a Shape Fitness pelo site e gostaria de obter mais informações.',
  mod: 'Olá! Gostaria de saber mais sobre as modalidades disponíveis na Shape Fitness.',
  cron: 'Olá! Gostaria de consultar os horários das aulas.',
  planos: 'Olá! Gostaria de saber mais sobre os planos e condições da academia.'
};
let D, filter = 0, waKey = 'home';
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); kids.flat().forEach(k => e.append(k)); return e; };
const wa = k => `https://wa.me/${D.settings.whatsapp}?text=${encodeURIComponent(MSG[k] || MSG.home)}`;
const hm = t => t.replace(':00', 'h').replace(':', 'h');
const hrs = h => `${hm(h.open)} às ${hm(h.close)}`;

function bahiaNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bahia', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday), time: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute };
}
function status() {
  const n = bahiaNow(), h = D.settings.hours.find(x => x.days.includes(n.day));
  const open = h && n.time >= h.open && n.time < h.close, s = $('status');
  s.className = 'pill ' + (open ? 'on' : 'off');
  s.lastChild.textContent = open ? `Aberta agora · fecha às ${hm(h.close)}` : 'Fechada agora';
  s.setAttribute('role', 'status');
}
function render() {
  const S = D.settings, today = bahiaNow().day;
  document.title = 'Shape Fitness | Academia em Feira de Santana – BA';
  const brand = S.logo ? el('img', { src: S.logo, alt: 'Shape Fitness' }) : null;
  if (brand) { $('logo').replaceChildren(brand); $('flogo').replaceChildren(el('img', { src: S.logo, alt: 'Shape Fitness', style: 'height:56px' })); }
  else $('flogo').innerHTML = 'SHAPE <b>FITNESS</b>';
  $('tagline').textContent = S.tagline; $('heroText').textContent = S.hero_text; $('intro').textContent = S.intro;
  if (S.hero_image) document.documentElement.style.setProperty('--hero', `url("${S.hero_image}")`);
  $('chips').replaceChildren(...D.modalities.map(m => el('a', { href: '#modalidades', textContent: m.name })));

  $('mods').replaceChildren(...D.modalities.map(m => {
    const cl = D.classes.filter(c => c.modality_id === m.id);
    const times = cl.length ? cl.slice(0, 4).map(c => el('span', { textContent: `${DAYS[c.weekday].slice(0, 3)} ${hm(c.start)}–${hm(c.end)}` })) : [el('span', { className: 'muted', textContent: 'Horários em breve. Consulte pelo WhatsApp.' })];
    const btn = el('a', { className: 'btn sm', href: '#cronograma', textContent: 'Consultar cronograma' });
    btn.onclick = () => { filter = m.id; drawSchedule(); };
    return el('article', { className: 'card' }, m.image ? el('img', { className: 'ph', src: m.image, alt: m.name, loading: 'lazy' }) : el('div', { className: 'ph', textContent: m.name.slice(0, 2).toUpperCase() }),
      el('div', { className: 'bd' }, el('h3', { textContent: m.name }), el('p', { textContent: m.description }), el('div', { className: 'times' }, times), btn));
  }));

  $('hours').replaceChildren(...S.hours.map(h => el('div', { className: 'card' + (h.days.includes(today) ? ' today' : '') }, el('h3', { textContent: h.label }), el('strong', { textContent: hrs(h) }))));
  $('fhours').replaceChildren(...S.hours.map(h => el('li', { textContent: `${h.label}: ${hrs(h)}` })));
  drawSchedule();

  $('tp').replaceChildren(...S.totalpass_plans.map(p => el('li', { textContent: p })));
  $('plansNote').textContent = S.plans_note;
  [['wlogo', S.wellhub_logo, 'Wellhub'], ['tlogo', S.totalpass_logo, 'TotalPass']].forEach(([id, src, n]) => $(id).replaceChildren(...(src ? [el('img', { src, alt: n, style: 'height:44px;width:auto;margin-bottom:12px;background:#fff;padding:6px 10px;border-radius:8px' })] : [])));
  const pb = $('plansBtn'); if (S.totalpass_url || S.wellhub_url) { pb.href = S.totalpass_url || S.wellhub_url; pb.target = '_blank'; pb.rel = 'noopener'; pb.removeAttribute('data-wa-btn'); }
  $('ben').replaceChildren(...S.benefits.map(b => el('div', { className: 'card ben' }, el('div', { className: 'ic', textContent: b.icon, 'aria-hidden': 'true' }), el('h3', { textContent: b.title }), el('p', { textContent: b.text }))));
  if (D.gallery.length) { $('galeria').hidden = false; $('gal').replaceChildren(...D.gallery.map(g => el('img', { src: g.image, alt: g.caption || 'Foto da Shape Fitness', loading: 'lazy' }))); }

  const q = encodeURIComponent(S.address);
  $('addr').textContent = S.address;
  $('map').src = S.map_embed || `https://www.google.com/maps?q=${q}&output=embed`;
  $('dir').href = `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  $('app').href = S.maps_url || `https://www.google.com/maps/search/?api=1&query=${q}`;
  $('faddr').textContent = S.address;
  $('fwa').textContent = 'WhatsApp ' + S.whatsapp_display; $('fwa').dataset.waBtn = 'home';
  $('fig').textContent = '@' + S.instagram; $('fig').href = 'https://instagram.com/' + S.instagram;
  $('yr').textContent = new Date().getFullYear();
  wireWa(); status();
}
function drawSchedule() {
  const tabs = [{ id: 0, name: 'Todas' }, ...D.modalities.map(m => ({ id: m.id, name: m.name }))];
  $('tabs').replaceChildren(...tabs.map(t => { const b = el('button', { textContent: t.name, type: 'button' }); b.setAttribute('aria-pressed', filter === t.id); b.onclick = () => { filter = t.id; drawSchedule(); }; return b; }));
  const today = bahiaNow().day;
  const cls = D.classes.filter(c => !filter || c.modality_id === filter);
  $('days').replaceChildren(...[1,2,3,4,5,6,0].map(d => {
    const list = cls.filter(c => c.weekday === d);
    return el('div', { className: 'day' + (d === today ? ' today' : '') }, el('h3', { textContent: DAYS[d] }),
      list.length ? list.map(c => el('div', { className: 'cls' }, el('b', { textContent: `${hm(c.start)} – ${hm(c.end)}` }), el('small', { textContent: c.modality + (c.instructor ? ' · ' + c.instructor : '') }))) : el('p', { className: 'muted', textContent: 'Sem aulas cadastradas.' }));
  }));
}
function wireWa() {
  const upd = () => { $('wa').href = wa(waKey); };
  document.querySelectorAll('[data-wa-btn]').forEach(a => { a.href = wa(a.dataset.waBtn); a.target = '_blank'; a.rel = 'noopener'; });
  upd();
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { waKey = e.target.dataset.wa; upd(); } }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('section[data-wa]').forEach(s => io.observe(s));
}
$('burger').onclick = () => { const o = $('nav').classList.toggle('open'); $('burger').setAttribute('aria-expanded', o); };
$('nav').onclick = e => { if (e.target.tagName === 'A') { $('nav').classList.remove('open'); $('burger').setAttribute('aria-expanded', false); } };
fetch('/api/public').then(r => r.json()).then(d => { D = d; render(); setInterval(status, 30000); })
  .catch(() => { $('tagline').textContent = 'SHAPE FITNESS'; });
})();
