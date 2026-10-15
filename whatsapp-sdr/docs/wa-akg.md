# WA-AKG: instalação, conexão e problemas comuns

Repositório: https://github.com/mrifqidaffaaditya/WA-AKG. É um gateway de WhatsApp multi-sessão (Next.js + Baileys + Prisma) com API REST e webhooks.

## Instalar

Requisitos: Node 20+, MySQL ou PostgreSQL. Opções:

**Docker (inclui MySQL):**
```bash
git clone https://github.com/mrifqidaffaaditya/WA-AKG.git && cd WA-AKG
cp .env.example .env   # defina MYSQL_ROOT_PASSWORD, AUTH_SECRET (32+ chars), ADMIN_EMAIL, ADMIN_PASSWORD
# no .env, ajuste também TZ=America/Sao_Paulo e LOCALE=pt-BR (o padrão é Jakarta / id-ID)
docker compose up -d
```

**Node + PM2:**
```bash
git clone https://github.com/mrifqidaffaaditya/WA-AKG.git && cd WA-AKG
npm install && cp .env.example .env    # DATABASE_URL, AUTH_SECRET, PORT...
npm run db:push
npm run make-admin admin@exemplo.com senha
npm run build && pm2 start ecosystem.config.js
```

`AUTH_SECRET` é obrigatório: o servidor não sobe sem ele.

## Conectar o número

1. Abra o dashboard (padrão `http://localhost:3000`) e entre com o admin.
2. Crie uma sessão (ex.: `vendas`) e escaneie o QR code pelo WhatsApp do número que vai atender (Aparelhos conectados → Conectar aparelho).
3. Em Settings → API Keys, gere uma chave (`wag_...`).
4. Na sessão, **apague ou desative as regras de auto-reply e deixe a mensagem de boas-vindas vazia**. Respostas do WA-AKG seriam vistas pelo SDR como mensagens do time e pausariam o bot.

No `.env` do SDR: `WAAKG_URL=http://localhost:3000` (sem `/api`), `WAAKG_API_KEY=wag_...`, `WAAKG_SESSION=vendas`.

## Webhook

`npm run registrar-webhook` cria o webhook `message.received` + `message.sent` para a sessão, com o `WEBHOOK_SECRET` do `.env`. Ele confere se já existe antes de criar.

O WA-AKG precisa **alcançar** o `PUBLIC_URL`:

| Cenário | PUBLIC_URL |
|---|---|
| Os dois na mesma máquina, sem Docker | `http://localhost:3100` |
| WA-AKG em Docker, SDR no host | `http://host.docker.internal:3100` (no Linux, adicione `extra_hosts: ["host.docker.internal:host-gateway"]` ao serviço `app`) |
| Em servidores diferentes | URL pública com HTTPS (proxy reverso) ou túnel (`cloudflared tunnel --url http://localhost:3100`) |

Como o `PUBLIC_URL` também vai nos links do painel enviados ao vendedor, num cenário com Docker o link pode não abrir de fora. Se isso importar, publique o painel numa URL acessível e use-a.

Para conferir as entregas: o WA-AKG guarda logs dos webhooks (status e corpo da resposta) no dashboard. `GET http://localhost:3100/saude` deve responder `{"ok":true}`.

## Formato do evento (referência)

```json
{ "event": "message.received", "sessionId": "vendas", "timestamp": "...",
  "data": { "key": { "id": "...", "remoteJid": "5511...@s.whatsapp.net", "fromMe": false },
            "pushName": "Carla", "from": "5511...@s.whatsapp.net", "isGroup": false, "chatType": "PERSONAL",
            "type": "TEXT|IMAGE|AUDIO|VIDEO|DOCUMENT|STICKER|LOCATION|CONTACT", "content": "...", "caption": "...", "fileUrl": "/api/media/..." } }
```

Envio: `POST /api/messages/{sessao}/{jid codificado}/send` com `{ "message": { "text": "..." } }` (ou `image`, `video`, `document`).
Digitando: `POST /api/chat/{sessao}/{jid}/presence` com `{ "presence": "composing" }`.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Lead manda mensagem e nada acontece | Webhook não registrado ou `PUBLIC_URL` inalcançável (veja os logs de webhook no WA-AKG); bot desligado no painel; lead em modo humano |
| 401 no `/webhook` | `WEBHOOK_SECRET` diferente do segredo cadastrado no WA-AKG. Apague o webhook no WA-AKG e rode `registrar-webhook` de novo |
| Bot pausa sozinho logo depois de responder | Auto-reply ou boas-vindas do WA-AKG ativos, ou outro sistema enviando pelo mesmo número |
| Duas respostas para cada mensagem | Dois webhooks cadastrados para a mesma URL, ou o auto-reply do WA-AKG ativo |
| `erro_ia` nos eventos | `ANTHROPIC_API_KEY` ausente ou inválida, ou falta de crédito. A mensagem de contingência foi enviada e o lead foi para o time |
| Áudios sem resposta útil | O bot recebe `[áudio]` e pede para a pessoa escrever. Transcrição exigiria baixar `fileUrl` e transcrever, o que ainda não está implementado |
| Sessão cai | Normal no Baileys de vez em quando. Reconecte pelo QR no WA-AKG; o painel do SDR mostra o status no topo |
