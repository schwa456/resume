/**
 * Edit mode · activated only on localhost with ?edit=1
 * · makes key prose blocks contenteditable
 * · floating toolbar with Save / Discard
 * · Save POSTs full HTML to /save → server writes file + git commit + push
 */

(function () {
    "use strict";

    const params = new URLSearchParams(location.search);
    const EDIT = params.get("edit") === "1";
    const HOST = location.hostname;
    const IS_LOCAL = HOST === "localhost" || HOST === "127.0.0.1" || HOST === "";

    if (!EDIT || !IS_LOCAL) return;

    /* Targets: headings, paragraphs, and list items in prose zones.
       We leave navigation, tool chips, and data blocks alone. */
    const EDITABLE_SELECTORS = [
        ".slide-h",
        ".slide-sub",
        ".slide-kind",
        ".cover-intro",
        ".cover-name",
        ".cover-role",
        ".cover-hero p",
        ".cl-salute",
        ".cl-lead",
        ".cover-letter p",
        ".cl-sign",
        ".rs-title",
        ".rs-block h4",
        ".rs-edu strong",
        ".rs-edu em",
        ".rs-list li",
        ".ring-name",
        ".tool span:last-child",
        ".tool-chip span:last-child",
        ".f-date",
        ".f-info h3",
        ".f-info > p",
        ".f-detail-block p",
        ".f-sub-title",
        ".f-sub-body",
        ".f-sub-meta span:last-child",
        ".featured-sub-h",
        ".featured-sub-kind",
        ".letter-num em",
        ".letter-lead",
        ".letter-body p",
        ".port-tag-inline",
        ".port-files-strip .pf-name",
        ".pv-mark",
        ".f-cover-tag",
        ".f-file-label",
        ".closing-kicker",
        ".closing-contact li",
        ".closing-thanks",
        ".closing-sign"
    ];

    const toolbar = document.createElement("div");
    toolbar.id = "edit-toolbar";
    toolbar.innerHTML = `
        <style>
            #edit-toolbar {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                background: #0f0f0e;
                color: #fff;
                border-radius: 99px;
                padding: 10px 16px;
                font-family: -apple-system, "Pretendard Variable", sans-serif;
                font-size: 13px;
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            }
            #edit-toolbar button {
                background: transparent;
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 99px;
                padding: 6px 14px;
                font: inherit;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            #edit-toolbar button:hover {
                background: #fff;
                color: #0f0f0e;
                border-color: #fff;
            }
            #edit-toolbar .et-save {
                background: #1D4ED8;
                border-color: #1D4ED8;
            }
            #edit-toolbar .et-save:hover {
                background: #1e3a8a;
                border-color: #1e3a8a;
                color: #fff;
            }
            #edit-toolbar .et-status {
                font-family: "JetBrains Mono", ui-monospace, monospace;
                font-size: 11px;
                letter-spacing: 0.05em;
                color: #9ca3af;
                min-width: 120px;
            }
            [data-edit-on="true"] {
                outline: 1px dashed rgba(29, 78, 216, 0.25);
                outline-offset: 4px;
                border-radius: 2px;
                transition: outline-color 0.2s ease;
            }
            [data-edit-on="true"]:hover {
                outline-color: rgba(29, 78, 216, 0.5);
            }
            [data-edit-on="true"]:focus {
                outline: 2px solid #1D4ED8;
                outline-offset: 4px;
                background: rgba(219, 234, 254, 0.3);
            }
        </style>
        <span class="et-label">✎ Edit Mode</span>
        <span class="et-status" id="et-status">idle</span>
        <button class="et-discard" title="변경 취소하고 새로고침">취소</button>
        <button class="et-save" title="변경사항을 저장하고 커밋·푸시">저장 → 배포</button>
    `;

    const activate = () => {
        const seen = new Set();
        EDITABLE_SELECTORS.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                if (seen.has(el)) return;
                if (el.closest("#edit-toolbar")) return;
                seen.add(el);
                el.setAttribute("contenteditable", "true");
                el.setAttribute("data-edit-on", "true");
                el.setAttribute("spellcheck", "false");
            });
        });
    };

    const setStatus = (text, isErr) => {
        const s = toolbar.querySelector("#et-status");
        if (s) {
            s.textContent = text;
            s.style.color = isErr ? "#fca5a5" : "#9ca3af";
        }
    };

    const cleanForSave = () => {
        /* Clone and strip edit-only attributes/UI before serialization. */
        const clone = document.documentElement.cloneNode(true);
        clone.querySelectorAll("[data-edit-on]").forEach((el) => {
            el.removeAttribute("contenteditable");
            el.removeAttribute("data-edit-on");
            el.removeAttribute("spellcheck");
        });
        const toolbarClone = clone.querySelector("#edit-toolbar");
        if (toolbarClone) toolbarClone.remove();
        return "<!DOCTYPE html>\n" + clone.outerHTML;
    };

    const save = async () => {
        setStatus("saving…");
        try {
            const html = cleanForSave();
            const res = await fetch("/save", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    html,
                    message: "편집 모드: 인라인 수정 저장"
                })
            });
            const data = await res.json();
            if (!res.ok || !data.ok) {
                setStatus("save failed", true);
                console.error("save failed:", data);
                alert("저장 실패\n" + (data.error || res.status) + "\n" + (data.stderr || ""));
                return;
            }
            if (data.committed === false) {
                setStatus("no changes");
            } else {
                setStatus("pushed ✓ deploying");
            }
        } catch (err) {
            setStatus("save error", true);
            console.error(err);
            alert("저장 중 오류: " + err.message);
        }
    };

    const discard = () => {
        if (confirm("모든 변경을 버리고 새로고침할까요?")) {
            location.reload();
        }
    };

    document.addEventListener("DOMContentLoaded", () => {
        activate();
        document.body.appendChild(toolbar);
        toolbar.querySelector(".et-save").addEventListener("click", save);
        toolbar.querySelector(".et-discard").addEventListener("click", discard);

        /* Keyboard shortcut: Ctrl/Cmd + S */
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                save();
            }
        });

        /* Warn on unload if there are edits */
        let dirty = false;
        document.addEventListener("input", (e) => {
            if (e.target.closest("[data-edit-on]")) {
                dirty = true;
                setStatus("dirty");
            }
        }, true);
        window.addEventListener("beforeunload", (e) => {
            if (dirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        });
    });
})();
