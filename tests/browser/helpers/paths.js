const path = require("path");
const extensionPath = path.join(__dirname, "../../../src");
const popupUrl = `file://${path.resolve(__dirname, "../../../src/popup/popup.html")}`;

module.exports = { extensionPath, popupUrl };