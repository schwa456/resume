/**
 * Local edit server — serves v2/ on http://localhost:4173
 * and accepts PUT /save to write index.html back to disk,
 * then auto-commits + pushes to GitHub (Vercel auto-deploys).
 *
 * Run: node tools/edit-server.js
 * Then open: http://localhost:4173/?edit=1
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const PORT = process.env.EDIT_PORT ? Number(process.env.EDIT_PORT) : 4173;
const MAX_BODY = 5 * 1024 * 1024; // 5 MB

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css":  "text/css; charset=utf-8",
    ".js":   "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg":  "image/svg+xml",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico":  "image/x-icon",
    ".woff2":"font/woff2",
    ".woff": "font/woff"
};

function log(...args) {
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`[${ts}]`, ...args);
}

function safeResolve(urlPath) {
    const decoded = decodeURIComponent(urlPath.split("?")[0]);
    const rel = decoded === "/" ? "/index.html" : decoded;
    const abs = path.normalize(path.join(ROOT, rel));
    if (!abs.startsWith(ROOT)) return null;
    return abs;
}

function serveStatic(req, res) {
    const abs = safeResolve(req.url);
    if (!abs) {
        res.writeHead(403).end("Forbidden");
        return;
    }
    fs.stat(abs, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404).end("Not Found");
            return;
        }
        const mime = MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
        res.writeHead(200, {
            "Content-Type": mime,
            "Cache-Control": "no-store"
        });
        fs.createReadStream(abs).pipe(res);
    });
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (c) => {
            size += c.length;
            if (size > MAX_BODY) {
                reject(new Error("Body too large"));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        req.on("error", reject);
    });
}

function git(args) {
    return new Promise((resolve, reject) => {
        execFile("git", args, { cwd: ROOT }, (err, stdout, stderr) => {
            if (err) {
                err.stdout = stdout;
                err.stderr = stderr;
                reject(err);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

async function commitAndPush(message) {
    await git(["add", "index.html"]);
    const status = await git(["status", "--porcelain"]);
    if (!status.stdout.trim()) {
        return { committed: false, reason: "no changes" };
    }
    await git(["commit", "-m", message]);
    await git(["push", "origin", "main"]);
    return { committed: true };
}

async function handleSave(req, res) {
    try {
        const body = await readBody(req);
        const payload = JSON.parse(body);
        const html = payload.html;
        if (typeof html !== "string" || html.length < 200 || !/<html/i.test(html)) {
            res.writeHead(400, { "Content-Type": "application/json" })
                .end(JSON.stringify({ ok: false, error: "invalid html payload" }));
            return;
        }
        const target = path.join(ROOT, "index.html");
        fs.writeFileSync(target, html, "utf-8");
        log("wrote", target, `(${html.length} bytes)`);

        const message = payload.message || "편집 모드: 인라인 수정 저장";
        const result = await commitAndPush(
            `${message}\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
        );
        log("commit result:", result);

        res.writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify({ ok: true, ...result }));
    } catch (err) {
        log("save error:", err.message, err.stderr || "");
        res.writeHead(500, { "Content-Type": "application/json" })
            .end(JSON.stringify({ ok: false, error: err.message, stderr: err.stderr || "" }));
    }
}

const server = http.createServer((req, res) => {
    // CORS-safe origin check: only accept saves from same origin (localhost)
    if (req.method === "PUT" && req.url === "/save") {
        handleSave(req, res);
        return;
    }
    if (req.method === "GET") {
        serveStatic(req, res);
        return;
    }
    res.writeHead(405).end("Method Not Allowed");
});

server.listen(PORT, "127.0.0.1", () => {
    log(`edit server running at http://localhost:${PORT}/?edit=1`);
    log(`serving from: ${ROOT}`);
    log(`save endpoint: PUT /save (writes index.html + git commit + push)`);
});
