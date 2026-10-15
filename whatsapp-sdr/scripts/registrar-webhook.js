// Registra este servidor como webhook da sessão no WA-AKG.
// Uso: npm run registrar-webhook
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WaAkg } from '../lib/waakg.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(raiz, '.env')); } catch { /* usa o ambiente */ }

const wa = new WaAkg({ url: process.env.WAAKG_URL, apiKey: process.env.WAAKG_API_KEY, sessao: process.env.WAAKG_SESSION });
const publicUrl = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3100}`).replace(/\/+$/, '');
const alvo = `${publicUrl}/webhook`;

if (!wa.configurado) {
  console.error('Preencha WAAKG_URL, WAAKG_API_KEY e WAAKG_SESSION no .env.');
  process.exit(1);
}

try {
  const s = await wa.status();
  console.log(`Sessão "${wa.sessao}": ${s?.data?.status ?? JSON.stringify(s).slice(0, 120)}`);
} catch (e) {
  console.error(`Não consegui consultar a sessão: ${e.message}`);
  process.exit(1);
}

try {
  const lista = await wa.listarWebhooks();
  const itens = Array.isArray(lista?.data) ? lista.data : Array.isArray(lista) ? lista : [];
  if (itens.some((w) => w.url === alvo)) {
    console.log(`Webhook já registrado para ${alvo}. Nada a fazer.`);
    process.exit(0);
  }
} catch { /* se não der para listar, tenta registrar mesmo assim */ }

const r = await wa.registrarWebhook({ url: alvo, secret: process.env.WEBHOOK_SECRET || undefined });
console.log(`Webhook registrado: ${alvo}`);
console.log(JSON.stringify(r?.data ?? r, null, 2).slice(0, 600));
