// Servidor local para testes: node local.js (precisa de DATABASE_URL). Em produção a Vercel usa api/index.js.
const express = require('express'), path = require('path'), api = require('./api/index.js');
const app = express(), pub = path.join(__dirname, 'public');
app.use(api);
app.get('/admin', (req, res) => res.sendFile(path.join(pub, 'admin.html')));
app.use(express.static(pub, { extensions: ['html'] }));
app.listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
