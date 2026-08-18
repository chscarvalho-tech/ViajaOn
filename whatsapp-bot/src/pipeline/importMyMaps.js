// Lê a lista do Google My Maps — pastas/camadas do mapa viram o campo "nicho" usado nos
// scripts de abordagem ("negócios de {{NICHO}} na região"). A ViajaOn ainda não definiu um
// critério de classificação por ICP a partir da pasta (ao contrário da Xamã, que separava
// B2B/BPO de clínica/estética) — por padrão, pasta vira nicho e icp fica null. Se um dia
// fizer sentido segmentar (ex.: "dono de negócio" vs. "profissional liberal"), ajustar
// classify() abaixo por pasta/camada do mapa.
// Canal é sempre WhatsApp aqui, seguindo o script "My Maps" ("Encontrei a [MARCA] pelo Google").
//
// Aceita dois formatos:
//   .csv  — formato de semente (nome,pasta,lon,lat,telefone), útil pra testar o pipeline
//           antes de ter um export real.
//   .kml  — export real do My Maps (Menu do mapa > Baixar KML). O KML do My Maps normalmente
//           só traz nome e coordenadas — SEM telefone. Contatos sem telefone entram com
//           status "sem_telefone" e ficam de fora da fila de envio até serem enriquecidos.
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { XMLParser } from 'fast-xml-parser';

function classify(pasta = '') {
  return { icp: null, nicho: pasta || null };
}

function toArray(x) {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function textOf(node) {
  if (node === undefined || node === null) return null;
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'object' && '#text' in node) return String(node['#text']).trim();
  return null;
}

// Tenta achar um telefone dentro da descrição do placemark, quando o My Maps importou
// colunas extras de uma planilha (a descrição vem como uma tabela HTML em CDATA).
function extractPhoneFromDescription(desc) {
  if (!desc) return null;
  const match = desc.match(/(\+?55\s*)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/);
  return match ? match[0].trim() : null;
}

async function importFromCsv(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  return records.map((row) => {
    const { icp, nicho } = classify(row.pasta);
    return {
      nomeMarca: row.nome?.trim() || null,
      nicho,
      icp,
      telefone: row.telefone?.trim() || null,
      lat: row.lat ? Number(row.lat) : null,
      lon: row.lon ? Number(row.lon) : null,
      canal: 'whatsapp',
      origem: 'google_my_maps',
    };
  });
}

async function importFromKml(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: '__cdata' });
  const doc = parser.parse(raw);
  const kmlDoc = doc?.kml?.Document;
  if (!kmlDoc) return [];

  const contacts = [];
  const folders = toArray(kmlDoc.Folder);
  const collectFromPlacemarks = (placemarks, pasta) => {
    for (const pm of toArray(placemarks)) {
      const nome = textOf(pm.name);
      if (!nome) continue;
      const desc = textOf(pm.description) || pm.description?.__cdata || null;
      const { icp, nicho } = classify(pasta);
      const coordsStr = textOf(pm.Point?.coordinates);
      const [lon, lat] = coordsStr ? coordsStr.split(',').map(Number) : [null, null];
      contacts.push({
        nomeMarca: nome,
        nicho,
        icp,
        telefone: extractPhoneFromDescription(desc),
        lat: lat ?? null,
        lon: lon ?? null,
        canal: 'whatsapp',
        origem: 'google_my_maps',
      });
    }
  };

  if (folders.length > 0) {
    for (const folder of folders) {
      collectFromPlacemarks(folder.Placemark, textOf(folder.name));
    }
  } else {
    collectFromPlacemarks(kmlDoc.Placemark, null);
  }
  return contacts;
}

export async function importMyMaps(filePath) {
  const contacts = filePath.toLowerCase().endsWith('.kml')
    ? await importFromKml(filePath)
    : await importFromCsv(filePath);

  return contacts.map((c) => ({
    ...c,
    status: c.telefone ? 'novo' : 'sem_telefone',
  }));
}
