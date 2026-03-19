const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs/promises");

const extensionPath = path.join(__dirname, "../../src");

test.describe("WAReminder Extension Validation", () => {
    test("should have valid manifest", async () => {
        const manifestPath = path.join(extensionPath, "manifest.json");
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

        expect(manifest.manifest_version).toBe(3);
        expect(manifest.name).toBeDefined();
        expect(manifest.default_locale).toBeDefined();
        expect(manifest.background?.service_worker).toBeDefined();
    });

    test("should have valid localized messages", async () => {
        const manifestPath = path.join(extensionPath, "manifest.json");
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

        const messagesPath = path.join(
            extensionPath,
            `_locales/${manifest.default_locale}/messages.json`,
        );
        const messages = JSON.parse(await fs.readFile(messagesPath, "utf8"));

        expect(Object.keys(messages).length).toBeGreaterThan(0);
    });

    test("should have valid i18n placeholder references", async () => {
        const manifestPath = path.join(extensionPath, "manifest.json");
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

        const messagesPath = path.join(
            extensionPath,
            `_locales/${manifest.default_locale}/messages.json`,
        );
        const messages = JSON.parse(await fs.readFile(messagesPath, "utf8"));

        const placeholderRegex = /\$([A-Z0-9_]+)\$/g;
        const errors = [];

        for (const [keyName, messageObj] of Object.entries(messages)) {
            if (typeof messageObj !== "object" || !messageObj.message) {
                continue;
            }

            const message = messageObj.message;
            const definedPlaceholders = Object.keys(
                messageObj.placeholders || {},
            );

            let matches;
            const referencedPlaceholders = new Set();
            while ((matches = placeholderRegex.exec(message)) !== null) {
                referencedPlaceholders.add(matches[1]);
            }

            for (const placeholder of referencedPlaceholders) {
                // Check both named placeholders (CONTACT, TIME) and numeric placeholders ($1, $2)
                const isNumeric = /^\d+$/.test(placeholder);
                const placeholderKey = isNumeric ? `$${placeholder}` : placeholder.toLowerCase();
                
                const defined = isNumeric 
                    ? definedPlaceholders.some(
                        (key) => {
                            const placeholderObj = messageObj.placeholders[key];
                            return placeholderObj && placeholderObj.content === placeholderKey;
                        }
                    )
                    : definedPlaceholders.some(
                        (key) => key.toLowerCase() === placeholderKey,
                    );

                if (!defined) {
                    errors.push(
                        `[${keyName}] Placeholder $${placeholder}$ used but not defined in placeholders object`,
                    );
                }
            }
        }

        expect(errors, "No i18n placeholder errors").toEqual([]);
    });
});
