---
name: distribution-agent
description: Sobe a mídia gerada de uma campanha da ViajaON (Supabase, com fallback local), monta metadata de publicação e gera o advisory "Publish <task> <data>.md". Nunca publica de verdade sem o usuário citar esse arquivo pelo nome. Acione como último passo de uma campanha, depois de ad/vídeo/copy prontos.
---

# Distribution Agent

## Como rodar

```bash
node scripts/distribute.js --task=<nome_da_task> [--date=YYYY-MM-DD]
```

Coleta toda mídia de `outputs/<task>_<data>/ads/` e `.../video/` (`.png`, `.jpg`, `.mp4`),
tenta subir pro Supabase Storage, e grava:

- `media_urls.json` — lista de `{ file, url }`
- `Publish <task> <data>.md` — advisory com mídia, ad/vídeo resumidos, horários sugeridos e o
  checklist de brand governance

## Sem SUPABASE_URL/SUPABASE_SERVICE_KEY configurados

Cai em fallback: usa `file:///caminho/local` como "URL" em vez de subir pra lugar nenhum.
Isso é avisado no console e é óbvio no `media_urls.json` (URL começa com `file:///`) — nunca
apresente isso como link público real pro usuário. Pra hosting real, criar um projeto
Supabase, um bucket `campaign-uploads` (ou o nome que preferir, via `SUPABASE_BUCKET`), e
colocar a service key no `.env`.

## Regra mais importante: publicação é sempre manual

Este script **nunca** publica no Instagram ou YouTube. Ele só gera o Publish MD como
advisory. A API real (Instagram Graph API, YouTube Data API) não está integrada neste
projeto — se um dia for integrar, o gatilho continua sendo o mesmo: só executar quando o
usuário citar explicitamente `Publish <task> <data>.md` pelo nome numa mensagem, nunca por
conta própria ao terminar o pipeline.

## O que entra no Publish MD

1. Lista de mídia com URL (real ou fallback local)
2. Resumo do ad estático (headline/subtexto/CTA de `ads/layout.json`, se existir)
3. Resumo do vídeo (número de scenes, duração total, de `video/scenes.json`, se existir)
4. Horários sugeridos por plataforma — heurística simples baseada no público (executivos/donos
   de empresa), não dado real de analytics; ajustar se o Luís tiver dado melhor
5. Checklist de `knowledge/brand_identity.md` → Brand Governance, pra revisar antes de postar
6. Legenda do Instagram auditada com `ig-humanizer --mode audit` (ver `knowledge/instagram_skills.md`). Publora só com chave configurada e aprovação explícita do Luís

## Antes de usar em produção

- Confirmar se o bucket do Supabase deve ser público (Graph API do Instagram precisa de URL
  pública pra puxar a mídia) ou se outro esquema de hosting é preferido.
- Se for publicar via API de verdade: Instagram Graph API precisa de app configurado + token
  de página; YouTube Data API precisa de OAuth com `YOUTUBE_REFRESH_TOKEN`. Nenhum dos dois
  está implementado — nem os testei, porque não há credencial disponível nesta sessão.
