// @ts-check

const ChatService = require('../../../src/services/chat-service');

describe('ChatService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.tabs.query.mockReset();
    chrome.tabs.update.mockReset();
    chrome.tabs.create.mockReset();
    chrome.windows.update.mockReset();
  });

  describe('navigateToChat', () => {
    it('updates existing WhatsApp tab for individual chat', async () => {
      const existingTab = { id: 42, windowId: 1 };
      chrome.tabs.query.mockResolvedValue([existingTab]);
      chrome.tabs.update.mockResolvedValue({});
      chrome.windows.update.mockResolvedValue({});

      await ChatService.navigateToChat('5511999999999@c.us');

      expect(chrome.tabs.query).toHaveBeenCalledWith({
        url: 'https://web.whatsapp.com/*',
      });
      expect(chrome.tabs.update).toHaveBeenCalledWith(42, {
        active: true,
        url: 'https://web.whatsapp.com/send?phone=5511999999999',
      });
      expect(chrome.windows.update).toHaveBeenCalledWith(1, { focused: true });
    });

    it('creates new tab when no WhatsApp tab exists', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue({});

      await ChatService.navigateToChat('5511999999999@c.us');

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://web.whatsapp.com/send?phone=5511999999999',
      });
      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    it('uses base URL for group chats', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue({});

      await ChatService.navigateToChat('120363123456789@g.us');

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://web.whatsapp.com',
      });
    });

    it('focuses the first matching tab when multiple exist', async () => {
      const tabs = [
        { id: 1, windowId: 10 },
        { id: 2, windowId: 20 },
      ];
      chrome.tabs.query.mockResolvedValue(tabs);
      chrome.tabs.update.mockResolvedValue({});
      chrome.windows.update.mockResolvedValue({});

      await ChatService.navigateToChat('5511999999999@c.us');

      expect(chrome.tabs.update).toHaveBeenCalledWith(1, expect.any(Object));
      expect(chrome.windows.update).toHaveBeenCalledWith(10, { focused: true });
    });
  });
});
