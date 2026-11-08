# Shape Fitness — site institucional (versão Vercel)

Site público + painel em `/admin`. Backend Express (`api/index.js`) com **Postgres (Neon)** e **Vercel Blob** para fotos.

## Publicar na Vercel
1. Suba esta pasta para um repositório no GitHub e importe o repositório na Vercel (Framework Preset: **Other**).
2. No projeto da Vercel, aba **Storage**: crie um banco **Neon (Postgres)** e um **Blob**. Isso cria sozinho as variáveis `DATABASE_URL` (ou `POSTGRES_URL`) e `BLOB_READ_WRITE_TOKEN`.
3. (Opcional) Em **Settings → Environment Variables**, defina `ADMIN_INITIAL_PASSWORD` com a senha inicial desejada. Sem isso, vale a senha inicial combinada.
4. Faça o deploy (ou redeploy, se criou o storage depois). As tabelas são criadas no primeiro acesso.
5. Acesse `/admin`: usuário `admin`. O painel obriga a trocar a senha inicial no primeiro login.

## Testar localmente
    npm install
    DATABASE_URL="postgres://..." BLOB_READ_WRITE_TOKEN="..." npm start

Observações: o limite de envio da Vercel é 4,5 MB, por isso o painel reduz as fotos para no máximo 1600 px antes de enviar.
