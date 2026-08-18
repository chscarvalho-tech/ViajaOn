// Carrega content/scripts.json e content/objections.json, escolhe uma variação de redação
// por envio (pra não mandar texto idêntico em massa) e substitui as variáveis {{CHAVE}}.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { paths } from '../config.js';

const scripts = JSON.parse(readFileSync(path.join(paths.contentDir, 'scripts.json'), 'utf8'));
const objections = JSON.parse(readFileSync(path.join(paths.contentDir, 'objections.json'), 'utf8'));

export function getScript(key) {
  const s = scripts[key];
  if (!s) throw new Error(`Script "${key}" não existe em content/scripts.json`);
  return s;
}

function substitute(template, vars) {
  return template.replace(/{{\s*([A-Z_]+)\s*}}/g, (_, key) => {
    const value = vars[key];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Variável {{${key}}} não foi preenchida para esta mensagem`);
    }
    return value;
  });
}

// Escolha pseudo-aleatória, mas estável por contato: o mesmo contato sempre cai na mesma
// variação (evita reenviar com texto diferente se o job rodar de novo), mas contatos
// diferentes tendem a pegar variações diferentes.
function pickVariationIndex(total, seed) {
  if (total <= 1) return 0;
  let hash = 0;
  for (const ch of String(seed)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % total;
}

export function renderMessage(scriptKey, vars, { seed } = {}) {
  const script = getScript(scriptKey);
  const idx = pickVariationIndex(script.variations.length, seed ?? scriptKey);
  const template = script.variations[idx];
  return { texto: substitute(template, vars), variationIndex: idx };
}

export function optOutKeywords() {
  return scripts.opt_out_keywords || [];
}

// Casa por palavra inteira (não substring): "ia" não deve bater dentro de "agência".
// Também ignora acento, pra "já tenho agência" bater com "ja tenho agencia" também.
// Uma keyword de várias palavras (ex. "já tenho agência") só conta se TODAS as palavras
// dela aparecerem na mensagem — não precisa ser a frase inteira e contígua, então
// "já tenho uma agência que faz isso" também bate com essa keyword.
function tokenize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu) || [];
}

export function findFaq(texto) {
  const words = new Set(tokenize(texto));
  let best = null;
  let bestScore = 0;
  for (const f of objections.faq) {
    for (const kw of f.keywords) {
      const kwWords = tokenize(kw);
      if (kwWords.length === 0) continue;
      const allPresent = kwWords.every((w) => words.has(w));
      if (allPresent && kwWords.length > bestScore) {
        best = f;
        bestScore = kwWords.length;
      }
    }
  }
  return best;
}

export function faqById(id) {
  return objections.faq.find((f) => f.id === id);
}

export function allFaq() {
  return objections.faq;
}

export function escalationMessage() {
  return objections.fora_de_escopo.mensagem_escalonamento;
}
