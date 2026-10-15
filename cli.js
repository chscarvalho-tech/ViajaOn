// CLI de operação, pensada para o Claude Code (e para humanos) consultarem o bot sem abrir o painel.
//
//   node cli.js resumo [dias]            KPIs do período (padrão 30 dias)
//   node cli.js leads [etapa|quentes|humano] [busca]
//   node cli.js lead <id|telefone>       ficha completa + conversa
//   node cli.js lacunas                  perguntas que o bot não soube responder
//   node cli.js testar "mensagem" [sessao]   conversa com o bot pelo terminal (não usa WhatsApp)
//   node cli.js reset-teste [sessao]     apaga a conversa de teste
//   node cli.js validar                  valida config/bot.json e config/funil.json
//   node cli.js prompt                   imprime o prompt de sistema atual (para revisão)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarApp } from './lib/app.js';
import { validarBot, validarFunil } from './lib/config.js';
import { montarSistema } from './lib/cerebro.js';

const raiz = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(raiz, '.env')); } catch { /* usa o ambiente */ }
const app = criarApp({ raiz, publicUrl: process.env.PUBLIC_URL || '' });
const { repo, config } = app;

const [cmd, ...args] = process.argv.slice(2);
const data = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR') : '—');
const nome = (l) => l.dados?.nome || l.nome_whatsapp || '(sem nome)';

function linhaLead(l) {
  return `#${l.id}  ${nome(l).padEnd(18).slice(0, 18)}  +${l.telefone}  ${l.etapa.padEnd(14)} ${String(l.score).padStart(3)} ${l.temperatura.padEnd(6)} ${l.modo === 'humano' ? '🙋' : '🤖'}  ${data(l.ultima_msg_lead_em)}  ${(l.resumo || '').slice(0, 70)}`;
}

switch (cmd) {
  case 'resumo': {
    const dias = Number(args[0]) || 30;
    const funil = config.funil();
    const r = repo.resumo({ desde: Date.now() - dias * 864e5, faixaQuente: funil.faixas.quente, etapasQualificadas: ['qualificado', 'encaminhado', 'ganho'] });
    console.log(`Últimos ${dias} dias`);
    console.log(`  Leads: ${r.leads_periodo} (hoje: ${r.leads_hoje})  ·  qualificados: ${r.qualificados_periodo} (${Math.round(r.taxa_qualificacao * 100)}%)`);
    console.log(`  Encaminhados ao time: ${r.encaminhados_periodo}  ·  ganhos: ${r.ganhos_periodo}  ·  quentes ativos: ${r.quentes_ativos}`);
    console.log(`  1ª resposta média: ${r.primeira_resposta_media_ms ? Math.round(r.primeira_resposta_media_ms / 1000) + 's' : '—'}  ·  mensagens: ${r.mensagens_periodo}`);
    console.log(`  Custo IA estimado: US$ ${app.custoEstimado(r.uso_ia).toFixed(2)}  ·  lacunas abertas: ${r.lacunas_abertas}`);
    console.log('  Por etapa (agora):');
    for (const e of funil.etapas) console.log(`    ${e.nome.padEnd(22)} ${r.por_etapa.find((x) => x.etapa === e.id)?.n ?? 0}`);
    if (r.aguardando_humano.length) {
      console.log('  Aguardando o time:');
      for (const l of r.aguardando_humano) console.log(`    #${l.id} ${nome(l)} +${l.telefone} — ${(l.resumo || '').slice(0, 80)}`);
    }
    break;
  }
  case 'leads': {
    const [f, ...resto] = args;
    const filtro = {};
    if (f === 'quentes') filtro.temperatura = 'quente';
    else if (f === 'humano') filtro.modo = 'humano';
    else if (f && config.funil().etapas.some((e) => e.id === f)) filtro.etapa = f;
    else if (f) resto.unshift(f);
    if (resto.length) filtro.q = resto.join(' ');
    const leads = repo.listarLeads({ ...filtro, limite: 100 });
    leads.forEach((l) => console.log(linhaLead(l)));
    console.log(`${leads.length} lead(s)`);
    break;
  }
  case 'lead': {
    const ref = args[0] || '';
    const l = /^\d{1,6}$/.test(ref) ? repo.leadPorId(Number(ref)) : repo.leadPorTelefone(ref.replace(/\D/g, ''));
    if (!l) { console.error('Lead não encontrado.'); process.exit(1); }
    console.log(linhaLead(l));
    console.log('Dados:', JSON.stringify(l.dados, null, 2));
    console.log('Critérios:', JSON.stringify(l.criterios));
    console.log('Tags:', (l.tags || []).join(', '), '| Destino:', l.destino || '—', '| Opt-out:', l.optout ? 'sim' : 'não');
    if (l.notas) console.log('Notas:', l.notas);
    console.log('\nConversa:');
    for (const m of repo.mensagens(l.id, 200)) console.log(`  [${data(m.criado_em)}] ${m.autor.padEnd(7)} ${m.texto}`);
    console.log('\nEventos:');
    for (const e of repo.eventos(l.id, 30).reverse()) console.log(`  [${data(e.criado_em)}] ${e.tipo} ${JSON.stringify(e.detalhe)}`);
    break;
  }
  case 'lacunas':
    for (const l of repo.listarLacunas('aberta')) console.log(`#${l.id} [${data(l.criado_em)}] ${l.pergunta}  (lead #${l.lead_id ?? '—'})`);
    break;
  case 'testar': {
    const texto = args[0];
    if (!texto) { console.error('Uso: node cli.js testar "mensagem" [sessao]'); process.exit(1); }
    const r = await app.simular(args[1] || 'cli', texto);
    for (const m of r.respostas) console.log(`🤖 ${m.texto}`);
    const l = r.lead;
    console.log(`\n— etapa: ${l.etapa} · score ${l.score} (${l.temperatura}) · modo: ${l.modo}`);
    console.log(`— dados: ${JSON.stringify(l.dados)}`);
    const ult = r.eventos[0];
    if (ult) console.log(`— último evento: ${ult.tipo} ${JSON.stringify(ult.detalhe)}`);
    break;
  }
  case 'reset-teste': {
    const l = repo.leadPorJid(`sim:${args[0] || 'cli'}`);
    if (l) repo.apagarLead(l.id);
    console.log('Conversa de teste apagada.');
    break;
  }
  case 'validar': {
    const eb = validarBot(config.bot());
    const ef = validarFunil(config.funil());
    for (const e of eb) console.log('bot.json:', e);
    for (const e of ef) console.log('funil.json:', e);
    if (!eb.length && !ef.length) console.log('Configuração válida.');
    process.exitCode = eb.length || ef.length ? 1 : 0;
    // Pendências: informações ainda vazias (não impedem de rodar, mas limitam o bot).
    const bot = config.bot();
    const funil = config.funil();
    const pend = [];
    if (!process.env.ANTHROPIC_API_KEY) pend.push('.env → ANTHROPIC_API_KEY vazio (o bot não responde sem ela)');
    for (const d of funil.destinos ?? []) if (!d.whatsapp) pend.push(`funil.json → destinos "${d.id}" sem WhatsApp (o aviso de lead transferido não é enviado)`);
    if (!bot.link_agendamento) pend.push('bot.json → link_agendamento vazio (quem aceita a conversa é transferido direto)');
    for (const m of funil.materiais ?? []) if (!m.url) pend.push(`funil.json → material "${m.id}" sem URL (o bot não oferece)`);
    if (!process.env.WAAKG_URL || !process.env.WAAKG_API_KEY || !process.env.WAAKG_SESSION) pend.push('.env → WAAKG_URL / WAAKG_API_KEY / WAAKG_SESSION incompletos (necessário só para colocar no WhatsApp)');
    if (!process.env.PAINEL_SENHA) pend.push('.env → PAINEL_SENHA vazia (o painel não inicia)');
    if (config.conhecimento().some((d) => d.conteudo.includes('<!--'))) pend.push('conhecimento/ → ainda há arquivos com texto de modelo (<!-- -->)');
    if (pend.length) {
      console.log(`\nPendências (${pend.length}):`);
      pend.forEach((p) => console.log(`  - ${p}`));
    } else console.log('Sem pendências.');
    break;
  }
  case 'prompt':
    console.log(montarSistema(config.bot(), config.funil(), config.conhecimento()));
    break;
  default:
    console.log('Comandos: resumo [dias] | leads [etapa|quentes|humano] [busca] | lead <id|telefone> | lacunas | testar "msg" [sessao] | reset-teste [sessao] | validar | prompt');
}
