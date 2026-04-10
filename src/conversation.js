'use strict';

/**
 * Gestionnaire d'historique de conversation par contact WhatsApp.
 * Chaque contact possède son propre historique indépendant.
 */
class ConversationManager {
  constructor(maxMessages = 20) {
    // Map: contactId -> tableau de messages {role, content}
    this.conversations = new Map();
    this.maxMessages = maxMessages;
  }

  /**
   * Retourne l'historique d'un contact (crée un tableau vide si inexistant).
   */
  getHistory(contactId) {
    if (!this.conversations.has(contactId)) {
      this.conversations.set(contactId, []);
    }
    return this.conversations.get(contactId);
  }

  /**
   * Ajoute un message à l'historique et tronque si nécessaire.
   * Garantit que l'historique commence toujours par un message 'user'.
   */
  addMessage(contactId, role, content) {
    const history = this.getHistory(contactId);
    history.push({ role, content });

    if (history.length > this.maxMessages) {
      const trimmed = history.slice(history.length - this.maxMessages);
      // S'assurer que l'historique commence par un message utilisateur
      const firstUserIdx = trimmed.findIndex(m => m.role === 'user');
      this.conversations.set(
        contactId,
        firstUserIdx >= 0 ? trimmed.slice(firstUserIdx) : trimmed
      );
    }
  }

  /**
   * Efface l'historique d'un contact.
   */
  clear(contactId) {
    this.conversations.delete(contactId);
  }

  /**
   * Retourne le nombre de messages dans l'historique d'un contact.
   */
  size(contactId) {
    return this.getHistory(contactId).length;
  }
}

module.exports = ConversationManager;
