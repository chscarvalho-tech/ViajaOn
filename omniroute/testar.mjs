// Confere se o OmniRoute está no ar e quais modelos da lista do bot respondem.
// Uso (na pasta do bot): node omniroute/testar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(raiz, '.env')); } catch { /* usa o ambiente */ }

const base = (process.env.OMNIROUTE_URL || 'http://localhost:20128/v1').replace(/\/+$/, '');
const chave = process.env.OMNIROUTE_API_KEY;
const headers = { 'Content-Type': 'application/json', ...(chave ? { Authorization: `Bearer ${chave}` } : {}) };
const bot = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'bot.json'), 'utf8'));
const modelos = [].concat(bot.modelo || 'auto');

console.log(`OmniRoute: ${base}`);
try {
  const r = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(5000) });
  if (r.status === 401 || r.status === 403) {
    console.log(`✗ O OmniRoute recusou a chave (${r.status}). Confira OMNIROUTE_API_KEY no .env (Dashboard → Endpoints).`);
    process.exit(1);
  }
  const j = await r.json();
  const prefixos = [...new Set((j.data || []).map((m) => String(m.id).split('/')[0]))];
  console.log(`✓ No ar, ${(j.data || []).length} modelos. Provedores: ${prefixos.join(', ')}`);
} catch {
  console.log('✗ OmniRoute fora do ar. Inicie com: omniroute serve --no-open (a partir da sua pasta de usuário, não da pasta do bot).');
  process.exit(1);
}

let algum = false;
for (const modelo of modelos) {
  const ini = Date.now();
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: modelo,
        stream: false,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Responda APENAS JSON.' },
          { role: 'user', content: 'Retorne {"ok": true, "capital_da_franca": "..."}' },
        ],
      }),
    });
    const t = ((Date.now() - ini) / 1000).toFixed(1);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) console.log(`✗ ${modelo} (${t}s): ${String(j.error?.message || r.status).slice(0, 140)}`);
    else { console.log(`✓ ${modelo} (${t}s) → atendido por ${j.model}: ${String(j.choices?.[0]?.message?.content).replace(/\s+/g, ' ').slice(0, 60)}`); algum = true; }
  } catch (e) {
    console.log(`✗ ${modelo}: ${e.message}`);
  }
}
console.log(algum
  ? '\nPronto: o bot vai usar o primeiro modelo da lista que responder.'
  : '\nNenhum modelo respondeu. Conecte uma conta gratuita do Gemini no OmniRoute (veja omniroute/README.md).');
process.exit(algum ? 0 : 1);
