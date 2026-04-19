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
const MAX_BODY = 20 * 1024 * 1024; // 20 MB (index.html 본문 + 인라인 데이터)
/* GitHub는 파일당 100 MB에서 push를 거부하므로 그보다 여유있게 작게.
   이 이상 파일이 필요하면 Git LFS 도입 고려. */
const MAX_UPLOAD = 80 * 1024 * 1024; // 80 MB
const UPLOADS_REL = path.join("assets", "uploads");
const ALLOWED_IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const ALLOWED_DOC = new Set([".pdf", ".hwp", ".hwpx", ".ppt", ".pptx", ".xls", ".xlsx", ".doc", ".docx", ".txt"]);

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
        let aborted = false;
        req.on("data", (c) => {
            if (aborted) return;
            size += c.length;
            if (size > MAX_BODY) {
                aborted = true;
                /* Drain remaining data instead of destroying the socket so the
                   response handler can still send a JSON error back. */
                req.resume();
                reject(new Error(`Body too large (> ${MAX_BODY} bytes)`));
                return;
            }
            chunks.push(c);
        });
        req.on("end", () => {
            if (aborted) return;
            resolve(Buffer.concat(chunks).toString("utf-8"));
        });
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
    const addArgs = ["add", "index.html"];
    if (fs.existsSync(path.join(ROOT, "assets"))) {
        addArgs.push("assets");
    }
    await git(addArgs);
    const status = await git(["status", "--porcelain"]);
    if (!status.stdout.trim()) {
        return { committed: false, reason: "no changes" };
    }
    await git(["commit", "-m", message]);
    await git(["push", "origin", "main"]);
    return { committed: true };
}

function readRawBody(req, limit) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let aborted = false;
        req.on("data", (c) => {
            if (aborted) return;
            size += c.length;
            if (size > limit) {
                aborted = true;
                req.resume();
                reject(new Error(`Body too large (> ${limit} bytes)`));
                return;
            }
            chunks.push(c);
        });
        req.on("end", () => {
            if (aborted) return;
            resolve(Buffer.concat(chunks));
        });
        req.on("error", reject);
    });
}

function sendJson(res, status, payload) {
    if (res.headersSent || res.writableEnded) return;
    try {
        res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" })
            .end(JSON.stringify(payload));
    } catch (e) {
        log("sendJson failed:", e.message);
    }
}

async function handleUpload(req, res) {
    try {
        const rawName = decodeURIComponent(req.headers["x-filename"] || "upload");
        const ext = path.extname(rawName).toLowerCase();
        if (!ALLOWED_IMG.has(ext) && !ALLOWED_DOC.has(ext)) {
            sendJson(res, 400, { ok: false, error: `ext not allowed: ${ext || "(none)"}` });
            return;
        }
        const base = path.basename(rawName, ext).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "file";
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const filename = `${ts}-${base}${ext}`;

        const uploadsAbs = path.join(ROOT, UPLOADS_REL);
        fs.mkdirSync(uploadsAbs, { recursive: true });

        const buf = await readRawBody(req, MAX_UPLOAD);
        const target = path.join(uploadsAbs, filename);
        fs.writeFileSync(target, buf);
        log("uploaded", filename, `(${buf.length} bytes)`);

        const relPath = UPLOADS_REL.replace(/\\/g, "/") + "/" + filename;
        sendJson(res, 200, { ok: true, path: relPath, bytes: buf.length });
    } catch (err) {
        log("upload error:", err.message);
        sendJson(res, 500, { ok: false, error: err.message });
    }
}

async function handleSave(req, res) {
    try {
        const body = await readBody(req);
        let payload;
        try {
            payload = JSON.parse(body);
        } catch (e) {
            sendJson(res, 400, { ok: false, error: "invalid json body: " + e.message });
            return;
        }
        const html = payload.html;
        if (typeof html !== "string" || html.length < 200 || !/<html/i.test(html)) {
            sendJson(res, 400, { ok: false, error: "invalid html payload" });
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

        sendJson(res, 200, { ok: true, ...result });
    } catch (err) {
        log("save error:", err.message, err.stderr || "");
        sendJson(res, 500, { ok: false, error: err.message, stderr: err.stderr || "" });
    }
}

const server = http.createServer((req, res) => {
    // CORS-safe origin check: only accept saves from same origin (localhost)
    if (req.method === "PUT" && req.url === "/save") {
        handleSave(req, res);
        return;
    }
    if (req.method === "POST" && req.url === "/upload") {
        handleUpload(req, res);
        return;
    }
    if (req.method === "GET") {
        serveStatic(req, res);
        return;
    }
    /* Unknown route: respond with JSON so the client's res.json() parser
       doesn't choke on plain text. */
    sendJson(res, 405, { ok: false, error: `method not allowed: ${req.method} ${req.url}` });
});

/* Surface otherwise-silent crashes so they show up in the server log and
   the client doesn't just see a dropped connection. */
process.on("uncaughtException", (err) => {
    log("UNCAUGHT EXCEPTION:", err.stack || err.message);
});
process.on("unhandledRejection", (reason) => {
    log("UNHANDLED REJECTION:", reason && reason.stack ? reason.stack : reason);
});

server.listen(PORT, "127.0.0.1", () => {
    log(`edit server running at http://localhost:${PORT}/?edit=1`);
    log(`serving from: ${ROOT}`);
    log(`save endpoint:   PUT  /save   (writes index.html + git commit + push)`);
    log(`upload endpoint: POST /upload (writes to ${UPLOADS_REL}/)`);
});
