'use strict';

const { google } = require('googleapis');

// Taille max pour l'envoi WhatsApp (documents)
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

// Les fichiers Google Workspace ne se téléchargent pas directement :
// ils doivent être exportés vers un format standard.
const WORKSPACE_EXPORT = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/pdf',
    ext: '.pdf',
    label: 'Google Doc → PDF',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: '.xlsx',
    label: 'Google Sheets → XLSX',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/pdf',
    ext: '.pdf',
    label: 'Google Slides → PDF',
  },
  'application/vnd.google-apps.drawing': {
    mimeType: 'application/pdf',
    ext: '.pdf',
    label: 'Google Drawing → PDF',
  },
};

class GoogleDriveService {
  constructor() {
    const keyFile = process.env.GOOGLE_CREDENTIALS_FILE || 'google-credentials.json';

    this.auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
    this.folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!this.folderId) {
      throw new Error('GOOGLE_DRIVE_FOLDER_ID manquant dans .env');
    }
  }

  /**
   * Liste les fichiers du dossier Drive configuré.
   * @param {string} search - Filtre optionnel sur le nom du fichier
   * @param {number} limit  - Nombre max de résultats (défaut 20)
   */
  async listFiles(search = '', limit = 20) {
    // Échapper les apostrophes dans la recherche
    const safe = search.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    let q = `'${this.folderId}' in parents and trashed = false`;
    if (safe) q += ` and name contains '${safe}'`;

    const res = await this.drive.files.list({
      q,
      fields: 'files(id, name, mimeType, size, modifiedTime)',
      orderBy: 'name',
      pageSize: limit,
    });

    return res.data.files || [];
  }

  /**
   * Télécharge un fichier depuis Drive et le retourne en base64.
   * Les fichiers Google Workspace sont automatiquement exportés.
   *
   * @param {string} fileId - ID du fichier Drive
   * @returns {{ name, mimeType, base64, size }}
   */
  async downloadFile(fileId) {
    // 1. Récupérer les métadonnées
    const metaRes = await this.drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size',
    });
    const { name, mimeType, size } = metaRes.data;

    // 2. Vérifier la taille (uniquement pour les fichiers non-Workspace qui ont une taille)
    if (size && parseInt(size, 10) > MAX_BYTES) {
      const mb = (parseInt(size, 10) / 1024 / 1024).toFixed(1);
      throw new Error(`Fichier trop volumineux (${mb} MB). Limite: ${MAX_BYTES / 1024 / 1024} MB.`);
    }

    let buffer;
    let finalMime = mimeType;
    let finalName = name;

    if (WORKSPACE_EXPORT[mimeType]) {
      // 3a. Fichier Google Workspace → export
      const exp = WORKSPACE_EXPORT[mimeType];
      const exportRes = await this.drive.files.export(
        { fileId, mimeType: exp.mimeType },
        { responseType: 'arraybuffer' }
      );
      buffer = Buffer.from(exportRes.data);
      finalMime = exp.mimeType;
      if (!finalName.toLowerCase().endsWith(exp.ext)) {
        finalName += exp.ext;
      }
    } else {
      // 3b. Fichier normal → téléchargement direct
      const dlRes = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );
      buffer = Buffer.from(dlRes.data);
    }

    return {
      name: finalName,
      mimeType: finalMime,
      base64: buffer.toString('base64'),
      size: buffer.length,
    };
  }

  /**
   * Recherche le premier fichier dont le nom contient `nameQuery`.
   * @returns {object|null}
   */
  async findByName(nameQuery) {
    const files = await this.listFiles(nameQuery, 5);
    return files.length > 0 ? files[0] : null;
  }
}

/**
 * Formate une taille en octets pour l'affichage.
 */
function formatSize(bytes) {
  if (!bytes) return '?';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Retourne un emoji selon le type MIME du fichier.
 */
function mimeEmoji(mimeType = '') {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf') || mimeType.includes('google-apps.document')) return '📑';
  if (mimeType.includes('spreadsheet') || mimeType.includes('google-apps.spreadsheet')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('google-apps.presentation')) return '📊';
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar')) return '📦';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  return '📄';
}

module.exports = { GoogleDriveService, formatSize, mimeEmoji };
