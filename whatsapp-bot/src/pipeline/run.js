// Varre data/contacts/ e importa qualquer export do Apollo ou do Google My Maps encontrado.
// Convenção de nome de arquivo (não precisa ser exato, só conter a palavra):
//   *apollo*.csv        -> importApolloCsv (ICP 1, LinkedIn)
//   *my-maps*.csv|.kml  -> importMyMaps (ICP 1 ou 2, WhatsApp)
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { paths } from '../config.js';
import { importApolloCsv } from './importApollo.js';
import { importMyMaps } from './importMyMaps.js';
import { addContacts, listContacts } from '../store/db.js';

export async function runImport() {
  const files = await readdir(paths.contactsDir).catch(() => []);
  if (files.length === 0) {
    console.log(`Nenhum arquivo em ${paths.contactsDir}. Coloque o export do Apollo (CSV) e/ou do Google My Maps (CSV ou KML) lá e rode de novo.`);
    return;
  }

  let totalAdded = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const full = path.join(paths.contactsDir, file);
    const lower = file.toLowerCase();
    let contacts = null;

    if (lower.endsWith('.kml')) {
      contacts = await importMyMaps(full);
    } else if (lower.endsWith('.csv') && lower.includes('apollo')) {
      contacts = await importApolloCsv(full);
    } else if (lower.endsWith('.csv') && (lower.includes('my-maps') || lower.includes('maps'))) {
      contacts = await importMyMaps(full);
    } else if (lower.endsWith('.csv')) {
      console.log(`Pulando ${file}: não deu para saber se é export do Apollo ou do My Maps. Renomeie incluindo "apollo" ou "my-maps" no nome do arquivo.`);
      continue;
    } else {
      continue;
    }

    const { added, skipped } = await addContacts(contacts);
    totalAdded += added;
    totalSkipped += skipped;
    console.log(`${file}: ${contacts.length} lidos, ${added} novos, ${skipped} duplicados/ignorados.`);
  }

  const semTelefone = (await listContacts({ status: 'sem_telefone' })).length;
  console.log(`\nTotal importado: ${totalAdded} novos contatos (${totalSkipped} duplicados).`);
  if (semTelefone > 0) {
    console.log(`Atenção: ${semTelefone} contatos do My Maps estão sem telefone e não entram na fila de WhatsApp até serem enriquecidos.`);
  }
}
