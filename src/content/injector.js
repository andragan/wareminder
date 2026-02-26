// @ts-check

/**
 * DOM injection for the "Set Reminder" button into WhatsApp Web chat header.
 * Also handles chat context extraction (chatId, chatName).
 * @module injector
 */

(function () {
    "use strict";

    const REMINDER_BTN_TESTID = "wa-reminder-btn";
    const REMINDER_BTN_SELECTOR = `[data-testid="${REMINDER_BTN_TESTID}"]`;

    /**
     * Strategy 2: Extract chat ID from first data-id attribute on conversation elements.
     * Individual message data-id format: "true_PHONE@c.us_MSGID"
     * Group message data-id format: "false_120363@g.us_MSGID"
     * @returns {string | null} The extracted chatId or null if not found
     */
    function getChatIdFromFirstDataId() {
        const conversationPanel = document.querySelector("#main [data-id]");
        if (conversationPanel) {
            const dataId = conversationPanel.getAttribute("data-id");
            const jidMatch = dataId && dataId.match(/(\d+@[cg]\.us)/);
            if (jidMatch) {
                console.log("[WAReminder] getChatIdFromFirstDataId succeeded:", jidMatch[1]);
                return jidMatch[1];
            }
        }
        console.log("[WAReminder] getChatIdFromFirstDataId failed: no data-id or JID match");
        return null;
    }

    /**
     * Attempts to extract the chat ID from the URL, DOM, or falls back to a slugified chat name.
     * Tries multiple strategies in order until one succeeds.
     * @returns {string} The extracted chatId
     */
    function extractChatId() {
        return getChatIdFromFirstDataId();
    }

    /**
     * Extracts the current chat context from WhatsApp Web DOM and URL.
     * Uses header title for chatName and attempts to extract chatId from URL or DOM.
     * @returns {{ chatId: string, chatName: string } | null}
     */
    function extractChatContext() {
        try {
            // Extract chat name from header
            const header = document.querySelector("#main header");
            if (!header) {
                console.warn("WAReminder: Header not found");
                return null;
            }

            const chatName = getSelectedChatName(header);
            const chatId = extractChatId();

            return {
                chatId: chatId.trim(),
                chatName: chatName.trim(),
            };
        } catch (e) {
            console.warn("WAReminder: Failed to extract chat context", e);
            return null;
        }
    }

    /**
     * Attempts to extract the chat name from the header element using multiple strategies.
     * @param {Element} header - The #main header element
     * @returns {string | null} The extracted chat name, or null if not found
     */
    function getSelectedChatName(header) {
        let chatName = null;

        const NAME_SELECTORS = [
            'span[dir="auto"]',
        ];

        for (const selector of NAME_SELECTORS) {
            const el = header.querySelector(selector);
            const text = el
                ? (el.getAttribute("title") || el.textContent || "").trim()
                : "";
            if (text) {
                console.log(`WAReminder: Chat name found using selector "${selector}":`, text);
                chatName = text;
                break;
            }
        }

        if (!chatName) {
            console.warn("WAReminder: Chat name not found in header");
            return null;
        }

        return chatName;
    }

    /**
     * Injects the "Set Reminder" button into the chat header action buttons area.
     * @param {Element} header - The #main header element
     * @returns {boolean} Whether injection succeeded
     */
    function injectReminderButton(header) {
        // Don't inject if already present
        if (header.querySelector(REMINDER_BTN_SELECTOR)) {
            return true;
        }

        try {
            // Create the reminder button
            const btn = document.createElement("button");
            btn.setAttribute("data-testid", REMINDER_BTN_TESTID);
            btn.className = "wa-reminder-btn";
            btn.type = "button";
            btn.title =
                (chrome.i18n && chrome.i18n.getMessage("setReminder")) ||
                "Set Reminder";
            btn.setAttribute(
                "aria-label",
                (chrome.i18n && chrome.i18n.getMessage("setReminder")) ||
                    "Set Reminder",
            );

            // Bell icon SVG
            btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" class="wa-reminder-icon">
          <path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/>
        </svg>
      `;

            // Click handler: show reminder prompt
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const context = extractChatContext();
                if (!context) {
                    showInjectionError(header);
                    return;
                }

                if (
                    typeof WAReminder !== "undefined" &&
                    WAReminder.showPrompt
                ) {
                    WAReminder.showPrompt(context, header);
                }
            });

            // Find where to insert the button.
            // Both private and group chats share the same structure:
            //   header > ... > div (action area, last child) > div (buttons container) > button (video call)
            // [role="button"] elements are the profile/name divs, NOT the action buttons,
            // so we locate the first native <button> in the rightmost header section instead.
            const actionArea = header.lastElementChild;
            const firstNativeBtn = actionArea
                ? actionArea.querySelector("button")
                : null;

            if (firstNativeBtn && firstNativeBtn.parentElement) {
                // Insert our button before the first native action button (video call)
                firstNativeBtn.parentElement.insertBefore(btn, firstNativeBtn);
            } else {
                // Fallback: append to action area or header
                const target = actionArea || header;
                target.appendChild(btn);
            }

            return true;
        } catch (e) {
            console.warn("WAReminder: Failed to inject button", e);
            return false;
        }
    }

    /**
     * Shows an error notification when injection fails, guiding user to popup.
     * @param {Element} header
     */
    function showInjectionError(header) {
        // Create a temporary inline error message
        const existing = header.querySelector(".wa-reminder-error");
        if (existing) existing.remove();

        const errorEl = document.createElement("div");
        errorEl.className = "wa-reminder-error";
        errorEl.textContent =
            (chrome.i18n && chrome.i18n.getMessage("injectionFailed")) ||
            "Could not detect chat. Use the popup dashboard instead.";

        header.appendChild(errorEl);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorEl.parentElement) {
                errorEl.remove();
            }
        }, 5000);
    }

    /**
     * Called by chat-observer when a chat header is detected.
     * Attempts to inject the reminder button.
     * @param {Element} header
     */
    function onChatHeaderDetected(header) {
        const success = injectReminderButton(header);
        if (!success) {
            console.warn(
                "WAReminder: Button injection failed, popup dashboard available as fallback.",
            );
            showInjectionError(header);
        }
    }

    // Expose on global namespace
    window.WAReminder = window.WAReminder || {};
    window.WAReminder.extractChatContext = extractChatContext;
    window.WAReminder.injectReminderButton = injectReminderButton;
    window.WAReminder.onChatHeaderDetected = onChatHeaderDetected;
})();
