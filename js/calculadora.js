/* ==========================================================================
   DOUBLE STEEL — Calculadora de peso teórico + Orden de material
   ========================================================================== */
(function () {
    'use strict';

    const DS = window.DS = window.DS || {};
    DS.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const DENSIDAD = 7850;            // kg/m³ (acero al carbón)
    const KG_A_LB = 2.20462;
    const LBFT_A_KGM = 1.48816;       // lb/ft -> kg/m
    const WA_NUMBER = '528991948477';
    const STORAGE_KEY = 'ds_orden_v1';

    const A_METROS = { m: 1, ft: 0.3048, in: 0.0254, mm: 0.001 };

    const fmt = (n, d = 2) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d });
    DS.fmt = fmt;

    // Texto corto de una medida: 2" · 4' · 6 m · 50 mm
    function medida(v, u) {
        const n = String(+(+v).toFixed(4));
        if (u === 'in') return n + '"';
        if (u === 'ft') return n + "'";
        return n + ' ' + u;
    }

    /* ----------------------------------------------------------------------
       Catálogos de espesores
       ---------------------------------------------------------------------- */
    const CAL = {
        26: { v: 0.0179, t: 'Cal. 26 (0.018")', s: 'Cal. 26' },
        24: { v: 0.0239, t: 'Cal. 24 (0.024")', s: 'Cal. 24' },
        22: { v: 0.0299, t: 'Cal. 22 (0.030")', s: 'Cal. 22' },
        20: { v: 0.0359, t: 'Cal. 20 (0.036")', s: 'Cal. 20' },
        18: { v: 0.0478, t: 'Cal. 18 (0.048")', s: 'Cal. 18' },
        16: { v: 0.0598, t: 'Cal. 16 (0.060")', s: 'Cal. 16' },
        14: { v: 0.0747, t: 'Cal. 14 (0.075")', s: 'Cal. 14' },
        12: { v: 0.1046, t: 'Cal. 12 (0.105")', s: 'Cal. 12' },
        11: { v: 0.1196, t: 'Cal. 11 (0.120")', s: 'Cal. 11' },
        10: { v: 0.1345, t: 'Cal. 10 (0.135")', s: 'Cal. 10' }
    };
    const FR = {
        '1/8': { v: 0.125, t: '1/8" (3.2 mm)', s: '1/8"' },
        '3/16': { v: 0.1875, t: '3/16" (4.8 mm)', s: '3/16"' },
        '1/4': { v: 0.25, t: '1/4" (6.4 mm)', s: '1/4"' },
        '5/16': { v: 0.3125, t: '5/16" (7.9 mm)', s: '5/16"' },
        '3/8': { v: 0.375, t: '3/8" (9.5 mm)', s: '3/8"' },
        '1/2': { v: 0.5, t: '1/2" (12.7 mm)', s: '1/2"' },
        '5/8': { v: 0.625, t: '5/8" (15.9 mm)', s: '5/8"' },
        '3/4': { v: 0.75, t: '3/4" (19.1 mm)', s: '3/4"' },
        '1': { v: 1, t: '1" (25.4 mm)', s: '1"' }
    };
    const cal = (...k) => k.map(x => CAL[x]);
    const fr = (...k) => k.map(x => FR[x]);

    // Vigas IPR comerciales (designación W, peso nominal en lb/ft)
    const IPR = [
        ['W4x13', 4, 4], ['W6x9', 6, 4], ['W6x12', 6, 4], ['W6x15', 6, 6], ['W6x20', 6, 6], ['W6x25', 6, 6],
        ['W8x10', 8, 4], ['W8x13', 8, 4], ['W8x15', 8, 4], ['W8x18', 8, 5.25], ['W8x21', 8, 5.25],
        ['W8x24', 8, 6.5], ['W8x28', 8, 6.5], ['W8x31', 8, 8], ['W8x35', 8, 8],
        ['W10x12', 10, 4], ['W10x15', 10, 4], ['W10x17', 10, 4], ['W10x19', 10, 4],
        ['W10x22', 10, 5.75], ['W10x26', 10, 5.75], ['W10x30', 10, 5.75], ['W10x33', 10, 8],
        ['W12x14', 12, 4], ['W12x16', 12, 4], ['W12x19', 12, 4], ['W12x22', 12, 4],
        ['W12x26', 12, 6.5], ['W12x30', 12, 6.5], ['W12x35', 12, 6.5],
        ['W14x22', 14, 5], ['W14x26', 14, 5], ['W14x30', 14, 6.75], ['W14x34', 14, 6.75],
        ['W16x26', 16, 5.5], ['W16x31', 16, 5.5], ['W16x36', 16, 7],
        ['W18x35', 18, 6], ['W18x40', 18, 6]
    ].map(([w, d, bf]) => {
        const kgm = parseFloat(w.split('x')[1]) * LBFT_A_KGM;
        const bfTxt = String(bf).replace('.25', '¼').replace('.5', '½').replace('.75', '¾');
        return { v: w, d, bf, kgm, t: `IPR ${d}" x ${bfTxt}" — ${fmt(kgm, 1)} kg/m (${w})`, s: `IPR ${d}" x ${bfTxt}" ${fmt(kgm, 1)} kg/m` };
    });

    // Varilla corrugada (número -> diámetro en pulgadas)
    const VARILLA = [
        { v: '2.5', d: 0.3125, t: '#2.5 — 5/16" (7.9 mm)', s: '#2.5 (5/16")' },
        { v: '3', d: 0.375, t: '#3 — 3/8" (9.5 mm)', s: '#3 (3/8")' },
        { v: '4', d: 0.5, t: '#4 — 1/2" (12.7 mm)', s: '#4 (1/2")' },
        { v: '5', d: 0.625, t: '#5 — 5/8" (15.9 mm)', s: '#5 (5/8")' },
        { v: '6', d: 0.75, t: '#6 — 3/4" (19.1 mm)', s: '#6 (3/4")' },
        { v: '8', d: 1, t: '#8 — 1" (25.4 mm)', s: '#8 (1")' },
        { v: '10', d: 1.25, t: '#10 — 1 1/4" (31.8 mm)', s: '#10 (1 1/4")' },
        { v: '12', d: 1.5, t: '#12 — 1 1/2" (38.1 mm)', s: '#12 (1 1/2")' }
    ];

    /* ----------------------------------------------------------------------
       Ayudantes de dibujo (SVG, viewBox 240 x 200)
       ---------------------------------------------------------------------- */
    const CX = 125, CY = 88;

    function fit(w, h, maxW = 150, maxH = 112) {
        const s = Math.min(maxW / w, maxH / h);
        return { s, W: w * s, H: h * s, x0: CX - (w * s) / 2, y0: CY - (h * s) / 2 };
    }
    const r1 = n => Math.round(n * 10) / 10;
    const poly = pts => 'M' + pts.map(p => r1(p[0]) + ' ' + r1(p[1])).join(' L') + ' Z';

    function label(x, y, txt) {
        const w = txt.length * 5.6 + 10;
        return `<rect class="bg" x="${r1(x - w / 2)}" y="${r1(y - 8)}" width="${r1(w)}" height="15" rx="2"/>` +
            `<text x="${r1(x)}" y="${r1(y + 3.5)}" text-anchor="middle">${esc(txt)}</text>`;
    }
    function dimH(x1, x2, y, txt) {
        return `<g class="dim"><line x1="${r1(x1)}" y1="${r1(y)}" x2="${r1(x2)}" y2="${r1(y)}"/>` +
            `<line class="tick" x1="${r1(x1)}" y1="${r1(y - 4)}" x2="${r1(x1)}" y2="${r1(y + 4)}"/>` +
            `<line class="tick" x1="${r1(x2)}" y1="${r1(y - 4)}" x2="${r1(x2)}" y2="${r1(y + 4)}"/>` +
            label((x1 + x2) / 2, y, txt) + '</g>';
    }
    function dimV(y1, y2, x, txt) {
        return `<g class="dim"><line x1="${r1(x)}" y1="${r1(y1)}" x2="${r1(x)}" y2="${r1(y2)}"/>` +
            `<line class="tick" x1="${r1(x - 4)}" y1="${r1(y1)}" x2="${r1(x + 4)}" y2="${r1(y1)}"/>` +
            `<line class="tick" x1="${r1(x - 4)}" y1="${r1(y2)}" x2="${r1(x + 4)}" y2="${r1(y2)}"/>` +
            label(x, (y1 + y2) / 2, txt) + '</g>';
    }
    function note(x, y, tx, ty, txt) {
        const half = (txt.length * 5.6 + 10) / 2;
        let cx = tx + (tx >= x ? 1 : -1) * (half + 2);
        cx = Math.min(Math.max(cx, half + 2), 238 - half);
        return `<g class="dim"><path d="M${r1(x)} ${r1(y)} L${r1(tx)} ${r1(ty)}"/>` +
            `<circle cx="${r1(x)}" cy="${r1(y)}" r="2" fill="#FFD700"/>` + label(cx, ty, txt) + '</g>';
    }
    const SVG_DEFS = '<defs>' +
        '<linearGradient id="steelGrad" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#6b7078"/><stop offset=".45" stop-color="#2f3238"/><stop offset=".7" stop-color="#4c5058"/><stop offset="1" stop-color="#25282d"/>' +
        '</linearGradient>' +
        '<linearGradient id="steelFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3d43"/><stop offset="1" stop-color="#1c1e22"/></linearGradient>' +
        '</defs>';

    function esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    DS.esc = esc;

    // Engrosa visualmente espesores muy delgados para que se vean en el dibujo
    const vis = (t, s, min = 3) => Math.max(t * s, min) / s;

    /* ----------------------------------------------------------------------
       Definición de cada tipo de producto
       ---------------------------------------------------------------------- */
    const TIPOS = {
        placa: {
            nombre: 'Placa / Lámina',
            hint: 'Placa, lámina lisa o antiderrapante',
            vista: 'Vista superior',
            icon: '<path d="M4 23 L14 13 H36 L26 23 Z"/><path d="M4 23 V27 H26 L36 17 V13"/><path d="M26 23 V27"/>',
            fields: [
                { id: 'espesor', label: 'Espesor / Calibre', type: 'gauge', full: true, def: '0.25',
                    groups: [['Placa (fracciones)', fr('1/8', '3/16', '1/4', '5/16', '3/8', '1/2', '5/8', '3/4', '1')], ['Calibres de lámina', cal(26, 24, 22, 20, 18, 16, 14, 12, 11, 10)]] },
                { id: 'ancho', label: 'Ancho', type: 'dim', units: ['ft', 'm', 'in', 'mm'], def: [4, 'ft'] },
                { id: 'largo', label: 'Largo', type: 'dim', units: ['ft', 'm', 'in', 'mm'], def: [8, 'ft'] },
                { id: 'hojas', label: 'Medidas comerciales', type: 'chips', items: [
                    { t: "3' x 8'", set: { ancho: [3, 'ft'], largo: [8, 'ft'] } },
                    { t: "4' x 8'", set: { ancho: [4, 'ft'], largo: [8, 'ft'] } },
                    { t: "4' x 10'", set: { ancho: [4, 'ft'], largo: [10, 'ft'] } },
                    { t: "5' x 10'", set: { ancho: [5, 'ft'], largo: [10, 'ft'] } },
                    { t: "8' x 20'", set: { ancho: [8, 'ft'], largo: [20, 'ft'] } },
                    { t: '1.22 x 2.44 m', set: { ancho: [1.22, 'm'], largo: [2.44, 'm'] } }
                ] }
            ],
            calc(g) {
                const t = g('espesor');
                return { pieza: t * g('ancho') * g('largo') * DENSIDAD, lineal: t * DENSIDAD, linealU: 'kg / m²' };
            },
            validate(g) {
                if (g('espesor') <= 0) return 'Indica el espesor';
                if (g('ancho') <= 0 || g('largo') <= 0) return 'Indica ancho y largo';
            },
            detalle: d => `Esp. ${d('espesor')} · ${d('ancho')} x ${d('largo')}`,
            draw(g, d) {
                const w = g('largo'), h = g('ancho');
                const f = fit(w, h, 150, 95);
                const off = 7;
                const x0 = f.x0 - off / 2, y0 = f.y0 - off / 2;
                return `<path class="shape-face" d="${poly([[x0 + off, y0 + off], [x0 + f.W + off, y0 + off], [x0 + f.W + off, y0 + f.H + off], [x0 + off, y0 + f.H + off]])}"/>` +
                    `<path class="shape" d="${poly([[x0, y0], [x0 + f.W, y0], [x0 + f.W, y0 + f.H], [x0, y0 + f.H]])}"/>` +
                    `<path class="dim" d="M${r1(x0 + f.W)} ${r1(y0)} L${r1(x0 + f.W + off)} ${r1(y0 + off)} M${r1(x0)} ${r1(y0 + f.H)} L${r1(x0 + off)} ${r1(y0 + f.H + off)}" stroke="#FFD700" stroke-width="1"/>` +
                    dimH(x0, x0 + f.W, y0 + f.H + off + 16, d('largo')) +
                    dimV(y0, y0 + f.H, x0 - 16, d('ancho')) +
                    `<text class="svg-note" x="${CX}" y="18" text-anchor="middle">ESPESOR ${esc(d('espesor'))}</text>`;
            }
        },

        ptr: {
            nombre: 'PTR / HSS',
            hint: 'Perfil tubular cuadrado o rectangular',
            vista: 'Sección transversal',
            icon: '<rect x="8" y="6" width="24" height="24" rx="2"/><rect x="13" y="11" width="14" height="14" rx="1"/>',
            fields: [
                { id: 'a', label: 'Lado A (ancho)', type: 'dim', units: ['in', 'mm'], def: [2, 'in'] },
                { id: 'b', label: 'Lado B (alto)', type: 'dim', units: ['in', 'mm'], def: [2, 'in'] },
                { id: 'espesor', label: 'Espesor de pared', type: 'gauge', def: '0.125',
                    groups: [['Calibres', cal(14, 12, 11, 10)], ['Fracciones', fr('1/8', '3/16', '1/4', '5/16', '3/8', '1/2')]] },
                { id: 'largo', label: 'Largo', type: 'dim', units: ['m', 'ft'], def: [6, 'm'] },
                { id: 'medidas', label: 'Medidas comunes', type: 'chips', items: [
                    { t: '1" x 1"', set: { a: [1, 'in'], b: [1, 'in'] } },
                    { t: '1 1/2" x 1 1/2"', set: { a: [1.5, 'in'], b: [1.5, 'in'] } },
                    { t: '2" x 1"', set: { a: [2, 'in'], b: [1, 'in'] } },
                    { t: '2" x 2"', set: { a: [2, 'in'], b: [2, 'in'] } },
                    { t: '3" x 1 1/2"', set: { a: [3, 'in'], b: [1.5, 'in'] } },
                    { t: '3" x 3"', set: { a: [3, 'in'], b: [3, 'in'] } },
                    { t: '4" x 2"', set: { a: [4, 'in'], b: [2, 'in'] } },
                    { t: '4" x 4"', set: { a: [4, 'in'], b: [4, 'in'] } },
                    { t: '6" x 6"', set: { a: [6, 'in'], b: [6, 'in'] } }
                ] }
            ],
            calc(g) {
                const a = g('a'), b = g('b'), t = g('espesor');
                const area = 2 * t * (a + b - 2 * t);
                return { pieza: area * g('largo') * DENSIDAD, lineal: area * DENSIDAD, linealU: 'kg / m' };
            },
            validate(g) {
                if (g('a') <= 0 || g('b') <= 0) return 'Indica las medidas del perfil';
                if (g('espesor') <= 0) return 'Indica el espesor de pared';
                if (2 * g('espesor') >= Math.min(g('a'), g('b'))) return 'El espesor es demasiado grande para esas medidas';
                if (g('largo') <= 0) return 'Indica el largo';
            },
            detalle: d => `${d('a')} x ${d('b')} · ${d('espesor')} · L ${d('largo')}`,
            draw(g, d) {
                const a = g('a'), b = g('b');
                const f = fit(a, b, 140, 105);
                const t = vis(g('espesor'), f.s) * f.s;
                const { x0, y0, W, H } = f;
                const path = poly([[x0, y0], [x0 + W, y0], [x0 + W, y0 + H], [x0, y0 + H]]) + ' ' +
                    poly([[x0 + t, y0 + t], [x0 + t, y0 + H - t], [x0 + W - t, y0 + H - t], [x0 + W - t, y0 + t]]);
                return `<path class="shape" d="${path}"/>` +
                    dimH(x0, x0 + W, y0 + H + 18, 'A = ' + d('a')) +
                    dimV(y0, y0 + H, x0 - 20, 'B = ' + d('b')) +
                    note(x0 + W - t / 2, y0 + H * 0.3, x0 + W + 18, y0 + 6, 't = ' + d('espesor'));
            }
        },

        tubo: {
            nombre: 'Tubo Redondo',
            hint: 'Usa el diámetro exterior real (ej. 2" céd. 40 = 2.375")',
            vista: 'Sección transversal',
            icon: '<circle cx="20" cy="18" r="12"/><circle cx="20" cy="18" r="7"/>',
            fields: [
                { id: 'diametro', label: 'Diámetro exterior', type: 'dim', units: ['in', 'mm'], def: [2.375, 'in'] },
                { id: 'espesor', label: 'Espesor de pared', type: 'gauge', def: 'custom', customDef: [0.154, 'in'],
                    groups: [['Calibres', cal(18, 16, 14, 12, 11, 10)], ['Fracciones', fr('1/8', '3/16', '1/4', '5/16', '3/8', '1/2')]] },
                { id: 'largo', label: 'Largo', type: 'dim', units: ['m', 'ft'], def: [6, 'm'], full: true },
                { id: 'ced', label: 'Tubo cédula 40 (diámetro nominal)', type: 'chips', items: [
                    { t: '1/2"', set: { diametro: [0.84, 'in'], espesor: { custom: [0.109, 'in'] } } },
                    { t: '3/4"', set: { diametro: [1.05, 'in'], espesor: { custom: [0.113, 'in'] } } },
                    { t: '1"', set: { diametro: [1.315, 'in'], espesor: { custom: [0.133, 'in'] } } },
                    { t: '1 1/4"', set: { diametro: [1.66, 'in'], espesor: { custom: [0.14, 'in'] } } },
                    { t: '1 1/2"', set: { diametro: [1.9, 'in'], espesor: { custom: [0.145, 'in'] } } },
                    { t: '2"', set: { diametro: [2.375, 'in'], espesor: { custom: [0.154, 'in'] } } },
                    { t: '3"', set: { diametro: [3.5, 'in'], espesor: { custom: [0.216, 'in'] } } },
                    { t: '4"', set: { diametro: [4.5, 'in'], espesor: { custom: [0.237, 'in'] } } }
                ] }
            ],
            calc(g) {
                const D = g('diametro'), t = g('espesor');
                const area = Math.PI * t * (D - t);
                return { pieza: area * g('largo') * DENSIDAD, lineal: area * DENSIDAD, linealU: 'kg / m' };
            },
            validate(g) {
                if (g('diametro') <= 0) return 'Indica el diámetro exterior';
                if (g('espesor') <= 0) return 'Indica el espesor de pared';
                if (2 * g('espesor') >= g('diametro')) return 'El espesor es demasiado grande para ese diámetro';
                if (g('largo') <= 0) return 'Indica el largo';
            },
            detalle: d => `Ø ext. ${d('diametro')} · pared ${d('espesor')} · L ${d('largo')}`,
            draw(g, d) {
                const D = g('diametro');
                const f = fit(D, D, 120, 112);
                const R = f.W / 2, r = R - vis(g('espesor'), f.s) * f.s;
                const c = `M${CX - R} ${CY} a${R} ${R} 0 1 0 ${2 * R} 0 a${R} ${R} 0 1 0 ${-2 * R} 0 Z ` +
                    `M${r1(CX - r)} ${CY} a${r1(r)} ${r1(r)} 0 1 0 ${r1(2 * r)} 0 a${r1(r)} ${r1(r)} 0 1 0 ${r1(-2 * r)} 0 Z`;
                return `<path class="shape" d="${c}"/>` +
                    dimH(CX - R, CX + R, CY + R + 18, 'Ø ' + d('diametro')) +
                    note(CX + R * 0.72, CY - R * 0.66, CX + R + 14, CY - R + 2, 't = ' + d('espesor'));
            }
        },

        polin: {
            nombre: 'Polín Monten',
            hint: 'Perfil C o Z formado en frío',
            vista: 'Sección transversal',
            icon: '<path d="M30 11 V6 H10 V30 H30 V25"/>',
            fields: [
                { id: 'tipo', label: 'Tipo de polín', type: 'select', full: true, def: 'c',
                    options: [{ v: 'c', t: 'Polín C' }, { v: 'z', t: 'Polín Z' }] },
                { id: 'peralte', label: 'Peralte (altura)', type: 'dim', units: ['in', 'mm'], def: [4, 'in'] },
                { id: 'patin', label: 'Ancho de patín', type: 'dim', units: ['in', 'mm'], def: [2, 'in'] },
                { id: 'labio', label: 'Labio (0 = sin labio)', type: 'dim', units: ['in', 'mm'], def: [0.625, 'in'] },
                { id: 'espesor', label: 'Espesor / Calibre', type: 'gauge', def: '0.0747', groups: [['Calibres', cal(16, 14, 12, 10)]] },
                { id: 'largo', label: 'Largo', type: 'dim', units: ['m', 'ft'], def: [6, 'm'], full: true },
                { id: 'peraltes', label: 'Peraltes comunes', type: 'chips', items: [
                    { t: '3"', set: { peralte: [3, 'in'] } }, { t: '4"', set: { peralte: [4, 'in'] } },
                    { t: '5"', set: { peralte: [5, 'in'] } }, { t: '6"', set: { peralte: [6, 'in'] } },
                    { t: '7"', set: { peralte: [7, 'in'] } }, { t: '8"', set: { peralte: [8, 'in'] } },
                    { t: '10"', set: { peralte: [10, 'in'] } }
                ] }
            ],
            calc(g) {
                const h = g('peralte'), b = g('patin'), c = g('labio'), t = g('espesor');
                const linea = c > 0 ? h + 2 * b + 2 * c - 4 * t : h + 2 * b - 2 * t;
                const area = t * linea;
                return { pieza: area * g('largo') * DENSIDAD, lineal: area * DENSIDAD, linealU: 'kg / m' };
            },
            validate(g) {
                if (g('peralte') <= 0 || g('patin') <= 0) return 'Indica peralte y patín';
                if (g('espesor') <= 0) return 'Indica el espesor';
                if (2 * g('espesor') >= Math.min(g('peralte'), g('patin'))) return 'El espesor es demasiado grande';
                if (g('labio') > g('peralte') / 2) return 'El labio no puede ser mayor a la mitad del peralte';
                if (g('largo') <= 0) return 'Indica el largo';
            },
            detalle: d => `${d('tipo') === 'z' ? 'Z' : 'C'} ${d('peralte')} x ${d('patin')} · labio ${d('labio')} · ${d('espesor')} · L ${d('largo')}`,
            draw(g, d) {
                const z = g('tipo') === 'z';
                const h = g('peralte'), b = g('patin');
                const f = fit(z ? 2 * b : b, h, 130, 112);
                const s = f.s;
                const t = vis(g('espesor'), s);
                const c = g('labio') > 0 ? Math.max(g('labio'), t * 1.5) : 0;
                let pts, webX, topX;
                if (!z) {
                    pts = c > 0
                        ? [[0, 0], [b, 0], [b, c], [b - t, c], [b - t, t], [t, t], [t, h - t], [b - t, h - t], [b - t, h - c], [b, h - c], [b, h], [0, h]]
                        : [[0, 0], [b, 0], [b, t], [t, t], [t, h - t], [b, h - t], [b, h], [0, h]];
                    webX = t / 2;
                    topX = 0;
                } else {
                    // Alma entre x = b - t y x = b; patín superior a la derecha, inferior a la izquierda
                    const L = b - t;
                    pts = c > 0
                        ? [[L, 0], [L + b, 0], [L + b, c], [L + b - t, c], [L + b - t, t], [b, t], [b, h], [0, h], [0, h - c], [t, h - c], [t, h - t], [L, h - t]]
                        : [[L, 0], [L + b, 0], [L + b, t], [b, t], [b, h], [0, h], [0, h - t], [L, h - t]];
                    webX = b - t / 2;
                    topX = L;
                }
                const totalW = z ? 2 * b - t : b;
                const x0 = CX - (totalW * s) / 2, y0 = f.y0;
                const P = pts.map(p => [x0 + p[0] * s, y0 + p[1] * s]);
                return `<path class="shape" d="${poly(P)}"/>` +
                    dimV(y0, y0 + h * s, x0 - 18, d('peralte')) +
                    dimH(x0 + topX * s, x0 + (topX + b) * s, y0 - 14, d('patin')) +
                    note(x0 + webX * s, y0 + h * s * 0.55, x0 + totalW * s + 20, y0 + h * s * 0.55, 't = ' + d('espesor'));
            }
        },

        ipr: {
            nombre: 'Viga IPR / H',
            hint: 'Elige una medida comercial o define dimensiones',
            vista: 'Sección transversal',
            icon: '<path d="M8 6h24v5h-9.5v14H32v5H8v-5h9.5V11H8z"/>',
            fields: [
                { id: 'perfil', label: 'Perfil', type: 'select', full: true, def: 'W8x15',
                    options: IPR.concat([{ v: 'custom', t: '📐 Otra (definir dimensiones)' }]) },
                { id: 'd', label: 'Peralte (d)', type: 'dim', units: ['in', 'mm'], def: [8, 'in'], showIf: s => s.perfil.v === 'custom' },
                { id: 'bf', label: 'Ancho de patín (bf)', type: 'dim', units: ['in', 'mm'], def: [4, 'in'], showIf: s => s.perfil.v === 'custom' },
                { id: 'tw', label: 'Espesor del alma (tw)', type: 'dim', units: ['in', 'mm'], def: [0.245, 'in'], showIf: s => s.perfil.v === 'custom' },
                { id: 'tf', label: 'Espesor del patín (tf)', type: 'dim', units: ['in', 'mm'], def: [0.315, 'in'], showIf: s => s.perfil.v === 'custom' },
                { id: 'largo', label: 'Largo', type: 'dim', units: ['m', 'ft'], def: [6.1, 'm'], full: true },
                { id: 'largos', label: 'Largos comunes', type: 'chips', items: [
                    { t: '6.10 m (20\')', set: { largo: [6.1, 'm'] } },
                    { t: '9.15 m (30\')', set: { largo: [9.15, 'm'] } },
                    { t: '12.20 m (40\')', set: { largo: [12.2, 'm'] } }
                ] }
            ],
            calc(g) {
                let kgm;
                const p = g('perfil');
                if (p !== 'custom') {
                    kgm = IPR.find(x => x.v === p).kgm;
                } else {
                    const area = 2 * g('bf') * g('tf') + (g('d') - 2 * g('tf')) * g('tw');
                    kgm = area * DENSIDAD;
                }
                return { pieza: kgm * g('largo'), lineal: kgm, linealU: 'kg / m' };
            },
            validate(g) {
                if (g('perfil') === 'custom') {
                    if (g('d') <= 0 || g('bf') <= 0 || g('tw') <= 0 || g('tf') <= 0) return 'Completa las dimensiones de la viga';
                    if (2 * g('tf') >= g('d')) return 'El espesor de patín es demasiado grande';
                    if (g('tw') >= g('bf')) return 'El alma no puede ser más ancha que el patín';
                }
                if (g('largo') <= 0) return 'Indica el largo';
            },
            detalle(d, g) {
                if (g('perfil') !== 'custom') return `${IPR.find(x => x.v === g('perfil')).s} · L ${d('largo')}`;
                return `d ${d('d')} · bf ${d('bf')} · tw ${d('tw')} · tf ${d('tf')} · L ${d('largo')}`;
            },
            draw(g, d) {
                const custom = g('perfil') === 'custom';
                let D, BF, TW, TF, lblD, lblB;
                if (custom) {
                    D = g('d'); BF = g('bf'); TW = g('tw'); TF = g('tf'); lblD = d('d'); lblB = d('bf');
                } else {
                    const p = IPR.find(x => x.v === g('perfil'));
                    D = p.d; BF = p.bf; TW = p.d * 0.032; TF = p.d * 0.045; lblD = p.d + '"'; lblB = String(p.bf) + '"';
                }
                const f = fit(BF, D, 130, 112);
                const s = f.s;
                const tw = vis(TW, s, 3), tf = vis(TF, s, 3.5);
                const pts = [[0, 0], [BF, 0], [BF, tf], [BF / 2 + tw / 2, tf], [BF / 2 + tw / 2, D - tf], [BF, D - tf], [BF, D], [0, D], [0, D - tf], [BF / 2 - tw / 2, D - tf], [BF / 2 - tw / 2, tf], [0, tf]];
                const P = pts.map(p => [f.x0 + p[0] * s, f.y0 + p[1] * s]);
                let out = `<path class="shape" d="${poly(P)}"/>` +
                    dimV(f.y0, f.y0 + f.H, f.x0 - 18, 'd = ' + lblD) +
                    dimH(f.x0, f.x0 + f.W, f.y0 + f.H + 18, 'bf = ' + lblB);
                if (custom) {
                    out += note(CX + tw * s / 2, CY, f.x0 + f.W + 16, CY, 'tw ' + d('tw')) +
                        note(f.x0 + f.W * 0.85, f.y0 + tf * s / 2, f.x0 + f.W + 16, f.y0 - 4, 'tf ' + d('tf'));
                } else {
                    out += `<text class="svg-note" x="${CX}" y="14" text-anchor="middle">${esc(g('perfil'))}</text>`;
                }
                return out;
            }
        },

        angulo: {
            nombre: 'Ángulo',
            hint: 'Lados iguales o desiguales',
            vista: 'Sección transversal',
            icon: '<path d="M10 6v24h22v-5H15V6z"/>',
            fields: [
                { id: 'tipo', label: 'Tipo de ángulo', type: 'select', full: true, def: 'igual',
                    options: [{ v: 'igual', t: 'Ángulo de lados iguales (L)' }, { v: 'desigual', t: 'Ángulo de lados desiguales (L)' }] },
                { id: 'a', label: 'Lado A', type: 'dim', units: ['in', 'mm'], def: [2, 'in'] },
                { id: 'b', label: 'Lado B', type: 'dim', units: ['in', 'mm'], def: [2, 'in'], showIf: s => s.tipo.v === 'desigual' },
                { id: 'espesor', label: 'Espesor', type: 'gauge', def: '0.1875', groups: [['Fracciones', fr('1/8', '3/16', '1/4', '5/16', '3/8', '1/2', '5/8', '3/4')]] },
                { id: 'largo', label: 'Largo', type: 'dim', units: ['m', 'ft'], def: [6, 'm'], full: true },
                { id: 'medidas', label: 'Medidas comunes', type: 'chips', items: [
                    { t: '1"', set: { a: [1, 'in'], b: [1, 'in'] } }, { t: '1 1/4"', set: { a: [1.25, 'in'], b: [1.25, 'in'] } },
                    { t: '1 1/2"', set: { a: [1.5, 'in'], b: [1.5, 'in'] } }, { t: '2"', set: { a: [2, 'in'], b: [2, 'in'] } },
                    { t: '2 1/2"', set: { a: [2.5, 'in'], b: [2.5, 'in'] } }, { t: '3"', set: { a: [3, 'in'], b: [3, 'in'] } },
                    { t: '4"', set: { a: [4, 'in'], b: [4, 'in'] } }
                ] }
            ],
            ladoB: g => (g('tipo') === 'igual' ? g('a') : g('b')),
            calc(g) {
                const a = g('a'), b = this.ladoB(g), t = g('espesor');
                const area = t * (a + b - t);
                return { pieza: area * g('largo') * DENSIDAD, lineal: area * DENSIDAD, linealU: 'kg / m' };
            },
            validate(g) {
                if (g('a') <= 0 || this.ladoB(g) <= 0) return 'Indica la medida de los lados';
                if (g('espesor') <= 0) return 'Indica el espesor';
                if (g('espesor') >= Math.min(g('a'), this.ladoB(g))) return 'El espesor es demasiado grande';
                if (g('largo') <= 0) return 'Indica el largo';
            },
            detalle: (d, g) => `${d('a')} x ${g('tipo') === 'igual' ? d('a') : d('b')} · ${d('espesor')} · L ${d('largo')}`,
            draw(g, d) {
                const a = g('a'), b = this.ladoB(g);
                const f = fit(b, a, 130, 112);
                const s = f.s, t = vis(g('espesor'), s, 3.5);
                const pts = [[0, 0], [t, 0], [t, a - t], [b, a - t], [b, a], [0, a]];
                const P = pts.map(p => [f.x0 + p[0] * s, f.y0 + p[1] * s]);
                const lb = g('tipo') === 'igual' ? d('a') : d('b');
                return `<path class="shape" d="${poly(P)}"/>` +
                    dimV(f.y0, f.y0 + f.H, f.x0 - 18, 'A = ' + d('a')) +
                    dimH(f.x0, f.x0 + f.W, f.y0 + f.H + 18, 'B = ' + lb) +
                    note(f.x0 + t * s / 2, f.y0 + f.H * 0.35, f.x0 + t * s + 26, f.y0 + f.H * 0.25, 't = ' + d('espesor'));
            }
        },

        solera: {
            nombre: 'Solera',
            hint: 'Barra plana de acero',
            vista: 'Sección transversal',
            icon: '<rect x="5" y="14" width="30" height="8" rx="1"/>',
            fields: [
                { id: 'ancho', label: 'Ancho', type: 'dim', units: ['in', 'mm'], def: [2, 'in'] },
                { id: 'espesor', label: 'Espesor', type: 'gauge', def: '0.25', groups: [['Fracciones', fr('1/8', '3/16', '1/4', '5/16', '3/8', '1/2', '5/8', '3/4', '1')]] },
                { id: 'largo', label: 'Largo', type: 'dim', units: ['m', 'ft'], def: [6, 'm'], full: true },
                { id: 'anchos', label: 'Anchos comunes', type: 'chips', items: [
                    { t: '1/2"', set: { ancho: [0.5, 'in'] } }, { t: '3/4"', set: { ancho: [0.75, 'in'] } },
                    { t: '1"', set: { ancho: [1, 'in'] } }, { t: '1 1/2"', set: { ancho: [1.5, 'in'] } },
                    { t: '2"', set: { ancho: [2, 'in'] } }, { t: '3"', set: { ancho: [3, 'in'] } },
                    { t: '4"', set: { ancho: [4, 'in'] } }
                ] }
            ],
            calc(g) {
                const area = g('ancho') * g('espesor');
                return { pieza: area * g('largo') * DENSIDAD, lineal: area * DENSIDAD, linealU: 'kg / m' };
            },
            validate(g) {
                if (g('ancho') <= 0 || g('espesor') <= 0) return 'Indica ancho y espesor';
                if (g('largo') <= 0) return 'Indica el largo';
            },
            detalle: d => `${d('ancho')} x ${d('espesor')} · L ${d('largo')}`,
            draw(g, d) {
                const w = g('ancho'), t = g('espesor');
                const f = fit(w, t, 160, 60);
                const H = Math.max(f.H, 8);
                const y0 = CY - H / 2;
                return `<path class="shape" d="${poly([[f.x0, y0], [f.x0 + f.W, y0], [f.x0 + f.W, y0 + H], [f.x0, y0 + H]])}"/>` +
                    dimH(f.x0, f.x0 + f.W, y0 + H + 20, d('ancho')) +
                    dimV(y0, y0 + H, f.x0 - 18, d('espesor'));
            }
        },

        varilla: {
            nombre: 'Varilla Corrugada',
            hint: 'Selecciona el número de varilla',
            vista: 'Vista lateral (esquemática)',
            icon: '<rect x="4" y="14" width="32" height="8" rx="4"/><path d="M10 14l3 8M16 14l3 8M22 14l3 8M28 14l3 8"/>',
            fields: [
                { id: 'numero', label: 'Número de varilla', type: 'select', full: true, def: '3',
                    options: VARILLA.concat([{ v: 'custom', t: '📐 Otro diámetro' }]) },
                { id: 'diametro', label: 'Diámetro', type: 'dim', units: ['in', 'mm'], def: [0.5, 'in'], showIf: s => s.numero.v === 'custom' },
                { id: 'largo', label: 'Largo', type: 'dim', units: ['m', 'ft'], def: [12, 'm'], full: true },
                { id: 'largos', label: 'Largos comunes', type: 'chips', items: [
                    { t: '6 m', set: { largo: [6, 'm'] } }, { t: '9 m', set: { largo: [9, 'm'] } }, { t: '12 m', set: { largo: [12, 'm'] } }
                ] }
            ],
            diam(g) {
                const n = g('numero');
                return n === 'custom' ? g('diametro') : VARILLA.find(x => x.v === n).d * A_METROS.in;
            },
            calc(g) {
                const D = this.diam(g);
                const area = Math.PI / 4 * D * D;
                return { pieza: area * g('largo') * DENSIDAD, lineal: area * DENSIDAD, linealU: 'kg / m' };
            },
            validate(g) {
                if (this.diam(g) <= 0) return 'Indica el diámetro';
                if (g('largo') <= 0) return 'Indica el largo';
            },
            detalle(d, g) {
                const n = g('numero');
                return `${n === 'custom' ? 'Ø ' + d('diametro') : VARILLA.find(x => x.v === n).s} · L ${d('largo')}`;
            },
            draw(g, d) {
                const n = g('numero');
                const dTxt = n === 'custom' ? d('diametro') : VARILLA.find(x => x.v === n).s;
                const dm = this.diam(g) * 1000;
                const H = Math.min(Math.max(dm * 1.1, 12), 40);
                const x0 = 22, x1 = 228, y0 = CY - H / 2;
                let ribs = '';
                for (let x = x0 + 8; x < x1 - 4; x += 11) {
                    ribs += `M${x} ${r1(y0)} L${r1(x + H * 0.45)} ${r1(y0 + H)} `;
                }
                return `<path class="shape" d="M${x0} ${r1(y0)} H${x1} a${r1(H / 2)} ${r1(H / 2)} 0 0 1 0 ${r1(H)} H${x0} a${r1(H / 2)} ${r1(H / 2)} 0 0 1 0 ${r1(-H)} Z"/>` +
                    `<path d="${ribs}" stroke="#FFD700" stroke-opacity=".55" stroke-width="1.4" fill="none"/>` +
                    `<line x1="${x0}" y1="${CY}" x2="${x1}" y2="${CY}" stroke="#FFD700" stroke-opacity=".35" stroke-width="1"/>` +
                    dimH(x0 - H / 2, x1 + H / 2, y0 + H + 22, 'L = ' + d('largo')) +
                    `<text class="svg-note" x="${CX}" y="${r1(y0 - 16)}" text-anchor="middle">VARILLA ${esc(dTxt)}</text>`;
            }
        }
    };

    DS.TIPOS = TIPOS;

    /* ----------------------------------------------------------------------
       Estado
       ---------------------------------------------------------------------- */
    const state = {};
    let tipoActual = 'placa';

    function initState(tipo) {
        const st = {};
        TIPOS[tipo].fields.forEach(f => {
            if (f.type === 'dim') st[f.id] = { v: f.def[0], u: f.def[1] };
            else if (f.type === 'gauge') {
                const cd = f.customDef || ['', 'in'];
                st[f.id] = { sel: f.def, cv: cd[0], cu: cd[1] };
            } else if (f.type === 'select') st[f.id] = { v: f.def };
        });
        state[tipo] = st;
    }
    Object.keys(TIPOS).forEach(initState);

    const fieldDef = (tipo, id) => TIPOS[tipo].fields.find(f => f.id === id);

    function gaugeOption(f, sel) {
        for (const [, items] of f.groups) {
            const o = items.find(x => String(x.v) === String(sel));
            if (o) return o;
        }
        return null;
    }

    // Valor en metros (dim / gauge) o valor crudo (select)
    function getter(tipo) {
        const st = state[tipo];
        return id => {
            const f = fieldDef(tipo, id), s = st[id];
            if (!f || !s) return 0;
            if (f.type === 'dim') return Math.max(parseFloat(s.v) || 0, 0) * A_METROS[s.u];
            if (f.type === 'gauge') {
                if (s.sel === 'custom') return Math.max(parseFloat(s.cv) || 0, 0) * A_METROS[s.cu];
                return parseFloat(s.sel) * A_METROS.in;
            }
            return s.v;
        };
    }

    // Texto legible de cada campo
    function display(tipo) {
        const st = state[tipo];
        return id => {
            const f = fieldDef(tipo, id), s = st[id];
            if (!f || !s) return '';
            if (f.type === 'dim') return medida(parseFloat(s.v) || 0, s.u);
            if (f.type === 'gauge') {
                if (s.sel === 'custom') return medida(parseFloat(s.cv) || 0, s.cu);
                const o = gaugeOption(f, s.sel);
                return o ? o.s : s.sel;
            }
            return s.v;
        };
    }

    /* ----------------------------------------------------------------------
       DOM
       ---------------------------------------------------------------------- */
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const el = {
        calc: $('#calc'),
        tabs: $('#calc-tabs'),
        fields: $('#calc-fields'),
        title: $('#calc-title'),
        hint: $('#calc-hint'),
        svg: $('#calc-svg'),
        drawingLabel: $('#calc-drawing-label'),
        qty: $('#calc-cantidad'),
        total: $('#calc-total'),
        pieza: $('#calc-pieza'),
        lineal: $('#calc-lineal'),
        linealU: $('#calc-lineal-u'),
        lb: $('#calc-lb'),
        ton: $('#calc-ton'),
        add: $('#calc-add'),
        reset: $('#calc-reset'),
        totalWrap: $('.calc-total')
    };
    if (!el.calc) return;

    function buildTabs() {
        const frag = document.createDocumentFragment();
        Object.entries(TIPOS).forEach(([key, T]) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'calc-tab';
            b.setAttribute('role', 'tab');
            b.dataset.tipo = key;
            b.setAttribute('aria-selected', 'false');
            b.innerHTML = `<svg viewBox="0 0 40 36" aria-hidden="true">${T.icon}</svg><span>${esc(T.nombre)}</span>`;
            frag.appendChild(b);
        });
        const ind = document.createElement('span');
        ind.className = 'calc-tab-indicator';
        frag.appendChild(ind);
        el.tabs.appendChild(frag);
        el.indicator = ind;
        el.tabs.addEventListener('click', e => {
            const b = e.target.closest('.calc-tab');
            if (b) setTipo(b.dataset.tipo);
        });
    }

    function moveIndicator() {
        const active = $('.calc-tab.is-active', el.tabs);
        if (!active || !el.indicator) return;
        el.indicator.style.width = active.offsetWidth + 'px';
        el.indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    }

    function optionHTML(o, sel) {
        return `<option value="${esc(o.v)}"${String(o.v) === String(sel) ? ' selected' : ''}>${esc(o.t)}</option>`;
    }

    function buildField(f, st, i) {
        const wrap = document.createElement('div');
        wrap.className = 'field' + (f.full || f.type === 'chips' ? ' full' : '');
        wrap.dataset.field = f.id;
        wrap.style.setProperty('--i', i);
        const fid = `f-${tipoActual}-${f.id}`;
        const s = st[f.id];

        if (f.type === 'dim') {
            wrap.innerHTML = `<label for="${fid}">${esc(f.label)}</label>
                <div class="field-control">
                    <input type="number" id="${fid}" data-role="v" value="${esc(s.v)}" min="0" step="any" inputmode="decimal">
                    <select class="unit" data-role="u" aria-label="Unidad de ${esc(f.label)}">${f.units.map(u => `<option value="${u}"${u === s.u ? ' selected' : ''}>${u}</option>`).join('')}</select>
                </div>`;
        } else if (f.type === 'gauge') {
            const groups = f.groups.map(([lbl, items]) => `<optgroup label="${esc(lbl)}">${items.map(o => optionHTML(o, s.sel)).join('')}</optgroup>`).join('');
            wrap.innerHTML = `<label for="${fid}">${esc(f.label)}</label>
                <div class="field-control">
                    <select class="full-select" id="${fid}" data-role="sel">${groups}
                        <optgroup label="Medida personalizada"><option value="custom"${s.sel === 'custom' ? ' selected' : ''}>📐 Otra medida…</option></optgroup>
                    </select>
                </div>
                <div class="field-control field-custom${s.sel === 'custom' ? ' is-open' : ''}">
                    <input type="number" data-role="cv" value="${esc(s.cv)}" min="0" step="any" inputmode="decimal" placeholder="Espesor" aria-label="${esc(f.label)} personalizado">
                    <select class="unit" data-role="cu" aria-label="Unidad del espesor">${['in', 'mm'].map(u => `<option value="${u}"${u === s.cu ? ' selected' : ''}>${u}</option>`).join('')}</select>
                </div>`;
        } else if (f.type === 'select') {
            wrap.innerHTML = `<label for="${fid}">${esc(f.label)}</label>
                <div class="field-control"><select class="full-select" id="${fid}" data-role="v">${f.options.map(o => optionHTML(o, s.v)).join('')}</select></div>`;
        } else if (f.type === 'chips') {
            wrap.innerHTML = `<label>${esc(f.label)}</label>
                <div class="quick-chips">${f.items.map((c, k) => `<button type="button" data-chip="${k}">${esc(c.t)}</button>`).join('')}</div>`;
        }
        return wrap;
    }

    function renderFields(animate) {
        const T = TIPOS[tipoActual], st = state[tipoActual];
        el.fields.innerHTML = '';
        T.fields.forEach((f, i) => el.fields.appendChild(buildField(f, st, i)));
        updateVisibility();
        if (animate) {
            el.fields.classList.remove('anim');
            void el.fields.offsetWidth;
            el.fields.classList.add('anim');
        }
    }

    function updateVisibility() {
        const T = TIPOS[tipoActual], st = state[tipoActual];
        T.fields.forEach(f => {
            if (!f.showIf) return;
            const w = el.fields.querySelector(`[data-field="${f.id}"]`);
            if (w) w.classList.toggle('is-hidden', !f.showIf(st));
        });
    }

    function syncFieldDOM(id) {
        const f = fieldDef(tipoActual, id), s = state[tipoActual][id];
        const w = el.fields.querySelector(`[data-field="${id}"]`);
        if (!w || !f) return;
        if (f.type === 'dim') {
            w.querySelector('[data-role="v"]').value = s.v;
            w.querySelector('[data-role="u"]').value = s.u;
        } else if (f.type === 'gauge') {
            w.querySelector('[data-role="sel"]').value = s.sel;
            w.querySelector('[data-role="cv"]').value = s.cv;
            w.querySelector('[data-role="cu"]').value = s.cu;
            w.querySelector('.field-custom').classList.toggle('is-open', s.sel === 'custom');
        } else if (f.type === 'select') {
            w.querySelector('[data-role="v"]').value = s.v;
        }
        w.querySelectorAll('.field-control').forEach(c => {
            c.classList.remove('invalid');
            void c.offsetWidth;
        });
    }

    function onFieldInput(e) {
        const target = e.target;
        const w = target.closest('[data-field]');
        if (!w || !target.dataset.role) return;
        const id = w.dataset.field, role = target.dataset.role;
        const s = state[tipoActual][id];
        s[role] = target.value;
        if (role === 'sel') {
            w.querySelector('.field-custom').classList.toggle('is-open', s.sel === 'custom');
            if (s.sel === 'custom') setTimeout(() => w.querySelector('[data-role="cv"]').focus(), 50);
        }
        if (target.tagName === 'SELECT') updateVisibility();
        recalc(target.tagName === 'SELECT');
    }

    function onChip(e) {
        const b = e.target.closest('[data-chip]');
        if (!b) return;
        const w = b.closest('[data-field]');
        const f = fieldDef(tipoActual, w.dataset.field);
        const chip = f.items[+b.dataset.chip];
        const st = state[tipoActual];
        Object.entries(chip.set).forEach(([id, val]) => {
            if (Array.isArray(val)) {
                st[id].v = val[0];
                st[id].u = val[1];
            } else if (val.custom) {
                st[id].sel = 'custom';
                st[id].cv = val.custom[0];
                st[id].cu = val.custom[1];
            }
            syncFieldDOM(id);
        });
        w.querySelectorAll('[data-chip]').forEach(x => x.classList.toggle('is-active', x === b));
        updateVisibility();
        recalc(true);
    }

    /* ----------------------------------------------------------------------
       Cálculo + resultados animados
       ---------------------------------------------------------------------- */
    let ultimo = { total: 0, pieza: 0, lineal: 0, lb: 0, ton: 0 };
    let resultado = null;

    function cantidad() {
        return Math.max(1, Math.floor(parseFloat(el.qty.value) || 1));
    }

    function animateNumber(node, from, to, dec) {
        if (DS.reducedMotion || from === to) {
            node.textContent = fmt(to, dec);
            return;
        }
        const start = performance.now(), dur = 550;
        cancelAnimationFrame(node._raf);
        const step = now => {
            const p = Math.min((now - start) / dur, 1);
            const e = 1 - Math.pow(1 - p, 3);
            node.textContent = fmt(from + (to - from) * e, dec);
            if (p < 1) node._raf = requestAnimationFrame(step);
        };
        node._raf = requestAnimationFrame(step);
    }

    function recalc(redraw) {
        const T = TIPOS[tipoActual];
        const g = getter(tipoActual), d = display(tipoActual);
        const err = T.validate ? T.validate.call(T, g) : null;
        let r = { pieza: 0, lineal: 0, linealU: 'kg / m' };
        if (!err) r = T.calc.call(T, g);
        if (!isFinite(r.pieza) || r.pieza < 0) r.pieza = 0;

        const qty = cantidad();
        const nuevo = { total: r.pieza * qty, pieza: r.pieza, lineal: r.lineal, lb: r.pieza * qty * KG_A_LB, ton: r.pieza * qty / 1000 };

        animateNumber(el.total, ultimo.total, nuevo.total, 2);
        animateNumber(el.pieza, ultimo.pieza, nuevo.pieza, 2);
        animateNumber(el.lineal, ultimo.lineal, nuevo.lineal, 2);
        animateNumber(el.lb, ultimo.lb, nuevo.lb, 2);
        animateNumber(el.ton, ultimo.ton, nuevo.ton, 3);
        el.linealU.textContent = r.linealU;
        if (Math.abs(nuevo.total - ultimo.total) > 0.004) {
            el.totalWrap.classList.remove('flash');
            void el.totalWrap.offsetWidth;
            el.totalWrap.classList.add('flash');
        }
        ultimo = nuevo;

        el.hint.textContent = err || T.hint;
        el.hint.style.color = err ? 'var(--danger)' : '';
        el.add.disabled = !!err || r.pieza <= 0;
        el.add.style.opacity = el.add.disabled ? .5 : '';

        resultado = err ? null : {
            tipo: tipoActual,
            producto: T.nombre,
            detalle: T.detalle.call(T, d, g),
            kgPieza: r.pieza,
            cantidad: qty
        };

        drawSVG(redraw);
    }

    function drawSVG(animate) {
        const T = TIPOS[tipoActual];
        let body = '';
        try {
            body = T.draw.call(T, getter(tipoActual), display(tipoActual));
        } catch (e) {
            body = '';
        }
        el.svg.innerHTML = SVG_DEFS + body;
        el.drawingLabel.textContent = T.vista;
        if (animate && !DS.reducedMotion) {
            el.svg.classList.remove('draw-anim');
            void el.svg.getBoundingClientRect();
            el.svg.classList.add('draw-anim');
        } else if (!animate) {
            el.svg.classList.remove('draw-anim');
        }
    }

    function setTipo(tipo, preset) {
        if (!TIPOS[tipo]) return;
        const cambio = tipo !== tipoActual;
        tipoActual = tipo;
        if (preset) {
            const st = state[tipo];
            Object.entries(preset).forEach(([id, val]) => Object.assign(st[id], val));
        }
        el.tabs.querySelectorAll('.calc-tab').forEach(b => {
            const on = b.dataset.tipo === tipo;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
            if (on && cambio) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        });
        el.title.textContent = TIPOS[tipo].nombre;
        moveIndicator();
        renderFields(true);
        recalc(true);
    }

    /* ----------------------------------------------------------------------
       ORDEN
       ---------------------------------------------------------------------- */
    const storage = {
        get() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                const data = raw ? JSON.parse(raw) : [];
                return Array.isArray(data) ? data.filter(x => x && typeof x.kgPieza === 'number') : [];
            } catch (e) {
                return [];
            }
        },
        set(items) {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* sin almacenamiento */ }
        }
    };

    const Orden = {
        items: storage.get(),
        listeners: [],
        totals() {
            const kg = this.items.reduce((a, it) => a + it.kgPieza * it.cantidad, 0);
            const piezas = this.items.reduce((a, it) => a + it.cantidad, 0);
            return { kg, piezas, partidas: this.items.length };
        },
        emit(type, payload) {
            storage.set(this.items);
            this.listeners.forEach(fn => fn(type, payload));
        },
        add(item) {
            const it = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, item);
            this.items.push(it);
            this.emit('add', it);
            return it;
        },
        remove(id) {
            this.items = this.items.filter(it => it.id !== id);
            this.emit('remove', id);
        },
        setQty(id, q) {
            const it = this.items.find(x => x.id === id);
            if (!it) return;
            it.cantidad = Math.max(1, Math.floor(q) || 1);
            this.emit('qty', it);
        },
        clear() {
            this.items = [];
            this.emit('clear');
        },
        on(fn) { this.listeners.push(fn); }
    };
    DS.orden = Orden;

    function folio() {
        const n = new Date();
        const p = x => String(x).padStart(2, '0');
        return `DS-${String(n.getFullYear()).slice(2)}${p(n.getMonth() + 1)}${p(n.getDate())}-${p(n.getHours())}${p(n.getMinutes())}`;
    }

    function clienteDatos() {
        const nom = ($('#orden-cliente') && $('#orden-cliente').value.trim()) || ($('#quote-name') && $('#quote-name').value.trim()) || '';
        const tel = ($('#orden-telefono') && $('#orden-telefono').value.trim()) || ($('#quote-phone') && $('#quote-phone').value.trim()) || '';
        return { nom, tel };
    }

    // Texto de la orden para WhatsApp (también lo usa el formulario de cotización)
    DS.ordenTexto = function (conEncabezado = true) {
        const { kg } = Orden.totals();
        let txt = conEncabezado ? `*ORDEN DE MATERIAL — DOUBLE STEEL*\nFolio: ${folio()}\n` : '';
        if (conEncabezado) {
            const c = clienteDatos();
            if (c.nom) txt += `Cliente: ${c.nom}\n`;
            if (c.tel) txt += `Teléfono: ${c.tel}\n`;
        }
        txt += '\n';
        Orden.items.forEach((it, i) => {
            txt += `${i + 1}. *${it.producto}* — ${it.detalle}\n`;
            txt += `    ${it.cantidad} pza(s) x ${fmt(it.kgPieza)} kg = ${fmt(it.kgPieza * it.cantidad)} kg\n`;
        });
        txt += `\n*Peso total estimado: ${fmt(kg)} kg (${fmt(kg / 1000, 3)} t)*\n`;
        return txt;
    };

    DS.enviarOrdenWhatsApp = function () {
        if (!Orden.items.length) {
            DS.toast && DS.toast('Tu orden está vacía. Agrega materiales desde la calculadora.', 'error');
            return;
        }
        const msg = DS.ordenTexto(true) + '\nFavor de confirmar disponibilidad y precio. ¡Gracias!';
        window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    };

    /* --- PDF (jsPDF se carga solo cuando se necesita) --- */
    function loadScript(src) {
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = res;
            s.onerror = () => rej(new Error('No se pudo cargar ' + src));
            document.head.appendChild(s);
        });
    }

    async function ensurePDF() {
        if (!(window.jspdf && window.jspdf.jsPDF)) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        if (!window.jspdf.jsPDF.API.autoTable) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');
        }
    }

    function imagenDataURL(src) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth;
                    c.height = img.naturalHeight;
                    c.getContext('2d').drawImage(img, 0, 0);
                    resolve(c.toDataURL('image/png'));
                } catch (e) {
                    resolve(null); // p. ej. abierto como archivo local
                }
            };
            img.onerror = () => resolve(null);
            img.src = src;
        });
    }

    // jsPDF (helvetica) no soporta algunos símbolos: los normalizamos
    const pdfTxt = s => String(s).replace(/[—–]/g, '-').replace(/[·]/g, '|').replace(/Ø/g, 'D').replace(/[“”″]/g, '"').replace(/[^\x20-\xFF]/g, '');

    DS.generarPDF = async function () {
        if (!Orden.items.length) {
            DS.toast && DS.toast('Tu orden está vacía.', 'error');
            return;
        }
        const btn = $('#orden-pdf');
        const prev = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando…';
        }
        try {
            await ensurePDF();
            const logo = await imagenDataURL('img/logo.png');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();
            const fol = folio();
            const ahora = new Date();
            const c = clienteDatos();
            const { kg, piezas } = Orden.totals();

            // Encabezado
            doc.setFillColor(17, 17, 17);
            doc.rect(0, 0, W, 34, 'F');
            doc.setFillColor(255, 215, 0);
            doc.rect(0, 34, W, 2.2, 'F');
            if (logo) doc.addImage(logo, 'PNG', 12, 7, 56, 56 * 227 / 640, 'logo', 'FAST');
            else {
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(20);
                doc.text('DOUBLE', 14, 21);
                doc.setTextColor(255, 215, 0);
                doc.text('STEEL', 48, 21);
            }
            doc.setTextColor(255, 215, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(16);
            doc.text('ORDEN DE MATERIAL', W - 14, 16, { align: 'right' });
            doc.setTextColor(200, 200, 200);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(`Folio: ${fol}`, W - 14, 23, { align: 'right' });
            doc.text(ahora.toLocaleDateString('es-MX') + ' ' + ahora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }), W - 14, 28, { align: 'right' });

            // Datos
            doc.setTextColor(30, 30, 30);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTE', 14, 46);
            doc.text('PROVEEDOR', W / 2 + 4, 46);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.text(pdfTxt(c.nom || 'Cliente web'), 14, 52);
            if (c.tel) doc.text(pdfTxt('Tel: ' + c.tel), 14, 57);
            doc.text('Double Steel S.A. de C.V.', W / 2 + 4, 52);
            doc.text('Carr. a Monclova KM 5.3, Escobedo, N.L.', W / 2 + 4, 57);
            doc.text('Tel. / WhatsApp: +52 899 194 8477', W / 2 + 4, 62);

            doc.autoTable({
                startY: 70,
                head: [['#', 'Producto', 'Especificación', 'Cant.', 'Kg / pza', 'Kg total']],
                body: Orden.items.map((it, i) => [
                    String(i + 1),
                    pdfTxt(it.producto),
                    pdfTxt(it.detalle),
                    String(it.cantidad),
                    fmt(it.kgPieza),
                    fmt(it.kgPieza * it.cantidad)
                ]),
                foot: [[
                    { content: `TOTAL  (${piezas} pzas)`, colSpan: 5, styles: { halign: 'right' } },
                    { content: fmt(kg) + ' kg', styles: { halign: 'right' } }
                ]],
                theme: 'striped',
                styles: { fontSize: 9, cellPadding: 2.6, valign: 'middle' },
                headStyles: { fillColor: [17, 17, 17], textColor: [255, 215, 0], fontStyle: 'bold' },
                footStyles: { fillColor: [255, 215, 0], textColor: [17, 17, 17], fontStyle: 'bold', fontSize: 10 },
                alternateRowStyles: { fillColor: [246, 246, 246] },
                columnStyles: {
                    0: { cellWidth: 9, halign: 'center' },
                    1: { cellWidth: 34, fontStyle: 'bold' },
                    3: { cellWidth: 14, halign: 'center' },
                    4: { cellWidth: 22, halign: 'right' },
                    5: { cellWidth: 26, halign: 'right' }
                },
                margin: { left: 14, right: 14, bottom: 22 },
                didDrawPage: () => {
                    doc.setDrawColor(255, 215, 0);
                    doc.setLineWidth(.6);
                    doc.line(14, H - 16, W - 14, H - 16);
                    doc.setFontSize(8);
                    doc.setTextColor(120, 120, 120);
                    doc.text('doublesteel.com.mx  |  +52 899 194 8477  |  ventas@doublesteel.com', 14, H - 10);
                    doc.text(`Página ${doc.internal.getNumberOfPages()}`, W - 14, H - 10, { align: 'right' });
                }
            });

            let y = doc.lastAutoTable.finalY + 10;
            if (y > H - 45) {
                doc.addPage();
                y = 24;
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(17, 17, 17);
            doc.text(`Peso total estimado: ${fmt(kg)} kg  (${fmt(kg / 1000, 3)} t)`, 14, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(90, 90, 90);
            const notas = doc.splitTextToSize('* Peso teórico calculado con densidad de 7,850 kg/m3 y dimensiones nominales; el peso real puede variar por tolerancias de fabricación. Esta orden no es una factura: precios y disponibilidad sujetos a confirmación por un asesor de Double Steel.', W - 28);
            doc.text(notas, 14, y + 7);

            doc.save(`Orden_DoubleSteel_${fol}.pdf`);
            DS.toast && DS.toast('PDF descargado. Puedes adjuntarlo en WhatsApp.', 'ok', 'fa-file-pdf');
        } catch (e) {
            console.error(e);
            DS.toast && DS.toast('No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = prev;
            }
        }
    };

    /* --- Animación "vuela a la orden" --- */
    function flyToOrden(fromEl) {
        const target = $('.orden-fab');
        if (!target || DS.reducedMotion || !fromEl.animate) return Promise.resolve();
        const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
        const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
        const dx = b.left + b.width / 2 - sx, dy = b.top + b.height / 2 - sy;
        const dot = document.createElement('div');
        dot.className = 'fly-dot';
        dot.style.left = sx + 'px';
        dot.style.top = sy + 'px';
        document.body.appendChild(dot);
        const anim = dot.animate([
            { transform: 'translate(0,0) scale(.6)', opacity: 1 },
            { transform: `translate(${dx * 0.45}px, ${Math.min(dy * 0.45, 0) - 160}px) scale(1.4)`, opacity: 1, offset: 0.45 },
            { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: .7 }
        ], { duration: 850, easing: 'cubic-bezier(.5,0,.4,1)' });
        return anim.finished.then(() => dot.remove()).catch(() => dot.remove());
    }

    /* ----------------------------------------------------------------------
       Eventos
       ---------------------------------------------------------------------- */
    buildTabs();
    el.fields.addEventListener('input', onFieldInput);
    el.fields.addEventListener('change', e => {
        if (e.target.tagName === 'SELECT') return; // ya manejado en 'input'
        onFieldInput(e);
    });
    el.fields.addEventListener('click', onChip);

    el.qty.addEventListener('input', () => recalc(false));
    el.qty.addEventListener('blur', () => { el.qty.value = cantidad(); recalc(false); });
    document.querySelectorAll('.calc-qty [data-step]').forEach(b => b.addEventListener('click', () => {
        el.qty.value = Math.max(1, cantidad() + parseInt(b.dataset.step, 10));
        recalc(false);
    }));

    el.reset.addEventListener('click', () => {
        initState(tipoActual);
        el.qty.value = 1;
        renderFields(true);
        recalc(true);
    });

    el.add.addEventListener('click', () => {
        if (!resultado) return;
        const fab = $('.orden-fab');
        if (fab) fab.classList.add('has-items');
        const item = Orden.add(Object.assign({}, resultado));
        flyToOrden(el.add).then(() => {
            document.querySelectorAll('.cart-badge').forEach(bd => {
                bd.classList.remove('bump');
                void bd.offsetWidth;
                bd.classList.add('bump');
            });
        });
        DS.toast && DS.toast(`Agregado: ${item.producto} (${item.cantidad} pza) · ${fmt(item.kgPieza * item.cantidad)} kg`, 'ok', 'fa-check-circle');
    });

    window.addEventListener('resize', moveIndicator);

    // API pública
    DS.calc = {
        setTipo,
        get tipo() { return tipoActual; },
        moveIndicator
    };

    setTipo('placa');
    // El indicador necesita las fuentes cargadas para medir bien
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveIndicator);
    window.addEventListener('load', moveIndicator);
})();
