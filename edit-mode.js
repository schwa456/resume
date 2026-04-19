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
            [data-image-slot="true"] {
                cursor: pointer;
                position: relative;
            }
            [data-image-slot="true"]::after {
                content: "⬆ 이미지 업로드";
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(15, 15, 14, 0.78);
                color: #fff;
                font-family: "JetBrains Mono", ui-monospace, monospace;
                font-size: 10px;
                letter-spacing: 0.06em;
                padding: 4px 9px;
                border-radius: 99px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.18s ease;
                z-index: 10;
            }
            [data-image-slot="true"]:hover::after {
                opacity: 1;
            }
            [data-image-slot="true"]:hover {
                outline: 2px dashed rgba(29, 78, 216, 0.55);
                outline-offset: 2px;
            }
            [data-edit-img="true"] {
                outline: 1px dashed rgba(29, 78, 216, 0.35);
                outline-offset: 3px;
                cursor: pointer;
            }
            [data-edit-img="true"]:hover {
                outline: 2px solid #1D4ED8;
            }
            [data-file-slot="true"] {
                position: relative;
            }
            [data-file-slot="true"]:hover {
                outline: 2px dashed rgba(29, 78, 216, 0.55);
                outline-offset: 2px;
            }
        </style>
        <span class="et-label">✎ Edit Mode</span>
        <span class="et-status" id="et-status">idle</span>
        <button class="et-image" title="포커스된 블록에 이미지 삽입">+ 이미지</button>
        <button class="et-doc" title="포커스된 파일 링크 교체 / 포커스된 블록에 파일 링크 삽입">+ 파일</button>
        <button class="et-discard" title="변경 취소하고 새로고침">취소</button>
        <button class="et-save" title="변경사항을 저장하고 커밋·푸시">저장 → 배포</button>
    `;

    /* Image slots: clickable areas that get their background replaced with an uploaded image. */
    const IMAGE_SLOT_SELECTORS = [
        ".portrait-frame",  /* cover 페이지의 "H" 이니셜 영역 */
        ".f-cover",         /* Career/Archive/Portfolio 커버 박스 (C01–C04, A01–A04, P01–P04, W01–W02) */
        ".f-cover-photo"    /* 기존 사진 포함 커버 (이미지 교체용) */
    ];

    /* File (document) slots: anchors that point to downloadable files. */
    const FILE_SLOT_SELECTORS = [
        "a.port-file",
        "a.f-file-chip",
        "a[data-file]"
    ];

    const BADGE_MAP = {
        pdf: "pf-pdf",
        xls: "pf-xlsx",
        xlsx: "pf-xlsx",
        ppt: "pf-pptx",
        pptx: "pf-pptx",
        hwp: "pf-hwp",
        hwpx: "pf-hwp",
        doc: "pf-doc",
        docx: "pf-doc",
        txt: "pf-txt"
    };
    const BADGE_CLASSES = new Set(Object.values(BADGE_MAP));

    /* Track the last contenteditable element the user clicked/focused
       — we insert images into it when the toolbar button is pressed. */
    let lastFocused = null;
    /* If set, next upload replaces this element's contents instead of inserting. */
    let pendingSlot = null;
    /* Upload mode: "image" or "doc" — decides which file input opens and how result is applied. */
    let pendingMode = "image";
    let dirtyRef = { value: false };

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

        /* Mark every image slot so user can click to upload/replace. */
        const slotSeen = new Set();
        IMAGE_SLOT_SELECTORS.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                if (slotSeen.has(el)) return;
                if (el.closest("#edit-toolbar")) return;
                slotSeen.add(el);
                el.setAttribute("data-image-slot", "true");
                el.addEventListener("click", (ev) => {
                    /* Ignore clicks on contenteditable children (e.g. captions). */
                    if (ev.target !== el && ev.target.closest("[data-edit-on]")) return;
                    pendingSlot = el;
                    pendingMode = "image";
                    imageInput.click();
                });
            });
        });

        /* Existing <img> elements — clicking one replaces its src. */
        document.querySelectorAll("img").forEach((img) => {
            if (img.closest("#edit-toolbar")) return;
            img.setAttribute("data-edit-img", "true");
            img.addEventListener("click", (ev) => {
                ev.stopPropagation();
                pendingSlot = img;
                pendingMode = "image";
                imageInput.click();
            });
        });

        /* File slots: clicking a file-link anchor opens a file picker to replace it. */
        const fileSeen = new Set();
        FILE_SLOT_SELECTORS.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                if (fileSeen.has(el)) return;
                if (el.closest("#edit-toolbar")) return;
                fileSeen.add(el);
                el.setAttribute("data-file-slot", "true");
                el.addEventListener("click", (ev) => {
                    /* Prevent the anchor from navigating in edit mode. */
                    ev.preventDefault();
                    ev.stopPropagation();
                    pendingSlot = el;
                    pendingMode = "doc";
                    docInput.click();
                });
            });
        });
    };

    /* Hidden file inputs + upload helper. Created once, reused. */
    const imageInput = document.createElement("input");
    imageInput.type = "file";
    imageInput.accept = "image/*";
    imageInput.style.display = "none";
    document.documentElement.appendChild(imageInput);

    const docInput = document.createElement("input");
    docInput.type = "file";
    docInput.accept = ".pdf,.hwp,.hwpx,.ppt,.pptx,.xls,.xlsx,.doc,.docx,.txt";
    docInput.style.display = "none";
    document.documentElement.appendChild(docInput);

    const uploadFile = async (file) => {
        const buf = await file.arrayBuffer();
        const res = await fetch("/upload", {
            method: "POST",
            headers: {
                "Content-Type": file.type || "application/octet-stream",
                "X-Filename": encodeURIComponent(file.name)
            },
            body: buf
        });
        return res.json();
    };

    const extOf = (name) => {
        const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
        return m ? m[1] : "";
    };

    const applyImage = (uploadedPath, originalName) => {
        if (pendingSlot instanceof HTMLImageElement) {
            pendingSlot.src = uploadedPath;
            return;
        }
        if (pendingSlot && pendingSlot.hasAttribute("data-image-slot")) {
            /* Replace slot contents with a cover-fit image, stripping any placeholder text. */
            pendingSlot.innerHTML = `<img src="${uploadedPath}" alt="${originalName}" data-edit-img="true" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;">`;
            const injected = pendingSlot.querySelector("img");
            if (injected) {
                injected.addEventListener("click", (ev) => {
                    ev.stopPropagation();
                    pendingSlot = injected;
                    pendingMode = "image";
                    imageInput.click();
                });
            }
            return;
        }
        if (lastFocused) {
            const img = document.createElement("img");
            img.src = uploadedPath;
            img.alt = originalName;
            img.setAttribute("data-edit-img", "true");
            img.style.maxWidth = "100%";
            img.style.display = "block";
            img.style.margin = "12px 0";
            lastFocused.appendChild(img);
            return;
        }
        alert("이미지를 삽입할 블록을 먼저 클릭하세요.\n또는 이미지 영역(점선 박스)을 클릭해서 교체하세요.");
    };

    const applyDoc = (uploadedPath, originalName) => {
        const ext = extOf(originalName);
        const badgeClass = BADGE_MAP[ext] || "pf-doc";

        const setAnchor = (a) => {
            a.setAttribute("href", uploadedPath);
            a.setAttribute("download", originalName);
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener");
            a.setAttribute("data-file", originalName);
            /* Update badge class if present */
            const badge = a.querySelector(".pf-badge");
            if (badge) {
                BADGE_CLASSES.forEach((c) => badge.classList.remove(c));
                badge.classList.add(badgeClass);
                badge.textContent = ext.toUpperCase();
            }
            /* Update file name text if present */
            const nameEl = a.querySelector(".pf-name, .f-file-name");
            if (nameEl) nameEl.textContent = originalName;
        };

        if (pendingSlot instanceof HTMLAnchorElement) {
            setAnchor(pendingSlot);
            return;
        }
        if (lastFocused) {
            const a = document.createElement("a");
            a.textContent = originalName;
            a.className = "link";
            setAnchor(a);
            lastFocused.appendChild(document.createTextNode(" "));
            lastFocused.appendChild(a);
            return;
        }
        alert("파일 링크를 교체할 기존 파일 칩을 클릭하거나,\n링크를 삽입할 텍스트 블록을 먼저 클릭하세요.");
    };

    const handleUpload = async (file, mode) => {
        if (!file) return;
        setStatus(`uploading ${file.name}…`);
        try {
            const data = await uploadFile(file);
            if (!data.ok) {
                setStatus("upload failed", true);
                alert("업로드 실패: " + (data.error || "unknown"));
                return;
            }
            if (mode === "image") {
                applyImage(data.path, file.name);
            } else {
                applyDoc(data.path, file.name);
            }
            dirtyRef.value = true;
            setStatus(`added ${file.name.slice(0, 18)}… · save to deploy`);
        } catch (err) {
            setStatus("upload error", true);
            console.error(err);
            alert("업로드 중 오류: " + err.message);
        } finally {
            pendingSlot = null;
        }
    };

    imageInput.addEventListener("change", (e) => {
        const f = e.target.files[0];
        e.target.value = "";
        handleUpload(f, "image");
    });
    docInput.addEventListener("change", (e) => {
        const f = e.target.files[0];
        e.target.value = "";
        handleUpload(f, "doc");
    });

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
        clone.querySelectorAll("[data-image-slot]").forEach((el) => {
            el.removeAttribute("data-image-slot");
        });
        clone.querySelectorAll("[data-edit-img]").forEach((el) => {
            el.removeAttribute("data-edit-img");
        });
        clone.querySelectorAll("[data-file-slot]").forEach((el) => {
            el.removeAttribute("data-file-slot");
        });
        const toolbarClone = clone.querySelector("#edit-toolbar");
        if (toolbarClone) toolbarClone.remove();
        /* Hidden file inputs appended to <html> — strip them. */
        clone.querySelectorAll('input[type="file"]').forEach((el) => {
            if (el.style && el.style.display === "none") el.remove();
        });
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
        toolbar.querySelector(".et-image").addEventListener("click", () => {
            pendingSlot = null;
            pendingMode = "image";
            imageInput.click();
        });
        toolbar.querySelector(".et-doc").addEventListener("click", () => {
            pendingSlot = null;
            pendingMode = "doc";
            docInput.click();
        });

        /* Track the last focused editable block so "+ 이미지/파일" buttons know
           where to insert when no slot is explicitly selected. */
        document.addEventListener("focusin", (e) => {
            const editable = e.target.closest("[data-edit-on]");
            if (editable) lastFocused = editable;
        });

        /* Keyboard shortcut: Ctrl/Cmd + S */
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                save();
            }
        });

        /* Warn on unload if there are edits */
        document.addEventListener("input", (e) => {
            if (e.target.closest("[data-edit-on]")) {
                dirtyRef.value = true;
                setStatus("dirty");
            }
        }, true);
        window.addEventListener("beforeunload", (e) => {
            if (dirtyRef.value) {
                e.preventDefault();
                e.returnValue = "";
            }
        });
    });
})();
