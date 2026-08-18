// Store local em JSON (via lowdb). Suficiente para o volume desta operação (dezenas a
// poucas centenas de contatos) e não exige nenhum compilador nativo nem credencial extra
// (ao contrário de SQLite nativo ou Google Sheets). dá pra trocar por Sheets/Postgres depois
// sem mudar quem chama este módulo — só reimplementar as funções exportadas abaixo.
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { paths, timezone } from '../config.js';

const defaultData = {
  contacts: [],
  messages: [],
  cadence: [],
  optOuts: [],
  botConversations: {},
  dailyCounts: {},
  meta: { firstSendAt: { linkedin: null, whatsapp: null } },
};

const adapter = new JSONFile(paths.dbFile);
const db = new Low(adapter, defaultData);

let loaded = false;
async function ready() {
  if (!loaded) {
    await db.read();
    db.data ||= structuredClone(defaultData);
    loaded = true;
  }
  return db;
}

function today() {
  return DateTime.now().setZone(timezone).toISODate();
}

// ---- contatos ----------------------------------------------------------

export async function addContacts(contacts) {
  await ready();
  const existingKeys = new Set(
    db.data.contacts.map((c) => c.dedupeKey)
  );
  let added = 0;
  let skipped = 0;
  for (const c of contacts) {
    const dedupeKey = makeDedupeKey(c);
    if (existingKeys.has(dedupeKey)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(dedupeKey);
    db.data.contacts.push({
      id: randomUUID(),
      dedupeKey,
      nome: c.nome || '',
      nomeMarca: c.nomeMarca || '',
      nicho: c.nicho || '',
      icp: c.icp ?? null,
      canal: c.canal, // 'linkedin' | 'whatsapp'
      telefone: c.telefone || null,
      linkedinUrl: c.linkedinUrl || null,
      lat: c.lat ?? null,
      lon: c.lon ?? null,
      origem: c.origem, // 'apollo' | 'google_my_maps'
      status: c.status || 'novo', // novo -> abordado -> respondeu | opt_out | erro | sem_telefone | sem_linkedin
      criadoEm: DateTime.now().toISO(),
    });
    added += 1;
  }
  await db.write();
  return { added, skipped };
}

function makeDedupeKey(c) {
  if (c.canal === 'linkedin' && c.linkedinUrl) return `li:${c.linkedinUrl.toLowerCase()}`;
  if (c.canal === 'whatsapp' && c.telefone) return `wa:${normalizePhone(c.telefone)}`;
  // Sem telefone/URL para diferenciar (comum em import de My Maps ainda não enriquecido):
  // usa nome + coordenadas, senão duas filiais com o mesmo nome de marca (ex.: "Clínica da
  // Cidade" em cidades diferentes) seriam tratadas como duplicata uma da outra.
  const nome = (c.nomeMarca || c.nome || '').toLowerCase().trim();
  if (c.lat != null && c.lon != null) return `nm:${nome}:${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
  return `nm:${nome}`;
}

export function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export async function listContacts({ canal, status, icp } = {}) {
  await ready();
  return db.data.contacts.filter((c) => {
    if (canal && c.canal !== canal) return false;
    if (status && c.status !== status) return false;
    if (icp !== undefined && c.icp !== icp) return false;
    return true;
  });
}

export async function updateContact(id, patch) {
  await ready();
  const c = db.data.contacts.find((x) => x.id === id);
  if (!c) return null;
  Object.assign(c, patch);
  await db.write();
  return c;
}

export async function findContactByPhone(phone) {
  await ready();
  const norm = normalizePhone(phone);
  return db.data.contacts.find((c) => c.telefone && normalizePhone(c.telefone) === norm) || null;
}

// ---- mensagens enviadas -------------------------------------------------

export async function logMessage({ contactId, script, canal, texto, status = 'enviado', erro = null }) {
  await ready();
  const entry = {
    id: randomUUID(),
    contactId,
    script,
    canal,
    texto,
    status,
    erro,
    enviadoEm: DateTime.now().toISO(),
  };
  db.data.messages.push(entry);
  await incrDailyCount(canal);
  await db.write();
  return entry;
}

export async function listMessages({ contactId } = {}) {
  await ready();
  return db.data.messages.filter((m) => (contactId ? m.contactId === contactId : true));
}

// ---- contadores diários / rampa de aquecimento --------------------------

export async function getDailyCount(canal, dateStr = today()) {
  await ready();
  return db.data.dailyCounts?.[canal]?.[dateStr] || 0;
}

async function incrDailyCount(canal, dateStr = today()) {
  db.data.dailyCounts[canal] ||= {};
  db.data.dailyCounts[canal][dateStr] = (db.data.dailyCounts[canal][dateStr] || 0) + 1;
}

export async function getFirstSendAt(canal) {
  await ready();
  return db.data.meta.firstSendAt[canal];
}

export async function recordFirstSendIfNeeded(canal) {
  await ready();
  if (!db.data.meta.firstSendAt[canal]) {
    db.data.meta.firstSendAt[canal] = DateTime.now().toISO();
    await db.write();
  }
}

// ---- opt-out --------------------------------------------------------------

export async function addOptOut({ contactId, telefone, motivo }) {
  await ready();
  db.data.optOuts.push({ contactId, telefone, motivo, quando: DateTime.now().toISO() });
  if (contactId) {
    const c = db.data.contacts.find((x) => x.id === contactId);
    if (c) c.status = 'opt_out';
  }
  await db.write();
}

export async function isOptedOut(phone) {
  await ready();
  const norm = normalizePhone(phone);
  return db.data.optOuts.some((o) => o.telefone && normalizePhone(o.telefone) === norm);
}

// ---- cadência de nutrição (D+1 / D+3 / D+10) -----------------------------

export async function scheduleCadence(contactId, steps) {
  // steps: [{ step: 'd1', dueAt: ISOString }, ...]
  await ready();
  for (const s of steps) {
    db.data.cadence.push({ contactId, step: s.step, dueAt: s.dueAt, done: false });
  }
  await db.write();
}

export async function dueCadenceSteps(nowIso = DateTime.now().toISO()) {
  await ready();
  return db.data.cadence.filter((c) => !c.done && c.dueAt <= nowIso);
}

export async function markCadenceDone(contactId, step) {
  await ready();
  const c = db.data.cadence.find((x) => x.contactId === contactId && x.step === step);
  if (c) c.done = true;
  await db.write();
}

// ---- conversas do bot de suporte ------------------------------------------

export async function getBotConversation(jid) {
  await ready();
  return db.data.botConversations[jid] || { history: [], escalated: false };
}

export async function saveBotConversation(jid, conv) {
  await ready();
  db.data.botConversations[jid] = conv;
  await db.write();
}

export default { ready };
