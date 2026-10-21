import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { criarApp } from './lib/app.js';
import { statusIA } from './lib/cerebro.js';

const raiz = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(raiz, '.env')); } catch { /* sem .env: usa o ambiente */ }

const PORT = Number(process.env.PORT || 3100);
const SENHA = process.env.PAINEL_SENHA || '';
const SEGREDO_WEBHOOK = process.env.WEBHOOK_SECRET || '';
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');

if (!SENHA) {
  console.error('Defina PAINEL_SENHA no .env antes de iniciar.');
  process.exit(1);
}
if (!SEGREDO_WEBHOOK) console.warn('[aviso] WEBHOOK_SECRET vazio: o webhook aceitará chamadas sem assinatura.');
const app = criarApp({ raiz, publicUrl: PUBLIC_URL });
const { repo, config, motor, wa } = app;
statusIA(config.bot()).then((s) => { if (!s.ok) console.warn(`[aviso] IA indisponível (${s.provedor}): ${s.detalhe}. O bot não conseguirá responder.`); });

const TOKEN = crypto.createHmac('sha256', SENHA).update('painel-sdr-v1').digest('hex');
const HTML_PAINEL = path.join(raiz, 'painel', 'index.html');

// ---------------- utilitários HTTP ----------------

function lerCorpo(req, limite = 2 * 1024 * 1024) {
  return new Promise((ok, falha) => {
    const partes = [];
    let tam = 0;
    req.on('data', (c) => {
      tam += c.length;
      if (tam > limite) { falha(Object.assign(new Error('corpo grande demais'), { status: 413 })); req.destroy(); }
      else partes.push(c);
    });
    req.on('end', () => ok(Buffer.concat(partes)));
    req.on('error', falha);
  });
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function autenticado(req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)sdr_token=([a-f0-9]+)/);
  return Boolean(m && m[1].length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(m[1]), Buffer.from(TOKEN)));
}

function assinaturaValida(bruto, cabecalho) {
  if (!SEGREDO_WEBHOOK) return true;
  const recebida = String(cabecalho || '').replace(/^sha256=/, '');
  const esperada = crypto.createHmac('sha256', SEGREDO_WEBHOOK).update(bruto).digest('hex');
  return recebida.length === esperada.length && crypto.timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada));
}

const csvCampo = (v) => {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ---------------- rotas ----------------

const rotas = [];
const rota = (metodo, padrao, fn, { publica = false } = {}) => {
  const nomes = [];
  const re = new RegExp('^' + padrao.replace(/:(\w+)/g, (_, n) => { nomes.push(n); return '([^/]+)'; }) + '$');
  rotas.push({ metodo, re, nomes, fn, publica });
};

rota('GET', '/saude', (req, res) => json(res, 200, { ok: true }), { publica: true });

rota('POST', '/webhook', async (req, res) => {
  const bruto = await lerCorpo(req);
  if (!assinaturaValida(bruto, req.headers['x-webhook-signature'])) return json(res, 401, { erro: 'assinatura inválida' });
  let payload;
  try { payload = JSON.parse(bruto.toString('utf8')); } catch { return json(res, 400, { erro: 'json inválido' }); }
  json(res, 200, { ok: true });
  motor.receberWebhook(payload).catch((e) => console.error('[webhook]', e));
}, { publica: true });

rota('POST', '/api/login', async (req, res) => {
  const { senha } = JSON.parse((await lerCorpo(req)).toString() || '{}');
  const a = crypto.createHash('sha256').update(String(senha ?? '')).digest();
  const b = crypto.createHash('sha256').update(SENHA).digest();
  if (!crypto.timingSafeEqual(a, b)) {
    await new Promise((r) => setTimeout(r, 800));
    return json(res, 401, { erro: 'senha incorreta' });
  }
  res.setHeader('Set-Cookie', `sdr_token=${TOKEN}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`);
  json(res, 200, { ok: true });
}, { publica: true });

rota('POST', '/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'sdr_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  json(res, 200, { ok: true });
});

rota('GET', '/api/status', async (req, res) => {
  const bot = config.bot();
  let whatsapp = { configurado: wa.configurado };
  if (wa.configurado) {
    try {
      const s = await wa.status();
      const d = s?.data ?? s;
      whatsapp = { configurado: true, conectado: /connected|open/i.test(String(d?.status ?? '')), status: d?.status ?? 'desconhecido', sessao: wa.sessao };
    } catch (e) { whatsapp = { configurado: true, conectado: false, erro: e.message }; }
  }
  const conhecimento = config.conhecimento();
  const ia = await statusIA(bot);
  json(res, 200, {
    bot_ativo: Boolean(bot.ativo),
    nome_bot: bot.nome_bot,
    empresa: bot.empresa,
    modelo: bot.modelo,
    esforco: bot.esforco,
    ia_provedor: ia.provedor,
    ia_configurada: ia.ok,
    ia_detalhe: ia.detalhe,
    webhook_url: `${PUBLIC_URL}/webhook`,
    webhook_assinado: Boolean(SEGREDO_WEBHOOK),
    whatsapp,
    conhecimento: { arquivos: conhecimento.length, tokens_aprox: Math.round(conhecimento.reduce((s, d) => s + d.conteudo.length, 0) / 4) },
  });
});

rota('POST', '/api/bot/ativo', async (req, res) => {
  const { ativo } = JSON.parse((await lerCorpo(req)).toString() || '{}');
  const bot = config.bot();
  bot.ativo = Boolean(ativo);
  config.salvarBot(bot);
  repo.evento(null, ativo ? 'bot_ligado' : 'bot_desligado', {});
  json(res, 200, { ativo: bot.ativo });
});

rota('GET', '/api/resumo', (req, res, { query }) => {
  const dias = Math.min(Math.max(Number(query.get('dias')) || 30, 1), 365);
  const funil = config.funil();
  const r = repo.resumo({
    desde: Date.now() - dias * 864e5,
    faixaQuente: funil.faixas.quente,
    etapasQualificadas: ['qualificado', 'encaminhado', 'ganho'].filter((e) => funil.etapas.some((x) => x.id === e)),
  });
  r.custo_estimado_usd = app.custoEstimado(r.uso_ia);
  json(res, 200, { dias, ...r });
});

rota('GET', '/api/funil', (req, res) => json(res, 200, config.funil()));

rota('GET', '/api/leads', (req, res, { query }) => {
  json(res, 200, repo.listarLeads({
    etapa: query.get('etapa') || undefined,
    temperatura: query.get('temperatura') || undefined,
    modo: query.get('modo') || undefined,
    q: query.get('q') || undefined,
  }));
});

rota('GET', '/api/leads/:id', (req, res, { p }) => {
  const lead = repo.leadPorId(Number(p.id));
  if (!lead) return json(res, 404, { erro: 'lead não encontrado' });
  json(res, 200, { lead, mensagens: repo.mensagens(lead.id), eventos: repo.eventos(lead.id) });
});

rota('PATCH', '/api/leads/:id', async (req, res, { p }) => {
  const id = Number(p.id);
  const lead = repo.leadPorId(id);
  if (!lead) return json(res, 404, { erro: 'lead não encontrado' });
  const corpo = JSON.parse((await lerCorpo(req)).toString() || '{}');
  const funil = config.funil();
  const patch = {};
  if (corpo.etapa && corpo.etapa !== lead.etapa) {
    if (!funil.etapas.some((e) => e.id === corpo.etapa)) return json(res, 400, { erro: 'etapa inválida' });
    patch.etapa = corpo.etapa;
    repo.evento(id, 'etapa', { de: lead.etapa, para: corpo.etapa, por: 'time' });
    if (corpo.etapa === 'encaminhado' && lead.modo === 'bot') { patch.modo = 'humano'; patch.pausado_ate = null; }
  }
  for (const k of ['notas', 'responsavel', 'destino']) if (k in corpo) patch[k] = corpo[k];
  if (Array.isArray(corpo.tags)) patch.tags = corpo.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  if (corpo.dados && typeof corpo.dados === 'object') patch.dados = { ...lead.dados, ...corpo.dados };
  if (corpo.criterios && typeof corpo.criterios === 'object') {
    patch.criterios = { ...lead.criterios, ...corpo.criterios };
    Object.assign(patch, app.calcularScore(funil, patch.criterios));
  }
  if (corpo.modo === 'humano' && lead.modo !== 'humano') {
    patch.modo = 'humano'; patch.pausado_ate = null;
    repo.evento(id, 'humano_assumiu', { via: 'painel' });
  }
  if ('optout' in corpo) patch.optout = corpo.optout ? 1 : 0;
  json(res, 200, repo.atualizarLead(id, patch));
});

rota('POST', '/api/leads/:id/devolver', (req, res, { p }) => {
  const lead = motor.devolverAoBot(Number(p.id));
  if (!lead) return json(res, 404, { erro: 'lead não encontrado' });
  json(res, 200, lead);
});

rota('POST', '/api/leads/:id/mensagem', async (req, res, { p }) => {
  const { texto } = JSON.parse((await lerCorpo(req)).toString() || '{}');
  if (!String(texto ?? '').trim()) return json(res, 400, { erro: 'texto vazio' });
  await motor.mensagemDoTime(Number(p.id), String(texto).trim());
  json(res, 200, { ok: true });
});

rota('DELETE', '/api/leads/:id', (req, res, { p }) => {
  repo.apagarLead(Number(p.id));
  json(res, 200, { ok: true });
});

rota('GET', '/api/exportar.csv', (req, res) => {
  const funil = config.funil();
  const cab = ['id', 'nome', 'telefone', 'etapa', 'score', 'temperatura', 'modo', 'destino', 'responsavel', 'tags', 'resumo', 'notas', 'optout', 'criado_em', 'ultima_msg_lead_em', ...funil.campos.map((c) => c.id)];
  const linhas = repo.listarLeads({ limite: 100000 }).map((l) => [
    l.id, l.dados?.nome || l.nome_whatsapp, l.telefone, l.etapa, l.score, l.temperatura, l.modo, l.destino, l.responsavel,
    (l.tags || []).join(', '), l.resumo, l.notas, l.optout,
    new Date(l.criado_em).toISOString(), l.ultima_msg_lead_em ? new Date(l.ultima_msg_lead_em).toISOString() : '',
    ...funil.campos.map((c) => l.dados?.[c.id] ?? ''),
  ].map(csvCampo).join(';'));
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
  });
  res.end('﻿' + [cab.join(';'), ...linhas].join('\r\n'));
});

// ---- conhecimento ----
rota('GET', '/api/conhecimento', (req, res) => json(res, 200, config.conhecimento()));

rota('PUT', '/api/conhecimento/:nome', async (req, res, { p }) => {
  const { conteudo } = JSON.parse((await lerCorpo(req)).toString() || '{}');
  try { config.salvarConhecimento(decodeURIComponent(p.nome), conteudo); } catch (e) { return json(res, 400, { erro: e.message }); }
  json(res, 200, { ok: true });
});

rota('DELETE', '/api/conhecimento/:nome', (req, res, { p }) => {
  try { config.apagarConhecimento(decodeURIComponent(p.nome)); } catch (e) { return json(res, 400, { erro: e.message }); }
  json(res, 200, { ok: true });
});

// ---- lacunas ----
rota('GET', '/api/lacunas', (req, res, { query }) => json(res, 200, repo.listarLacunas(query.get('status') || 'aberta')));

rota('POST', '/api/lacunas/:id/resolver', async (req, res, { p }) => {
  const { resposta, incorporar = true } = JSON.parse((await lerCorpo(req)).toString() || '{}');
  const l = repo.lacuna(Number(p.id));
  if (!l) return json(res, 404, { erro: 'lacuna não encontrada' });
  if (!String(resposta ?? '').trim()) return json(res, 400, { erro: 'escreva a resposta' });
  if (incorporar) config.anexarConhecimento('99-respostas-do-time.md', `\n## ${l.pergunta.trim()}\n${String(resposta).trim()}\n`);
  repo.atualizarLacuna(l.id, { status: 'resolvida', resposta: String(resposta).trim() });
  json(res, 200, { ok: true });
});

rota('POST', '/api/lacunas/:id/ignorar', (req, res, { p }) => {
  repo.atualizarLacuna(Number(p.id), { status: 'ignorada' });
  json(res, 200, { ok: true });
});

// ---- configuração ----
rota('GET', '/api/config/:qual', (req, res, { p }) => {
  if (p.qual === 'bot') return json(res, 200, config.bot());
  if (p.qual === 'funil') return json(res, 200, config.funil());
  json(res, 404, { erro: 'configuração desconhecida' });
});

rota('PUT', '/api/config/:qual', async (req, res, { p }) => {
  let obj;
  try { obj = JSON.parse((await lerCorpo(req)).toString()); } catch (e) { return json(res, 400, { erros: [`JSON inválido: ${e.message}`] }); }
  const erros = p.qual === 'bot' ? config.salvarBot(obj) : p.qual === 'funil' ? config.salvarFunil(obj) : ['configuração desconhecida'];
  if (erros.length) return json(res, 400, { erros });
  json(res, 200, { ok: true });
});

// ---- simulador ----
rota('POST', '/api/simulador', async (req, res) => {
  const { sessao = 'painel', texto } = JSON.parse((await lerCorpo(req)).toString() || '{}');
  if (!String(texto ?? '').trim()) return json(res, 400, { erro: 'texto vazio' });
  const r = await app.simular(String(sessao), String(texto));
  json(res, 200, r);
});

rota('GET', '/api/simulador/:sessao', (req, res, { p }) => {
  const lead = repo.leadPorJid(`sim:${decodeURIComponent(p.sessao)}`);
  if (!lead) return json(res, 200, {});
  json(res, 200, { lead, mensagens: repo.mensagens(lead.id), eventos: repo.eventos(lead.id, 10) });
});

rota('DELETE', '/api/simulador/:sessao', (req, res, { p }) => {
  const lead = repo.leadPorJid(`sim:${decodeURIComponent(p.sessao)}`);
  if (lead) repo.apagarLead(lead.id);
  json(res, 200, { ok: true });
});

// ---------------- servidor ----------------

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.readFileSync(HTML_PAINEL));
    }
    for (const r of rotas) {
      if (r.metodo !== req.method) continue;
      const m = url.pathname.match(r.re);
      if (!m) continue;
      if (!r.publica && !autenticado(req)) return json(res, 401, { erro: 'não autenticado' });
      const p = Object.fromEntries(r.nomes.map((n, i) => [n, m[i + 1]]));
      return await r.fn(req, res, { p, query: url.searchParams });
    }
    json(res, 404, { erro: 'rota não encontrada' });
  } catch (e) {
    console.error('[http]', req.method, url.pathname, e);
    if (!res.headersSent) json(res, e.status || 500, { erro: e.message || 'erro interno' });
  }
});

servidor.listen(PORT, () => {
  console.log(`SDR WhatsApp rodando em ${PUBLIC_URL}`);
  console.log(`  Painel:  ${PUBLIC_URL}/`);
  console.log(`  Webhook: ${PUBLIC_URL}/webhook  (registre com: npm run registrar-webhook)`);
});

// Follow-ups: verifica a cada 5 minutos.
setInterval(() => {
  motor.rodarFollowups().catch((e) => console.error('[followups]', e));
}, 5 * 60 * 1000).unref();
