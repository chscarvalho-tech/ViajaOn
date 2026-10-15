import path from 'node:path';
import { Repo } from './db.js';
import { Config } from './config.js';
import { WaAkg } from './waakg.js';
import { Cerebro, calcularScore } from './cerebro.js';
import { Motor } from './motor.js';

// Preço por milhão de tokens (USD): [entrada, saída, leitura de cache]. Escrita de cache = 1,25 × entrada.
const PRECOS = {
  'claude-opus-5-5': [4, 20, 0.2],
  'claude-opus-5': [5, 25, 0.5],
  'claude-sonnet-5-5': [2, 10, 0.2],
  'claude-sonnet-5': [2, 10, 0.2],
  'claude-haiku-5-5': [0.1, 0.5, 0.01],
  'claude-fable-5-1': [10, 50, 0.25],
};

/** Monta as peças do bot (usado pelo servidor e pela CLI). */
export function criarApp({ raiz, publicUrl = '' }) {
  const repo = new Repo(path.join(raiz, 'data', 'sdr.db'));
  const config = new Config(raiz);
  const wa = new WaAkg({ url: process.env.WAAKG_URL, apiKey: process.env.WAAKG_API_KEY, sessao: process.env.WAAKG_SESSION });
  const cerebro = new Cerebro();
  const motor = new Motor({ repo, config, cerebro, wa, publicUrl });

  function custoEstimado(usos) {
    let total = 0;
    for (const u of usos) {
      const chave = Object.keys(PRECOS).find((k) => u.modelo === k || u.modelo?.startsWith(k + '-'));
      if (!chave) continue;
      const [ent, sai, cache] = PRECOS[chave];
      total += (u.entrada * ent + u.saida * sai + u.cache_leitura * cache + u.cache_escrita * ent * 1.25) / 1e6;
    }
    return Math.round(total * 10000) / 10000;
  }

  /** Conversa de teste: não passa pelo WhatsApp e não entra nas métricas. */
  async function simular(sessao, texto) {
    const jid = `sim:${sessao}`;
    let lead = repo.leadPorJid(jid) ?? repo.criarLead({ jid, telefone: '0000000000', nome_whatsapp: 'Teste' });
    const ultimoId = repo.mensagens(lead.id, 1).at(-1)?.id ?? 0;
    repo.inserirMensagem({ lead_id: lead.id, direcao: 'in', autor: 'lead', texto });
    repo.atualizarLead(lead.id, { ultima_msg_lead_em: Date.now(), followups_enviados: 0 });
    await motor.processar(lead.id);
    lead = repo.leadPorId(lead.id);
    const novas = repo.mensagens(lead.id, 50).filter((m) => m.id > ultimoId && m.direcao === 'out');
    const eventos = repo.eventos(lead.id, 10);
    return { lead, respostas: novas, eventos };
  }

  return { repo, config, wa, cerebro, motor, custoEstimado, simular, calcularScore };
}
