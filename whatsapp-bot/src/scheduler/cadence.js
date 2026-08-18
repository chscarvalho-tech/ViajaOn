// Cadência de nutrição pós-abordagem: D+1, D+3, D+10. Sem etapa de diagnóstico/teste —
// a abordagem já convida direto para a call de 30 minutos (Método ROTA), então a cadência
// começa a contar a partir do envio da mensagem inicial (ver whatsapp/outreach.js e
// linkedin/send.js, que chamam scheduleNurture logo após o primeiro contato).
import { DateTime } from 'luxon';
import { scheduleCadence, dueCadenceSteps, markCadenceDone } from '../store/db.js';
import { renderMessage } from '../content/render.js';
import { timezone, links } from '../config.js';

// Chame isto logo após a abordagem inicial de um contato, pra agendar os três toques
// de nutrição subsequentes.
export async function scheduleNurture(contactId) {
  const base = DateTime.now().setZone(timezone);
  await scheduleCadence(contactId, [
    { step: 'd1', dueAt: base.plus({ days: 1 }).toISO() },
    { step: 'd3', dueAt: base.plus({ days: 3 }).toISO() },
    { step: 'd10', dueAt: base.plus({ days: 10 }).toISO() },
  ]);
}

const STEP_TO_SCRIPT = {
  d1: 'whatsapp_followup_24h',
  d3: 'whatsapp_followup_d3',
  d10: 'whatsapp_followup_d10',
};

// Retorna as mensagens prontas para os passos de cadência vencidos, sem enviar nada —
// quem consome isto (src/whatsapp/run.js) decide como e quando efetivamente mandar,
// respeitando o rate limiter.
export async function buildDueNurtureMessages(contactsById) {
  const due = await dueCadenceSteps();
  const out = [];
  for (const step of due) {
    const contact = contactsById.get(step.contactId);
    if (!contact) continue;

    const scriptKey = STEP_TO_SCRIPT[step.step];
    const vars = { LINK_AGENDA: links.agenda };

    const { texto } = renderMessage(scriptKey, vars, { seed: contact.id + step.step });
    out.push({ contact, step: step.step, scriptKey, texto });
  }
  return out;
}

export async function markNurtureSent(contactId, step) {
  await markCadenceDone(contactId, step);
}
