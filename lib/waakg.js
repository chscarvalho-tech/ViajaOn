// Cliente mínimo da API REST do WA-AKG (https://github.com/mrifqidaffaaditya/WA-AKG).

export class WaAkg {
  constructor({ url, apiKey, sessao }) {
    this.url = (url || '').replace(/\/+$/, '').replace(/\/api$/, '');
    this.apiKey = apiKey;
    this.sessao = sessao;
  }

  get configurado() {
    return Boolean(this.url && this.apiKey && this.sessao);
  }

  async req(metodo, caminho, corpo) {
    if (!this.configurado) throw new Error('WA-AKG não configurado (WAAKG_URL, WAAKG_API_KEY, WAAKG_SESSION)');
    const res = await fetch(`${this.url}/api${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': this.apiKey },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(30000),
    });
    const texto = await res.text();
    let json;
    try { json = texto ? JSON.parse(texto) : {}; } catch { json = { raw: texto }; }
    if (!res.ok || json?.status === false) {
      throw new Error(`WA-AKG ${metodo} ${caminho} → ${res.status}: ${json?.message || json?.error || texto.slice(0, 200)}`);
    }
    return json;
  }

  _rota(jid, sufixo) {
    return `/messages/${encodeURIComponent(this.sessao)}/${encodeURIComponent(jid)}/${sufixo}`;
  }

  /** Envia texto e devolve o id da mensagem no WhatsApp (quando o WA-AKG informa). */
  async enviarTexto(jid, texto) {
    const r = await this.req('POST', this._rota(jid, 'send'), { message: { text: texto } });
    return r?.data?.key?.id ?? null;
  }

  async enviarMidia(jid, { tipo, url, legenda, nomeArquivo }) {
    let message;
    if (tipo === 'imagem') message = { image: { url }, caption: legenda || undefined };
    else if (tipo === 'video') message = { video: { url }, caption: legenda || undefined };
    else if (tipo === 'documento') {
      const nome = nomeArquivo || decodeURIComponent(url.split('/').pop().split('?')[0]) || 'arquivo.pdf';
      const mimetype = nome.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
      message = { document: { url }, mimetype, fileName: nome, caption: legenda || undefined };
    } else throw new Error(`tipo de mídia não suportado: ${tipo}`);
    const r = await this.req('POST', this._rota(jid, 'send'), { message });
    return r?.data?.key?.id ?? null;
  }

  async digitando(jid) {
    try {
      await this.req('POST', `/chat/${encodeURIComponent(this.sessao)}/${encodeURIComponent(jid)}/presence`, { presence: 'composing' });
    } catch { /* indicador de digitação é cosmético */ }
  }

  status() {
    return this.req('GET', `/sessions/${encodeURIComponent(this.sessao)}`);
  }

  listarWebhooks() {
    return this.req('GET', '/webhooks');
  }

  registrarWebhook({ url, secret, nome = 'SDR WhatsApp (Claude)' }) {
    return this.req('POST', '/webhooks', {
      name: nome,
      url,
      secret,
      sessionId: this.sessao,
      events: ['message.received', 'message.sent'],
    });
  }
}
