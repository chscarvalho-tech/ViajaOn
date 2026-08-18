// Sessão do WhatsApp via Baileys (biblioteca não-oficial — decisão já tomada e documentada
// no plano publicado, com os riscos que ela carrega). Autenticação por QR code, escaneado
// uma vez pelo celular; a sessão fica salva em data/state/whatsapp-auth e é reaproveitada.
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { pino } from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config.js';

export async function connectWhatsapp({ onMessage, phoneNumber } = {}) {
  const { state, saveCreds } = await useMultiFileAuthState(paths.whatsappAuthDir);
  const { version } = await fetchLatestBaileysVersion();

  // Login por código (em vez de QR) só faz sentido numa conexão ainda não registrada.
  const usePairingCode = Boolean(phoneNumber) && !state.creds.registered;

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  if (usePairingCode) {
    // Baileys só aceita o pedido de código depois que o socket abre o primeiro handshake
    // (evento 'connection.update' com qr disponível é o sinal de que já pode pedir).
    let requested = false;
    sock.ev.on('connection.update', async (update) => {
      if (update.qr && !requested) {
        requested = true;
        try {
          const digits = phoneNumber.replace(/\D/g, '');
          const code = await sock.requestPairingCode(digits);
          console.log(`\nCódigo de pareamento para ${digits}: ${code}`);
          console.log('No celular: WhatsApp > Aparelhos conectados > Conectar um aparelho > "Conectar com número de telefone" > digite o código acima.\n');
        } catch (err) {
          console.error('Falha ao pedir o código de pareamento:', err.message || err);
        }
      }
    });
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && !usePairingCode) {
      console.log('\nEscaneie este QR code no WhatsApp do número dedicado (Aparelhos conectados > Conectar um aparelho):\n');
      qrcode.generate(qr, { small: true });
      // Salva o payload bruto do QR (não a arte ASCII) pra poder renderizar como imagem de verdade.
      try {
        fs.writeFileSync(path.join(paths.stateDir, 'last-qr.txt'), qr);
      } catch { /* não bloqueia o login por causa disso */ }
    }
    if (connection === 'open') {
      console.log('WhatsApp conectado.');
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      console.log(`Conexão do WhatsApp encerrada${loggedOut ? ' (deslogado — apague data/state/whatsapp-auth e escaneie de novo)' : ', tentando reconectar...'}`);
      if (!loggedOut) connectWhatsapp({ onMessage, phoneNumber });
    }
  });

  if (onMessage) {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        const text = extractText(msg);
        if (!text) continue;
        await onMessage(sock, msg.key.remoteJid, text, msg);
      }
    });
  }

  return sock;
}

function extractText(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    null
  );
}

export function waitForOpen(sock) {
  return new Promise((resolve) => {
    sock.ev.on('connection.update', (u) => {
      if (u.connection === 'open') resolve();
    });
  });
}
