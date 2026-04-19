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
            .edit-drag-over {
                outline: 2px solid #1D4ED8 !important;
                outline-offset: 3px;
                background-color: rgba(29, 78, 216, 0.08) !important;
                transition: outline 0.1s ease, background-color 0.1s ease;
            }
            #edit-drop-veil {
                position: fixed;
                inset: 0;
                z-index: 99997;
                background: rgba(29, 78, 216, 0.06);
                border: 3px dashed rgba(29, 78, 216, 0.45);
                pointer-events: none;
                display: none;
            }
            #edit-drop-veil.is-on { display: block; }
            #edit-drop-veil::after {
                content: "파일을 드롭해서 업로드";
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #0f0f0e;
                color: #fff;
                padding: 10px 18px;
                border-radius: 99px;
                font-family: "JetBrains Mono", ui-monospace, monospace;
                font-size: 12px;
                letter-spacing: 0.05em;
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
        ".rs-portrait",     /* 이력서 프로필 사진 슬롯 (현재 H 이니셜 표시) */
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

    /* ---------- Drag-and-drop upload helpers ---------- */
    const IMG_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg"]);

    const detectMode = (file) => {
        if (file && file.type && file.type.startsWith("image/")) return "image";
        const m = String((file && file.name) || "").toLowerCase().match(/\.([a-z0-9]+)$/);
        return m && IMG_EXTS.has(m[1]) ? "image" : "doc";
    };

    const carriesFiles = (e) => {
        if (!e.dataTransfer) return false;
        const t = e.dataTransfer.types;
        if (!t) return false;
        /* DOMStringList doesn't have .includes() in all browsers */
        return Array.from(t).indexOf("Files") !== -1;
    };

    const bindDropTarget = (el, opts) => {
        if (el.dataset.editDropBound === "1") return;
        el.dataset.editDropBound = "1";
        el.addEventListener("dragenter", (e) => {
            if (!carriesFiles(e)) return;
            e.preventDefault();
            e.stopPropagation();
            el.classList.add("edit-drag-over");
        });
        el.addEventListener("dragover", (e) => {
            if (!carriesFiles(e)) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
        });
        el.addEventListener("dragleave", (e) => {
            /* Only clear when actually leaving the element (not entering a child). */
            if (el.contains(e.relatedTarget)) return;
            el.classList.remove("edit-drag-over");
        });
        el.addEventListener("drop", (e) => {
            if (!carriesFiles(e)) return;
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("edit-drag-over");
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (!file) return;
            pendingSlot = opts.slot || null;
            const mode = opts.mode === "auto" ? detectMode(file) : opts.mode;
            pendingMode = mode;
            handleUpload(file, mode);
        });
    };

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
                /* Drops on a text block insert an image/file at the focused location. */
                bindDropTarget(el, { slot: null, mode: "auto" });
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
                bindDropTarget(el, { slot: el, mode: "image" });
            });
        });

        /* Existing <img> elements — clicking one opens the edit popover
           (size · position · fit · replace · delete). Replace is deferred
           to the popover's "교체" button. */
        document.querySelectorAll("img").forEach((img) => {
            if (img.closest("#edit-toolbar")) return;
            if (img.closest("#img-edit-pop")) return;
            attachImgEditHandlers(img);
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
                bindDropTarget(el, { slot: el, mode: "doc" });
            });
        });
    };

    /* =====================================================================
       Image edit popover — size / object-position / object-fit / replace / delete.
       Opens when the user clicks any <img data-edit-img>.
       ===================================================================== */
    const imgEditPopover = document.createElement("div");
    imgEditPopover.id = "img-edit-pop";
    imgEditPopover.innerHTML = `
        <style>
            #img-edit-pop {
                position: absolute;
                z-index: 99998;
                background: #0f0f0e;
                color: #fff;
                padding: 14px 16px;
                border-radius: 14px;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.32);
                font-family: -apple-system, "Pretendard Variable", sans-serif;
                font-size: 12px;
                display: none;
                min-width: 220px;
                user-select: none;
            }
            #img-edit-pop.is-open { display: block; }
            #img-edit-pop .iep-row { margin-bottom: 12px; }
            #img-edit-pop .iep-row:last-child { margin-bottom: 0; }
            #img-edit-pop label {
                display: block;
                color: #9ca3af;
                font-family: "JetBrains Mono", ui-monospace, monospace;
                font-size: 10px;
                letter-spacing: 0.08em;
                margin-bottom: 6px;
                text-transform: uppercase;
            }
            #img-edit-pop .iep-value {
                color: #fff;
                font-family: "JetBrains Mono", ui-monospace, monospace;
                font-size: 10px;
                float: right;
                text-transform: none;
            }
            #img-edit-pop input[type=range] {
                width: 100%;
                accent-color: #1D4ED8;
            }
            #img-edit-pop .iep-grid {
                display: grid;
                grid-template-columns: repeat(3, 24px);
                grid-template-rows: repeat(3, 24px);
                gap: 4px;
            }
            #img-edit-pop .iep-grid button {
                background: transparent;
                border: 1px solid rgba(255, 255, 255, 0.22);
                border-radius: 4px;
                padding: 0;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            #img-edit-pop .iep-grid button:hover { background: rgba(255, 255, 255, 0.14); }
            #img-edit-pop .iep-grid button.active {
                background: #1D4ED8;
                border-color: #1D4ED8;
            }
            #img-edit-pop select {
                width: 100%;
                padding: 6px 8px;
                background: #1a1a18;
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 6px;
                font: inherit;
            }
            #img-edit-pop .iep-actions {
                display: flex;
                gap: 6px;
                margin-top: 6px;
            }
            #img-edit-pop .iep-actions button {
                flex: 1;
                background: transparent;
                color: #fff;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 8px;
                padding: 7px 10px;
                cursor: pointer;
                font: inherit;
                transition: all 0.15s ease;
            }
            #img-edit-pop .iep-actions button:hover { background: rgba(255, 255, 255, 0.12); }
            #img-edit-pop .iep-actions .iep-del {
                color: #fca5a5;
                border-color: rgba(252, 165, 165, 0.4);
            }
            #img-edit-pop .iep-actions .iep-del:hover {
                background: rgba(252, 165, 165, 0.15);
            }
            #img-edit-pop .iep-hint {
                color: #9ca3af;
                font-size: 10px;
                line-height: 1.4;
                margin-top: 2px;
            }
        </style>
        <div class="iep-row">
            <label>크기 <span class="iep-value" id="iep-w-val">100%</span></label>
            <input type="range" id="iep-width" min="20" max="100" step="5" value="100">
        </div>
        <div class="iep-row">
            <label>정렬 (포커스 위치)</label>
            <div class="iep-grid" id="iep-grid">
                <button type="button" data-pos="0% 0%"   title="좌상"></button>
                <button type="button" data-pos="50% 0%"  title="상단"></button>
                <button type="button" data-pos="100% 0%" title="우상"></button>
                <button type="button" data-pos="0% 50%"  title="좌측"></button>
                <button type="button" data-pos="50% 50%" class="active" title="중앙"></button>
                <button type="button" data-pos="100% 50%" title="우측"></button>
                <button type="button" data-pos="0% 100%"   title="좌하"></button>
                <button type="button" data-pos="50% 100%"  title="하단"></button>
                <button type="button" data-pos="100% 100%" title="우하"></button>
            </div>
            <p class="iep-hint">이미지 자체를 드래그해서 세밀하게 맞출 수도 있습니다.</p>
        </div>
        <div class="iep-row">
            <label>채우기 방식</label>
            <select id="iep-fit">
                <option value="cover">꽉 채우기 (cover)</option>
                <option value="contain">비율 유지 (contain)</option>
                <option value="fill">늘여서 채움 (fill)</option>
                <option value="none">원본 크기 (none)</option>
            </select>
        </div>
        <div class="iep-row iep-row-ratio">
            <label>프레임 비율</label>
            <select id="iep-ratio">
                <option value="">섹션 기본</option>
                <option value="1 / 1">1 : 1 (정사각)</option>
                <option value="4 / 3">4 : 3 (표준)</option>
                <option value="3 / 2">3 : 2 (가로형)</option>
                <option value="16 / 9">16 : 9 (와이드)</option>
                <option value="4 / 5">4 : 5 (세로형)</option>
                <option value="2 / 3">2 : 3 (책표지)</option>
            </select>
            <p class="iep-hint">같은 섹션 내 모든 이미지를 같은 비율로 맞추면 시선 정렬이 한결 깔끔해집니다.</p>
        </div>
        <div class="iep-actions">
            <button type="button" id="iep-replace">교체</button>
            <button type="button" id="iep-del" class="iep-del">삭제</button>
        </div>
    `;

    /* State for the popover's current target. */
    let activeImg = null;

    const isSlotImage = (img) => !!img && !!img.closest && !!img.closest("[data-image-slot]");

    const parsePos = (s) => {
        const m = String(s || "").match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
        return m ? [parseFloat(m[1]), parseFloat(m[2])] : [50, 50];
    };

    const parseScale = (s) => {
        const m = /scale\(([\d.]+)\)/.exec(String(s || ""));
        return m ? parseFloat(m[1]) : 1;
    };

    const openImgPopover = (img) => {
        activeImg = img;
        /* Populate controls from current inline styles. */
        const cs = window.getComputedStyle(img);
        const slot = isSlotImage(img);
        const slider = imgEditPopover.querySelector("#iep-width");
        const widthRow = slider.closest(".iep-row");
        widthRow.style.display = "";
        if (slot) {
            /* Slot images use transform: scale() as a zoom. */
            slider.min = "100";
            slider.max = "300";
            slider.step = "5";
            const scale = parseScale(img.style.transform);
            slider.value = String(Math.max(100, Math.min(300, Math.round(scale * 100))));
        } else {
            /* Free-standing images use width: %% as direct size. */
            slider.min = "20";
            slider.max = "100";
            slider.step = "5";
            const inlineW = img.style.width || "";
            const widthPct = inlineW.endsWith("%") ? parseInt(inlineW, 10) : 100;
            slider.value = String(Math.max(20, Math.min(100, widthPct || 100)));
        }
        imgEditPopover.querySelector("#iep-w-val").textContent = slider.value + "%";

        const currentFit = img.style.objectFit || cs.objectFit || "cover";
        imgEditPopover.querySelector("#iep-fit").value = currentFit;

        /* Aspect-ratio row only meaningful for slot images — operates on the slot. */
        const ratioRow = imgEditPopover.querySelector(".iep-row-ratio");
        const ratioSel = imgEditPopover.querySelector("#iep-ratio");
        ratioRow.style.display = slot ? "" : "none";
        if (slot) {
            const slotEl = img.closest("[data-image-slot]");
            const inlineRatio = (slotEl && slotEl.style.aspectRatio) || "";
            /* Normalize whitespace — select options use "W / H". */
            const norm = String(inlineRatio).replace(/\s+/g, " ").trim();
            ratioSel.value = Array.from(ratioSel.options).some((o) => o.value === norm) ? norm : "";
        }

        const [px, py] = parsePos(img.style.objectPosition || cs.objectPosition);
        imgEditPopover.querySelectorAll("#iep-grid button").forEach((b) => {
            const [bx, by] = parsePos(b.getAttribute("data-pos"));
            b.classList.toggle("active", bx === px && by === py);
        });

        /* Position the popover just below the image, within viewport. */
        imgEditPopover.classList.add("is-open");
        const rect = img.getBoundingClientRect();
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;
        const popRect = imgEditPopover.getBoundingClientRect();
        let left = rect.left + scrollX + rect.width / 2 - popRect.width / 2;
        let top  = rect.bottom + scrollY + 10;
        /* Clamp to viewport horizontally. */
        const margin = 12;
        const vw = document.documentElement.clientWidth;
        left = Math.max(scrollX + margin, Math.min(left, scrollX + vw - popRect.width - margin));
        /* If popover would fall below viewport, flip above the image. */
        if (rect.bottom + popRect.height + 20 > window.innerHeight) {
            top = rect.top + scrollY - popRect.height - 10;
        }
        imgEditPopover.style.left = left + "px";
        imgEditPopover.style.top  = top + "px";
    };

    const closeImgPopover = () => {
        imgEditPopover.classList.remove("is-open");
        activeImg = null;
    };

    const attachImgEditHandlers = (img) => {
        if (img.dataset.editImgBound === "1") return;
        img.setAttribute("data-edit-img", "true");
        img.setAttribute("draggable", "false");
        img.dataset.editImgBound = "1";

        img.addEventListener("click", (ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            openImgPopover(img);
        });

        /* Drag to reposition: only meaningful for cover/contain inside a slot.
           Adjusts object-position as percentages based on cursor movement
           relative to the image box. */
        img.addEventListener("mousedown", (ev) => {
            if (ev.button !== 0) return;
            if (!isSlotImage(img)) return;
            const rect = img.getBoundingClientRect();
            const [startX, startY] = parsePos(img.style.objectPosition || "50% 50%");
            const originX = ev.clientX;
            const originY = ev.clientY;
            let moved = false;

            const onMove = (e) => {
                const dx = e.clientX - originX;
                const dy = e.clientY - originY;
                if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
                /* Inverse relation: dragging right should reveal the left side. */
                const nx = Math.max(0, Math.min(100, startX - (dx / rect.width) * 100));
                const ny = Math.max(0, Math.min(100, startY - (dy / rect.height) * 100));
                const pos = `${nx.toFixed(1)}% ${ny.toFixed(1)}%`;
                img.style.objectPosition = pos;
                img.style.transformOrigin = pos;
                dirtyRef.value = true;
            };
            const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                if (moved) {
                    /* Sync the grid active state after a drag. */
                    if (activeImg === img) openImgPopover(img);
                    setStatus("dirty");
                }
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
            ev.preventDefault();
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

    /* Parse a Response defensively — some error paths (old server version,
       routing miss, connection drop) return empty or non-JSON bodies. */
    const parseJsonResponse = async (res) => {
        const text = await res.text();
        if (!text) {
            return { ok: false, error: `empty response (HTTP ${res.status}) — edit-server 재시작이 필요할 수 있습니다` };
        }
        try {
            return JSON.parse(text);
        } catch (e) {
            return { ok: false, error: `non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}` };
        }
    };

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
        return parseJsonResponse(res);
    };

    const extOf = (name) => {
        const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
        return m ? m[1] : "";
    };

    const applyImage = (uploadedPath, originalName) => {
        if (pendingSlot instanceof HTMLImageElement) {
            pendingSlot.src = uploadedPath;
            if (pendingSlot.hasAttribute("alt")) pendingSlot.alt = originalName;
            /* If this is a designated port-photo inside a .f-cover, ensure
               parent carries .has-photo so overlays stay readable. */
            const cover = pendingSlot.closest(".f-cover");
            if (cover) cover.classList.add("has-photo");
            return;
        }
        if (pendingSlot && pendingSlot.hasAttribute("data-image-slot")) {
            /* 1. Prefer updating a pre-existing designated photo img
                  (.port-photo in portfolio/writing, .f-cover-photo-img
                  in Career C02, or previously-injected .slot-photo). */
            const existing = pendingSlot.querySelector(
                "img.port-photo, img.f-cover-photo-img, img.slot-photo"
            );
            if (existing) {
                existing.src = uploadedPath;
                existing.alt = originalName;
                existing.style.objectPosition = "50% 50%";
                existing.style.transformOrigin = "50% 50%";
                existing.style.transform = "";
                attachImgEditHandlers(existing);
                pendingSlot.classList.add("has-photo");
                return;
            }
            /* 2. Portrait frames (cover H / resume H) have no overlays —
                  simpler to replace contents with a full-bleed img. */
            if (pendingSlot.matches(".portrait-frame, .rs-portrait")) {
                pendingSlot.innerHTML =
                    `<img src="${uploadedPath}" alt="${originalName}" data-edit-img="true" class="slot-photo" style="position:static;">`;
                const injected = pendingSlot.querySelector("img");
                if (injected) {
                    /* portrait slots want the image to fill naturally, not absolute */
                    injected.style.position = "static";
                    attachImgEditHandlers(injected);
                }
                return;
            }
            /* 3. .f-cover without an existing photo placeholder — inject a
                  .slot-photo absolute image as FIRST child so overlays
                  (number/tag/pv-mark) stay visible on top. */
            const img = document.createElement("img");
            img.src = uploadedPath;
            img.alt = originalName;
            img.className = "slot-photo";
            img.setAttribute("data-edit-img", "true");
            pendingSlot.insertBefore(img, pendingSlot.firstChild);
            pendingSlot.classList.add("has-photo");
            attachImgEditHandlers(img);
            return;
        }
        if (lastFocused) {
            const img = document.createElement("img");
            img.src = uploadedPath;
            img.alt = originalName;
            img.setAttribute("data-edit-img", "true");
            img.style.width = "100%";
            img.style.maxWidth = "100%";
            img.style.display = "block";
            img.style.margin = "12px auto";
            lastFocused.appendChild(img);
            attachImgEditHandlers(img);
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
            el.removeAttribute("draggable");
            if (el.dataset) delete el.dataset.editImgBound;
        });
        clone.querySelectorAll("[data-file-slot]").forEach((el) => {
            el.removeAttribute("data-file-slot");
        });
        clone.querySelectorAll("[data-edit-drop-bound]").forEach((el) => {
            el.removeAttribute("data-edit-drop-bound");
            if (el.dataset) delete el.dataset.editDropBound;
        });
        clone.querySelectorAll(".edit-drag-over").forEach((el) => {
            el.classList.remove("edit-drag-over");
        });
        const toolbarClone = clone.querySelector("#edit-toolbar");
        if (toolbarClone) toolbarClone.remove();
        const popClone = clone.querySelector("#img-edit-pop");
        if (popClone) popClone.remove();
        const veilClone = clone.querySelector("#edit-drop-veil");
        if (veilClone) veilClone.remove();
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
            const data = await parseJsonResponse(res);
            if (!res.ok || !data.ok) {
                setStatus("save failed", true);
                console.error("save failed:", res.status, data);
                alert("저장 실패 (HTTP " + res.status + ")\n" + (data.error || "") + "\n" + (data.stderr || ""));
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
        document.body.appendChild(imgEditPopover);

        /* Global drop veil: visual hint when user is dragging a file over the page.
           Also swallows drops that land outside any bound slot so the browser
           doesn't navigate away to the file. */
        const dropVeil = document.createElement("div");
        dropVeil.id = "edit-drop-veil";
        document.body.appendChild(dropVeil);

        /* Depth counting is fragile because slot handlers stopPropagation,
           so we use a debounced hide timer instead: each dragover keeps the
           veil alive; 220ms without a dragover hides it. */
        let veilHideTimer = 0;
        const pokeVeil = () => {
            dropVeil.classList.add("is-on");
            if (veilHideTimer) clearTimeout(veilHideTimer);
            veilHideTimer = setTimeout(() => dropVeil.classList.remove("is-on"), 220);
        };
        const killVeil = () => {
            if (veilHideTimer) clearTimeout(veilHideTimer);
            dropVeil.classList.remove("is-on");
        };

        window.addEventListener("dragover", (e) => {
            if (!carriesFiles(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            pokeVeil();
        }, true);
        window.addEventListener("drop", (e) => {
            if (!carriesFiles(e)) return;
            killVeil();
            /* If the drop landed inside a bound slot, its own handler already
               consumed the event; this runs only for drops on bare page area. */
            if (e.defaultPrevented) return;
            e.preventDefault();
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (!file) return;
            /* Fall back to the most recently focused editable block. */
            if (lastFocused) {
                pendingSlot = null;
                const mode = detectMode(file);
                pendingMode = mode;
                handleUpload(file, mode);
            } else {
                alert("이미지/파일을 삽입할 위치를 먼저 지정해 주세요.\n이미지 영역(점선 박스)이나 텍스트 블록 위에 드롭하세요.");
            }
        });

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

        /* Image edit popover — wire controls. */
        const widthInput = imgEditPopover.querySelector("#iep-width");
        const widthVal   = imgEditPopover.querySelector("#iep-w-val");
        const fitSelect  = imgEditPopover.querySelector("#iep-fit");
        const ratioSelect = imgEditPopover.querySelector("#iep-ratio");
        const gridEl     = imgEditPopover.querySelector("#iep-grid");
        const replaceBtn = imgEditPopover.querySelector("#iep-replace");
        const deleteBtn  = imgEditPopover.querySelector("#iep-del");

        widthInput.addEventListener("input", () => {
            widthVal.textContent = widthInput.value + "%";
            if (!activeImg) return;
            if (isSlotImage(activeImg)) {
                const s = Math.max(1, parseInt(widthInput.value, 10) / 100);
                activeImg.style.transform = `scale(${s.toFixed(2)})`;
            } else {
                activeImg.style.width = widthInput.value + "%";
            }
            dirtyRef.value = true;
            setStatus("dirty");
        });

        fitSelect.addEventListener("change", () => {
            if (!activeImg) return;
            activeImg.style.objectFit = fitSelect.value;
            dirtyRef.value = true;
            setStatus("dirty");
        });

        ratioSelect.addEventListener("change", () => {
            if (!activeImg) return;
            const slotEl = activeImg.closest("[data-image-slot]");
            if (!slotEl) return;
            if (ratioSelect.value) {
                slotEl.style.aspectRatio = ratioSelect.value;
            } else {
                slotEl.style.aspectRatio = "";
            }
            dirtyRef.value = true;
            setStatus("dirty");
        });

        gridEl.addEventListener("click", (e) => {
            const btn = e.target.closest("button[data-pos]");
            if (!btn || !activeImg) return;
            gridEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            const pos = btn.getAttribute("data-pos");
            activeImg.style.objectPosition = pos;
            if (isSlotImage(activeImg)) {
                /* Zoom should pivot around the same focal point as object-position. */
                activeImg.style.transformOrigin = pos;
            }
            dirtyRef.value = true;
            setStatus("dirty");
        });

        replaceBtn.addEventListener("click", () => {
            if (!activeImg) return;
            pendingSlot = activeImg;
            pendingMode = "image";
            closeImgPopover();
            imageInput.click();
        });

        deleteBtn.addEventListener("click", () => {
            if (!activeImg) return;
            if (!confirm("이미지를 삭제하시겠습니까?")) return;
            const slot = activeImg.closest("[data-image-slot]");
            /* Preserve overlays (number/tag/pv-mark) and any port-photo
               placeholder. For designated placeholders we only blank the src;
               for injected .slot-photo we remove the node. */
            if (activeImg.matches("img.port-photo, img.f-cover-photo-img")) {
                activeImg.setAttribute("src", "");
                activeImg.removeAttribute("alt");
                activeImg.style.objectPosition = "";
                activeImg.style.transformOrigin = "";
                activeImg.style.transform = "";
            } else {
                activeImg.remove();
            }
            if (slot) {
                slot.classList.remove("has-photo");
                /* Clear any inline aspect-ratio override so section default reapplies. */
                if (slot.style.aspectRatio) slot.style.aspectRatio = "";
            }
            closeImgPopover();
            dirtyRef.value = true;
            setStatus("dirty");
        });

        /* Close popover: outside click, Escape, scroll. */
        document.addEventListener("mousedown", (e) => {
            if (!imgEditPopover.classList.contains("is-open")) return;
            if (e.target.closest("#img-edit-pop")) return;
            if (e.target.closest("[data-edit-img]")) return;
            closeImgPopover();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && imgEditPopover.classList.contains("is-open")) {
                closeImgPopover();
            }
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
