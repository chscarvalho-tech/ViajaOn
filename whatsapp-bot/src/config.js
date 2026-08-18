// Configuração central. Números aqui refletem a fase 6 (limites de segurança) do plano
// publicado — não são um "extra", são o que evita queimar a conta/número na primeira semana.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const paths = {
  root: ROOT,
  dataDir: path.join(ROOT, 'data'),
  contactsDir: path.join(ROOT, 'data', 'contacts'),
  stateDir: path.join(ROOT, 'data', 'state'),
  dbFile: path.join(ROOT, 'data', 'db.json'),
  linkedinProfileDir: process.env.LINKEDIN_CHROME_PROFILE_DIR || path.join(ROOT, 'data', 'state', 'linkedin-profile'),
  whatsappAuthDir: path.join(ROOT, 'data', 'state', 'whatsapp-auth'), // legado (Baileys) — ver whatsappWebProfileDir
  whatsappWebProfileDir: path.join(ROOT, 'data', 'state', 'whatsapp-web-profile'),
  contentDir: path.join(ROOT, 'content'),
};

export const persona = {
  nome: 'Luís',
};

export const links = {
  agenda: process.env.AGENDA_LINK || '',
};

export const timezone = process.env.TIMEZONE || 'America/Sao_Paulo';

// Janela de envio: nunca manda fora do horário comercial do fuso configurado.
// todayCutoff permite apertar o limite só para hoje (ex.: "20:30" pedido pelo usuário),
// sem mexer no horário comercial padrão dos outros dias.
export const sendWindow = {
  startHour: 9,
  endHour: 19,
  todayCutoff: process.env.TODAY_CUTOFF || null, // "HH:mm" ou null
};

// Tetos e ritmo por canal. "warmup" é uma rampa linear de N dias até o teto em regime;
// antes do fim da rampa, o teto do dia é interpolado entre startPerDay e steadyPerDay.
export const channels = {
  linkedin: {
    warmupDays: 10,
    startPerDay: 8,
    steadyPerDay: 20, // faixa do plano: 15–25/dia
    delayMsMin: 2 * 60 * 1000, // 2 min
    delayMsMax: 6 * 60 * 1000, // 6 min
  },
  whatsapp: {
    warmupDays: 15,
    startPerDay: 20,
    steadyPerDay: 60, // faixa do plano: 40–80/dia
    delayMsMin: 30 * 1000, // 30s
    delayMsMax: 180 * 1000, // 180s
  },
};

export const optOut = {
  // Também carregado de content/scripts.json (opt_out_keywords) — isto é só um fallback.
  keywords: ['parar', 'sair', 'descadastrar', 'cancelar contato', 'não quero mais', 'remover', 'stop'],
};
