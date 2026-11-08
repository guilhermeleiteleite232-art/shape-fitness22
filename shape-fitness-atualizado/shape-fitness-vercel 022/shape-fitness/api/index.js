'use strict';
// Backend da Shape Fitness (Express) para Vercel: Postgres (Neon) + Vercel Blob.
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const URL_DB = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = global.__POOL || new Pool({ connectionString: URL_DB, ssl: /localhost|127\.0\.0\.1/.test(URL_DB || '') ? false : { rejectUnauthorized: false }, max: 1 });
const q = (sql, p) => pool.query(sql, p).then(r => r.rows);

const DEFAULTS = {
  tagline: 'SEU OBJETIVO. NOSSA MISSÃO.',
  intro: 'Na Shape Fitness, acreditamos que cada conquista começa com uma decisão. Oferecemos um ambiente preparado para proporcionar saúde, qualidade de vida e evolução, sempre com acompanhamento e dedicação.',
  hero_text: 'Academia em Feira de Santana com musculação, aulas coletivas e acompanhamento de instrutores.',
  whatsapp: '5575998101021', whatsapp_display: '(75) 99810-1021', instagram: 'academiashapefsa',
  address: 'Rua Felinto Marques de Cerqueira, 1049, Bairro Brasília, Feira de Santana – BA',
  hours: [
    { label: 'Segunda a sexta-feira', days: [1,2,3,4,5], open: '05:00', close: '21:00' },
    { label: 'Sábado', days: [6], open: '07:00', close: '13:00' },
    { label: 'Domingo', days: [0], open: '09:00', close: '12:00' }],
  benefits: [
    { icon: '◆', title: 'Diversidade de modalidades', text: 'Musculação, funcional, Pilates, Fit Dance e G.A.P.' },
    { icon: '▣', title: 'Ambiente preparado', text: 'Espaço pensado para a prática de atividades físicas.' },
    { icon: '▲', title: 'Musculação', text: 'Treino de força com acompanhamento.' },
    { icon: '●', title: 'Aulas coletivas', text: 'Programação semanal de aulas em grupo.' },
    { icon: '✚', title: 'Acompanhamento de instrutores', text: 'Orientação para você evoluir com segurança.' },
    { icon: '◷', title: 'Diferentes horários', text: 'Funcionamento de segunda a domingo.' },
    { icon: '★', title: 'Wellhub e TotalPass', text: 'Aceitamos os benefícios corporativos.' }],
  totalpass_plans: ['Basic I', 'Silver', 'Silver+'],
  plans_note: 'A disponibilidade das modalidades pode variar de acordo com o plano contratado. Consulte as condições diretamente no aplicativo da sua plataforma.',
  wellhub_url: '', totalpass_url: '', wellhub_logo: '', totalpass_logo: '', maps_url: '', hero_image: '', logo: '', map_embed: ''
};
const SEED_MODS = [['Musculação','Treino de força com equipamentos e orientação de instrutores.'],['Treinamento Funcional','Exercícios de corpo inteiro para condicionamento e mobilidade.'],['Pilates','Fortalecimento, postura e controle corporal.'],['Fit Dance','Aula de dança com movimento, ritmo e energia.'],['G.A.P.','Glúteos, abdômen e pernas em aula coletiva.']];

let initP;
const init = () => initP || (initP = (async () => {
  for (const s of [
    'CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, username TEXT UNIQUE, hash TEXT, must_change INTEGER DEFAULT 1)',
    'CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER, expires BIGINT)',
    'CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)',
    'CREATE TABLE IF NOT EXISTS modalities(id SERIAL PRIMARY KEY, name TEXT, description TEXT, image TEXT DEFAULT \'\', position INTEGER DEFAULT 0)',
    'CREATE TABLE IF NOT EXISTS classes(id SERIAL PRIMARY KEY, modality_id INTEGER REFERENCES modalities(id) ON DELETE CASCADE, weekday INTEGER, start TEXT, "end" TEXT, instructor TEXT)',
    'CREATE TABLE IF NOT EXISTS gallery(id SERIAL PRIMARY KEY, image TEXT, caption TEXT, position INTEGER DEFAULT 0)',
    'CREATE TABLE IF NOT EXISTS fails(ip TEXT PRIMARY KEY, n INTEGER, t BIGINT)'
  ]) await pool.query(s);
  // semeadura atômica: só quem inserir a chave 'seeded' popula os dados iniciais
  if ((await q("INSERT INTO kv(k,v) VALUES('seeded','1') ON CONFLICT (k) DO NOTHING RETURNING k")).length) {
    for (const [k, v] of Object.entries(DEFAULTS)) await pool.query('INSERT INTO kv(k,v) VALUES($1,$2) ON CONFLICT (k) DO NOTHING', [k, JSON.stringify(v)]);
    for (let i = 0; i < SEED_MODS.length; i++) await pool.query('INSERT INTO modalities(name,description,position) VALUES($1,$2,$3)', [SEED_MODS[i][0], SEED_MODS[i][1], i]);
  }
  // Acesso inicial somente por senha. A senha é armazenada como hash.
  await pool.query('INSERT INTO users(username,hash,must_change) VALUES($1,$2,0) ON CONFLICT (username) DO NOTHING', ['admin', bcrypt.hashSync(process.env.ADMIN_INITIAL_PASSWORD || 'shepe', 12)]);
  // Migração única para instalações existentes, sem sobrescrever futuras trocas.
  const migration = await pool.query("INSERT INTO kv(k,v) VALUES('admin_password_shepe_migration','1') ON CONFLICT (k) DO NOTHING RETURNING k");
  if (migration.rowCount) await pool.query('UPDATE users SET hash=$1,must_change=0 WHERE username=$2', [bcrypt.hashSync(process.env.ADMIN_INITIAL_PASSWORD || 'shepe', 12), 'admin']);
})().catch(e => { initP = null; throw e; }));

const getSettings = async () => ({ ...DEFAULTS, ...Object.fromEntries((await q("SELECT k,v FROM kv WHERE k<>'seeded'")).map(r => [r.k, JSON.parse(r.v)])) });
const setSetting = (k, v) => pool.query('INSERT INTO kv(k,v) VALUES($1,$2) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v', [k, JSON.stringify(v)]);
const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(e => { console.error(e); res.status(500).json({ error: 'Erro interno. Tente novamente.' }); });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(h(async (req, res, next) => { await init(); next(); }));

const SESSION_MS = 8 * 3600 * 1000;
const cookieOpts = req => ({ httpOnly: true, sameSite: 'strict', secure: req.secure, maxAge: SESSION_MS, path: '/' });
const readCookie = (req, n) => (req.headers.cookie || '').split(/;\s*/).map(c => c.split('=')).find(c => c[0] === n)?.[1];
const auth = h(async (req, res, next) => {
  const tok = readCookie(req, 'sid');
  const s = tok && (await q('SELECT s.user_id,u.must_change FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires>$2', [tok, Date.now()]))[0];
  if (!s) return res.status(401).json({ error: 'Não autenticado' });
  req.user = s; req.token = tok; next();
});
// CSRF: mutações exigem cabeçalho customizado + cookie SameSite=Strict
const csrf = (req, res, next) => (req.method === 'GET' || req.get('X-Requested-With') === 'fetch') ? next() : res.status(403).json({ error: 'Requisição inválida' });
const ready = (req, res, next) => req.user.must_change ? res.status(403).json({ error: 'Troque a senha inicial para continuar', mustChange: true }) : next();

const MAX_IMG = 3.2 * 1024 * 1024; // limite de corpo da Vercel: 4,5 MB
app.post('/api/admin/upload', csrf, auth, ready, express.json({ limit: '4.4mb' }), h(async (req, res) => {
  const m = /^data:image\/(?:png|jpeg|webp);base64,(.+)$/.exec(req.body?.data || '');
  if (!m) return res.status(400).json({ error: 'Envie PNG, JPG ou WebP' });
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > MAX_IMG) return res.status(400).json({ error: 'Imagem muito grande' });
  const kind = buf.slice(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) ? ['png','image/png']
    : buf.slice(0, 3).equals(Buffer.from([0xff,0xd8,0xff])) ? ['jpg','image/jpeg']
    : (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') ? ['webp','image/webp'] : null;
  if (!kind) return res.status(400).json({ error: 'Arquivo de imagem inválido' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: 'Armazenamento de imagens (Vercel Blob) não configurado' });
  const { put } = require('@vercel/blob');
  const r = await put(`shape/${crypto.randomBytes(12).toString('hex')}.${kind[0]}`, buf, { access: 'public', contentType: kind[1], addRandomSuffix: false });
  res.json({ url: r.url });
}));
app.use(express.json({ limit: '100kb' }));
app.use('/api', csrf);

app.post('/api/login', h(async (req, res) => {
  const ip = req.ip, now = Date.now();
  let f = (await q('SELECT * FROM fails WHERE ip=$1', [ip]))[0];
  if (f && now - Number(f.t) > 15 * 60e3) { await pool.query('DELETE FROM fails WHERE ip=$1', [ip]); f = null; }
  if (f && f.n >= 5) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  const { password } = req.body || {};
  const u = (await q('SELECT * FROM users WHERE username=$1', ['admin']))[0];
  const ok = bcrypt.compareSync(String(password || ''), u ? u.hash : '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
  if (!u || !ok) {
    await pool.query('INSERT INTO fails(ip,n,t) VALUES($1,1,$2) ON CONFLICT (ip) DO UPDATE SET n=fails.n+1', [ip, now]);
    return res.status(401).json({ error: 'Senha incorreta' });
  }
  await pool.query('DELETE FROM fails WHERE ip=$1', [ip]);
  await pool.query('DELETE FROM sessions WHERE expires<$1', [now]);
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions(token,user_id,expires) VALUES($1,$2,$3)', [token, u.id, now + SESSION_MS]);
  res.cookie('sid', token, cookieOpts(req)).json({ ok: true, mustChange: !!u.must_change });
}));
app.post('/api/logout', auth, h(async (req, res) => { await pool.query('DELETE FROM sessions WHERE token=$1', [req.token]); res.clearCookie('sid').json({ ok: true }); }));
app.get('/api/me', auth, (req, res) => res.json({ ok: true, mustChange: !!req.user.must_change }));
app.post('/api/admin/password', auth, h(async (req, res) => {
  const { current, next } = req.body || {};
  const u = (await q('SELECT * FROM users WHERE id=$1', [req.user.user_id]))[0];
  if (!bcrypt.compareSync(String(current || ''), u.hash)) return res.status(400).json({ error: 'Senha atual incorreta' });
  if (String(next || '').length < 8) return res.status(400).json({ error: 'A nova senha deve ter ao menos 8 caracteres' });
  await pool.query('UPDATE users SET hash=$1,must_change=0 WHERE id=$2', [bcrypt.hashSync(next, 12), u.id]);
  await pool.query('DELETE FROM sessions WHERE user_id=$1 AND token<>$2', [u.id, req.token]);
  res.json({ ok: true });
}));

const dataAll = async () => ({
  modalities: await q('SELECT * FROM modalities ORDER BY position,id'),
  classes: await q('SELECT id,modality_id,weekday,start,"end" AS "end",instructor FROM classes ORDER BY weekday,start'),
  gallery: await q('SELECT * FROM gallery ORDER BY position,id')
});
app.get('/api/public', h(async (req, res) => {
  const d = await dataAll(), names = Object.fromEntries(d.modalities.map(m => [m.id, m.name]));
  res.set('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
  res.json({ settings: await getSettings(), modalities: d.modalities, classes: d.classes.map(c => ({ ...c, modality: names[c.modality_id] })), gallery: d.gallery });
}));

const admin = express.Router();
admin.use(auth, ready);
const s = (v, n = 500) => String(v ?? '').trim().slice(0, n);
const timeOk = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const img = v => { v = s(v, 400); return v === '' || /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\/[\w./-]+$/.test(v) ? v : ''; };
const link = v => { v = s(v, 400); return v === '' || /^https:\/\//.test(v) ? v : ''; };
const nextPos = async t => (await q(`SELECT COALESCE(MAX(position),0)+1 AS p FROM ${t}`))[0].p;
admin.get('/summary', h(async (req, res) => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bahia' }));
  const n = async t => (await q(`SELECT COUNT(*)::int AS n FROM ${t}`))[0].n;
  res.json({ modalities: await n('modalities'), classes: await n('classes'), photos: await n('gallery'),
    next: await q('SELECT c.id,c.start,c.instructor,m.name AS modality FROM classes c JOIN modalities m ON m.id=c.modality_id WHERE c.weekday=$1 AND c.start>=$2 ORDER BY c.start LIMIT 5', [now.getDay(), now.toTimeString().slice(0, 5)]) });
}));
admin.get('/settings', h(async (req, res) => res.json(await getSettings())));
admin.put('/settings', h(async (req, res) => {
  const b = req.body || {};
  if (b.hours && !(Array.isArray(b.hours) && b.hours.every(x => timeOk(x.open) && timeOk(x.close) && Array.isArray(x.days)))) return res.status(400).json({ error: 'Horário inválido' });
  if (b.whatsapp && !/^\d{12,13}$/.test(String(b.whatsapp))) return res.status(400).json({ error: 'WhatsApp: use só números com 55 + DDD (ex.: 5575998101021)' });
  for (const k of ['hero_image', 'logo', 'wellhub_logo', 'totalpass_logo']) if (k in b) b[k] = img(b[k]);
  for (const k of ['wellhub_url', 'totalpass_url', 'maps_url']) if (k in b) b[k] = link(b[k]);
  for (const k of Object.keys(DEFAULTS)) if (k in b) await setSetting(k, b[k]);
  res.json(await getSettings());
}));
admin.get('/data', h(async (req, res) => res.json(await dataAll())));
admin.post('/modalities', h(async (req, res) => { const b = req.body; if (!s(b.name)) return res.status(400).json({ error: 'Informe o nome' });
  const r = await q('INSERT INTO modalities(name,description,image,position) VALUES($1,$2,$3,$4) RETURNING id', [s(b.name, 80), s(b.description, 400), img(b.image), await nextPos('modalities')]); res.json({ id: r[0].id }); }));
admin.put('/modalities/:id', h(async (req, res) => { const b = req.body; await pool.query('UPDATE modalities SET name=$1,description=$2,image=$3 WHERE id=$4', [s(b.name, 80), s(b.description, 400), img(b.image), +req.params.id]); res.json({ ok: true }); }));
admin.delete('/modalities/:id', h(async (req, res) => { await pool.query('DELETE FROM classes WHERE modality_id=$1', [+req.params.id]); await pool.query('DELETE FROM modalities WHERE id=$1', [+req.params.id]); res.json({ ok: true }); }));
const classErr = async b => !(await q('SELECT 1 FROM modalities WHERE id=$1', [+b.modality_id])).length ? 'Escolha a modalidade' : !(b.weekday >= 0 && b.weekday <= 6) ? 'Dia inválido' : !timeOk(b.start) || !timeOk(b.end) ? 'Horário inválido' : b.end <= b.start ? 'O término deve ser depois do início' : null;
admin.post('/classes', h(async (req, res) => { const b = req.body, e = await classErr(b); if (e) return res.status(400).json({ error: e });
  const r = await q('INSERT INTO classes(modality_id,weekday,start,"end",instructor) VALUES($1,$2,$3,$4,$5) RETURNING id', [+b.modality_id, +b.weekday, b.start, b.end, s(b.instructor, 80)]); res.json({ id: r[0].id }); }));
admin.put('/classes/:id', h(async (req, res) => { const b = req.body, e = await classErr(b); if (e) return res.status(400).json({ error: e });
  await pool.query('UPDATE classes SET modality_id=$1,weekday=$2,start=$3,"end"=$4,instructor=$5 WHERE id=$6', [+b.modality_id, +b.weekday, b.start, b.end, s(b.instructor, 80), +req.params.id]); res.json({ ok: true }); }));
admin.delete('/classes/:id', h(async (req, res) => { await pool.query('DELETE FROM classes WHERE id=$1', [+req.params.id]); res.json({ ok: true }); }));
admin.post('/gallery', h(async (req, res) => { if (!img(req.body.image)) return res.status(400).json({ error: 'Imagem inválida' });
  const r = await q('INSERT INTO gallery(image,caption,position) VALUES($1,$2,$3) RETURNING id', [img(req.body.image), s(req.body.caption, 120), await nextPos('gallery')]); res.json({ id: r[0].id }); }));
const move = t => h(async (req, res) => {
  const ids = (await q(`SELECT id FROM ${t} ORDER BY position,id`)).map(r => r.id), i = ids.indexOf(+req.params.id), j = i + (+req.body.dir < 0 ? -1 : 1);
  if (i >= 0 && j >= 0 && j < ids.length) { [ids[i], ids[j]] = [ids[j], ids[i]]; for (let k = 0; k < ids.length; k++) await pool.query(`UPDATE ${t} SET position=$1 WHERE id=$2`, [k, ids[k]]); }
  res.json({ ok: true });
});
admin.post('/modalities/:id/move', move('modalities'));
admin.post('/gallery/:id/move', move('gallery'));
admin.put('/gallery/:id', h(async (req, res) => { await pool.query('UPDATE gallery SET caption=$1 WHERE id=$2', [s(req.body.caption, 120), +req.params.id]); res.json({ ok: true }); }));
admin.delete('/gallery/:id', h(async (req, res) => { await pool.query('DELETE FROM gallery WHERE id=$1', [+req.params.id]); res.json({ ok: true }); }));
app.use('/api/admin', admin);
app.use('/api', (req, res) => res.status(404).json({ error: 'Não encontrado' }));

// SEO: robots.txt e sitemap.xml gerados com o domínio de quem acessa
const origin = req => `${req.protocol}://${req.get('host')}`;
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: ${origin(req)}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin(req)}/</loc><changefreq>weekly</changefreq></url></urlset>`));

module.exports = app;
