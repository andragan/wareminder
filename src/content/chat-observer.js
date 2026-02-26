// @ts-check

/**
 * MutationObserver for detecting WhatsApp Web DOM changes.
 * Observes the #app element and debounces callbacks to detect
 * when the chat header appears or changes (e.g., navigating between chats).
 * @module chat-observer
 */

/* global WAReminder */

(function () {
    "use strict";

    /**
     * Debounce utility (inline to avoid cross-file dependency in content scripts).
     * @param {Function} fn
     * @param {number} delay
     * @returns {Function}
     */
    function debounce(fn, delay) {
        let timeoutId = null;
        return function (...args) {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                fn.apply(this, args);
                timeoutId = null;
            }, delay);
        };
    }

    const DEBOUNCE_MS = 100;
    const OBSERVER_CONFIG = { childList: true, subtree: true };

    /** @type {MutationObserver|null} */
    let observer = null;

    /**
     * Callback invoked (debounced) when DOM mutations are detected.
     * Checks if the chat header exists and triggers button injection.
     */
    const handleMutations = debounce(() => {
        const mainHeader = document.querySelector("#main header");
        if (mainHeader) {
            // Notify the injector module that a chat header is available
            if (
                typeof WAReminder !== "undefined" &&
                WAReminder.onChatHeaderDetected
            ) {
                WAReminder.onChatHeaderDetected(mainHeader);
            }
        }
    }, DEBOUNCE_MS);

    /**
     * Starts observing WhatsApp Web DOM for chat navigation changes.
     * @returns {void}
     */
    function startObserving() {
        // Find a stable root to observe
        const target = document.querySelector("#app") || document.body;

        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(handleMutations);
        observer.observe(target, OBSERVER_CONFIG);

        // Trigger an initial check in case a chat is already open
        handleMutations();
    }

    /**
     * Stops observing DOM mutations.
     * @returns {void}
     */
    function stopObserving() {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    }

    // Expose on global namespace for content script communication
    window.WAReminder = window.WAReminder || {};
    window.WAReminder.startObserving = startObserving;
    window.WAReminder.stopObserving = stopObserving;

    // Auto-start observation
    startObserving();
})();
