'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const ConversationManager = require('./conversation.js');

const DEFAULT_SYSTEM_PROMPT = `Tu es un assistant IA sympathique et utile qui répond aux messages WhatsApp.
Sois concis, amical et direct. Adapte ton style au ton conversationnel de WhatsApp.
Garde tes réponses brèves sauf si une explication détaillée est vraiment nécessaire.
Tu réponds en français par défaut, mais adapte-toi à la langue de l'utilisateur.`;

class WhatsAppAgent {
  constructor() {
    this.anthropic = new Anthropic();
    this.model = process.env.CLAUDE_MODEL || 'claude-opus-4-6';
    this.maxTokens = parseInt(process.env.MAX_TOKENS || '1024', 10);
    this.systemPrompt = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
    this.conversations = new ConversationManager(
      parseInt(process.env.MAX_HISTORY || '20', 10)
    );
  }

  /**
   * Génère une réponse de Claude pour un message entrant.
   * @param {string} contactId - Identifiant unique du contact WhatsApp
   * @param {string} userMessage - Message texte de l'utilisateur
   * @returns {Promise<string>} - Réponse de l'IA
   */
  async respond(contactId, userMessage) {
    this.conversations.addMessage(contactId, 'user', userMessage);

    const messages = this.conversations.getHistory(contactId);

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: this.systemPrompt,
      messages,
    });

    // Extraire le bloc texte de la réponse
    const textBlock = response.content.find(b => b.type === 'text');
    const reply = textBlock?.text || '(réponse vide)';

    this.conversations.addMessage(contactId, 'assistant', reply);

    return reply;
  }

  /**
   * Réinitialise l'historique de conversation d'un contact.
   * @param {string} contactId
   */
  resetConversation(contactId) {
    this.conversations.clear(contactId);
  }

  /**
   * Retourne des statistiques sur la conversation d'un contact.
   * @param {string} contactId
   */
  getStats(contactId) {
    return {
      model: this.model,
      historyLength: this.conversations.size(contactId),
      maxHistory: parseInt(process.env.MAX_HISTORY || '20', 10),
    };
  }
}

module.exports = WhatsAppAgent;
