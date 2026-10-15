import { calcularScore, montarContexto } from './cerebro.js';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const soDigitos = (s) => String(s ?? '').replace(/\D/g, '');
export const ehSimulacao = (jid) => String(jid).startsWith('sim:');

const DIAS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function dentroDoHorario(horario, agora = new Date()) {
  if (!horario) return true;
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: horario.fuso || 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(agora).map((p) => [p.type, p.value])
  );
  const hhmm = `${partes.hour}:${partes.minute}`;
  return horario.dias.includes(DIAS[partes.weekday]) && hhmm >= horario.inicio && hhmm < horario.fim;
}

/** Preenche {campo} ou {campo|alternativa} com dados do lead. */
export function preencher(modelo, valores) {
  return String(modelo)
    .replace(/\{(\w+)(?:\|([^}]*))?\}/g, (_, k, alt) => (valores[k] ? String(valores[k]) : alt ?? ''))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([!?.,])/g, '$1')
    .trim();
}

export function primeiroNome(lead) {
  return (lead.dados?.nome || lead.nome_whatsapp || '').trim().split(/\s+/)[0] || '';
}

/** Texto que representa o conteúdo de um evento de mensagem do WA-AKG. */
export function descreverConteudo(d) {
  const texto = (d.content || '').trim();
  const legenda = (d.caption || '').trim();
  switch (d.type) {
    case 'TEXT': return texto;
    case 'IMAGE': return `[imagem]${legenda ? ' ' + legenda : ''}`;
    case 'VIDEO': return `[vídeo]${legenda ? ' ' + legenda : ''}`;
    case 'AUDIO': return '[áudio — o lead enviou uma mensagem de voz que não pode ser ouvida aqui]';
    case 'DOCUMENT': return `[documento: ${texto || 'arquivo'}]${legenda ? ' ' + legenda : ''}`;
    case 'STICKER': return '[figurinha]';
    case 'LOCATION': return `[localização: ${texto}]`;
    case 'CONTACT': return `[contato compartilhado: ${texto}]`;
    default: return texto || `[${String(d.type || 'mensagem').toLowerCase()}]`;
  }
}

export class Motor {
  constructor({ repo, config, cerebro, wa, publicUrl = '', log = console }) {
    Object.assign(this, { repo, config, cerebro, wa, publicUrl, log });
    this.timers = new Map();
    this.ocupados = new Set();
    this.repetir = new Set();
    this.idsEnviados = new Set();
    this.pendentes = []; // { jid, texto, ate } — envios nossos aguardando o eco "message.sent"
  }

  // ---------------- entrada ----------------

  async receberWebhook(payload) {
    const { event, data } = payload || {};
    if (!data) return;
    if (event === 'message.received') return this.mensagemRecebida(data);
    if (event === 'message.sent') return this.mensagemEnviada(data);
  }

  mensagemRecebida(d) {
    const bot = this.config.bot();
    if (d.key?.fromMe) return;
    if (d.isGroup || (d.chatType && d.chatType !== 'PERSONAL')) return;
    const jid = d.from || d.key?.remoteJid;
    if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') return;
    const telefone = soDigitos(jid.split('@')[0].split(':')[0]);
    if ((bot.numeros_ignorados ?? []).some((n) => soDigitos(n) && telefone.endsWith(soDigitos(n)))) return;
    // Números dos destinos (time) não viram leads.
    if ((this.config.funil().destinos ?? []).some((x) => soDigitos(x.whatsapp) && telefone.endsWith(soDigitos(x.whatsapp)))) return;

    let lead = this.repo.leadPorJid(jid);
    if (!lead) {
      lead = this.repo.criarLead({ jid, telefone, nome_whatsapp: d.pushName });
      this.repo.evento(lead.id, 'lead_criado', { origem: 'whatsapp' });
    }
    const id = this.repo.inserirMensagem({
      lead_id: lead.id, direcao: 'in', autor: 'lead', tipo: d.type || 'TEXT',
      texto: descreverConteudo(d), wa_id: d.key?.id ?? null,
    });
    if (!id) return; // reentrega do mesmo webhook
    this.repo.atualizarLead(lead.id, {
      ultima_msg_lead_em: Date.now(),
      followups_enviados: 0,
      nome_whatsapp: d.pushName || lead.nome_whatsapp,
    });
    this.agendar(lead.id, (bot.aguardar_segundos ?? 8) * 1000);
  }

  async mensagemEnviada(d) {
    const jid = d.key?.remoteJid || d.from;
    const waId = d.key?.id ?? null;
    if (!jid || jid.endsWith('@g.us') || ehSimulacao(jid)) return;
    const texto = descreverConteudo(d);
    if (this._ehNosso(jid, waId, texto)) return;
    // O eco pode chegar antes de a API devolver o id do envio: espera um pouco e confere de novo.
    await dormir(4000);
    if (this._ehNosso(jid, waId, texto)) return;

    const lead = this.repo.leadPorJid(jid);
    if (!lead) return; // conversa que não é de lead (pessoal, time etc.)
    const id = this.repo.inserirMensagem({ lead_id: lead.id, direcao: 'out', autor: 'humano', tipo: d.type || 'TEXT', texto, wa_id: waId });
    if (!id) return;
    this._humanoAssumiu(lead, 'whatsapp');
  }

  _humanoAssumiu(lead, via) {
    const bot = this.config.bot();
    const patch = { ultima_msg_humano_em: Date.now() };
    if (lead.modo === 'bot') {
      patch.modo = 'humano';
      const horas = Number(bot.pausa_humano_horas ?? 12);
      patch.pausado_ate = horas > 0 ? Date.now() + horas * 3600e3 : null;
      this.repo.evento(lead.id, 'humano_assumiu', { via, retoma_em: patch.pausado_ate });
    }
    this.repo.atualizarLead(lead.id, patch);
  }

  _ehNosso(jid, waId, texto) {
    if (waId && this.idsEnviados.has(waId)) return true;
    const agora = Date.now();
    this.pendentes = this.pendentes.filter((p) => p.ate > agora);
    const achou = this.pendentes.find((p) => p.jid === jid && p.texto.trim() === texto.trim());
    if (achou && waId) this.idsEnviados.add(waId);
    return Boolean(achou);
  }

  // ---------------- processamento ----------------

  agendar(leadId, ms) {
    clearTimeout(this.timers.get(leadId));
    this.timers.set(leadId, setTimeout(() => {
      this.timers.delete(leadId);
      this.processar(leadId).catch((e) => this.log.error('[motor] erro ao processar lead', leadId, e));
    }, ms));
  }

  async processar(leadId) {
    if (this.ocupados.has(leadId)) { this.repetir.add(leadId); return; }
    this.ocupados.add(leadId);
    try {
      await this._processar(leadId);
    } finally {
      this.ocupados.delete(leadId);
      if (this.repetir.delete(leadId)) this.agendar(leadId, 300);
    }
  }

  async _processar(leadId) {
    const lead = this.repo.leadPorId(leadId);
    if (!lead) return;
    const bot = this.config.bot();
    const funil = this.config.funil();
    const novas = this.repo.mensagensDoLeadApos(lead.id, lead.ultimo_in_respondido);
    if (!novas.length) return;
    const marcar = (extra = {}) => this.repo.atualizarLead(lead.id, { ultimo_in_respondido: novas.at(-1).id, ...extra });
    const sim = ehSimulacao(lead.jid);

    if (lead.optout) return marcar();
    if (!bot.ativo && !sim) return marcar();
    if (lead.modo === 'humano') {
      if (lead.pausado_ate && Date.now() > lead.pausado_ate) {
        this.repo.evento(lead.id, 'bot_retomou', { motivo: 'fim da pausa após resposta humana' });
        Object.assign(lead, this.repo.atualizarLead(lead.id, { modo: 'bot', pausado_ate: null }));
      } else return marcar();
    }
    if (['ganho', 'perdido'].includes(lead.etapa)) return marcar();

    const textoNovo = novas.map((m) => m.texto).join(' ').trim().toLowerCase();
    if ((bot.palavras_optout ?? []).some((p) => textoNovo === String(p).toLowerCase())) {
      marcar({ optout: 1 });
      this.repo.evento(lead.id, 'optout', { via: 'palavra-chave' });
      if (bot.mensagem_optout) await this.enviarSequencia(lead, [bot.mensagem_optout], 'bot');
      return;
    }

    const historico = this.repo.mensagens(lead.id, bot.historico_max_mensagens || 40);
    const contexto = montarContexto({ lead, funil, bot, dentroHorario: dentroDoHorario(bot.horario) });
    let r;
    try {
      r = await this.cerebro.pensar({ bot, funil, conhecimento: this.config.conhecimento(), historico, contexto });
    } catch (e) {
      this.log.error('[motor] falha na IA', e);
      this.repo.evento(lead.id, 'erro_ia', { erro: String(e.message || e).slice(0, 500) });
      marcar();
      return this._falhaParaHumano(lead, bot, 'erro na IA');
    }
    this.repo.registrarUso(lead.id, r.modelo, r.usage);
    marcar();
    if (r.recusa) {
      this.repo.evento(lead.id, 'recusa_ia', { categoria: r.categoria });
      return this._falhaParaHumano(lead, bot, 'resposta recusada pela IA');
    }
    await this.aplicar(lead, r.saida, { bot, funil });
  }

  async _falhaParaHumano(lead, bot, motivo) {
    if (bot.mensagem_erro) await this.enviarSequencia(lead, [bot.mensagem_erro], 'bot');
    this.repo.atualizarLead(lead.id, { modo: 'humano', pausado_ate: null });
    this.repo.evento(lead.id, 'transferido', { destino: null, motivo });
  }

  async aplicar(lead, s, { bot, funil }) {
    const dados = { ...lead.dados };
    for (const [k, v] of Object.entries(s.dados || {})) if (typeof v === 'string' && v.trim()) dados[k] = v.trim();
    const criterios = { ...lead.criterios };
    for (const [k, v] of Object.entries(s.criterios || {})) {
      if (v === 'sim' || v === true) criterios[k] = true;
      else if (v === 'nao' || v === false) criterios[k] = false;
    }
    const { score, temperatura } = calcularScore(funil, criterios);

    let etapa = s.etapa;
    if (s.acao === 'transferir') etapa = 'encaminhado';
    if (s.acao === 'desqualificar') etapa = 'desqualificado';
    if (!funil.etapas.some((e) => e.id === etapa)) etapa = lead.etapa;

    const patch = {
      dados, criterios, score, temperatura, etapa,
      resumo: s.resumo?.trim() || lead.resumo,
      sentimento: s.sentimento,
      tags: [...new Set([...(lead.tags || []), ...(s.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean)])].slice(0, 20),
    };
    if (etapa !== lead.etapa) this.repo.evento(lead.id, 'etapa', { de: lead.etapa, para: etapa, motivo: s.motivo, por: 'bot' });
    if (s.lacuna?.trim()) this.repo.criarLacuna(lead.id, s.lacuna.trim());
    let atual = this.repo.atualizarLead(lead.id, patch);

    const baloes = (s.mensagens || []).map((t) => t.trim()).filter(Boolean).slice(0, bot.max_baloes || 3);
    await this.enviarSequencia(atual, baloes, 'bot');

    switch (s.acao) {
      case 'transferir': {
        const destino = (funil.destinos ?? []).find((x) => x.id === s.destino_id) ?? (funil.destinos ?? [])[0] ?? null;
        atual = this.repo.atualizarLead(lead.id, { modo: 'humano', pausado_ate: null, destino: destino?.id ?? null });
        this.repo.evento(lead.id, 'transferido', { destino: destino?.id ?? null, motivo: s.motivo });
        await this.notificarDestino(atual, destino, s.motivo);
        break;
      }
      case 'enviar_material': {
        const m = (funil.materiais ?? []).find((x) => x.id === s.material_id);
        if (m?.url) {
          await this.enviarMaterial(atual, m);
          this.repo.evento(lead.id, 'material_enviado', { material: m.id });
        }
        break;
      }
      case 'enviar_agendamento': {
        if (bot.link_agendamento && !baloes.join(' ').includes(bot.link_agendamento)) {
          await this.enviarSequencia(atual, [bot.link_agendamento], 'bot');
        }
        this.repo.evento(lead.id, 'agendamento_enviado', {});
        break;
      }
      case 'optout':
        this.repo.atualizarLead(lead.id, { optout: 1 });
        this.repo.evento(lead.id, 'optout', { via: 'ia' });
        break;
      case 'desqualificar':
        this.repo.evento(lead.id, 'desqualificado', { motivo: s.motivo });
        break;
    }
  }

  // ---------------- saída ----------------

  async enviarTexto(jid, texto) {
    this.pendentes.push({ jid, texto, ate: Date.now() + 120000 });
    const id = await this.wa.enviarTexto(jid, texto);
    if (id) this.idsEnviados.add(id);
    return id;
  }

  /** Envia balões com pausa de digitação e registra no histórico. autor: bot | humano */
  async enviarSequencia(lead, textos, autor = 'bot') {
    const sim = ehSimulacao(lead.jid);
    const bot = this.config.bot();
    for (const texto of textos) {
      let waId = null;
      if (!sim) {
        if (bot.simular_digitacao !== false && autor === 'bot') {
          await this.wa.digitando(lead.jid);
          await dormir(Math.min(1000 + texto.length * 30, 6000));
        }
        try {
          waId = await this.enviarTexto(lead.jid, texto);
        } catch (e) {
          this.log.error('[motor] falha ao enviar', e.message);
          this.repo.evento(lead.id, 'erro_envio', { erro: String(e.message).slice(0, 300) });
          continue;
        }
      }
      this.repo.inserirMensagem({ lead_id: lead.id, direcao: 'out', autor, texto, wa_id: waId });
    }
    if (!textos.length) return;
    const agora = Date.now();
    const atual = this.repo.leadPorId(lead.id);
    const patch = autor === 'humano' ? { ultima_msg_humano_em: agora } : { ultima_msg_bot_em: agora };
    if (autor === 'bot' && atual.primeira_resposta_ms == null) patch.primeira_resposta_ms = agora - atual.criado_em;
    this.repo.atualizarLead(lead.id, patch);
  }

  async enviarMaterial(lead, m) {
    const descricao = `[material enviado: ${m.nome}]`;
    let waId = null;
    if (!ehSimulacao(lead.jid)) {
      try {
        if (m.tipo === 'link') waId = await this.enviarTexto(lead.jid, m.url);
        else {
          this.pendentes.push({ jid: lead.jid, texto: m.legenda || '', ate: Date.now() + 120000 });
          waId = await this.wa.enviarMidia(lead.jid, { tipo: m.tipo, url: m.url, legenda: m.legenda, nomeArquivo: m.nome_arquivo });
          if (waId) this.idsEnviados.add(waId);
        }
      } catch (e) {
        this.repo.evento(lead.id, 'erro_envio', { erro: String(e.message).slice(0, 300), material: m.id });
        return;
      }
    }
    this.repo.inserirMensagem({ lead_id: lead.id, direcao: 'out', autor: 'sistema', tipo: m.tipo.toUpperCase(), texto: descricao, wa_id: waId });
  }

  montarNotificacao(lead, motivo) {
    const funil = this.config.funil();
    const etapa = funil.etapas.find((e) => e.id === lead.etapa)?.nome || lead.etapa;
    const dados = funil.campos
      .filter((c) => lead.dados?.[c.id])
      .map((c) => `• ${c.rotulo}: ${lead.dados[c.id]}`);
    return [
      '🔔 *Lead encaminhado pelo bot*',
      `*Nome:* ${lead.dados?.nome || lead.nome_whatsapp || '—'}`,
      `*WhatsApp:* +${lead.telefone} → https://wa.me/${lead.telefone}`,
      `*Etapa:* ${etapa} · score ${lead.score} (${lead.temperatura})`,
      motivo ? `*Motivo:* ${motivo}` : null,
      lead.resumo ? `*Resumo:* ${lead.resumo}` : null,
      dados.length ? `*Dados:*\n${dados.join('\n')}` : null,
      this.publicUrl ? `Painel: ${this.publicUrl}/#/lead/${lead.id}` : null,
    ].filter(Boolean).join('\n');
  }

  async notificarDestino(lead, destino, motivo) {
    const numero = soDigitos(destino?.whatsapp);
    if (!numero || ehSimulacao(lead.jid)) return;
    try {
      await this.enviarTexto(`${numero}@s.whatsapp.net`, this.montarNotificacao(lead, motivo));
    } catch (e) {
      this.repo.evento(lead.id, 'erro_envio', { erro: `notificação ao destino: ${String(e.message).slice(0, 300)}` });
    }
  }

  // ---------------- ações do painel ----------------

  async mensagemDoTime(leadId, texto) {
    const lead = this.repo.leadPorId(leadId);
    if (!lead) throw new Error('lead não encontrado');
    await this.enviarSequencia(lead, [texto], 'humano');
    this._humanoAssumiu(this.repo.leadPorId(leadId), 'painel');
  }

  devolverAoBot(leadId) {
    const lead = this.repo.leadPorId(leadId);
    if (!lead) return null;
    const funil = this.config.funil();
    const patch = { modo: 'bot', pausado_ate: null };
    if (lead.etapa === 'encaminhado') {
      patch.etapa = funil.etapas.some((e) => e.id === 'qualificado') ? 'qualificado' : 'novo';
      this.repo.evento(lead.id, 'etapa', { de: lead.etapa, para: patch.etapa, por: 'time', motivo: 'devolvido ao bot' });
    }
    this.repo.evento(lead.id, 'bot_retomou', { motivo: 'devolvido pelo time' });
    return this.repo.atualizarLead(lead.id, patch);
  }

  // ---------------- follow-ups ----------------

  async rodarFollowups() {
    const bot = this.config.bot();
    const funil = this.config.funil();
    if (!bot.ativo || !(funil.followups ?? []).length || !dentroDoHorario(bot.horario)) return 0;
    let enviados = 0;
    for (const lead of this.repo.leadsParaFollowup()) {
      const f = funil.followups[lead.followups_enviados];
      if (!f || !(f.etapas ?? []).includes(lead.etapa)) continue;
      if (Date.now() - lead.ultima_msg_bot_em < f.apos_horas * 3600e3) continue;
      const texto = preencher(f.mensagem, { ...lead.dados, nome: primeiroNome(lead) });
      await this.enviarSequencia(lead, [texto], 'bot');
      this.repo.atualizarLead(lead.id, { followups_enviados: lead.followups_enviados + 1 });
      this.repo.evento(lead.id, 'followup', { numero: lead.followups_enviados + 1 });
      enviados++;
    }
    return enviados;
  }
}
