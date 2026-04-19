/**
 * Vercel serverless function — /api/ping
 *
 * Sends an email via Resend when someone opens the portfolio.
 * Client-side throttles calls with a 1h cookie; this endpoint
 * is a best-effort trigger (no persistence, no visitor tracking).
 *
 * Required env vars (set in Vercel Project Settings):
 *   RESEND_API_KEY   — from https://resend.com/api-keys
 *   NOTIFY_EMAIL     — inbox to receive the alert (e.g. hevem@naver.com)
 *   NOTIFY_FROM      — verified sender (e.g. "Portfolio <alerts@yourdomain>")
 *                      or fallback to "onboarding@resend.dev" while testing
 */

export const config = {
    runtime: "nodejs"
};

export default async function handler(req, res) {
    if (req.method !== "POST" && req.method !== "GET") {
        res.status(405).json({ ok: false, error: "method not allowed" });
        return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.NOTIFY_EMAIL;
    const from = process.env.NOTIFY_FROM || "Portfolio Alerts <onboarding@resend.dev>";

    if (!apiKey || !to) {
        res.status(500).json({ ok: false, error: "missing env: RESEND_API_KEY or NOTIFY_EMAIL" });
        return;
    }

    const ua = req.headers["user-agent"] || "unknown";
    const ref = req.headers["referer"] || "direct";
    const ip = (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() || "n/a";
    const nowKst = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

    /* Very conservative: strip any HTML-unsafe chars before echoing back */
    const safe = (s) => String(s).replace(/[<>]/g, "").slice(0, 400);

    const subject = "[포트폴리오] 누군가 페이지를 열었습니다";
    const html = `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;color:#0f0f0e;line-height:1.6;">
            <h2 style="font-family:serif;font-weight:500;margin:0 0 12px;">포트폴리오 페이지 조회 알림</h2>
            <p style="margin:0 0 16px;color:#555;">누군가 포트폴리오를 열람했습니다.</p>
            <table style="border-collapse:collapse;font-size:13px;">
                <tr><td style="padding:4px 12px 4px 0;color:#888;">시각</td><td style="padding:4px 0;">${safe(nowKst)} (KST)</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#888;">Referer</td><td style="padding:4px 0;">${safe(ref)}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#888;">User-Agent</td><td style="padding:4px 0;">${safe(ua)}</td></tr>
                <tr><td style="padding:4px 12px 4px 0;color:#888;">IP(참고)</td><td style="padding:4px 0;">${safe(ip)}</td></tr>
            </table>
            <p style="margin:24px 0 0;color:#aaa;font-size:11px;">같은 방문자에게는 1시간에 한 번만 알림이 갑니다.</p>
        </div>
    `;
    const text = `포트폴리오 페이지 조회\n시각: ${nowKst} (KST)\nReferer: ${ref}\nUser-Agent: ${ua}\nIP: ${ip}`;

    try {
        const resp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ from, to, subject, html, text })
        });

        if (!resp.ok) {
            const errBody = await resp.text();
            res.status(502).json({ ok: false, error: "resend failed", status: resp.status, body: errBody });
            return;
        }

        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
}
