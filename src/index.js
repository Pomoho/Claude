'use strict';

require('dotenv').config();

const { Client, LocalAuth, MessageTypes } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const WhatsAppAgent = require('./agent.js');

// Vérification de la clé API au démarrage
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ERREUR: La variable ANTHROPIC_API_KEY est manquante dans le fichier .env');
  process.exit(1);
}

const agent = new WhatsAppAgent();

// ── Rate limiting ────────────────────────────────────────────────────────────
const lastMessageTime = new Map();
const RATE_LIMIT_MS = parseInt(process.env.RATE_LIMIT_MS || '2000', 10);

function isRateLimited(contactId) {
  const now = Date.now();
  const last = lastMessageTime.get(contactId) || 0;
  if (now - last < RATE_LIMIT_MS) return true;
  lastMessageTime.set(contactId, now);
  return false;
}

// ── Client WhatsApp ──────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
});

// ── Événements WhatsApp ──────────────────────────────────────────────────────

client.on('qr', (qr) => {
  console.log('\n📱 Scannez ce QR code avec WhatsApp:\n');
  qrcode.generate(qr, { small: true });
  console.log('\n👆 Ouvrez WhatsApp → Paramètres → Appareils connectés → Connecter un appareil\n');
});

client.on('authenticated', () => {
  console.log('🔐 Authentification réussie');
});

client.on('ready', () => {
  const model = process.env.CLAUDE_MODEL || 'claude-opus-4-6';
  const allowGroups = process.env.ALLOW_GROUPS === 'true';
  console.log('\n✅ Agent WhatsApp AI prêt!');
  console.log(`🤖 Modèle: ${model}`);
  console.log(`💬 Groupes: ${allowGroups ? 'activés' : 'désactivés'}`);
  console.log('\nCommandes disponibles dans WhatsApp:');
  console.log('  !aide   — Afficher l\'aide');
  console.log('  !reset  — Réinitialiser la conversation');
  console.log('  !stats  — Statistiques de la conversation');
  console.log('\n📡 En attente de messages...\n');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Échec d\'authentification:', msg);
  process.exit(1);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️  Déconnecté:', reason);
  console.log('🔄 Tentative de reconnexion...');
  client.initialize();
});

// ── Gestionnaire de messages ─────────────────────────────────────────────────

client.on('message', async (message) => {
  // Ignorer les messages non-texte (images, audio, vidéo, etc.)
  if (message.type !== MessageTypes.TEXT) return;

  // Ignorer les diffusions de statut
  if (message.from === 'status@broadcast') return;

  // Ignorer les messages de groupe si non configuré
  const allowGroups = process.env.ALLOW_GROUPS === 'true';
  if (!allowGroups && message.from.endsWith('@g.us')) return;

  const contactId = message.from;
  const text = message.body.trim();
  if (!text) return;

  // ── Commandes ──────────────────────────────────────────────────────────────

  if (text.toLowerCase() === '!aide' || text.toLowerCase() === '!help') {
    const model = process.env.CLAUDE_MODEL || 'claude-opus-4-6';
    await message.reply(
      '*🤖 Assistant WhatsApp AI*\n\n' +
      `Propulsé par *${model}*\n\n` +
      'Envoyez-moi un message et je vous répondrai!\n\n' +
      '*Commandes:*\n' +
      '• `!aide` — Afficher cette aide\n' +
      '• `!reset` — Réinitialiser la conversation\n' +
      '• `!stats` — Voir les statistiques'
    );
    return;
  }

  if (text.toLowerCase() === '!reset') {
    agent.resetConversation(contactId);
    await message.reply('🔄 Conversation réinitialisée! Bonjour, comment puis-je vous aider?');
    return;
  }

  if (text.toLowerCase() === '!stats') {
    const stats = agent.getStats(contactId);
    await message.reply(
      `📊 *Statistiques:*\n` +
      `• Modèle: ${stats.model}\n` +
      `• Messages en mémoire: ${stats.historyLength}/${stats.maxHistory * 2}`
    );
    return;
  }

  // ── Rate limiting ──────────────────────────────────────────────────────────

  if (isRateLimited(contactId)) {
    console.log(`⏱️  Rate limited: ${contactId}`);
    return;
  }

  // ── Traitement du message ──────────────────────────────────────────────────

  const preview = text.length > 70 ? text.slice(0, 70) + '...' : text;
  const timestamp = new Date().toLocaleTimeString('fr-FR');
  console.log(`📨 [${timestamp}] ${contactId}: ${preview}`);

  try {
    // Indicateur de frappe
    const chat = await message.getChat();
    await chat.sendStateTyping();

    const reply = await agent.respond(contactId, text);
    await message.reply(reply);

    console.log(`📤 [${timestamp}] Répondu à ${contactId} (${reply.length} chars)`);
  } catch (err) {
    console.error(`❌ Erreur pour ${contactId}:`, err.message);

    // Message d'erreur convivial
    const errorMsg = err.status === 401
      ? '⚠️ Clé API invalide. Vérifiez votre configuration.'
      : '⚠️ Une erreur s\'est produite. Veuillez réessayer dans un moment.';

    await message.reply(errorMsg);
  }
});

// ── Démarrage ────────────────────────────────────────────────────────────────

console.log('🚀 Démarrage de l\'agent WhatsApp AI...');
console.log(`   Node.js: ${process.version}`);
client.initialize();

// ── Arrêt propre ─────────────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`\n\n👋 Signal ${signal} reçu. Arrêt en cours...`);
  try {
    await client.destroy();
  } catch (_) {
    // Ignorer les erreurs à l'arrêt
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
