import fs from 'node:fs';
import path from 'node:path';

// Etapas que o código usa diretamente; o funil precisa tê-las.
export const ETAPAS_RESERVADAS = ['novo', 'encaminhado', 'desqualificado'];
const ID_VALIDO = /^[a-z][a-z0-9_]*$/;
const NOME_ARQUIVO = /^[\p{L}\p{N} _.-]+\.md$/u;

function lerJson(arquivo) {
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'));
}

function escreverJson(arquivo, obj) {
  fs.writeFileSync(arquivo, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function idsUnicos(lista, rotulo, erros) {
  const vistos = new Set();
  for (const item of lista) {
    if (!item || typeof item.id !== 'string' || !ID_VALIDO.test(item.id)) {
      erros.push(`${rotulo}: id inválido "${item?.id}" (use minúsculas, números e _)`);
    } else if (vistos.has(item.id)) {
      erros.push(`${rotulo}: id repetido "${item.id}"`);
    }
    vistos.add(item?.id);
  }
}

export function validarFunil(f) {
  const erros = [];
  for (const chave of ['etapas', 'campos', 'criterios']) {
    if (!Array.isArray(f?.[chave]) || !f[chave].length) erros.push(`"${chave}" precisa ser uma lista não vazia`);
  }
  if (erros.length) return erros;
  idsUnicos(f.etapas, 'etapas', erros);
  idsUnicos(f.campos, 'campos', erros);
  idsUnicos(f.criterios, 'criterios', erros);
  idsUnicos(f.destinos ?? [], 'destinos', erros);
  idsUnicos(f.materiais ?? [], 'materiais', erros);
  const ids = f.etapas.map((e) => e.id);
  for (const r of ETAPAS_RESERVADAS) if (!ids.includes(r)) erros.push(`etapas: a etapa "${r}" é obrigatória`);
  for (const e of f.etapas) {
    if (!e.nome) erros.push(`etapas: "${e.id}" sem nome`);
    if (!['ativa', 'humano', 'final'].includes(e.tipo)) erros.push(`etapas: "${e.id}" com tipo inválido (ativa | humano | final)`);
  }
  for (const c of f.criterios) {
    if (typeof c.peso !== 'number' || c.peso <= 0) erros.push(`criterios: "${c.id}" precisa de peso numérico > 0`);
  }
  const fx = f.faixas ?? {};
  if (typeof fx.quente !== 'number' || typeof fx.morno !== 'number' || fx.morno >= fx.quente) {
    erros.push('faixas: informe { "quente": n, "morno": n } com morno < quente');
  }
  for (const [i, fu] of (f.followups ?? []).entries()) {
    if (typeof fu.apos_horas !== 'number' || fu.apos_horas <= 0) erros.push(`followups[${i}]: apos_horas precisa ser > 0`);
    if (!fu.mensagem) erros.push(`followups[${i}]: mensagem vazia`);
    for (const e of fu.etapas ?? []) if (!ids.includes(e)) erros.push(`followups[${i}]: etapa desconhecida "${e}"`);
  }
  for (const m of f.materiais ?? []) {
    if (!['link', 'imagem', 'documento', 'video'].includes(m.tipo)) erros.push(`materiais: "${m.id}" com tipo inválido (link | imagem | documento | video)`);
  }
  return erros;
}

export function validarBot(b) {
  const erros = [];
  for (const k of ['nome_bot', 'empresa', 'modelo']) if (!b?.[k]) erros.push(`"${k}" é obrigatório`);
  if (b?.esforco && !['low', 'medium', 'high', 'xhigh', 'max'].includes(b.esforco)) erros.push('"esforco" deve ser low | medium | high | xhigh | max');
  if (b?.provedor_ia && !['anthropic', 'omniroute'].includes(b.provedor_ia)) erros.push('"provedor_ia" deve ser anthropic | omniroute');
  const h = b?.horario;
  if (h && (!/^\d{2}:\d{2}$/.test(h.inicio ?? '') || !/^\d{2}:\d{2}$/.test(h.fim ?? '') || !Array.isArray(h.dias))) {
    erros.push('"horario" precisa de { fuso, dias: [0-6], inicio: "HH:MM", fim: "HH:MM" }');
  }
  return erros;
}

/**
 * Lê a configuração do disco a cada uso, para que edições feitas no painel,
 * pelo Claude Code ou à mão valham na próxima mensagem sem reiniciar.
 */
export class Config {
  constructor(raiz) {
    this.raiz = raiz;
    this.arqBot = path.join(raiz, 'config', 'bot.json');
    this.arqFunil = path.join(raiz, 'config', 'funil.json');
    this.dirConhecimento = path.join(raiz, 'conhecimento');
    this._ultimoBot = null;
    this._ultimoFunil = null;
  }

  bot() {
    try { this._ultimoBot = lerJson(this.arqBot); } catch (e) {
      if (!this._ultimoBot) throw e;
      console.error('[config] bot.json inválido, usando a última versão boa:', e.message);
    }
    return this._ultimoBot;
  }

  funil() {
    try { this._ultimoFunil = lerJson(this.arqFunil); } catch (e) {
      if (!this._ultimoFunil) throw e;
      console.error('[config] funil.json inválido, usando a última versão boa:', e.message);
    }
    return this._ultimoFunil;
  }

  salvarBot(obj) {
    const erros = validarBot(obj);
    if (erros.length) return erros;
    escreverJson(this.arqBot, obj);
    return [];
  }

  salvarFunil(obj) {
    const erros = validarFunil(obj);
    if (erros.length) return erros;
    escreverJson(this.arqFunil, obj);
    return [];
  }

  conhecimento() {
    fs.mkdirSync(this.dirConhecimento, { recursive: true });
    return fs
      .readdirSync(this.dirConhecimento)
      .filter((n) => n.toLowerCase().endsWith('.md'))
      .sort((a, b) => a.localeCompare(b))
      .map((nome) => {
        const arq = path.join(this.dirConhecimento, nome);
        const st = fs.statSync(arq);
        return { nome, conteudo: fs.readFileSync(arq, 'utf8'), bytes: st.size, atualizado_em: st.mtimeMs };
      });
  }

  _caminhoSeguro(nome) {
    if (typeof nome !== 'string' || !NOME_ARQUIVO.test(nome) || nome !== path.basename(nome)) {
      throw new Error('Nome de arquivo inválido: use letras, números, espaço, _ - . e termine em .md');
    }
    return path.join(this.dirConhecimento, nome);
  }

  salvarConhecimento(nome, conteudo) {
    fs.mkdirSync(this.dirConhecimento, { recursive: true });
    fs.writeFileSync(this._caminhoSeguro(nome), String(conteudo ?? ''), 'utf8');
  }

  anexarConhecimento(nome, trecho) {
    fs.mkdirSync(this.dirConhecimento, { recursive: true });
    const arq = this._caminhoSeguro(nome);
    const cabecalho = fs.existsSync(arq) ? '' : '# Respostas do time\n\nPerguntas reais de leads, respondidas pelo time e incorporadas pelo painel.\n';
    fs.appendFileSync(arq, cabecalho + trecho, 'utf8');
  }

  apagarConhecimento(nome) {
    fs.rmSync(this._caminhoSeguro(nome), { force: true });
  }
}
