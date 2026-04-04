const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs/promises");
const { extensionPath } = require("./helpers/paths");

// DRY helpers
async function loadManifest() {
    const manifestPath = path.join(extensionPath, "manifest.json");
    return JSON.parse(await fs.readFile(manifestPath, "utf8"));
}

async function loadMessages() {
    const manifest = await loadManifest();
    const messagesPath = path.join(
        extensionPath,
        `_locales/${manifest.default_locale}/messages.json`,
    );
    return JSON.parse(await fs.readFile(messagesPath, "utf8"));
}

test.describe("WAReminder Extension Validation", () => {
    test("should have valid manifest", async () => {
        const manifest = await loadManifest();
        expect(manifest.manifest_version).toBe(3);
        expect(manifest.name).toBeDefined();
        expect(manifest.default_locale).toBeDefined();
        expect(manifest.background?.service_worker).toBeDefined();
    });

    test("should have valid localized messages", async () => {
        const messages = await loadMessages();
        expect(Object.keys(messages).length).toBeGreaterThan(0);
    });

    test("should have valid i18n placeholder references", async () => {
        const messages = await loadMessages();
        const placeholderRegex = /\$([A-Z0-9_]+)\$/g;
        const errors = [];

        await test.step("Iterate over all messages", async () => {
            for (const [keyName, messageObj] of Object.entries(messages)) {
                await test.step(`Check message: ${keyName}`, async () => {
                    expect(typeof messageObj, `Message ${keyName} should be an object`).toBe("object");
                    expect(messageObj.message, `Message ${keyName} should have a 'message' property`).toBeDefined();

                    const message = messageObj.message;
                    let referencedPlaceholders;
                    await test.step("Extract referenced placeholders", async () => {
                        referencedPlaceholders = new Set();
                        let matches;
                        while ((matches = placeholderRegex.exec(message)) !== null) {
                            referencedPlaceholders.add(matches[1]);
                        }
                    });

                    let definedPlaceholders;
                    await test.step("Extract defined placeholders", async () => {
                        definedPlaceholders = Object.keys(messageObj.placeholders || {});
                    });

                    for (const placeholder of referencedPlaceholders) {
                        await test.step(`Validate placeholder: $${placeholder}$`, async () => {
                            const defined = isPlaceholderDefined(placeholder, definedPlaceholders, messageObj);
                            if (!defined) {
                                errors.push(
                                    `[${keyName}] Placeholder $${placeholder}$ used but not defined in placeholders object`,
                                );
                            }
                        });
                    }
                });
            }
        });

        await test.step("Assert no i18n placeholder errors", async () => {
            expect(errors, "No i18n placeholder errors").toEqual([]);
        });
    });
});

// Extracted validation logic
function isPlaceholderDefined(placeholder, definedPlaceholders, messageObj) {
    const isNumeric = /^\d+$/.test(placeholder);
    const placeholderKey = isNumeric ? `$${placeholder}` : placeholder.toLowerCase();
    if (isNumeric) {
        return definedPlaceholders.some(
            (key) => {
                const placeholderObj = messageObj.placeholders[key];
                return placeholderObj && placeholderObj.content === placeholderKey;
            }
        );
    } else {
        return definedPlaceholders.some(
            (key) => key.toLowerCase() === placeholderKey,
        );
    }
}