/**
 * Simple static file server for Playwright tests.
 * Serves the project root so popup.html can load popup.js and constants.js
 * via ES module imports over HTTP (file:// protocol blocks ES modules in Chromium).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.TEST_SERVER_PORT || "4321", 10);
const ROOT = path.resolve(__dirname, "..");

const MIME_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
    const urlPath = req.url.split("?")[0];
    const filePath = path.join(ROOT, urlPath);

    // Prevent path traversal
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "text/plain";

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        res.writeHead(200, { "Content-Type": mimeType });
        res.end(content);
    });
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`Test server running at http://127.0.0.1:${PORT}`);
});
