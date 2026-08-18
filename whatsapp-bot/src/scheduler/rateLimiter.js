// Aplica a fase 6 do plano: rampa de aquecimento, teto diário e horário de silêncio.
// Isto é o que separa "automação" de "queimar a conta/número na primeira semana".
import { DateTime } from 'luxon';
import { channels, sendWindow, timezone } from '../config.js';
import { getDailyCount, getFirstSendAt, recordFirstSendIfNeeded } from '../store/db.js';

function now() {
  return DateTime.now().setZone(timezone);
}

export function isWithinSendWindow(at = now()) {
  const hour = at.hour + at.minute / 60;
  if (hour < sendWindow.startHour || hour >= sendWindow.endHour) return false;
  if (sendWindow.todayCutoff) {
    const [h, m] = sendWindow.todayCutoff.split(':').map(Number);
    const cutoff = at.set({ hour: h, minute: m, second: 0 });
    if (at >= cutoff) return false;
  }
  // fins de semana ficam fora por padrão — outreach B2B/clínica não costuma responder bem
  // fora de dia útil, e reduz ainda mais o volume que passa pela conta/número.
  if (at.weekday >= 6) return false;
  return true;
}

async function dailyCapFor(channel) {
  const cfg = channels[channel];
  const firstSendAt = await getFirstSendAt(channel);
  if (!firstSendAt) return cfg.startPerDay;

  const daysSince = Math.floor(DateTime.now().diff(DateTime.fromISO(firstSendAt), 'days').days);
  if (daysSince >= cfg.warmupDays) return cfg.steadyPerDay;

  const progress = daysSince / cfg.warmupDays;
  return Math.round(cfg.startPerDay + (cfg.steadyPerDay - cfg.startPerDay) * progress);
}

export async function canSendNow(channel) {
  if (!isWithinSendWindow()) {
    return { ok: false, reason: 'fora do horário de envio' };
  }
  const cap = await dailyCapFor(channel);
  const used = await getDailyCount(channel);
  if (used >= cap) {
    return { ok: false, reason: `teto diário atingido (${used}/${cap})` };
  }
  return { ok: true, cap, used };
}

export async function markSent(channel) {
  await recordFirstSendIfNeeded(channel);
}

export function randomDelayMs(channel) {
  const { delayMsMin, delayMsMax } = channels[channel];
  return Math.floor(delayMsMin + Math.random() * (delayMsMax - delayMsMin));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
