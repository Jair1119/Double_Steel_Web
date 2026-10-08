/* ==========================================================================
   DOUBLE STEEL — Interacciones, transiciones y utilidades de la página
   ========================================================================== */
(function () {
    'use strict';

    const DS = window.DS = window.DS || {};
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const root = document.documentElement;
    const WA_NUMBER = '528991948477';
    const reduced = DS.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const fmt = DS.fmt || ((n, d = 2) => Number(n).toFixed(d));
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

    /* ----------------------------------------------------------------------
       TOASTS
       ---------------------------------------------------------------------- */
    DS.toast = function (msg, type = 'ok', icon) {
        const box = $('#toasts');
        if (!box) return;
        const t = document.createElement('div');
        t.className = 'toast' + (type === 'error' ? ' error' : '');
        const ic = icon || (type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle');
        t.innerHTML = `<i class="fas ${ic}"></i><span></span>`;
        t.querySelector('span').textContent = msg;
        box.appendChild(t);
        while (box.children.length > 3) box.firstElementChild.remove();
        setTimeout(() => {
            t.classList.add('out');
            t.addEventListener('animationend', () => t.remove(), { once: true });
        }, 3400);
    };

    /* ----------------------------------------------------------------------
       BLOQUEO DE SCROLL (modales / menú)
       ---------------------------------------------------------------------- */
    let locks = 0;
    function lockScroll() {
        if (locks++ === 0) {
            const sw = window.innerWidth - root.clientWidth;
            document.body.style.paddingRight = sw > 0 ? sw + 'px' : '';
            document.body.classList.add('no-scroll');
        }
    }
    function unlockScroll() {
        locks = Math.max(0, locks - 1);
        if (locks === 0) {
            document.body.classList.remove('no-scroll');
            document.body.style.paddingRight = '';
        }
    }

    /* ----------------------------------------------------------------------
       PRELOADER (cortina que se enrolla)
       ---------------------------------------------------------------------- */
    (function preloader() {
        const pre = $('#preloader');
        const bar = $('#preloader-bar');
        const count = $('#preloader-count');
        let progress = 0, loaded = false, done = false;
        const t0 = performance.now();

        const finish = () => {
            if (done) return;
            done = true;
            if (pre) pre.classList.add('is-done');
            setTimeout(() => root.classList.add('is-loaded'), reduced ? 0 : 450);
            setTimeout(() => pre && pre.remove(), 1600);
        };

        if (!pre || reduced) {
            finish();
            return;
        }
        window.addEventListener('load', () => { loaded = true; });
        setTimeout(() => { loaded = true; }, 3200); // nunca esperar de más

        (function tick() {
            const elapsed = performance.now() - t0;
            const target = loaded ? 100 : Math.min(90, elapsed / 14);
            progress += (target - progress) * (loaded ? 0.18 : 0.08);
            if (loaded && progress > 99.4) progress = 100;
            bar.style.width = progress + '%';
            count.textContent = Math.round(progress);
            if (progress >= 100 && elapsed > 700) finish();
            else requestAnimationFrame(tick);
        })();
    })();

    /* ----------------------------------------------------------------------
       TEXTO DIVIDIDO (letras del título del hero)
       ---------------------------------------------------------------------- */
    $$('.split-text').forEach(node => {
        const words = node.textContent.trim().split(/\s+/);
        let i = 0;
        node.innerHTML = words.map(w => `<span class="word">${Array.from(w).map(ch => `<span class="char" style="--i:${i++}">${ch}</span>`).join('')}</span>`).join(' ');
    });

    /* Palabra rotativa */
    (function rotator() {
        const box = $('#hero-rotator');
        if (!box) return;
        const items = $$('span', box);
        let idx = 0;
        setTimeout(() => {
            setInterval(() => {
                if (document.hidden) return;
                const cur = items[idx];
                idx = (idx + 1) % items.length;
                const next = items[idx];
                cur.classList.remove('is-active');
                cur.classList.add('is-leaving');
                next.classList.remove('is-leaving');
                next.classList.add('is-active');
                setTimeout(() => cur.classList.remove('is-leaving'), 800);
            }, 2800);
        }, 2600);
    })();

    /* ----------------------------------------------------------------------
       REVEAL AL HACER SCROLL
       ---------------------------------------------------------------------- */
    // Los elementos con clip-path totalmente recortado no "intersectan" en Chrome,
    // así que para esos se observa al contenedor padre.
    const revealTargets = new Map();
    const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            (revealTargets.get(en.target) || [en.target]).forEach(n => n.classList.add('is-visible'));
            revealObserver.unobserve(en.target);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;

    $$('[data-reveal]').forEach(node => {
        const d = parseInt(node.dataset.delay || '0', 10);
        if (d) node.style.setProperty('--delay', d / 1000 + 's');
        if (!revealObserver || reduced) {
            node.classList.add('is-visible');
            return;
        }
        if (node.dataset.reveal.indexOf('clip') === 0 && node.parentElement) {
            const p = node.parentElement;
            if (!revealTargets.has(p)) {
                revealTargets.set(p, []);
                revealObserver.observe(p);
            }
            revealTargets.get(p).push(node);
        } else {
            revealObserver.observe(node);
        }
    });

    /* ----------------------------------------------------------------------
       CONTADORES
       ---------------------------------------------------------------------- */
    const counterObs = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            counterObs.unobserve(en.target);
            const node = en.target, to = parseInt(node.dataset.counter, 10);
            if (reduced) { node.textContent = to; return; }
            const t0 = performance.now(), dur = 1800;
            (function step(now) {
                const p = Math.min((now - t0) / dur, 1);
                node.textContent = Math.round(to * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)));
                if (p < 1) requestAnimationFrame(step);
            })(t0);
        });
    }, { threshold: 0.6 }) : null;
    $$('[data-counter]').forEach(n => counterObs ? counterObs.observe(n) : (n.textContent = n.dataset.counter));

    /* ----------------------------------------------------------------------
       SCROLL: header, progreso, parallax, volver arriba, proceso
       ---------------------------------------------------------------------- */
    const header = $('#header');
    const progressBar = $('#scroll-progress');
    const btt = $('#back-to-top');
    const bttRing = $('#btt-ring');
    const hero = $('#inicio');
    const heroContent = $('#hero-content');
    const heroVideo = $('#hero-video');
    const parallaxEls = $$('[data-parallax]');
    const processTrack = $('.process-track');
    const processFill = $('#process-line-fill');
    const processSteps = $$('.process-steps li');
    const mobileMenu = $('#mobile-menu');
    let lastY = window.scrollY, ticking = false, scrollVel = 0;

    function onScroll() {
        const y = window.scrollY;
        const vh = window.innerHeight;
        const docH = root.scrollHeight - vh;
        const p = docH > 0 ? y / docH : 0;
        const dy = y - lastY;
        scrollVel = Math.min(Math.abs(dy), 80);

        header.classList.toggle('scrolled', y > 40);
        const menuOpen = mobileMenu && mobileMenu.classList.contains('is-open');
        if (!menuOpen) {
            if (dy > 6 && y > 320) header.classList.add('hide');
            else if (dy < -6 || y < 120) header.classList.remove('hide');
        }

        progressBar.style.transform = `scaleX(${p})`;
        btt.classList.toggle('is-visible', y > 700);
        bttRing.style.strokeDashoffset = 132 - 132 * p;

        // Parallax del hero
        if (!reduced && hero) {
            const h = hero.offsetHeight;
            if (y < h) {
                const k = y / h;
                heroContent.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;
                heroContent.style.opacity = String(clamp(1 - k * 1.3, 0, 1));
                if (heroVideo) heroVideo.style.setProperty('--hero-scale', (1.08 + k * 0.15).toFixed(4));
            }
        }

        // Fondos con parallax
        if (!reduced) {
            parallaxEls.forEach(elp => {
                const r = elp.parentElement.getBoundingClientRect();
                if (r.bottom < 0 || r.top > vh) return;
                const speed = parseFloat(elp.dataset.parallax) || 0.2;
                const center = r.top + r.height / 2 - vh / 2;
                elp.style.transform = `translate3d(0, ${-center * speed}px, 0)`;
            });
        }

        // Línea del proceso
        if (processTrack) {
            const r = processTrack.getBoundingClientRect();
            const prog = clamp((vh * 0.8 - r.top) / (vh * 0.45), 0, 1);
            processFill.style.setProperty('--p', prog.toFixed(3));
            processSteps.forEach((li, i) => li.classList.toggle('is-reached', prog >= i / Math.max(processSteps.length - 1, 1) - 0.02));
        }

        lastY = y;
        ticking = false;
    }
    window.addEventListener('scroll', () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(onScroll);
        }
    }, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    btt.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));

    /* Scrollspy del menú */
    const navLinks = $$('.nav-link, .mobile-menu-nav a');
    if ('IntersectionObserver' in window) {
        const spy = new IntersectionObserver(entries => {
            entries.forEach(en => {
                if (!en.isIntersecting) return;
                const id = en.target.id;
                navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        $$('main section[id]').forEach(s => spy.observe(s));
    }

    /* ----------------------------------------------------------------------
       MENÚ MÓVIL
       ---------------------------------------------------------------------- */
    const toggle = $('#mobile-toggle');
    function setMenu(open) {
        if (!mobileMenu) return;
        const was = mobileMenu.classList.contains('is-open');
        if (was === open) return;
        mobileMenu.classList.toggle('is-open', open);
        toggle.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        mobileMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
        $$('.mobile-menu-nav a', mobileMenu).forEach((a, i) => { a.style.transitionDelay = open ? (0.25 + i * 0.06) + 's' : '0s'; });
        header.classList.remove('hide');
        open ? lockScroll() : unlockScroll();
    }
    toggle && toggle.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('is-open')));
    $$('a', mobileMenu || document.createElement('div')).forEach(a => a.addEventListener('click', () => setMenu(false)));
    window.addEventListener('resize', () => { if (window.innerWidth > 992) setMenu(false); });

    /* ----------------------------------------------------------------------
       MARQUEE con velocidad reactiva al scroll
       ---------------------------------------------------------------------- */
    (function marquee() {
        const tracks = $$('[data-marquee]');
        if (!tracks.length) return;
        const setup = () => tracks.forEach(t => {
            if (!t._base) t._base = t.innerHTML;
            t.innerHTML = t._base;
            const bw = t.scrollWidth || 1;
            const reps = Math.ceil((window.innerWidth * 1.25) / bw) + 1;
            t.innerHTML = t._base.repeat(reps);
            t._bw = bw;
            t._x = t._x || 0;
        });
        setup();
        let resizeT;
        window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(setup, 200); });
        if (reduced) return;
        let visible = true, boost = 0;
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(en => { visible = en[0].isIntersecting; }).observe($('.marquee-wrap'));
        }
        (function loop() {
            boost += (scrollVel * 0.25 - boost) * 0.08;
            scrollVel *= 0.9;
            if (visible && !document.hidden) {
                tracks.forEach(t => {
                    const dir = parseFloat(t.dataset.marquee) || 1;
                    t._x = (((t._x + dir * (0.9 + boost)) % t._bw) + t._bw) % t._bw;
                    t.style.transform = `translate3d(${-t._x}px,0,0)`;
                });
            }
            requestAnimationFrame(loop);
        })();
    })();

    /* ----------------------------------------------------------------------
       CHISPAS / BRASAS EN EL HERO (canvas)
       ---------------------------------------------------------------------- */
    (function sparks() {
        const canvas = $('#hero-sparks');
        if (!canvas || reduced || !canvas.getContext) return;
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        let W = 0, H = 0, running = true;
        const embers = [], sparks = [];
        const small = () => window.innerWidth < 700;
        const rand = (a, b) => a + Math.random() * (b - a);

        function resize() {
            W = canvas.clientWidth;
            H = canvas.clientHeight;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        function newEmber(initial) {
            return {
                x: rand(0, W), y: initial ? rand(0, H) : H + rand(0, 40),
                vy: -rand(0.25, 1.1), vx: rand(-0.2, 0.2), r: rand(0.6, 2.1),
                ph: rand(0, Math.PI * 2), life: 1
            };
        }
        function burst() {
            const x = rand(W * 0.1, W * 0.9), y = rand(H * 0.55, H * 0.9);
            const n = small() ? 14 : 26;
            const base = rand(-2.4, -0.7);
            for (let i = 0; i < n; i++) {
                const a = base + rand(-0.5, 0.5), s = rand(3, 9);
                sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.6, 1), decay: rand(0.012, 0.03) });
            }
        }
        resize();
        const count = small() ? 34 : 70;
        for (let i = 0; i < count; i++) embers.push(newEmber(true));
        window.addEventListener('resize', resize);
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(en => {
                running = en[0].isIntersecting;
                if (running) requestAnimationFrame(frame);
            }).observe(canvas);
        }
        let nextBurst = performance.now() + 1500;

        function frame(now) {
            if (!running) return;
            if (document.hidden) { requestAnimationFrame(frame); return; }
            ctx.clearRect(0, 0, W, H);
            ctx.globalCompositeOperation = 'lighter';

            embers.forEach((e, i) => {
                e.ph += 0.03;
                e.x += e.vx + Math.sin(e.ph) * 0.3;
                e.y += e.vy;
                const fade = clamp(e.y / H, 0, 1);
                if (e.y < -10) embers[i] = newEmber(false);
                const a = 0.55 * fade * (0.6 + 0.4 * Math.sin(e.ph * 3));
                ctx.fillStyle = `rgba(255, 170, 40, ${a * 0.25})`;
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.r * 3.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = `rgba(255, 220, 120, ${a})`;
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
                ctx.fill();
            });

            if (now > nextBurst) {
                burst();
                nextBurst = now + rand(1800, 4200);
            }
            ctx.lineCap = 'round';
            for (let i = sparks.length - 1; i >= 0; i--) {
                const s = sparks[i];
                s.vy += 0.16;
                s.vx *= 0.985;
                s.x += s.vx;
                s.y += s.vy;
                s.life -= s.decay;
                if (s.life <= 0 || s.y > H + 20) { sparks.splice(i, 1); continue; }
                ctx.strokeStyle = `rgba(255, ${Math.round(180 + 60 * s.life)}, 80, ${s.life})`;
                ctx.lineWidth = 1.4 * s.life + 0.4;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x - s.vx * 2.4, s.y - s.vy * 2.4);
                ctx.stroke();
            }
            ctx.globalCompositeOperation = 'source-over';
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    })();

    /* ----------------------------------------------------------------------
       BOTONES MAGNÉTICOS + TILT 3D EN TARJETAS
       ---------------------------------------------------------------------- */
    if (finePointer && !reduced) {
        $$('.magnetic').forEach(b => {
            b.addEventListener('pointermove', e => {
                const r = b.getBoundingClientRect();
                const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
                b.style.transform = `translate(${x * 0.22}px, ${y * 0.35}px)`;
            });
            b.addEventListener('pointerleave', () => { b.style.transform = ''; });
        });

        $$('.product-card').forEach(card => {
            card.addEventListener('pointermove', e => {
                const r = card.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
                card.classList.add('tilting');
                card.style.setProperty('--ry', ((px - 0.5) * 10).toFixed(2) + 'deg');
                card.style.setProperty('--rx', ((0.5 - py) * 8).toFixed(2) + 'deg');
                card.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
                card.style.setProperty('--my', (py * 100).toFixed(1) + '%');
            });
            card.addEventListener('pointerleave', () => {
                card.classList.remove('tilting');
                card.style.setProperty('--rx', '0deg');
                card.style.setProperty('--ry', '0deg');
            });
        });
    }

    /* ----------------------------------------------------------------------
       CATÁLOGO: filtros con animación FLIP + búsqueda
       ---------------------------------------------------------------------- */
    const PRODUCTOS = {
        ptr: {
            nombre: 'Perfil PTR', cat: 'Perfiles y Tubería', img: 'img/productos/ptr.jpg',
            desc: 'Perfil tubular de sección cuadrada o rectangular. Ligero, rígido y fácil de soldar: el favorito para estructuras ligeras y medianas, herrería y fabricación en general.',
            usos: ['Estructuras y techumbres', 'Portones, rejas y barandales', 'Marcos y bastidores', 'Mobiliario y remolques'],
            calc: ['ptr']
        },
        hss: {
            nombre: 'Perfil HSS', cat: 'Perfiles y Tubería', img: 'img/productos/hss.jpg',
            desc: 'Sección estructural hueca (Hollow Structural Section) de alta resistencia para proyectos que exigen mayor capacidad de carga y mejor desempeño estructural.',
            usos: ['Columnas y vigas', 'Naves industriales', 'Puentes peatonales', 'Estructura arquitectónica'],
            calc: ['ptr', { espesor: { sel: '0.1875' } }]
        },
        tubo: {
            nombre: 'Tubo Redondo', cat: 'Perfiles y Tubería', img: 'img/productos/tubo.jpg',
            desc: 'Tubo de acero de sección circular para aplicaciones estructurales y de herrería. Excelente resistencia a la torsión y acabado limpio.',
            usos: ['Barandales y pasamanos', 'Postes y soportes', 'Estructuras tubulares', 'Herrería y mobiliario'],
            calc: ['tubo']
        },
        placa: {
            nombre: 'Placa de Acero', cat: 'Láminas y Placas', img: 'img/productos/placa.jpg',
            desc: 'Placa de acero al carbón en distintos espesores para fabricación pesada, conexiones estructurales y piezas de maquinaria. Pregunta por corte a medida.',
            usos: ['Placas base y de conexión', 'Cartabones y atiesadores', 'Tolvas y tanques', 'Piezas de maquinaria'],
            calc: ['placa', { espesor: { sel: '0.25' } }]
        },
        lamina: {
            nombre: 'Lámina Lisa', cat: 'Láminas y Placas', img: 'img/productos/lamina.jpg',
            desc: 'Lámina de acero lisa en diversos calibres, ideal para fabricación, recubrimientos y trabajos de pailería.',
            usos: ['Gabinetes y cajas', 'Ductos y recubrimientos', 'Carrocerías y remolques', 'Fabricación general'],
            calc: ['placa', { espesor: { sel: '0.0747' } }]
        },
        antiderrapante: {
            nombre: 'Lámina Antiderrapante', cat: 'Láminas y Placas', img: 'img/productos/lamina-antiderrapante.jpg',
            desc: 'Lámina con relieve en patrón de rombo que brinda una superficie antideslizante y resistente al tránsito. (El cálculo de peso no incluye el relieve).',
            usos: ['Escalones y rampas', 'Pisos de plataformas', 'Cajas de camiones', 'Pasillos industriales'],
            calc: ['placa', { espesor: { sel: '0.125' } }]
        },
        acanalada: {
            nombre: 'Lámina Acanalada', cat: 'Láminas y Placas', img: 'img/productos/lamina-acanalada.jpg',
            desc: 'Lámina con perfil acanalado que aporta rigidez y escurrimiento eficiente del agua. Solución práctica para cubiertas y cerramientos.',
            usos: ['Techos y cubiertas', 'Muros y fachadas', 'Bodegas y naves', 'Cercas y bardas'],
            calc: null
        },
        ipr: {
            nombre: 'Viga IPR', cat: 'Vigas', img: 'img/productos/viga-ip.jpg',
            desc: 'Viga de patín ancho (IPR) para estructuras principales: soporta grandes claros y cargas con un excelente aprovechamiento del material.',
            usos: ['Entrepisos y losas', 'Naves industriales', 'Marcos estructurales', 'Mezzanines y puentes'],
            calc: ['ipr', { perfil: { v: 'W8x15' } }]
        },
        vigah: {
            nombre: 'Viga H', cat: 'Vigas', img: 'img/productos/viga-h.jpg',
            desc: 'Viga de sección H con patines anchos y alta inercia en ambos ejes. Excelente desempeño como columna y en estructuras de carga pesada.',
            usos: ['Columnas', 'Cimentaciones y pilotes', 'Estructuras de carga pesada', 'Marcos rígidos'],
            calc: ['ipr', { perfil: { v: 'W8x31' } }]
        },
        polin: {
            nombre: 'Polín / Panel C', cat: 'Perfiles y Tubería', img: 'img/productos/panel-c.jpg',
            desc: 'Perfil tipo C (polín monten) formado en frío: ligero, resistente y económico para estructuras de techo y muros.',
            usos: ['Largueros de techo', 'Muros y fachadas', 'Estructuras ligeras', 'Bastidores'],
            calc: ['polin']
        },
        angulo: {
            nombre: 'Ángulo', cat: 'Perfiles y Tubería', img: 'img/productos/angulo.jpg',
            desc: 'Ángulo de acero de lados iguales o desiguales. Versátil para refuerzos, marcos y soportes en herrería y estructura.',
            usos: ['Refuerzos y marcos', 'Soportes y ménsulas', 'Torres y armaduras', 'Herrería'],
            calc: ['angulo']
        },
        solera: {
            nombre: 'Solera', cat: 'Soleras y Varilla', img: 'img/productos/solera.jpg',
            desc: 'Barra plana de acero en diversos anchos y espesores, básica en herrería y fabricación.',
            usos: ['Herrería y rejas', 'Refuerzos y platinas', 'Bases y anclajes', 'Fabricación'],
            calc: ['solera']
        },
        varilla: {
            nombre: 'Varilla Corrugada', cat: 'Soleras y Varilla', img: 'img/productos/varilla-corrugada.jpg',
            desc: 'Varilla corrugada para refuerzo de concreto: su corrugado mejora la adherencia con el concreto en elementos estructurales.',
            usos: ['Cimentaciones', 'Castillos y dalas', 'Losas y muros', 'Obra civil'],
            calc: ['varilla']
        }
    };

    const grid = $('#products-grid');
    const cards = $$('.product-card', grid);
    const search = $('#catalog-search');
    const empty = $('#catalog-empty');
    let filtro = 'todos';

    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

    function applyFilter() {
        const q = norm(search.value.trim());
        const first = new Map();
        cards.forEach(c => { if (!c.classList.contains('is-hidden')) first.set(c, c.getBoundingClientRect()); });
        let shown = 0;
        cards.forEach(c => {
            const p = PRODUCTOS[c.dataset.id];
            const hay = norm($('h3', c).textContent + ' ' + $('.product-body p', c).textContent + ' ' + (p ? p.desc + ' ' + p.usos.join(' ') : ''));
            const ok = (filtro === 'todos' || c.dataset.cat === filtro) && (!q || hay.includes(q));
            c.classList.toggle('is-hidden', !ok);
            if (ok) shown++;
        });
        let k = 0;
        cards.forEach(c => {
            if (c.classList.contains('is-hidden')) return;
            c.classList.add('is-visible');
            if (reduced || !c.animate) return;
            const f = first.get(c);
            const l = c.getBoundingClientRect();
            if (f) {
                const dx = f.left - l.left, dy = f.top - l.top;
                if (dx || dy) c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.22,1,.36,1)' });
            } else {
                c.animate([{ opacity: 0, transform: 'scale(.85) translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 550, delay: (k++) * 45, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
            }
        });
        empty.hidden = shown > 0;
    }

    function setFiltro(f) {
        filtro = f;
        $$('.chip[data-filter]').forEach(ch => ch.classList.toggle('is-active', ch.dataset.filter === f));
        applyFilter();
    }
    $$('.chip[data-filter]').forEach(ch => ch.addEventListener('click', () => setFiltro(ch.dataset.filter)));
    let searchT;
    search.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(applyFilter, 120); });
    $$('[data-filter-link]').forEach(a => a.addEventListener('click', () => {
        search.value = '';
        setFiltro(a.dataset.filterLink);
    }));

    /* Acciones de las tarjetas */
    function irACalculadora(id) {
        const p = PRODUCTOS[id];
        if (!p || !p.calc || !DS.calc) return;
        DS.calc.setTipo(p.calc[0], p.calc[1]);
        const sec = $('#calculadora');
        sec.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        const box = $('#calc');
        box.classList.remove('highlight');
        setTimeout(() => box.classList.add('highlight'), 500);
        setTimeout(() => box.classList.remove('highlight'), 2300);
    }

    function irACotizar(nombre) {
        const sel = $('#quote-product');
        if (sel && nombre) sel.value = nombre;
        $('#cotizacion').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        setTimeout(() => {
            const n = $('#quote-name');
            n && n.focus({ preventScroll: true });
        }, reduced ? 0 : 900);
    }

    grid.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        const card = e.target.closest('.product-card');
        if (!card) return;
        const id = card.dataset.id;
        if (!btn) {
            openProducto(id, e);
            return;
        }
        const action = btn.dataset.action;
        if (action === 'detalle') openProducto(id, e);
        else if (action === 'calcular') irACalculadora(id);
        else if (action === 'cotizar') irACotizar(PRODUCTOS[id] && PRODUCTOS[id].nombre);
    });

    /* ----------------------------------------------------------------------
       MODALES (producto y video)
       ---------------------------------------------------------------------- */
    let lastFocus = null;
    function openModal(modal, origin) {
        lastFocus = document.activeElement;
        const dialog = $('.modal-dialog', modal);
        if (origin && dialog && window.innerWidth > 640) {
            const r = dialog.getBoundingClientRect();
            dialog.style.transformOrigin = `${clamp(origin.clientX - r.left, 0, r.width)}px ${clamp(origin.clientY - r.top, 0, r.height)}px`;
        } else if (dialog) {
            dialog.style.transformOrigin = '';
        }
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        lockScroll();
        setTimeout(() => { const c = $('.modal-close', modal); c && c.focus({ preventScroll: true }); }, 60);
    }
    function closeModal(modal) {
        if (!modal.classList.contains('is-open')) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        unlockScroll();
        const v = $('video', modal);
        if (v) v.pause();
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target.closest('[data-close-modal]')) closeModal(m); }));

    const pm = $('#product-modal');
    let pmActual = null;
    function openProducto(id, ev) {
        const p = PRODUCTOS[id];
        if (!p) return;
        pmActual = id;
        $('#pm-img').src = p.img;
        $('#pm-img').alt = p.nombre;
        $('#pm-tag').textContent = p.cat;
        $('#pm-title').textContent = p.nombre;
        $('#pm-desc').textContent = p.desc;
        $('#pm-usos').innerHTML = p.usos.map(u => `<li><i class="fas fa-check"></i>${DS.esc ? DS.esc(u) : u}</li>`).join('');
        $('#pm-calc').hidden = !p.calc;
        const msg = `Hola, me interesa cotizar *${p.nombre}*. ¿Me pueden apoyar con medidas, disponibilidad y precio?`;
        $('#pm-wa').href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
        openModal(pm, ev);
    }
    $('#pm-calc').addEventListener('click', () => {
        closeModal(pm);
        setTimeout(() => irACalculadora(pmActual), 250);
    });

    const vm = $('#video-modal');
    $('#open-video') && $('#open-video').addEventListener('click', e => {
        openModal(vm, e);
        const v = $('#plant-video');
        v.play && v.play().catch(() => { /* el usuario puede darle play */ });
    });

    /* ----------------------------------------------------------------------
       GALERÍA + LIGHTBOX
       ---------------------------------------------------------------------- */
    const lb = $('#lightbox');
    const lbImg = $('#lb-img');
    const lbCap = $('#lb-caption');
    const gItems = $$('.gallery-item');
    let gIndex = 0;

    function showGallery(i, dir) {
        gIndex = (i + gItems.length) % gItems.length;
        const it = gItems[gIndex];
        const img = $('img', it);
        lbImg.src = img.src;
        lbImg.alt = img.alt;
        lbCap.innerHTML = `<span>${String(gIndex + 1).padStart(2, '0')} / ${String(gItems.length).padStart(2, '0')}</span>`;
        lbCap.appendChild(document.createTextNode($('.gallery-caption', it).textContent.trim()));
        if (dir) {
            lbImg.style.setProperty('--dir', dir > 0 ? '60px' : '-60px');
            lbImg.classList.remove('swap');
            void lbImg.offsetWidth;
            lbImg.classList.add('swap');
        }
    }
    function openLightbox(i) {
        lastFocus = document.activeElement;
        showGallery(i);
        lb.classList.add('is-open');
        lb.setAttribute('aria-hidden', 'false');
        lockScroll();
        setTimeout(() => $('.lightbox-close', lb).focus({ preventScroll: true }), 60);
    }
    function closeLightbox() {
        if (!lb.classList.contains('is-open')) return;
        lb.classList.remove('is-open');
        lb.setAttribute('aria-hidden', 'true');
        unlockScroll();
        lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
    }
    gItems.forEach((it, i) => it.addEventListener('click', () => openLightbox(i)));
    $('#lb-prev').addEventListener('click', () => showGallery(gIndex - 1, -1));
    $('#lb-next').addEventListener('click', () => showGallery(gIndex + 1, 1));
    lb.addEventListener('click', e => { if (e.target.closest('[data-close-lightbox]')) closeLightbox(); });
    let swipeX = null;
    lb.addEventListener('pointerdown', e => { swipeX = e.clientX; });
    lb.addEventListener('pointerup', e => {
        if (swipeX === null) return;
        const dx = e.clientX - swipeX;
        swipeX = null;
        if (Math.abs(dx) > 50) showGallery(gIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });

    /* ----------------------------------------------------------------------
       FAQ (acordeón)
       ---------------------------------------------------------------------- */
    $$('.faq-item').forEach(item => {
        const q = $('.faq-q', item);
        q.addEventListener('click', () => {
            const open = !item.classList.contains('is-open');
            $$('.faq-item.is-open').forEach(o => {
                if (o !== item) {
                    o.classList.remove('is-open');
                    $('.faq-q', o).setAttribute('aria-expanded', 'false');
                }
            });
            item.classList.toggle('is-open', open);
            q.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    });

    /* ----------------------------------------------------------------------
       ORDEN: drawer, contadores, lista
       ---------------------------------------------------------------------- */
    const Orden = DS.orden;
    const drawer = $('#orden-drawer');
    const list = $('#orden-list');

    function itemHTML(it, i) {
        const esc = DS.esc || (s => s);
        return `<li data-id="${esc(it.id)}" style="--i:${i}">
            <span class="orden-item-title">${esc(it.producto)}</span>
            <button type="button" class="orden-item-remove" data-remove aria-label="Eliminar partida"><i class="fas fa-times"></i></button>
            <span class="orden-item-detail">${esc(it.detalle)} · ${fmt(it.kgPieza)} kg/pza</span>
            <div class="orden-item-foot">
                <div class="stepper">
                    <button type="button" data-qty="-1" aria-label="Restar"><i class="fas fa-minus"></i></button>
                    <input type="number" min="1" step="1" value="${it.cantidad}" aria-label="Cantidad de piezas" data-qty-input>
                    <button type="button" data-qty="1" aria-label="Sumar"><i class="fas fa-plus"></i></button>
                </div>
                <span class="orden-item-kg">${fmt(it.kgPieza * it.cantidad)} kg</span>
            </div>
        </li>`;
    }

    function renderLista() {
        if (!Orden || !list) return;
        list.innerHTML = Orden.items.map(itemHTML).join('');
    }

    function renderResumen() {
        if (!Orden) return;
        const t = Orden.totals();
        const has = t.partidas > 0;
        $$('[data-orden-count]').forEach(n => { n.textContent = t.partidas; });
        $$('[data-orden-kg]').forEach(n => { n.textContent = fmt(t.kg) + ' kg'; });
        $$('.cart-badge').forEach(b => b.classList.toggle('has-items', has));
        const fab = $('.orden-fab');
        fab && fab.classList.toggle('has-items', has);
        $('#orden-piezas').textContent = t.piezas;
        $('#calc-orderbar').classList.toggle('is-empty', !has);
        drawer.classList.toggle('is-empty', !has);
        $('#orden-empty').hidden = has;
        const inc = $('#quote-include-wrap');
        if (inc) inc.hidden = !has;
    }

    if (Orden) {
        Orden.on(type => {
            if (type !== 'qty') renderLista();
            renderResumen();
        });
        renderLista();
        renderResumen();
    }

    function openOrden() {
        lastFocus = document.activeElement;
        renderLista();
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        lockScroll();
        setTimeout(() => { const c = $('.drawer-head .icon-btn', drawer); c && c.focus({ preventScroll: true }); }, 80);
    }
    function closeOrden() {
        if (!drawer.classList.contains('is-open')) return;
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        unlockScroll();
    }
    $$('[data-open-orden]').forEach(b => b.addEventListener('click', openOrden));
    drawer.addEventListener('click', e => { if (e.target.closest('[data-close-orden]')) closeOrden(); });

    list.addEventListener('click', e => {
        const li = e.target.closest('li[data-id]');
        if (!li) return;
        const id = li.dataset.id;
        if (e.target.closest('[data-remove]')) {
            li.classList.add('removing');
            const done = () => Orden.remove(id);
            if (reduced) done();
            else li.addEventListener('animationend', done, { once: true });
            return;
        }
        const step = e.target.closest('[data-qty]');
        if (step) {
            const it = Orden.items.find(x => x.id === id);
            if (!it) return;
            Orden.setQty(id, it.cantidad + parseInt(step.dataset.qty, 10));
            $('[data-qty-input]', li).value = it.cantidad;
            $('.orden-item-kg', li).textContent = fmt(it.kgPieza * it.cantidad) + ' kg';
        }
    });
    list.addEventListener('change', e => {
        const inp = e.target.closest('[data-qty-input]');
        if (!inp) return;
        const li = inp.closest('li[data-id]');
        Orden.setQty(li.dataset.id, parseInt(inp.value, 10));
        const it = Orden.items.find(x => x.id === li.dataset.id);
        if (it) {
            inp.value = it.cantidad;
            $('.orden-item-kg', li).textContent = fmt(it.kgPieza * it.cantidad) + ' kg';
        }
    });

    $$('[data-orden-whatsapp]').forEach(b => b.addEventListener('click', () => DS.enviarOrdenWhatsApp && DS.enviarOrdenWhatsApp()));
    $('#orden-pdf').addEventListener('click', () => DS.generarPDF && DS.generarPDF());
    $('#orden-clear').addEventListener('click', () => {
        if (!Orden.items.length) return;
        if (window.confirm('¿Vaciar toda la orden?')) {
            Orden.clear();
            DS.toast('Orden vaciada', 'ok', 'fa-trash-alt');
        }
    });

    /* ----------------------------------------------------------------------
       COTIZACIÓN RÁPIDA (validación + WhatsApp)
       ---------------------------------------------------------------------- */
    const form = $('#quote-form');
    form.addEventListener('input', e => {
        const g = e.target.closest('.form-group');
        g && g.classList.remove('has-error');
    });
    form.addEventListener('submit', e => {
        e.preventDefault();
        const name = $('#quote-name'), phone = $('#quote-phone');
        const errs = [];
        if (name.value.trim().length < 2) errs.push(name);
        if (phone.value.replace(/\D/g, '').length < 10) errs.push(phone);
        $$('.form-group', form).forEach(g => g.classList.remove('has-error'));
        if (errs.length) {
            errs.forEach(inp => {
                const g = inp.closest('.form-group');
                void g.offsetWidth;
                g.classList.add('has-error');
            });
            errs[0].focus();
            DS.toast('Completa tu nombre y teléfono para continuar', 'error');
            return;
        }
        const prod = $('#quote-product').value || 'material de acero';
        const det = $('#quote-msg').value.trim();
        let text = `Hola, soy *${name.value.trim()}*, teléfono: ${phone.value.trim()}.\nSolicito cotización de: *${prod}*.`;
        if (det) text += `\nDetalles: ${det}`;
        const inc = $('#quote-include');
        if (inc && inc.checked && Orden && Orden.items.length && DS.ordenTexto) {
            text += '\n\n*Mi orden de la calculadora:*' + DS.ordenTexto(false);
        }
        window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
        DS.toast('¡Listo! Abriendo WhatsApp…', 'ok', 'fa-paper-plane');
    });

    /* ----------------------------------------------------------------------
       HORARIO: abierto / cerrado (hora de Monterrey)
       ---------------------------------------------------------------------- */
    (function horario() {
        const box = $('#open-status');
        if (!box) return;
        const H = { 1: [480, 1080], 2: [480, 1080], 3: [480, 1080], 4: [480, 1080], 5: [480, 1080], 6: [540, 780] };
        const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        const hora = m => {
            const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
            return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
        };
        function update() {
            let wd, mins;
            try {
                const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Monterrey', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
                const get = t => parts.find(p => p.type === t).value;
                wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
                mins = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
            } catch (e) {
                const n = new Date();
                wd = n.getDay();
                mins = n.getHours() * 60 + n.getMinutes();
            }
            const hoy = H[wd];
            const abierto = hoy && mins >= hoy[0] && mins < hoy[1];
            let txt;
            if (abierto) {
                txt = `Abierto ahora · cierra a las ${hora(hoy[1])}`;
            } else if (hoy && mins < hoy[0]) {
                txt = `Cerrado · abrimos hoy a las ${hora(hoy[0])}`;
            } else {
                let k = 1;
                while (!H[(wd + k) % 7] && k < 7) k++;
                const d = (wd + k) % 7;
                txt = `Cerrado · abrimos ${k === 1 ? 'mañana' : 'el ' + dias[d]} a las ${hora(H[d][0])}`;
            }
            box.classList.toggle('open', !!abierto);
            box.classList.toggle('closed', !abierto);
            $('.open-text', box).textContent = txt;
        }
        update();
        setInterval(update, 60000);
    })();

    /* ----------------------------------------------------------------------
       VARIOS
       ---------------------------------------------------------------------- */
    const year = $('#year');
    if (year) year.textContent = new Date().getFullYear();

    // Globo de WhatsApp: se muestra una vez
    const wa = $('.whatsapp-float');
    if (wa && window.innerWidth > 640) {
        setTimeout(() => {
            wa.classList.add('show-tip');
            setTimeout(() => wa.classList.remove('show-tip'), 4500);
        }, 9000);
    }

    // El video del hero se pausa cuando no está a la vista (ahorra batería)
    if (heroVideo && 'IntersectionObserver' in window) {
        new IntersectionObserver(en => {
            if (en[0].isIntersecting) heroVideo.play && heroVideo.play().catch(() => { });
            else heroVideo.pause && heroVideo.pause();
        }, { threshold: 0.05 }).observe(heroVideo);
    }

    // Escape cierra la capa superior
    document.addEventListener('keydown', e => {
        if (lb.classList.contains('is-open')) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') showGallery(gIndex + 1, 1);
            if (e.key === 'ArrowLeft') showGallery(gIndex - 1, -1);
            return;
        }
        if (e.key !== 'Escape') return;
        const m = $('.modal.is-open');
        if (m) { closeModal(m); return; }
        if (drawer.classList.contains('is-open')) { closeOrden(); return; }
        setMenu(false);
    });
})();
