// @ts-check

/**
 * Chat service for navigating to WhatsApp Web chats.
 * Handles tab finding/creating and chat URL construction.
 * @module chat-service
 */

import { WHATSAPP_URLS } from '../lib/constants.js';
import { buildNavigationUrl } from '../lib/utils.js';

/**
 * Navigates to a specific WhatsApp Web chat.
 * Finds an existing WhatsApp Web tab and updates it, or creates a new tab.
 * @param {string} chatId - WhatsApp JID (e.g., "5511999999999@c.us")
 * @returns {Promise<void>}
 */
async function navigateToChat(chatId) {
  const chatUrl = buildNavigationUrl(chatId);

  // Try to find an existing WhatsApp Web tab
  const tabs = await chrome.tabs.query({ url: WHATSAPP_URLS.TAB_QUERY });

  if (tabs.length > 0) {
    const tab = tabs[0];
    // Focus existing tab and navigate to chat
    await chrome.tabs.update(tab.id, { active: true, url: chatUrl });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    // Open a new tab
    await chrome.tabs.create({ url: chatUrl });
  }
}

export {
  navigateToChat,
};

const ChatService = {
  navigateToChat,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatService;
}
