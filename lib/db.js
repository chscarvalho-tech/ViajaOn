import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const CAMPOS_JSON = ['dados', 'criterios', 'tags'];

const ESQUEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jid TEXT NOT NULL UNIQUE,
  telefone TEXT,
  nome_whatsapp TEXT,
  etapa TEXT NOT NULL DEFAULT 'novo',
  score INTEGER NOT NULL DEFAULT 0,
  temperatura TEXT NOT NULL DEFAULT 'frio',
  dados TEXT NOT NULL DEFAULT '{}',
  criterios TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  resumo TEXT,
  sentimento TEXT,
  destino TEXT,
  responsavel TEXT,
  notas TEXT,
  modo TEXT NOT NULL DEFAULT 'bot',
  pausado_ate INTEGER,
  optout INTEGER NOT NULL DEFAULT 0,
  followups_enviados INTEGER NOT NULL DEFAULT 0,
  ultimo_in_respondido INTEGER NOT NULL DEFAULT 0,
  primeira_resposta_ms INTEGER,
  criado_em INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL,
  ultima_msg_lead_em INTEGER,
  ultima_msg_bot_em INTEGER,
  ultima_msg_humano_em INTEGER
);
CREATE INDEX IF NOT EXISTS idx_leads_etapa ON leads(etapa);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direcao TEXT NOT NULL,
  autor TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'TEXT',
  texto TEXT NOT NULL DEFAULT '',
  wa_id TEXT UNIQUE,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_lead ON mensagens(lead_id, id);

CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  detalhe TEXT NOT NULL DEFAULT '{}',
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos(tipo, criado_em);

CREATE TABLE IF NOT EXISTS lacunas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  pergunta TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  resposta TEXT,
  criado_em INTEGER NOT NULL,
  resolvido_em INTEGER
);

CREATE TABLE IF NOT EXISTS uso_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  modelo TEXT,
  entrada INTEGER NOT NULL DEFAULT 0,
  saida INTEGER NOT NULL DEFAULT 0,
  cache_leitura INTEGER NOT NULL DEFAULT 0,
  cache_escrita INTEGER NOT NULL DEFAULT 0,
  criado_em INTEGER NOT NULL
);
`;

function lerLinha(l) {
  if (!l) return null;
  const o = { ...l };
  for (const c of CAMPOS_JSON) {
    if (c in o) {
      try { o[c] = JSON.parse(o[c] ?? (c === 'tags' ? '[]' : '{}')); } catch { o[c] = c === 'tags' ? [] : {}; }
    }
  }
  return o;
}

// Leads de simulação (jid "sim:...") ficam fora de listas e métricas.
const SEM_SIM = "jid NOT LIKE 'sim:%'";

export class Repo {
  constructor(arquivo) {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    this.db = new DatabaseSync(arquivo);
    this.db.exec(ESQUEMA);
  }

  // ---------- leads ----------
  leadPorId(id) {
    return lerLinha(this.db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
  }

  leadPorJid(jid) {
    return lerLinha(this.db.prepare('SELECT * FROM leads WHERE jid = ?').get(jid));
  }

  leadPorTelefone(tel) {
    return lerLinha(this.db.prepare('SELECT * FROM leads WHERE telefone LIKE ? ORDER BY id DESC').get('%' + tel));
  }

  criarLead({ jid, telefone, nome_whatsapp }) {
    const agora = Date.now();
    const r = this.db
      .prepare('INSERT INTO leads (jid, telefone, nome_whatsapp, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)')
      .run(jid, telefone ?? null, nome_whatsapp ?? null, agora, agora);
    return this.leadPorId(Number(r.lastInsertRowid));
  }

  atualizarLead(id, patch) {
    const chaves = Object.keys(patch);
    if (!chaves.length) return this.leadPorId(id);
    const valores = chaves.map((k) => (CAMPOS_JSON.includes(k) ? JSON.stringify(patch[k]) : patch[k]));
    const sets = chaves.map((k) => `${k} = ?`).join(', ');
    this.db.prepare(`UPDATE leads SET ${sets}, atualizado_em = ? WHERE id = ?`).run(...valores, Date.now(), id);
    return this.leadPorId(id);
  }

  apagarLead(id) {
    this.db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  }

  listarLeads({ etapa, temperatura, modo, q, limite = 500, incluirSim = false } = {}) {
    const onde = [];
    const args = [];
    if (!incluirSim) onde.push(SEM_SIM);
    if (etapa) { onde.push('etapa = ?'); args.push(etapa); }
    if (temperatura) { onde.push('temperatura = ?'); args.push(temperatura); }
    if (modo) { onde.push('modo = ?'); args.push(modo); }
    if (q) {
      onde.push('(nome_whatsapp LIKE ? OR telefone LIKE ? OR dados LIKE ? OR resumo LIKE ? OR tags LIKE ?)');
      const t = `%${q}%`;
      args.push(t, t, t, t, t);
    }
    const where = onde.length ? `WHERE ${onde.join(' AND ')}` : '';
    const sql = `SELECT * FROM leads ${where} ORDER BY COALESCE(ultima_msg_lead_em, criado_em) DESC LIMIT ?`;
    return this.db.prepare(sql).all(...args, limite).map(lerLinha);
  }

  leadsParaFollowup() {
    return this.db
      .prepare(
        `SELECT * FROM leads WHERE ${SEM_SIM} AND modo = 'bot' AND optout = 0
         AND ultima_msg_bot_em IS NOT NULL
         AND ultima_msg_bot_em > COALESCE(ultima_msg_lead_em, 0)`
      )
      .all()
      .map(lerLinha);
  }

  // ---------- mensagens ----------
  /** Retorna o id inserido, ou null se a mensagem (wa_id) já existia. */
  inserirMensagem({ lead_id, direcao, autor, tipo = 'TEXT', texto = '', wa_id = null }) {
    const r = this.db
      .prepare('INSERT OR IGNORE INTO mensagens (lead_id, direcao, autor, tipo, texto, wa_id, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(lead_id, direcao, autor, tipo, texto, wa_id, Date.now());
    return r.changes ? Number(r.lastInsertRowid) : null;
  }

  mensagens(leadId, limite = 500) {
    return this.db
      .prepare('SELECT * FROM (SELECT * FROM mensagens WHERE lead_id = ? ORDER BY id DESC LIMIT ?) ORDER BY id ASC')
      .all(leadId, limite);
  }

  mensagensDoLeadApos(leadId, aposId) {
    return this.db
      .prepare("SELECT * FROM mensagens WHERE lead_id = ? AND direcao = 'in' AND id > ? ORDER BY id ASC")
      .all(leadId, aposId);
  }

  // ---------- eventos ----------
  evento(leadId, tipo, detalhe = {}) {
    this.db
      .prepare('INSERT INTO eventos (lead_id, tipo, detalhe, criado_em) VALUES (?, ?, ?, ?)')
      .run(leadId ?? null, tipo, JSON.stringify(detalhe), Date.now());
  }

  eventos(leadId, limite = 200) {
    return this.db
      .prepare('SELECT * FROM eventos WHERE lead_id = ? ORDER BY id DESC LIMIT ?')
      .all(leadId, limite)
      .map((e) => ({ ...e, detalhe: JSON.parse(e.detalhe || '{}') }));
  }

  // ---------- lacunas ----------
  criarLacuna(leadId, pergunta) {
    const existe = this.db
      .prepare("SELECT id FROM lacunas WHERE status = 'aberta' AND lower(pergunta) = lower(?)")
      .get(pergunta);
    if (existe) return existe.id;
    const r = this.db
      .prepare('INSERT INTO lacunas (lead_id, pergunta, criado_em) VALUES (?, ?, ?)')
      .run(leadId ?? null, pergunta, Date.now());
    return Number(r.lastInsertRowid);
  }

  listarLacunas(status = 'aberta') {
    return this.db
      .prepare(
        `SELECT l.*, d.nome_whatsapp, d.telefone FROM lacunas l LEFT JOIN leads d ON d.id = l.lead_id
         WHERE l.status = ? ORDER BY l.id DESC LIMIT 300`
      )
      .all(status);
  }

  lacuna(id) {
    return this.db.prepare('SELECT * FROM lacunas WHERE id = ?').get(id);
  }

  atualizarLacuna(id, { status, resposta }) {
    this.db
      .prepare('UPDATE lacunas SET status = ?, resposta = COALESCE(?, resposta), resolvido_em = ? WHERE id = ?')
      .run(status, resposta ?? null, status === 'aberta' ? null : Date.now(), id);
  }

  // ---------- uso de IA ----------
  registrarUso(leadId, modelo, u = {}) {
    this.db
      .prepare('INSERT INTO uso_ia (lead_id, modelo, entrada, saida, cache_leitura, cache_escrita, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(
        leadId ?? null,
        modelo ?? null,
        u.input_tokens ?? 0,
        u.output_tokens ?? 0,
        u.cache_read_input_tokens ?? 0,
        u.cache_creation_input_tokens ?? 0,
        Date.now()
      );
  }

  // ---------- métricas ----------
  resumo({ desde, faixaQuente, etapasQualificadas }) {
    const um = (sql, ...a) => this.db.prepare(sql).get(...a);
    const todos = (sql, ...a) => this.db.prepare(sql).all(...a);
    const placeholders = etapasQualificadas.map(() => '?').join(',') || "''";

    const leadsPeriodo = um(`SELECT COUNT(*) n FROM leads WHERE ${SEM_SIM} AND criado_em >= ?`, desde).n;
    const qualificadosPeriodo = um(
      `SELECT COUNT(*) n FROM leads WHERE ${SEM_SIM} AND criado_em >= ? AND (etapa IN (${placeholders}) OR score >= ?)`,
      desde, ...etapasQualificadas, faixaQuente
    ).n;
    const inicioHoje = new Date(); inicioHoje.setHours(0, 0, 0, 0);

    return {
      leads_periodo: leadsPeriodo,
      leads_hoje: um(`SELECT COUNT(*) n FROM leads WHERE ${SEM_SIM} AND criado_em >= ?`, inicioHoje.getTime()).n,
      qualificados_periodo: qualificadosPeriodo,
      taxa_qualificacao: leadsPeriodo ? qualificadosPeriodo / leadsPeriodo : 0,
      quentes_ativos: um(`SELECT COUNT(*) n FROM leads WHERE ${SEM_SIM} AND temperatura = 'quente' AND etapa NOT IN ('ganho','perdido','desqualificado')`).n,
      encaminhados_periodo: um(`SELECT COUNT(DISTINCT lead_id) n FROM eventos WHERE tipo = 'transferido' AND criado_em >= ? AND lead_id IN (SELECT id FROM leads WHERE ${SEM_SIM})`, desde).n,
      ganhos_periodo: um(`SELECT COUNT(DISTINCT lead_id) n FROM eventos WHERE tipo = 'etapa' AND json_extract(detalhe, '$.para') = 'ganho' AND criado_em >= ?`, desde).n,
      primeira_resposta_media_ms: um(`SELECT AVG(primeira_resposta_ms) v FROM leads WHERE ${SEM_SIM} AND criado_em >= ? AND primeira_resposta_ms IS NOT NULL`, desde).v,
      mensagens_periodo: um(`SELECT COUNT(*) n FROM mensagens WHERE criado_em >= ? AND lead_id IN (SELECT id FROM leads WHERE ${SEM_SIM})`, desde).n,
      por_etapa: todos(`SELECT etapa, COUNT(*) n FROM leads WHERE ${SEM_SIM} GROUP BY etapa`),
      por_temperatura: todos(`SELECT temperatura, COUNT(*) n FROM leads WHERE ${SEM_SIM} AND etapa NOT IN ('ganho','perdido','desqualificado') GROUP BY temperatura`),
      por_dia: todos(
        `SELECT date(criado_em / 1000, 'unixepoch', 'localtime') dia, COUNT(*) n FROM leads
         WHERE ${SEM_SIM} AND criado_em >= ? GROUP BY dia ORDER BY dia`,
        desde
      ),
      aguardando_humano: todos(
        `SELECT id, nome_whatsapp, telefone, dados, etapa, score, temperatura, resumo, destino, ultima_msg_lead_em, ultima_msg_humano_em
         FROM leads WHERE ${SEM_SIM} AND modo = 'humano' AND optout = 0
         AND etapa NOT IN ('ganho','perdido')
         AND (ultima_msg_humano_em IS NULL OR COALESCE(ultima_msg_lead_em, 0) > ultima_msg_humano_em)
         ORDER BY COALESCE(ultima_msg_lead_em, atualizado_em) ASC LIMIT 50`
      ).map(lerLinha),
      lacunas_abertas: um("SELECT COUNT(*) n FROM lacunas WHERE status = 'aberta'").n,
      uso_ia: todos(
        `SELECT modelo, SUM(entrada) entrada, SUM(saida) saida, SUM(cache_leitura) cache_leitura,
         SUM(cache_escrita) cache_escrita, COUNT(*) chamadas FROM uso_ia WHERE criado_em >= ? GROUP BY modelo`,
        desde
      ),
    };
  }
}
