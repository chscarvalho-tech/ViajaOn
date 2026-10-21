import Anthropic from '@anthropic-ai/sdk';

export const ACOES = ['continuar', 'transferir', 'enviar_material', 'enviar_agendamento', 'desqualificar', 'optout'];

// Modelos que aceitam o fallback automático do servidor quando um classificador recusa a resposta.
const MODELOS_COM_FALLBACK = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

/** Etapas que o bot pode escolher sozinho (ganho/perdido e outras "manuais" são só do time). */
export function etapasDoBot(funil) {
  return funil.etapas.filter((e) => !e.manual).map((e) => e.id);
}

export function calcularScore(funil, criterios) {
  let total = 0;
  let obtido = 0;
  for (const c of funil.criterios) {
    total += c.peso;
    if (criterios?.[c.id] === true) obtido += c.peso;
  }
  const score = total ? Math.round((obtido / total) * 100) : 0;
  const fx = funil.faixas;
  const temperatura = score >= fx.quente ? 'quente' : score >= fx.morno ? 'morno' : 'frio';
  return { score, temperatura };
}

const texto = (description) => ({ type: 'string', description });
const enumeracao = (valores, description) => ({ type: 'string', enum: valores, ...(description ? { description } : {}) });
const objeto = (properties, description) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false, ...(description ? { description } : {}),
});

/**
 * JSON Schema da resposta, montado a partir do funil. Plano (sem nulos nem uniões) e com enums reais,
 * que a API garante na geração: string vazia = "não sei"; critérios = sim | nao | indefinido.
 */
export function montarSchema(funil) {
  const dados = Object.fromEntries(funil.campos.map((c) => [c.id, texto(`${c.rotulo}: ${c.descricao || ''} ("" se ainda não souber)`)]));
  const criterios = Object.fromEntries(funil.criterios.map((c) => [c.id, enumeracao(['sim', 'nao', 'indefinido'], c.descricao)]));
  return objeto({
    mensagens: { type: 'array', items: { type: 'string' }, description: 'Balões de WhatsApp a enviar agora, em ordem.' },
    etapa: enumeracao(etapasDoBot(funil), 'Etapa do funil em que o lead fica depois desta resposta.'),
    dados: objeto(dados, 'Dados do lead. Preencha só o que a conversa mostrou; "" para o que não sabe.'),
    criterios: objeto(criterios, 'sim = atende, nao = não atende, indefinido = ainda não dá para saber.'),
    acao: enumeracao(ACOES),
    destino_id: enumeracao(['nenhum', ...(funil.destinos ?? []).map((d) => d.id)], 'Para quem transferir quando acao = transferir.'),
    material_id: enumeracao(['nenhum', ...(funil.materiais ?? []).map((m) => m.id)], 'Material a enviar quando acao = enviar_material.'),
    motivo: texto('Uma frase, uso interno: por que essa etapa e essa ação.'),
    resumo: texto('Resumo do lead para o time comercial, 1 a 3 frases, atualizado.'),
    tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas curtas e reutilizáveis (ex.: produto de interesse, origem, objeção).' },
    sentimento: enumeracao(['positivo', 'neutro', 'negativo']),
    lacuna: texto('Pergunta do lead que a base de conhecimento não responde; "" se não houver.'),
  });
}

function lista(itens) {
  return itens.length ? itens.map((i) => `- ${i}`).join('\n') : '- (nenhum)';
}

/** Prompt de sistema. Só muda quando a configuração ou o conhecimento mudam, então fica em cache. */
export function montarSistema(bot, funil, conhecimento) {
  const etapas = funil.etapas.map((e) =>
    `- \`${e.id}\` — ${e.nome}${e.manual ? ' (só o time define; nunca escolha)' : ''}: ${e.objetivo || ''}`
  );
  const campos = funil.campos.map((c) => `- \`${c.id}\` (${c.rotulo}): ${c.descricao || ''}`);
  const criterios = funil.criterios.map((c) => `- \`${c.id}\` (peso ${c.peso}): ${c.descricao}`);
  const destinos = (funil.destinos ?? []).map((d) => `- \`${d.id}\` — ${d.nome}: ${d.quando || ''}`);
  const materiais = (funil.materiais ?? []).filter((m) => m.url).map((m) => `- \`${m.id}\` — ${m.nome}: enviar quando ${m.quando || 'fizer sentido'}`);
  const h = bot.horario;
  const horario = h ? `${h.inicio} às ${h.fim}, dias ${h.dias.map((d) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d]).join(', ')} (${h.fuso})` : 'não definido';

  const docs = conhecimento.length
    ? conhecimento.map((d) => `<documento nome="${d.nome}">\n${d.conteudo.trim()}\n</documento>`).join('\n\n')
    : '(A base de conhecimento ainda está vazia. Não afirme nada sobre produtos, preços ou condições; registre as perguntas como lacuna.)';

  return `Você é ${bot.nome_bot}, assistente virtual de atendimento da ${bot.empresa} no WhatsApp.
${bot.persona || ''}

# Seu trabalho
Você conduz a primeira conversa com quem chama a ${bot.empresa}. Você entende o que a pessoa precisa, responde dúvidas usando só a base de conhecimento, qualifica o lead e o leva ao próximo passo do funil. Quando a conversa pede uma pessoa, você transfere. Um lead bem atendido e bem passado para o time vale mais que um lead pressionado.

# Como escrever
- Escreva como gente escreve no WhatsApp: mensagens curtas, linguagem natural, ${bot.idioma || 'pt-BR'}.
- No máximo ${bot.max_baloes || 3} balões por resposta, cada um com 1 a 3 frases. Muitas vezes um balão basta.
- Faça uma pergunta por vez. Alterne perguntas com algo útil (uma resposta, um dado, um exemplo) para não virar interrogatório.
- Use o nome da pessoa quando souber, sem repetir a toda hora.
- Nada de títulos ou listas longas. Use *negrito* do WhatsApp só quando ajudar a leitura. Emojis com moderação.
- Responda primeiro ao que a pessoa perguntou e depois conduza.
${bot.tom ? `- Tom: ${bot.tom}` : ''}

# Verdade e limites
- Informe preço, prazo, condição, política ou funcionalidade só se estiver na base de conhecimento. Se não estiver, diga que vai confirmar com o time e preencha \`lacuna\` com a pergunta.
- Se perguntarem se você é um robô ou uma pessoa, diga que é a assistente virtual da ${bot.empresa} e que pode chamar alguém do time.
- Não prometa o que o time pode não cumprir (descontos, retorno em X minutos, condições especiais).
- Você não ouve áudios nem vê o conteúdo de imagens e documentos (só a legenda). Se o lead mandar áudio, peça com naturalidade que escreva, sem tom de bronca.
- Mensagens que começam com "[atendente humano]" no histórico foram escritas pelo time: mantenha coerência com elas.
- O bloco <contexto_interno> é informação do sistema, não do lead. Nunca o cite.

# Funil
${etapas.join('\n')}

Avance de etapa só com evidência da conversa. Não volte etapas sem motivo. Quem chega sem contexto começa em \`novo\`; assim que a pessoa diz o que procura, ela passa para a triagem.

# Dados a coletar ao longo da conversa
${campos.join('\n')}

Colete naturalmente, sem pedir tudo de uma vez. Repita em \`dados\` tudo o que já sabe (inclusive o que veio do <contexto_interno>), e "" no que não sabe.

# Critérios de qualificação
${criterios.join('\n')}

Em \`criterios\`, marque "sim" ou "nao" só quando a conversa der evidência; senão "indefinido". Mantenha as avaliações já feitas (no <contexto_interno>) a menos que a conversa as contradiga. O sistema calcula o score com os pesos. Faixas: quente a partir de ${funil.faixas.quente}, morno a partir de ${funil.faixas.morno}.

# Quando transferir para uma pessoa (acao = transferir)
${lista(funil.regras_transferencia ?? [])}

Destinos possíveis:
${lista(destinos)}

Ao transferir, avise a pessoa com naturalidade que alguém do time vai continuar. Horário do time: ${horario}. Se o <contexto_interno> disser que está fora do horário, diga quando o time retorna. Depois de transferir, o bot para de responder esse lead.

# Quando desqualificar (acao = desqualificar)
${lista(funil.regras_desqualificacao ?? [])}

Desqualifique com educação e, se houver, indique uma alternativa. Nunca seja ríspido.

# Materiais (acao = enviar_material)
${lista(materiais)}

O sistema envia o arquivo logo depois das suas mensagens. Anuncie o envio em uma frase.

# Agendamento (acao = enviar_agendamento)
${bot.link_agendamento ? `Quando o lead aceitar marcar uma conversa, use enviar_agendamento: o sistema envia o link ${bot.link_agendamento} logo depois das suas mensagens.` : 'Não há link de agendamento configurado. Para marcar conversa, transfira para o time.'}

# Saída de lista (acao = optout)
Se a pessoa pedir para não receber mais mensagens, confirme em uma frase curta e use optout.

# Formato
Responda sempre no JSON pedido. Em \`acao\`, use "continuar" quando nenhuma ação especial for necessária. \`destino_id\` e \`material_id\` ficam "nenhum" quando não se aplicam; \`lacuna\` fica "" quando não houver. O \`resumo\` é para o vendedor que vai pegar o lead: necessidade, momento, objeções e o que já foi combinado.

Responda rápido: o lead está esperando no WhatsApp.

# Base de conhecimento da ${bot.empresa}
${docs}`;
}

function rotuloHistorico(m) {
  if (m.autor === 'humano') return `[atendente humano] ${m.texto}`;
  if (m.autor === 'sistema') return `[sistema] ${m.texto}`;
  return m.texto;
}

/** Converte o histórico salvo em turnos alternados user/assistant e injeta o contexto no último turno do lead. */
export function montarMensagens(historico, contexto) {
  const turnos = [];
  for (const m of historico) {
    const role = m.direcao === 'in' ? 'user' : 'assistant';
    const texto = rotuloHistorico(m).trim() || '[mensagem sem texto]';
    const ultimo = turnos.at(-1);
    if (ultimo && ultimo.role === role) ultimo.content += `\n${texto}`;
    else turnos.push({ role, content: texto });
  }
  if (!turnos.length || turnos[0].role !== 'user') turnos.unshift({ role: 'user', content: '[início da conversa]' });
  if (turnos.at(-1).role !== 'user') turnos.push({ role: 'user', content: '[sem mensagem nova do lead]' });
  const ultimo = turnos.at(-1);
  ultimo.content = `<contexto_interno>\n${contexto}\n</contexto_interno>\n\n${ultimo.content}`;
  return turnos;
}

export function montarContexto({ lead, funil, bot, dentroHorario, agora = new Date() }) {
  const etapa = funil.etapas.find((e) => e.id === lead.etapa);
  const quando = new Intl.DateTimeFormat('pt-BR', {
    timeZone: bot.horario?.fuso || 'America/Sao_Paulo',
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(agora);
  return [
    `Agora: ${quando}. Time humano ${dentroHorario ? 'DISPONÍVEL (dentro do horário)' : 'FORA do horário'}.`,
    `Etapa atual: ${lead.etapa}${etapa ? ` (${etapa.nome})` : ''}`,
    `Nome no perfil do WhatsApp: ${lead.nome_whatsapp || '(não informado)'}`,
    `Dados já coletados: ${JSON.stringify(lead.dados || {})}`,
    `Critérios já avaliados: ${JSON.stringify(Object.fromEntries(Object.entries(lead.criterios || {}).map(([k, v]) => [k, v ? 'sim' : 'nao'])))}`,
    `Score atual: ${lead.score} (${lead.temperatura})`,
    lead.notas ? `Notas do time sobre este lead: ${lead.notas}` : null,
  ].filter(Boolean).join('\n');
}

export class Cerebro {
  // Criado no primeiro uso, para o servidor subir mesmo antes de a chave ser configurada.
  // Credenciais: ANTHROPIC_API_KEY (ou outra fonte suportada pelo SDK).
  get client() {
    this._client ??= new Anthropic({ maxRetries: 3 });
    return this._client;
  }

  /**
   * @returns {{ saida?: object, recusa?: boolean, usage: object, modelo: string }}
   */
  async pensar(args) {
    return (args.bot.provedor_ia || 'anthropic') === 'omniroute' ? this.pensarOmniRoute(args) : this.pensarAnthropic(args);
  }

  /**
   * OmniRoute: gateway próprio, compatível com a API da OpenAI, que distribui entre provedores
   * (inclusive gratuitos). Sem schema garantido pela API: o formato vai descrito no prompt,
   * a resposta é pedida em json_object e normalizada.
   */
  async pensarOmniRoute({ bot, funil, conhecimento, historico, contexto }) {
    const base = (process.env.OMNIROUTE_URL || 'http://localhost:20128/v1').replace(/\/+$/, '');
    const chave = process.env.OMNIROUTE_API_KEY;
    // "modelo" pode ser uma lista em ordem de preferência: tenta cada um até um responder.
    const modelos = [].concat(bot.modelo || 'auto').filter(Boolean);
    const mensagens = [
      { role: 'system', content: `${montarSistema(bot, funil, conhecimento)}\n\n${descreverFormato(funil)}` },
      ...montarMensagens(historico, contexto),
    ];
    const erros = [];
    for (const modelo of modelos) {
      const corpo = { model: modelo, stream: false, temperature: 0.4, response_format: { type: 'json_object' }, messages: mensagens };
      try {
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(chave ? { Authorization: `Bearer ${chave}` } : {}) },
          body: JSON.stringify(corpo),
          signal: AbortSignal.timeout(45000),
        });
        const texto = await res.text();
        if (!res.ok) throw new Error(`OmniRoute ${res.status}: ${texto.slice(0, 300)}`);
        const payload = JSON.parse(texto);
        const conteudo = payload?.choices?.[0]?.message?.content ?? '';
        const saida = extrairJson(conteudo);
        if (!saida || !Array.isArray(saida.mensagens)) throw new Error(`OmniRoute respondeu sem o JSON esperado: ${conteudo.slice(0, 200)}`);
        const u = payload.usage || {};
        return {
          saida: normalizarSaida(saida, funil),
          usage: { input_tokens: u.prompt_tokens ?? 0, output_tokens: u.completion_tokens ?? 0 },
          modelo: `omniroute:${payload.model || corpo.model}`,
        };
      } catch (e) {
        erros.push(`${modelo}: ${String(e.message).slice(0, 160)}`);
      }
    }
    throw new Error(`Nenhum modelo do OmniRoute respondeu. ${erros.join(' | ')}`);
  }

  async pensarAnthropic({ bot, funil, conhecimento, historico, contexto }) {
    const params = {
      model: bot.modelo,
      max_tokens: 16000,
      output_config: { effort: bot.esforco || 'low', format: { type: 'json_schema', schema: montarSchema(funil) } },
      system: [{ type: 'text', text: montarSistema(bot, funil, conhecimento), cache_control: { type: 'ephemeral' } }],
      messages: montarMensagens(historico, contexto),
    };
    if (bot.fallback_recusa !== false && MODELOS_COM_FALLBACK.includes(bot.modelo)) {
      params.betas = ['server-side-fallback-2026-07-01'];
      params.fallbacks = 'default';
    }
    const resp = await this.client.beta.messages.create(params);
    if (resp.stop_reason === 'refusal') {
      return { recusa: true, categoria: resp.stop_details?.category ?? null, usage: resp.usage, modelo: resp.model };
    }
    const bruto = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let saida;
    try { saida = JSON.parse(bruto); } catch {
      throw new Error(`Resposta sem JSON válido (stop_reason=${resp.stop_reason}): ${bruto.slice(0, 200)}`);
    }
    return { saida: normalizarSaida(saida, funil), usage: resp.usage, modelo: resp.model };
  }
}

/** Diz se a IA configurada em bot.json está pronta: { provedor, ok, detalhe }. */
export async function statusIA(bot) {
  const provedor = bot.provedor_ia || 'anthropic';
  if (provedor !== 'omniroute') {
    return { provedor, ok: Boolean(process.env.ANTHROPIC_API_KEY), detalhe: process.env.ANTHROPIC_API_KEY ? bot.modelo : 'ANTHROPIC_API_KEY vazio no .env' };
  }
  const base = (process.env.OMNIROUTE_URL || 'http://localhost:20128/v1').replace(/\/+$/, '');
  const chave = process.env.OMNIROUTE_API_KEY;
  try {
    const res = await fetch(`${base}/models`, { headers: chave ? { Authorization: `Bearer ${chave}` } : {}, signal: AbortSignal.timeout(4000) });
    if (res.status === 401 || res.status === 403) return { provedor, ok: false, detalhe: `OmniRoute recusou a chave (${res.status}): confira OMNIROUTE_API_KEY` };
    if (!res.ok) return { provedor, ok: false, detalhe: `OmniRoute respondeu ${res.status} em ${base}` };
    return { provedor, ok: true, detalhe: `${base} · modelo ${[].concat(bot.modelo || 'auto').join(' → ')}` };
  } catch {
    return { provedor, ok: false, detalhe: `OmniRoute fora do ar em ${base} (inicie com: omniroute serve --no-open)` };
  }
}

/** Instrução de formato para provedores sem schema garantido (OmniRoute). */
export function descreverFormato(funil) {
  const destinos = ['nenhum', ...(funil.destinos ?? []).map((d) => d.id)];
  const materiais = ['nenhum', ...(funil.materiais ?? []).map((m) => m.id)];
  const exemplo = {
    mensagens: ['balão 1', 'balão 2 (opcional)'],
    etapa: etapasDoBot(funil)[0],
    dados: Object.fromEntries(funil.campos.map((c) => [c.id, ''])),
    criterios: Object.fromEntries(funil.criterios.map((c) => [c.id, 'indefinido'])),
    acao: 'continuar',
    destino_id: 'nenhum',
    material_id: 'nenhum',
    motivo: '',
    resumo: '',
    tags: [],
    sentimento: 'neutro',
    lacuna: '',
  };
  return `# Formato obrigatório da resposta
Responda APENAS com um objeto JSON válido, sem texto antes ou depois e sem bloco de código, com exatamente estas chaves:
${JSON.stringify(exemplo, null, 2)}

Valores permitidos:
- etapa: ${etapasDoBot(funil).join(' | ')}
- acao: ${ACOES.join(' | ')}
- destino_id: ${destinos.join(' | ')}
- material_id: ${materiais.join(' | ')}
- criterios.*: sim | nao | indefinido
- sentimento: positivo | neutro | negativo
- dados.*: texto ("" se não souber)`;
}

/** Extrai o primeiro objeto JSON de um texto (tolera bloco de código ou texto em volta). */
export function extrairJson(texto) {
  const limpo = String(texto ?? '').replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(limpo); } catch { /* tenta recortar */ }
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini === -1 || fim <= ini) return null;
  try { return JSON.parse(limpo.slice(ini, fim + 1)); } catch { return null; }
}

/** Garante a forma esperada mesmo se algo vier fora do schema (defesa extra; a API já restringe). */
export function normalizarSaida(s, funil) {
  const um = (v, validos, padrao) => (validos.includes(v) ? v : padrao);
  const str = (v) => (typeof v === 'string' ? v : '');
  return {
    mensagens: Array.isArray(s?.mensagens) ? s.mensagens.filter((m) => typeof m === 'string') : [],
    etapa: um(s?.etapa, etapasDoBot(funil), null),
    dados: Object.fromEntries(funil.campos.map((c) => [c.id, str(s?.dados?.[c.id])])),
    criterios: Object.fromEntries(funil.criterios.map((c) => [c.id, um(s?.criterios?.[c.id], ['sim', 'nao', 'indefinido'], 'indefinido')])),
    acao: um(s?.acao, ACOES, 'continuar'),
    destino_id: um(s?.destino_id, (funil.destinos ?? []).map((d) => d.id), 'nenhum'),
    material_id: um(s?.material_id, (funil.materiais ?? []).map((m) => m.id), 'nenhum'),
    motivo: str(s?.motivo),
    resumo: str(s?.resumo),
    tags: Array.isArray(s?.tags) ? s.tags.filter((t) => typeof t === 'string') : [],
    sentimento: um(s?.sentimento, ['positivo', 'neutro', 'negativo'], 'neutro'),
    lacuna: str(s?.lacuna),
  };
}
