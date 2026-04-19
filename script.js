/* ==========================================================
   Portfolio v2 · Editorial
   · folder tabs (top-right)
   · scroll rail (right)
   ========================================================== */
(function () {
    "use strict";

    const folders = document.querySelectorAll(".folder");
    const marks = document.querySelectorAll(".rail-mark");
    const slides = Array.from(document.querySelectorAll(".slide"));
    const railFill = document.getElementById("railFill");
    const railTrack = document.querySelector(".rail-track");

    /* ---------- Active section (folder + rail mark) ---------- */
    const setActive = (id) => {
        folders.forEach(f => {
            f.classList.toggle("is-active", f.getAttribute("href") === "#" + id);
        });
        const idx = slides.findIndex(s => s.id === id);
        marks.forEach((m, i) => {
            m.classList.toggle("is-active", m.dataset.id === id);
            m.classList.toggle("is-passed", i < idx);
        });
    };

    const spy = new IntersectionObserver(
        (entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) setActive(e.target.id);
            });
        },
        { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    slides.forEach(s => spy.observe(s));

    /* ---------- Scroll progress (rail fill + percent) ---------- */
    const updateProgress = () => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        const pct = docH > 0 ? Math.min(100, Math.max(0, (scrollTop / docH) * 100)) : 0;

        if (railFill && railTrack) {
            // Fill scales the rail from its top (22px from track top) to its bottom (22px from track bottom)
            const trackH = railTrack.clientHeight - 44;
            railFill.style.height = (pct / 100) * trackH + "px";
        }
    };

    let ticking = false;
    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateProgress();
            ticking = false;
        });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();

    /* ---------- Animate skill rings when visible ---------- */
    const rings = document.querySelectorAll(".ring");
    const ringIO = new IntersectionObserver(
        (entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const w = parseInt(e.target.dataset.w || "0", 10);
                const target = e.target;
                target.style.setProperty("--p", "0");
                // animate from 0 to w
                const duration = 1200;
                const start = performance.now();
                const ease = (t) => 1 - Math.pow(1 - t, 3);
                const step = (now) => {
                    const t = Math.min(1, (now - start) / duration);
                    target.style.setProperty("--p", (w * ease(t)).toFixed(1));
                    if (t < 1) requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
                ringIO.unobserve(target);
            });
        },
        { threshold: 0.25 }
    );
    rings.forEach(r => ringIO.observe(r));

    /* ---------- Freeze ring values before print ---------- */
    window.addEventListener("beforeprint", () => {
        rings.forEach(r => {
            const w = parseInt(r.dataset.w || "0", 10);
            r.style.setProperty("--p", w);
        });
    });

    /* ---------- Content protection (production only) ----------
       Prevents casual text copy, image drag-save, right-click save, and
       blocks attachment downloads with a friendly notice. Disabled on
       localhost so the edit-server workflow stays usable. */
    const host = location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
    if (!isLocal) {
        document.documentElement.classList.add("content-protect");

        const block = (e) => { e.preventDefault(); return false; };
        ["contextmenu", "copy", "cut", "dragstart", "selectstart"].forEach((evt) => {
            document.addEventListener(evt, block);
        });

        /* Hard-block attachment downloads — catches the click in the
           capture phase so the browser never starts the download. */
        document.addEventListener("click", (e) => {
            const a = e.target.closest("a[download]");
            if (!a) return;
            e.preventDefault();
            e.stopPropagation();
            alert("열람 전용 포트폴리오입니다. 파일 다운로드는 제공되지 않습니다.");
        }, true);

        /* Some browsers still allow image drag even with CSS — strip it
           on every img explicitly. */
        document.querySelectorAll("img").forEach((img) => {
            img.setAttribute("draggable", "false");
        });
    }
})();
