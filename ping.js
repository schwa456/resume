/**
 * View-ping client · 1h cookie throttle
 * Skips localhost/preview, crawler UAs, and edit mode.
 */
(function () {
    "use strict";

    const host = location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
    const isEdit = new URLSearchParams(location.search).get("edit") === "1";
    if (isLocal || isEdit) return;

    /* Skip obvious bots */
    const ua = navigator.userAgent || "";
    if (/bot|crawl|spider|preview|Slackbot|Twitterbot|facebookexternalhit|Discordbot|Applebot/i.test(ua)) return;

    /* 1h cookie throttle */
    const COOKIE = "pf_pinged";
    const has = document.cookie.split("; ").some((c) => c.startsWith(COOKIE + "="));
    if (has) return;

    const expires = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
    document.cookie = `${COOKIE}=1; expires=${expires}; path=/; SameSite=Lax`;

    /* Fire-and-forget; ignore failures silently */
    const send = () => {
        try {
            fetch("/api/ping", {
                method: "POST",
                keepalive: true,
                headers: { "Content-Type": "application/json" },
                body: "{}"
            }).catch(() => {});
        } catch (_) { /* noop */ }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", send);
    } else {
        send();
    }
})();
