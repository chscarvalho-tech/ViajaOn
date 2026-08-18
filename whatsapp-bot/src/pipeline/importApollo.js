// Lê um export CSV do Apollo (ICP 1 — B2B, canal LinkedIn). Os nomes de coluna variam
// conforme os campos escolhidos no export do Apollo, então o matching de cabeçalho é
// tolerante (case-insensitive, aceita alguns sinônimos). Ver content/apollo-template.csv
// para o formato de referência.
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

const HEADER_ALIASES = {
  firstName: ['first name', 'firstname'],
  lastName: ['last name', 'lastname'],
  company: ['company', 'company name', 'company name for emails', 'organization'],
  industry: ['industry', 'segmento', 'nicho'],
  linkedinUrl: ['person linkedin url', 'linkedin url', 'linkedin'],
  phone: ['phone number', 'corporate phone', 'mobile phone', 'phone', 'telefone'],
};

function findHeader(headers, aliases) {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

export async function importApolloCsv(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  if (records.length === 0) return [];

  const headers = Object.keys(records[0]);
  const col = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([key, aliases]) => [key, findHeader(headers, aliases)])
  );

  const contacts = [];
  for (const row of records) {
    const nome = [col.firstName && row[col.firstName], col.lastName && row[col.lastName]]
      .filter(Boolean)
      .join(' ')
      .trim();
    const linkedinUrl = col.linkedinUrl ? row[col.linkedinUrl]?.trim() : null;
    if (!linkedinUrl) continue; // sem perfil de LinkedIn não dá para automatizar o envio

    contacts.push({
      nome: nome || null,
      nomeMarca: col.company ? row[col.company]?.trim() : null,
      nicho: col.industry ? row[col.industry]?.trim() : null,
      linkedinUrl,
      telefone: col.phone ? row[col.phone]?.trim() || null : null,
      canal: 'linkedin',
      icp: 1,
      origem: 'apollo',
    });
  }
  return contacts;
}
