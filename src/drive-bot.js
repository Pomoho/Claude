'use strict';

/**
 * Agent WhatsApp Drive
 * ──────────────────────────────────────────────
 * Combine deux capacités sur le même numéro WhatsApp :
 *   1. IA Claude  → répond à tous les messages normaux
 *   2. Google Drive → commandes !liste, !fichier, !recherche
 *
 * Démarrage : node src/drive-bot.js  (ou npm run drive)
 */

require('dotenv').config();

const { Client, LocalAuth, MessageTypes, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const WhatsAppAgent = require('./agent.js');
const { GoogleDriveService, formatSize, mimeEmoji } = require('./google-drive.js');

// ── Validation de la configuration ──────────────────────────────────────────

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ ANTHROPIC_API_KEY manquant dans .env');
  process.exit(1);
}
if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
  console.error('❌ GOOGLE_DRIVE_FOLDER_ID manquant dans .env');
  process.exit(1);
}

// ── Initialisation des services ──────────────────────────────────────────────

const aiAgent = new WhatsAppAgent();

let driveService;
try {
  driveService = new GoogleDriveService();
  console.log('✅ Service Google Drive initialisé');
} catch (err) {
  console.error('❌ Erreur Google Drive:', err.message);
  process.exit(1);
}

// ── État de session par contact ──────────────────────────────────────────────
// Mémorise la dernière liste de fichiers affichée pour chaque contact,
// permettant à l'utilisateur de sélectionner un fichier par numéro.
const lastListedFiles = new Map();

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

// ── Aide Drive ───────────────────────────────────────────────────────────────

const DRIVE_HELP =
  '*📁 Commandes Google Drive:*\n\n' +
  '• `!liste` — Lister tous les fichiers du dossier\n' +
  '• `!liste <recherche>` — Filtrer par nom\n' +
  '• `!fichier <numéro>` — Envoyer le fichier n° (après `!liste`)\n' +
  '• `!fichier <nom>` — Rechercher et envoyer par nom\n\n' +
  '_Les Google Docs/Sheets/Slides sont convertis en PDF/XLSX_\n\n' +
  '*📌 Autres commandes:*\n' +
  '• `!reset` — Réinitialiser la conversation IA\n' +
  '• `!stats` — Voir les statistiques\n' +
  '• `!aide` — Afficher cette aide\n\n' +
  '_Pour tout autre message, je réponds avec l\'IA Claude_ 🤖';

// ── Client WhatsApp ──────────────────────────────────────────────────────────

const client = new Client({
  // Partage la session avec index.js pour éviter un nouveau QR code
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

// ── Événements de connexion ──────────────────────────────────────────────────

client.on('qr', (qr) => {
  console.log('\n📱 Scannez ce QR code (Agent Drive):\n');
  qrcode.generate(qr, { small: true });
  console.log('\n👆 WhatsApp → Appareils connectés → Connecter un appareil\n');
});

client.on('authenticated', () => console.log('🔐 Authentifié'));

client.on('ready', () => {
  const model = process.env.CLAUDE_MODEL || 'claude-opus-4-6';
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log('\n✅ Agent Drive + IA prêt!');
  console.log(`🤖 Claude: ${model}`);
  console.log(`📁 Drive folder: ${folder}`);
  console.log('\nCommandes Drive: !liste, !fichier');
  console.log('Commandes IA: !reset, !stats, !aide');
  console.log('\n📡 En attente de messages...\n');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Échec d\'authentification:', msg);
  process.exit(1);
});

client.on('disconnected', (reason) => {
  console.warn('⚠️  Déconnecté:', reason, '— reconnexion...');
  client.initialize();
});

// ── Gestionnaire de messages ─────────────────────────────────────────────────

client.on('message_create', async (message) => {
  if (message.fromMe) return;
  if (message.type !== MessageTypes.TEXT) return;
  if (message.from === 'status@broadcast') return;

  const allowGroups = process.env.ALLOW_GROUPS === 'true';
  if (!allowGroups && message.from.endsWith('@g.us')) return;

  const contactId = message.from;
  const text = message.body.trim();
  if (!text) return;

  if (isRateLimited(contactId)) return;

  const ts = new Date().toLocaleTimeString('fr-FR');
  const preview = text.length > 70 ? text.slice(0, 70) + '…' : text;
  console.log(`📨 [${ts}] ${contactId}: ${preview}`);

  // ── Commandes générales ──────────────────────────────────────────────────

  if (text.toLowerCase() === '!aide' || text.toLowerCase() === '!help') {
    await message.reply(DRIVE_HELP);
    return;
  }

  if (text.toLowerCase() === '!reset') {
    aiAgent.resetConversation(contactId);
    lastListedFiles.delete(contactId);
    await message.reply('🔄 Conversation réinitialisée!');
    return;
  }

  if (text.toLowerCase() === '!stats') {
    const stats = aiAgent.getStats(contactId);
    await message.reply(
      `📊 *Statistiques:*\n` +
      `• Modèle: ${stats.model}\n` +
      `• Messages IA en mémoire: ${stats.historyLength}/${stats.maxHistory * 2}\n` +
      `• Dossier Drive: ${process.env.GOOGLE_DRIVE_FOLDER_ID}`
    );
    return;
  }

  // ── Commandes Google Drive ───────────────────────────────────────────────

  const lower = text.toLowerCase();
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ').trim();

  // !liste [recherche]
  if (cmd === '!liste' || cmd === '!list') {
    await handleListe(message, contactId, args, ts);
    return;
  }

  // !fichier <nom|numéro>
  if (cmd === '!fichier' || cmd === '!file' || cmd === '!f') {
    await handleFichier(message, contactId, args, ts);
    return;
  }

  // ── Messages normaux → Claude IA ────────────────────────────────────────

  try {
    try {
      const chat = await message.getChat();
      await chat.sendStateTyping();
    } catch (_) {}

    const reply = await aiAgent.respond(contactId, text);
    await message.reply(reply);
    console.log(`📤 [${ts}] IA → ${contactId} (${reply.length} chars)`);
  } catch (err) {
    console.error(`❌ Erreur IA [${contactId}]:`, err.message);
    const errMsg = err.status === 401
      ? '⚠️ Clé API Claude invalide.'
      : '⚠️ Erreur IA, réessayez dans un moment.';
    await message.reply(errMsg);
  }
});

// ── Handlers Drive ───────────────────────────────────────────────────────────

async function handleListe(message, contactId, search, ts) {
  try {
    await message.reply(search ? `🔍 Recherche de "*${search}*"…` : '🔍 Chargement des fichiers…');

    const files = await driveService.listFiles(search);

    if (files.length === 0) {
      await message.reply(
        search
          ? `📭 Aucun fichier trouvé pour "*${search}*".\nEssayez \`!liste\` sans filtre.`
          : '📭 Ce dossier est vide ou le compte de service n\'y a pas accès.'
      );
      return;
    }

    // Mémoriser la liste pour la sélection par numéro
    lastListedFiles.set(contactId, files);

    const header = search
      ? `📁 *Résultats pour "${search}" (${files.length}):*\n\n`
      : `📁 *Fichiers disponibles (${files.length}):*\n\n`;

    const list = files.map((f, i) => {
      const emoji = mimeEmoji(f.mimeType);
      const size = f.size ? ` _(${formatSize(parseInt(f.size, 10))})_` : '';
      return `${i + 1}. ${emoji} ${f.name}${size}`;
    }).join('\n');

    await message.reply(
      header + list +
      '\n\n_Utilisez `!fichier <numéro>` ou `!fichier <nom>` pour télécharger_'
    );

    console.log(`📋 [${ts}] Liste envoyée à ${contactId}: ${files.length} fichiers`);
  } catch (err) {
    console.error(`❌ Erreur !liste [${contactId}]:`, err.message);
    const msg = err.message.includes('accès') || err.code === 403
      ? '⚠️ Accès refusé. Partagez le dossier avec le compte de service.'
      : '⚠️ Impossible de lister les fichiers. Vérifiez la configuration.';
    await message.reply(msg);
  }
}

async function handleFichier(message, contactId, args, ts) {
  if (!args) {
    await message.reply(
      '⚠️ Usage:\n' +
      '• `!fichier 2` — envoyer le fichier n°2 (après `!liste`)\n' +
      '• `!fichier rapport` — rechercher par nom'
    );
    return;
  }

  try {
    let targetFile = null;

    // Sélection par numéro (référence à la dernière liste)
    const num = parseInt(args, 10);
    if (!isNaN(num) && num > 0 && String(num) === args.trim()) {
      const listed = lastListedFiles.get(contactId);
      if (!listed || !listed[num - 1]) {
        await message.reply('⚠️ Numéro invalide. Utilisez `!liste` d\'abord pour voir les fichiers.');
        return;
      }
      targetFile = listed[num - 1];
    } else {
      // Sélection par nom
      await message.reply(`🔍 Recherche de "*${args}*"…`);
      targetFile = await driveService.findByName(args);
      if (!targetFile) {
        await message.reply(
          `❌ Fichier "*${args}*" introuvable.\n` +
          `Utilisez \`!liste ${args}\` pour affiner la recherche.`
        );
        return;
      }
    }

    // Téléchargement
    await message.reply(`⬇️ Téléchargement de *${targetFile.name}*…`);

    try {
      const chat = await message.getChat();
      await chat.sendStateTyping();
    } catch (_) {}

    const fileData = await driveService.downloadFile(targetFile.id);

    const media = new MessageMedia(fileData.mimeType, fileData.base64, fileData.name);
    const caption = `📎 *${fileData.name}*\n_${formatSize(fileData.size)} · Google Drive_`;

    await message.reply(media, null, { caption });

    console.log(`📤 [${ts}] Fichier → ${contactId}: ${fileData.name} (${formatSize(fileData.size)})`);
  } catch (err) {
    console.error(`❌ Erreur !fichier [${contactId}]:`, err.message);

    let msg;
    if (err.message.includes('volumineux')) {
      msg = `⚠️ ${err.message}`;
    } else if (err.code === 403) {
      msg = '⚠️ Accès refusé à ce fichier.';
    } else if (err.code === 404) {
      msg = '⚠️ Fichier introuvable sur Drive.';
    } else {
      msg = '⚠️ Impossible de télécharger ce fichier. Réessayez.';
    }
    await message.reply(msg);
  }
}

// ── Démarrage ────────────────────────────────────────────────────────────────

console.log('🚀 Démarrage Agent Drive + IA...');
console.log(`   Node.js: ${process.version}`);
client.initialize();

async function shutdown(signal) {
  console.log(`\n👋 Arrêt (${signal})…`);
  try { await client.destroy(); } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
