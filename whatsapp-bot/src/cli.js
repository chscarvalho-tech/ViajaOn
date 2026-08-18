#!/usr/bin/env node
import { runImport } from './pipeline/run.js';
import { linkedinLogin, linkedinSend } from './linkedin/run.js';
import { whatsappLogin, whatsappSend, whatsappCadence, whatsappBot } from './whatsapp/run.js';
import { whatsappWebLogin, whatsappWebRun } from './whatsapp-web/run.js';
import { listContacts, listMessages } from './store/db.js';

const [, , command] = process.argv;
const dryRun = process.argv.includes('--dry-run');
const phoneArg = process.argv.find((a) => a.startsWith('--phone='));
const phoneNumber = phoneArg ? phoneArg.slice('--phone='.length) : undefined;

async function statusReport() {
  const all = await listContacts({});
  const byStatus = {};
  const byCanal = {};
  for (const c of all) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byCanal[c.canal] = (byCanal[c.canal] || 0) + 1;
  }
  const messages = await listMessages({});

  console.log(`Contatos: ${all.length}`);
  console.log('Por canal:', byCanal);
  console.log('Por status:', byStatus);
  console.log(`Mensagens registradas: ${messages.length}`);
  if (byStatus.sem_telefone) {
    console.log(`\n${byStatus.sem_telefone} contato(s) do My Maps sem telefone — não entram em nenhuma fila até serem enriquecidos.`);
  }
  if (byStatus.revisar_manual) {
    console.log(`${byStatus.revisar_manual} contato(s) marcados para revisão manual no LinkedIn (perfil fora do padrão esperado).`);
  }
}

const commands = {
  import: runImport,
  status: statusReport,
  'linkedin:login': linkedinLogin,
  'linkedin:send': () => linkedinSend({ dryRun }),
  'whatsapp:login': () => whatsappLogin({ phoneNumber }), // legado (Baileys) — ver whatsapp-web:login
  'whatsapp:send': () => whatsappSend({ dryRun }),
  'whatsapp:cadence': () => whatsappCadence({ dryRun }),
  'whatsapp:bot': whatsappBot,
  'whatsapp-web:login': whatsappWebLogin,
  'whatsapp-web:run': () => whatsappWebRun({ dryRun }),
};

const fn = commands[command];
if (!fn) {
  console.log('Uso: node src/cli.js <comando> [--dry-run]\n');
  console.log('Comandos disponíveis:');
  for (const name of Object.keys(commands)) console.log(`  ${name}`);
  process.exit(1);
}

fn().catch((err) => {
  console.error(err);
  process.exit(1);
});
