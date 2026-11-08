(() => {
'use strict';
const app = document.getElementById('app');
const DAYS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let tab = 'dash', S, M = [], C = [], G = [];
async function api(method, url, body) {
  const r = await fetch('/api' + url, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'Erro'); e.status = r.status; e.mustChange = j.mustChange; throw e; }
  return j;
}
const msg = (t, ok) => { const e = document.getElementById('msg'); if (e) { e.className = 'err' + (ok ? ' ok' : ''); e.textContent = t; } };
const act = fn => async e => { try { await fn(e); } catch (er) { if (er.status === 401) return login(); msg(er.message); } };

function login(note) {
  app.innerHTML = `<form class="box login-box" id="f"><div class="login-brand">SHAPE FITNESS <span>· ADMIN</span></div>
  <label for="p">Senha de acesso</label><input id="p" type="password" autocomplete="current-password" required autofocus>
  <p class="err" id="msg" role="alert">${esc(note || '')}</p><button class="btn" style="width:100%;margin-top:8px">Entrar</button></form>`;
  document.getElementById('f').onsubmit = act(async e => { e.preventDefault();
    await api('POST', '/login', { password: document.getElementById('p').value }); start(); });
}
async function load() { [S, { modalities: M, classes: C, gallery: G }] = await Promise.all([api('GET', '/admin/settings'), api('GET', '/admin/data')]); }
async function start() {
  try { await api('GET', '/me'); await load(); } catch (e) { return e.status === 401 ? login() : login(e.message); }
  shell();
}
const TABS = [['dash', 'Resumo'], ['mod', 'Modalidades'], ['cls', 'Cronograma'], ['info', 'Informações'], ['img', 'Imagens'], ['cfg', 'Configurações']];
function shell() {
  app.innerHTML = `<div class="top"><strong style="font:800 1.4rem 'Barlow Condensed'">SHAPE <span style="color:var(--y)">PAINEL</span></strong>
  <nav class="mn" style="all:unset;display:flex;gap:6px;flex-wrap:wrap">${TABS.map(t => `<button data-t="${t[0]}" class="${tab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</nav>
  <span><a class="btn o sm" href="/" target="_blank">Ver site</a> <button class="btn o sm" id="out">Sair</button></span></div><main id="v"></main>`;
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; shell(); });
  document.getElementById('out').onclick = async () => { await api('POST', '/logout').catch(() => {}); login(); };
  views[tab]();
}
const v = h => { document.getElementById('v').innerHTML = h + '<p class="err" id="msg" role="status"></p>'; };
async function upload(file) {
  if (!file) return null;
  // reduz a imagem no navegador (máx. 1600 px) para caber no limite de envio da Vercel
  const src = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  const im = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Imagem inválida')); i.src = src; });
  const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
  c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
  const data = file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
  return (await api('POST', '/admin/upload', { data })).url;
}
const modOpts = sel => M.map(m => `<option value="${m.id}" ${m.id == sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
const views = {
  async dash() {
    const s = await api('GET', '/admin/summary');
    v(`<h2>Resumo</h2><div class="row"><div class="it"><div class="st">${s.modalities}</div>modalidades</div><div class="it"><div class="st">${s.classes}</div>aulas cadastradas</div><div class="it"><div class="st">${s.photos}</div>fotos na galeria</div></div>
    <h3 style="margin-top:24px">Próximas aulas de hoje</h3>${s.next.length ? s.next.map(c => `<div class="it"><b>${esc(c.start)}</b> · ${esc(c.modality)} ${c.instructor ? '· ' + esc(c.instructor) : ''}</div>`).join('') : '<p class="muted">Nenhuma aula restante hoje.</p>'}
    <h3 style="margin-top:24px">Aulas por modalidade</h3><div class="row">${M.map(m => `<div class="it"><b>${esc(m.name)}</b><br><span class="muted">${C.filter(c => c.modality_id === m.id).length} aula(s)</span></div>`).join('')}</div><h3 style="margin-top:24px">Acesso rápido</h3><div class="bar"><button class="btn sm" data-g="cls">Cronograma</button><button class="btn o sm" data-g="mod">Modalidades</button><button class="btn o sm" data-g="info">Informações</button><button class="btn o sm" data-g="img">Imagens</button><button class="btn o sm" data-g="cfg">Senha</button></div>`);
    document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { tab = b.dataset.g; shell(); });
  },
  mod() {
    v(`<h2>Modalidades</h2>${M.map(m => `<form class="it" data-id="${m.id}"><div class="row"><div><label>Nome</label><input name="name" value="${esc(m.name)}" required></div><div><label>Imagem</label><input type="file" name="file" accept="image/png,image/jpeg,image/webp"></div></div>
      <label>Descrição</label><textarea name="description">${esc(m.description)}</textarea><input type="hidden" name="image" value="${esc(m.image)}">${m.image ? `<img class="th" src="${esc(m.image)}" alt="">` : ''}
      <div class="bar"><button class="btn sm">Salvar</button><button type="button" class="btn o sm" data-del>Excluir</button><button type="button" class="btn o sm" data-mv="-1" aria-label="Subir">↑</button><button type="button" class="btn o sm" data-mv="1" aria-label="Descer">↓</button></div></form>`).join('')}
      <form class="it" id="new"><h3>Nova modalidade</h3><label>Nome</label><input name="name" required><label>Descrição</label><textarea name="description"></textarea><div class="bar"><button class="btn sm">Adicionar</button></div></form>`);
    document.querySelectorAll('form[data-id]').forEach(f => {
      f.onsubmit = act(async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); const u = await upload(f.file.files[0]); await api('PUT', '/admin/modalities/' + f.dataset.id, { name: d.name, description: d.description, image: u || d.image }); await load(); shell(); msg('Salvo.', 1); });
      f.querySelector('[data-del]').onclick = act(async () => { if (confirm('Excluir esta modalidade e todas as aulas dela?')) { await api('DELETE', '/admin/modalities/' + f.dataset.id); await load(); shell(); } });
      f.querySelectorAll('[data-mv]').forEach(b => b.onclick = act(async () => { await api('POST', '/admin/modalities/' + f.dataset.id + '/move', { dir: +b.dataset.mv }); await load(); shell(); }));
    });
    document.getElementById('new').onsubmit = act(async e => { e.preventDefault(); await api('POST', '/admin/modalities', Object.fromEntries(new FormData(e.target))); await load(); shell(); });
  },
  cls() {
    const form = (c = {}) => `<div class="row"><div><label>Modalidade</label><select name="modality_id">${modOpts(c.modality_id)}</select></div><div><label>Dia</label><select name="weekday">${[1,2,3,4,5,6,0].map(d => `<option value="${d}" ${c.weekday === d ? 'selected' : ''}>${DAYS[d]}</option>`).join('')}</select></div>
      <div><label>Início</label><input type="time" name="start" value="${c.start || ''}" required></div><div><label>Término</label><input type="time" name="end" value="${c.end || ''}" required></div><div><label>Instrutor</label><input name="instructor" value="${esc(c.instructor)}"></div></div>`;
    v(`<h2>Cronograma</h2><form class="it" id="new"><h3>Nova aula</h3>${form()}<div class="bar"><button class="btn sm">Adicionar aula</button></div></form>
    ${[1,2,3,4,5,6,0].map(d => `<h3 style="margin-top:22px">${DAYS[d]}</h3>${C.filter(c => c.weekday === d).map(c => `<form class="it" data-id="${c.id}">${form(c)}<div class="bar"><button class="btn sm">Salvar</button><button type="button" class="btn o sm" data-del>Excluir</button></div></form>`).join('') || '<p class="muted">Sem aulas.</p>'}`).join('')}`);
    const body = f => { const d = Object.fromEntries(new FormData(f)); d.weekday = +d.weekday; d.modality_id = +d.modality_id; return d; };
    document.getElementById('new').onsubmit = act(async e => { e.preventDefault(); await api('POST', '/admin/classes', body(e.target)); await load(); shell(); });
    document.querySelectorAll('form[data-id]').forEach(f => {
      f.onsubmit = act(async e => { e.preventDefault(); await api('PUT', '/admin/classes/' + f.dataset.id, body(f)); await load(); shell(); msg('Salvo.', 1); });
      f.querySelector('[data-del]').onclick = act(async () => { if (confirm('Excluir esta aula?')) { await api('DELETE', '/admin/classes/' + f.dataset.id); await load(); shell(); } });
    });
  },
  info() {
    const t = (n, l, val, big) => `<label>${l}</label>${big ? `<textarea name="${n}">${esc(val)}</textarea>` : `<input name="${n}" value="${esc(val)}">`}`;
    v(`<h2>Informações do site</h2><form class="it" id="f">${t('tagline', 'Frase principal', S.tagline)}${t('hero_text', 'Texto de apresentação', S.hero_text, 1)}${t('intro', 'Mensagem institucional', S.intro, 1)}
    <h3 style="margin-top:20px">Horário de funcionamento</h3>${S.hours.map((h, i) => `<div class="row"><div><label>Dias</label><input name="hl${i}" value="${esc(h.label)}"></div><div><label>Abre</label><input type="time" name="ho${i}" value="${h.open}"></div><div><label>Fecha</label><input type="time" name="hc${i}" value="${h.close}"></div></div>`).join('')}
    <h3 style="margin-top:20px">Contato e localização</h3>${t('whatsapp', 'WhatsApp (só números, com 55 + DDD)', S.whatsapp)}${t('whatsapp_display', 'WhatsApp exibido', S.whatsapp_display)}${t('instagram', 'Instagram (sem @)', S.instagram)}${t('address', 'Endereço', S.address)}${t('maps_url', 'Link do Google Maps para abrir no app (opcional, https://)', S.maps_url)}
    <h3 style="margin-top:20px">Wellhub e TotalPass</h3>${t('totalpass_plans', 'Planos TotalPass (separe por vírgula)', S.totalpass_plans.join(', '))}${t('plans_note', 'Observação', S.plans_note, 1)}${t('wellhub_url', 'Link do Wellhub (opcional, https://)', S.wellhub_url)}${t('totalpass_url', 'Link do TotalPass (opcional, https://)', S.totalpass_url)}
    <h3 style="margin-top:20px">Vantagens</h3><label>Uma por linha: Ícone | Título | Descrição (o ícone é opcional)</label><textarea name="benefits" style="min-height:190px">${esc(S.benefits.map(b => b.icon + ' | ' + b.title + ' | ' + b.text).join('\n'))}</textarea>
    <div class="bar"><button class="btn">Salvar informações</button></div></form>`);
    document.getElementById('f').onsubmit = act(async e => { e.preventDefault(); const d = Object.fromEntries(new FormData(e.target));
      const icons = ['◆','▣','▲','●','✚','◷','★'];
      const body = { tagline: d.tagline, hero_text: d.hero_text, intro: d.intro, whatsapp: d.whatsapp.replace(/\D/g, ''), whatsapp_display: d.whatsapp_display, instagram: d.instagram.replace('@', ''), address: d.address, maps_url: d.maps_url,
        totalpass_plans: d.totalpass_plans.split(',').map(x => x.trim()).filter(Boolean), plans_note: d.plans_note, wellhub_url: d.wellhub_url, totalpass_url: d.totalpass_url,
        hours: S.hours.map((h, i) => ({ ...h, label: d['hl' + i], open: d['ho' + i], close: d['hc' + i] })),
        benefits: d.benefits.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => { const p = l.split('|').map(x => x.trim()); return p.length >= 3 ? { icon: p[0].slice(0, 2), title: p[1], text: p.slice(2).join(' | ') } : { icon: icons[i % icons.length], title: p[0], text: p.slice(1).join(' | ') }; }) };
      S = await api('PUT', '/admin/settings', body); msg('Informações salvas. O site já foi atualizado.', 1); });
  },
  img() {
    const slot = (k, title, hint) => `<form class="it" data-k="${k}"><h3>${title}</h3>${S[k] ? `<img class="th" src="${esc(S[k])}" alt="" style="background:#222">` : `<p class="muted">${hint}</p>`}<input type="file" accept="image/png,image/jpeg,image/webp" required><div class="bar"><button class="btn sm">Enviar</button>${S[k] ? '<button type="button" class="btn o sm" data-clr="' + k + '">Remover</button>' : ''}</div></form>`;
    v(`<h2>Imagens</h2><div class="row">${slot('hero_image', 'Imagem da página inicial', 'Foto de destaque da academia.')}${slot('logo', 'Logotipo da Shape Fitness', 'Sem logo, o site mostra o nome em texto.')}${slot('wellhub_logo', 'Logotipo do Wellhub', 'Use o logo oficial da plataforma.')}${slot('totalpass_logo', 'Logotipo do TotalPass', 'Use o logo oficial da plataforma.')}</div>
    <h3 style="margin-top:24px">Galeria de fotos</h3><form class="it" id="g"><label>Nova foto</label><input type="file" accept="image/png,image/jpeg,image/webp" required><label>Legenda (opcional)</label><input name="cap"><div class="bar"><button class="btn sm">Adicionar à galeria</button></div></form>
    <div class="row">${G.map(g => `<div class="it" data-gid="${g.id}"><img class="th" style="width:100%;height:140px" src="${esc(g.image)}" alt=""><label>Legenda</label><input value="${esc(g.caption)}"><div class="bar"><button class="btn sm" data-gs>Salvar</button><button class="btn o sm" data-gm="-1" aria-label="Mover para antes">←</button><button class="btn o sm" data-gm="1" aria-label="Mover para depois">→</button><button class="btn o sm" data-gd>Excluir</button></div></div>`).join('')}</div><p class="muted">As imagens das modalidades são trocadas na aba Modalidades.</p>`);
    document.querySelectorAll('form[data-k]').forEach(f => f.onsubmit = act(async e => { e.preventDefault(); const u = await upload(f.querySelector('input').files[0]); S = await api('PUT', '/admin/settings', { [f.dataset.k]: u }); shell(); }));
    document.querySelectorAll('[data-clr]').forEach(b => b.onclick = act(async () => { S = await api('PUT', '/admin/settings', { [b.dataset.clr]: '' }); shell(); }));
    document.getElementById('g').onsubmit = act(async e => { e.preventDefault(); const u = await upload(e.target.querySelector('input[type=file]').files[0]); await api('POST', '/admin/gallery', { image: u, caption: e.target.cap.value }); await load(); shell(); });
    document.querySelectorAll('[data-gid]').forEach(c => { const id = c.dataset.gid;
      c.querySelector('[data-gs]').onclick = act(async () => { await api('PUT', '/admin/gallery/' + id, { caption: c.querySelector('input').value }); msg('Legenda salva.', 1); });
      c.querySelectorAll('[data-gm]').forEach(b => b.onclick = act(async () => { await api('POST', '/admin/gallery/' + id + '/move', { dir: +b.dataset.gm }); await load(); shell(); }));
      c.querySelector('[data-gd]').onclick = act(async () => { if (confirm('Excluir esta foto?')) { await api('DELETE', '/admin/gallery/' + id); await load(); shell(); } }); });
  },
  cfg() {
    v(`<h2>Configurações</h2><form class="it" id="f"><h3>Alterar senha do painel</h3><label>Senha atual</label><input id="c" type="password" autocomplete="current-password" required><label>Nova senha (mín. 8 caracteres)</label><input id="n" type="password" autocomplete="new-password" minlength="8" required><div class="bar"><button class="btn sm">Alterar senha</button></div></form>
    <p class="muted">Contatos, endereço e links externos ficam na aba Informações.</p>`);
    document.getElementById('f').onsubmit = act(async e => { e.preventDefault(); await api('POST', '/admin/password', { current: c.value, next: n.value }); e.target.reset(); msg('Senha alterada.', 1); });
  }
};
start();
})();
