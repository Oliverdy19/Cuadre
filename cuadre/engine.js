/*
 * Cuadre — motor financiero.
 * Lógica determinista y sin dependencias, separada de la interfaz.
 * Funciona en el navegador (window.CuadreEngine) y en Node (module.exports) para las pruebas.
 *
 * Reglas de dinero:
 *  - Todo importe se maneja en CENTAVOS enteros.
 *  - Los intereses se calculan por período y se redondean al centavo,
 *    "mitad lejos de cero" (r2c), en cada período.
 *  - Tasas: decimal anual nominal (0.32 = 32%). Interés mensual = saldo × tasa / 12.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CuadreEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- dinero ---------------- */
  const r2c = x => (x < 0 ? -1 : 1) * Math.round(Math.abs(x) + 1e-9);
  const toCents = v => {
    if (typeof v === 'number') return r2c(v * 100);
    return parseAmount(v);
  };
  const fromCents = c => c / 100;

  /** Interpreta importes como "RD$ 1,234.56", "(1,234.56)", "-500", "1.234,56", "US$12". Devuelve centavos o null. */
  function parseAmount(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') return isFinite(raw) ? r2c(raw * 100) : null;
    let s = String(raw).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-\s*$/.test(s)) { neg = true; s = s.replace(/-\s*$/, ''); }
    s = s.replace(/(RD|US|DOP|USD|EUR|\$|€)/gi, '').replace(/\s/g, '');
    if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
    if (s.startsWith('+')) s = s.slice(1);
    const hasComma = s.includes(','), hasDot = s.includes('.');
    if (hasComma && hasDot) {
      // el último separador es el decimal: 1,234.56 o 1.234,56
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hasComma) {
      // 1,234 / 12,345,678 → miles ; 1234,5 / 12,50 → decimal
      s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (hasDot && /^\d{1,3}(\.\d{3}){2,}$/.test(s)) {
      s = s.replace(/\./g, ''); // 1.234.567
    }
    if (!/^\d*\.?\d+$/.test(s)) return null;
    const n = parseFloat(s);
    if (!isFinite(n)) return null;
    return (neg ? -1 : 1) * r2c(n * 100);
  }

  /* ---------------- fechas ---------------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addMonths = (ym, n) => { let [y, m] = ym.split('-').map(Number); m += n - 1; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + pad(m + 1); };
  const monthsBetween = (a, b) => { const [y1, m1] = a.split('-').map(Number), [y2, m2] = b.split('-').map(Number); return (y2 - y1) * 12 + (m2 - m1); };
  const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
  const addDays = (d, n) => { const t = new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); };
  const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  /** Próxima fecha (>= desde) para un día del mes; ajusta a fin de mes si el día no existe. */
  function nextDayOfMonth(desde, dia) {
    let ym = desde.slice(0, 7);
    for (let i = 0; i < 3; i++) {
      const d = ym + '-' + pad(Math.min(dia, daysInMonth(ym)));
      if (d >= desde) return d;
      ym = addMonths(ym, 1);
    }
    return null;
  }

  /**
   * Interpreta fechas: yyyy-mm-dd, dd/mm/yyyy, dd-mm-yyyy, dd/mm/yy, mm/dd/yyyy (si se indica), números de Excel.
   * order: 'dmy' (por defecto, convención dominicana) o 'mdy'.
   */
  function parseDate(raw, order) {
    if (raw === null || raw === undefined || raw === '') return null;
    if (typeof raw === 'number' && raw > 20000 && raw < 80000) { // serial de Excel
      const t = new Date(Date.UTC(1899, 11, 30) + raw * 864e5);
      return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
    }
    const s = String(raw).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
      let a = +m[1], b = +m[2], y = +m[3];
      if (y < 100) y += 2000;
      let d, mo;
      if ((order || 'dmy') === 'mdy') { mo = a; d = b; } else { d = a; mo = b; }
      if (mo > 12 && d <= 12) { const t = d; d = mo; mo = t; }
      return valid(y, mo, d);
    }
    const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 };
    m = s.toLowerCase().match(/^(\d{1,2})[\s\-/]([a-zñ]{3})[a-zñ]*[\s\-/,]+(\d{2,4})/);
    if (m && MESES[m[2]]) { let y = +m[3]; if (y < 100) y += 2000; return valid(y, MESES[m[2]], +m[1]); }
    return null;
    function valid(y, mo, d) {
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      const ym = y + '-' + pad(mo);
      if (d > daysInMonth(ym)) return null;
      return ym + '-' + pad(d);
    }
  }
  /** Decide si una columna de fechas usa día/mes o mes/día mirando los valores. */
  function guessDateOrder(values) {
    let dmy = 0, mdy = 0;
    for (const v of values) {
      const m = String(v || '').match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/);
      if (!m) continue;
      if (+m[1] > 12) dmy++;
      if (+m[2] > 12) mdy++;
    }
    return mdy > dmy ? 'mdy' : 'dmy';
  }

  /* ---------------- CSV ---------------- */
  /** Analizador CSV con comillas, detecta separador (, ; o tab). Devuelve array de filas. */
  function parseCSV(text) {
    text = String(text).replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let inQ = false;
    for (const ch of firstLine) { if (ch === '"') inQ = !inQ; else if (!inQ && ch in counts) counts[ch]++; }
    const sep = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ',';
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(c => c.trim() !== '')) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.some(c => c.trim() !== '')) rows.push(row);
    return rows.map(r => r.map(c => c.trim()));
  }
  /** Sugiere mapeo de columnas por nombre de encabezado. */
  function guessMapping(headers) {
    const h = headers.map(x => normalize(x));
    const find = (...keys) => { const i = h.findIndex(x => keys.some(k => x.includes(k))); return i < 0 ? null : i; };
    return {
      fecha: find('FECHA', 'DATE', 'F. TRANS', 'POSTED'),
      descripcion: find('DESCRIP', 'CONCEPTO', 'DETALLE', 'COMERCIO', 'MERCHANT', 'REFERENCIA', 'NARRA'),
      monto: find('MONTO', 'IMPORTE', 'AMOUNT', 'VALOR', 'CANTIDAD'),
      referencia: (() => { const i = h.findIndex(x => /^(NO |NUM |NUMERO )?(DE )?REF(ERENCIA)?$|^REFERENCIA|^NO DE REFERENCIA/.test(x)); return i < 0 ? null : i; })(),
      debito: find('DEBITO', 'DÉBITO', 'CARGO', 'RETIRO', 'DEBIT'),
      credito: find('CREDITO', 'CRÉDITO', 'ABONO', 'DEPOSITO', 'DEPÓSITO', 'CREDIT'),
      moneda: find('MONEDA', 'CURRENCY', 'DIVISA')
    };
  }

  /* ---------------- PDF ---------------- */
  const MES3 = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12, JAN: 1, APR: 4, AUG: 8, DEC: 12 };
  const PDF_DATE = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}[\s/-](?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC|JAN|APR|AUG|DEC)[A-Z]*(?:[\s/-]\d{2,4})?)\b/i;
  // importes con 2 decimales (evita confundir referencias o números de cuenta)
  const PDF_AMOUNT = /^\(?[-+]?\s*(?:RD\$|US\$|\$|DOP|USD)?\s*\d{1,3}(?:[,.\s]\d{3})*[.,]\d{2}\)?\s*(?:-|CR|DB)?$/i;
  /** Fecha de un estado de cuenta → ISO. Completa el año con yearHint cuando falta. */
  function pdfDate(s, year, order) {
    s = String(s).trim().toUpperCase();
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/);
    if (m) return parseDate(`${m[1]}/${m[2]}/${year}`, order);
    m = s.match(/^(\d{1,2})[\s/-]([A-Z]{3})[A-Z]*(?:[\s/-](\d{2,4}))?$/);
    if (m && MES3[m[2]]) { let y = m[3] ? +m[3] : year; if (y < 100) y += 2000; return parseDate(`${m[1]}/${MES3[m[2]]}/${y}`, 'dmy'); }
    return parseDate(s, order);
  }
  /**
   * Convierte líneas de texto de un PDF en una tabla.
   * lines: [{page, y, items:[{x, w, str}]}] (una entrada por renglón visual, en orden de lectura).
   * Devuelve {headers, rows, year}: Fecha (ISO), Descripción y una columna por cada posición
   * horizontal de importes (débito, crédito, balance…), detectada por alineación a la derecha.
   */
  function tableFromPdfLines(lines, opts) {
    opts = opts || {};
    const all = lines.map(l => l.items.map(i => i.str).join(' ')).join('\n');
    const years = {}; (all.match(/\b\d{1,2}[/.-]\d{1,2}[/.-](\d{4})\b/g) || []).forEach(d => { const y = d.slice(-4); years[y] = (years[y] || 0) + 1; });
    const year = +(Object.keys(years).sort((a, b) => years[b] - years[a])[0] || opts.year || new Date().getFullYear());
    const order = opts.order || guessDateOrder((all.match(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g) || []));
    // fecha de referencia (la más reciente completa, p. ej. la de corte) para fechas sin año: dic en un estado de enero = año anterior
    const fulls = (all.match(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{4}\b/g) || []).map(d => parseDate(d, order)).filter(Boolean).sort();
    const ref = fulls[fulls.length - 1] || null;
    const fixYear = d => (ref && d && d > addDays(ref, 31)) ? (+d.slice(0, 4) - 1) + d.slice(4) : d;
    // "una cantidad con el signo (-) es un crédito": los cargos vienen en positivo
    const signoCredito = /SIGNO\s*\(?\s*-\s*\)?[^\n]{0,40}CR[EÉ]DITO/i.test(all) ? 'negativo' : null;
    const recs = []; let headerLine = null;
    for (const line of lines) {
      const items = line.items.filter(i => String(i.str).trim()).sort((a, b) => a.x - b.x)
        .map(i => ({ x: i.x, r: i.x + (i.w || 0), str: String(i.str).trim() }));
      if (!items.length) continue;
      // separa "01/11/2026 COMPRA..." cuando vienen juntos
      let fecha = null, rest = items;
      const first = items[0];
      const dm = first.str.match(PDF_DATE);
      if (dm) {
        fecha = fixYear(pdfDate(dm[1], year, order));
        if (fecha) {
          const tail = first.str.slice(dm[0].length).trim();
          rest = (tail ? [{ ...first, str: tail }] : []).concat(items.slice(1));
          // segunda fecha (entrada y transacción): se usa la de la transacción
          const m2 = rest[0] && rest[0].str.match(PDF_DATE);
          const f2 = m2 && fixYear(pdfDate(m2[1], year, order));
          if (f2) {
            fecha = f2;
            const t2 = rest[0].str.slice(m2[0].length).trim();
            rest = (t2 ? [{ ...rest[0], str: t2 }] : []).concat(rest.slice(1));
          }
        }
      }
      const amounts = rest.filter(i => PDF_AMOUNT.test(i.str));
      // quita números de referencia/autorización largos (8+ dígitos)
      const raw = rest.filter(i => !PDF_AMOUNT.test(i.str)).map(i => i.str).join(' ');
      const refM = raw.match(/\b\d{8,}\b/);
      const text = raw.replace(/\b\d{8,}\b/g, ' ').replace(/\s+/g, ' ').trim();
      const soloCodigos = /^[\d\s*-]+$/.test(text); // renglón con código de comercio y autorización (ej. "5943 072150")
      if (fecha && amounts.length) recs.push({ fecha, desc: text, amounts, page: line.page, y: line.y, ref: refM ? refM[0] : '' });
      else if (!fecha && !amounts.length && recs.length && text && !soloCodigos && text.length < 80 && line.page === recs[recs.length - 1].page && Math.abs(recs[recs.length - 1].y - line.y) <= (opts.lineGap || 14) && !/P[AÁ]GINA|PAGE|BALANCE|SALDO|TOTAL|SIGNO|INFORMACI/i.test(text)) {
        // renglón de continuación de la descripción anterior
        const last = recs[recs.length - 1]; if (!last.cont) { last.desc += ' ' + text; last.cont = true; }
      } else if (!fecha && !amounts.length && !recs.length && (text.match(/D[EÉ]BITO|CR[EÉ]DITO|RETIRO|DEP[OÓ]SITO|MONTO|BALANCE|SALDO|CARGO|ABONO|CANTIDAD|IMPORTE/gi) || []).length >= 2) headerLine = items;
    }
    // columnas de importes por su borde derecho
    const edges = recs.flatMap(r => r.amounts.map(a => a.r)).sort((a, b) => a - b);
    const cols = [];
    edges.forEach(e => { const c = cols[cols.length - 1]; if (c && e - c.max <= (opts.tolerance || 18)) { c.max = e; c.sum += e; c.n++; } else cols.push({ min: e, max: e, sum: e, n: 1 }); });
    cols.forEach(c => c.c = c.sum / c.n);
    const colOf = a => { let best = 0, d = Infinity; cols.forEach((c, i) => { const dd = Math.abs(c.c - a.r); if (dd < d) { d = dd; best = i; } }); return best; };
    const names = cols.map((c, i) => {
      if (headerLine) {
        const h = headerLine.filter(x => !/FECHA|DESCRIP|CONCEPTO|DETALLE/i.test(x.str)).map(x => ({ str: x.str, d: Math.min(Math.abs(x.r - c.c), Math.abs(x.x - c.c)) })).sort((a, b) => a.d - b.d)[0];
        if (h && h.d < 60) return h.str;
      }
      return 'Monto ' + (i + 1);
    });
    const hasRef = recs.some(r => r.ref);
    const rows = recs.map(r => { const row = [r.fecha, r.desc].concat(cols.map(() => '')); r.amounts.forEach(a => { row[2 + colOf(a)] = a.str; }); if (hasRef) row.push(r.ref); return row; });
    return { headers: ['Fecha', 'Descripción'].concat(names).concat(hasRef ? ['Referencia'] : []), rows, year, signoCredito };
  }

  /* ---------------- texto ---------------- */
  function normalize(s) {
    return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /** Clave de comercio: palabras significativas, sin números de referencia. */
  function merchantKey(desc) {
    const stop = new Set(['COMPRA', 'POS', 'PAGO', 'DEBITO', 'CREDITO', 'TRANSACCION', 'EN', 'DE', 'LA', 'EL', 'SA', 'SRL', 'POR', 'CON', 'TARJETA', 'VISA', 'MASTERCARD', 'TC', 'TD', 'RD', 'DO', 'SANTO', 'DOMINGO', 'STO', 'DGO']);
    const words = normalize(desc).split(' ').filter(w => w.length > 1 && !/\d/.test(w) && !stop.has(w));
    return words.slice(0, 2).join(' ');
  }
  const tokens = s => new Set(normalize(s).split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w)));
  function similarity(a, b) {
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return 0;
    let inter = 0; A.forEach(t => { if (B.has(t)) inter++; });
    return inter / Math.min(A.size, B.size);
  }

  /* ---------------- movimientos ---------------- */
  /** Huella estable para detectar duplicados exactos. */
  const fingerprint = t => [t.cuenta, t.fecha, t.monto, normalize(t.descripcion).replace(/\d{5,}/g, '#')].join('|');

  /**
   * Clasifica cada candidato contra los existentes:
   *  'nuevo' | 'duplicado' (misma huella o mismo id de origen) | 'posible' (mismo monto y cuenta, ±2 días, descripción parecida).
   */
  function dedupe(candidates, existing) {
    const prints = new Set(existing.map(fingerprint));
    const srcIds = new Set(existing.filter(t => t.origenId).map(t => t.cuenta + '|' + t.origenId));
    const seen = new Set();
    return candidates.map(c => {
      const fp = fingerprint(c);
      if (c.origenId) {
        // con número de referencia del banco: solo es repetido si esa referencia ya existe
        const k = c.cuenta + '|' + c.origenId;
        if (srcIds.has(k) || seen.has(k)) return { ...c, estado: 'duplicado', huella: fp };
        seen.add(k);
      } else {
        if (prints.has(fp) || seen.has(fp)) return { ...c, estado: 'duplicado', huella: fp };
        seen.add(fp);
      }
      const near = existing.find(t => t.cuenta === c.cuenta && t.monto === c.monto &&
        Math.abs(daysBetween(t.fecha, c.fecha)) <= 2 && similarity(t.descripcion, c.descripcion) >= 0.5);
      return { ...c, estado: near ? 'posible' : 'nuevo', huella: fp, parecidoA: near ? near.id : null };
    });
  }

  /**
   * Categoriza un movimiento.
   * Prioridad: regla del usuario (0.95) → historial del usuario (0.85) → regla del sistema (0.7) → sin categoría (0).
   */
  function categorize(t, rules, history) {
    const desc = normalize(t.descripcion);
    const userRule = rules.filter(r => r.origen === 'usuario').find(r => desc.includes(normalize(r.patron)));
    if (userRule) return { categoria: userRule.categoria, confianza: 0.95, catOrigen: 'regla' };
    const key = merchantKey(t.descripcion);
    if (key && history) {
      const h = history[key];
      if (h) return { categoria: h, confianza: 0.85, catOrigen: 'historial' };
    }
    const sys = rules.filter(r => r.origen !== 'usuario').find(r => {
      if (r.signo === 'ingreso' && t.monto < 0) return false;
      if (r.signo === 'gasto' && t.monto > 0) return false;
      return desc.includes(normalize(r.patron));
    });
    if (sys) return { categoria: sys.categoria, confianza: 0.7, catOrigen: 'sistema' };
    return { categoria: null, confianza: 0, catOrigen: 'ninguna' };
  }
  /** Historial de categorías que el usuario confirmó, por clave de comercio. */
  function buildHistory(txns) {
    const h = {};
    txns.filter(t => t.catOrigen === 'usuario' && t.categoria).forEach(t => { const k = merchantKey(t.descripcion); if (k) h[k] = t.categoria; });
    return h;
  }

  /**
   * Empareja movimientos opuestos entre cuentas propias (mismo importe absoluto, ±3 días).
   * Devuelve pares [idSalida, idEntrada, tipo] con tipo 'transferencia' o 'pago_deuda' si la entrada es una deuda.
   */
  function detectTransfers(txns, accounts) {
    const kind = Object.fromEntries(accounts.map(a => [a.id, a.tipo]));
    const isDebt = id => kind[id] === 'tarjeta' || kind[id] === 'prestamo' || kind[id] === 'otro_pasivo';
    const free = txns.filter(t => !t.par && !t.excluida && t.tipo !== 'ajuste');
    const outs = free.filter(t => t.monto < 0).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const used = new Set(), pairs = [];
    for (const o of outs) {
      if (used.has(o.id)) continue;
      const match = free.find(i => i.monto === -o.monto && i.cuenta !== o.cuenta && !used.has(i.id) &&
        Math.abs(daysBetween(o.fecha, i.fecha)) <= 3 && (i.moneda || 'DOP') === (o.moneda || 'DOP'));
      if (match) { used.add(o.id); used.add(match.id); pairs.push([o.id, match.id, isDebt(match.cuenta) ? 'pago_deuda' : 'transferencia']); }
    }
    return pairs;
  }

  /** ¿Cuenta para gasto/ingreso? Transferencias, pagos de deuda, ajustes y excluidos no cuentan. */
  const countsAsFlow = t => !t.excluida && (t.tipo === 'gasto' || t.tipo === 'ingreso');

  /** Gasto por categoría en un mes (centavos positivos). Solo moneda indicada. */
  function spendByCategory(txns, ym, moneda) {
    const out = {};
    txns.filter(t => countsAsFlow(t) && t.fecha.slice(0, 7) === ym && (t.moneda || 'DOP') === (moneda || 'DOP')).forEach(t => {
      const k = t.categoria || 'Sin categoría';
      out[k] = (out[k] || 0) - t.monto; // gastos negativos → positivo; ingresos restan
    });
    return out;
  }
  function monthTotals(txns, ym, moneda) {
    let ingresos = 0, gastos = 0;
    txns.filter(t => countsAsFlow(t) && t.fecha.slice(0, 7) === ym && (t.moneda || 'DOP') === (moneda || 'DOP')).forEach(t => {
      if (t.monto > 0) ingresos += t.monto; else gastos -= t.monto;
    });
    return { ingresos, gastos, neto: ingresos - gastos };
  }

  /* ---------------- cuentas y patrimonio ---------------- */
  const LIAB = new Set(['tarjeta', 'prestamo', 'otro_pasivo']);
  const isLiability = a => LIAB.has(a.tipo);
  /**
   * Saldo calculado: saldo declarado en su fecha + movimientos posteriores.
   * Activos: saldo = declarado + suma(montos). Pasivos (lo que se debe): saldo = declarado − suma(montos)
   * (una compra con tarjeta es negativa y aumenta la deuda; un pago es positivo y la reduce).
   */
  function accountBalance(a, txns) {
    const after = txns.filter(t => t.cuenta === a.id && t.fecha > (a.fechaSaldo || '0000') && !t.anulada);
    const s = after.reduce((x, t) => x + t.monto, 0);
    return isLiability(a) ? a.saldo - s : a.saldo + s;
  }
  /** Tasa vigente para una moneda a una fecha: la más reciente con fecha <= fecha. */
  function fxRate(fx, moneda, fecha) {
    if (!moneda || moneda === 'DOP') return { tasa: 1, fecha: null, fuente: null };
    const list = (fx || []).filter(r => r.moneda === moneda && (!fecha || r.fecha <= fecha)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return list[0] || null;
  }
  /** Patrimonio neto en RD$. Excluye cuentas marcadas y lista las monedas sin tasa. */
  function netWorth(accounts, txns, fx, fecha) {
    let activos = 0, pasivos = 0; const sinTasa = new Set(); const porTipo = {};
    accounts.filter(a => !a.excluir && !a.archivada).forEach(a => {
      const bal = accountBalance(a, txns);
      const r = fxRate(fx, a.moneda, fecha);
      if (!r) { sinTasa.add(a.moneda); return; }
      const dop = r2c(bal * r.tasa);
      if (isLiability(a)) pasivos += dop; else activos += dop;
      porTipo[a.tipo] = (porTipo[a.tipo] || 0) + dop;
    });
    return { activos, pasivos, neto: activos - pasivos, sinTasa: [...sinTasa], porTipo };
  }

  /* ---------------- préstamos ---------------- */
  /** Cuota de un préstamo francés (centavos). */
  function pmt(principal, tasaAnual, meses) {
    if (meses <= 0) return principal;
    const i = tasaAnual / 12;
    if (i === 0) return r2c(principal / meses);
    return r2c(principal * i / (1 - Math.pow(1 + i, -meses)));
  }
  /** Amortización de una sola deuda con pago fijo. Devuelve meses, intereses, o insuficiente. */
  function amortize(saldo, tasaAnual, pago, opts) {
    opts = opts || {};
    const fee = opts.comisionMensual || 0, max = opts.maxMeses || 600;
    let bal = saldo, interes = 0, comis = 0, m = 0; const rows = [];
    while (bal > 0 && m < max) {
      const it = r2c(bal * tasaAnual / 12);
      if (pago <= it + fee) return { insuficiente: true, meses: Infinity, interes: Infinity, rows };
      bal += it + fee; interes += it; comis += fee;
      const p = Math.min(pago, bal); bal -= p; m++;
      if (opts.rows) rows.push({ mes: m, interes: it, pago: p, saldo: bal });
    }
    return { insuficiente: bal > 0, meses: bal > 0 ? Infinity : m, interes, comisiones: comis, rows };
  }

  /* ---------------- motor de eliminación de deudas ---------------- */
  /**
   * debts: [{id, nombre, saldo, tasa, cuota, comisionMensual?, penalidadAbono?, tipoTasa?, desde? (yyyy-mm)}]
   * opts: {
   *   inicio: 'yyyy-mm', estrategia: 'avalancha'|'bola'|'hibrida'|'personalizada'|'minimos', orden?: [ids],
   *   extraMensual: centavos, extraDesde: 'yyyy-mm', eventos: [{mes:'yyyy-mm', monto}] (pagos extraordinarios),
   *   ajusteTasaVariable: puntos decimales (0.02 = +2pp) sobre deudas variables desde ajusteDesde,
   *   presupuestoMaximo: tope de pago total mensual (centavos) opcional, maxMeses
   * }
   * Las cuotas de deudas saldadas se suman al pago extra (efecto bola de nieve) excepto en 'minimos'.
   */
  function planDebts(debts, opts) {
    opts = Object.assign({ estrategia: 'avalancha', extraMensual: 0, eventos: [], maxMeses: 600 }, opts || {});
    const inicio = opts.inicio;
    const ds = debts.filter(d => d.saldo > 0).map(d => ({ ...d, bal: 0, started: false, paid: false, interes: 0, comisiones: 0, penalidades: 0 }));
    const baseBudget = ds.reduce((s, d) => s + d.cuota, 0);
    const cal = []; const payoff = {}; const insuf = new Set();
    let totalInt = 0, totalFee = 0, totalPen = 0, m = 0, totalPaid = 0, maxPago = 0;
    const order = list => {
      const live = list.filter(d => d.bal > 0);
      switch (opts.estrategia) {
        case 'bola': return live.sort((a, b) => a.bal - b.bal || b.tasa - a.tasa);
        case 'personalizada': { const o = opts.orden || []; return live.sort((a, b) => idx(o, a.id) - idx(o, b.id)); }
        case 'hibrida': {
          // Victoria rápida: si alguna deuda se puede saldar con ≤ 3 meses de pago extra, va primero (la más pequeña);
          // si no, avalancha por tasa.
          const extra = Math.max(1, opts.extraMensual || 0);
          const quick = live.filter(d => d.bal <= extra * 3).sort((a, b) => a.bal - b.bal);
          const rest = live.filter(d => !quick.includes(d)).sort((a, b) => b.tasa - a.tasa || a.bal - b.bal);
          return quick.concat(rest);
        }
        default: return live.sort((a, b) => b.tasa - a.tasa || a.bal - b.bal);
      }
    };
    while (m < opts.maxMeses) {
      const ym = addMonths(inicio, m);
      ds.forEach(d => { if (!d.started && (!d.desde || d.desde <= ym)) { d.started = true; d.bal = d.saldo; } });
      const live = ds.filter(d => d.started && d.bal > 0);
      if (!live.length && ds.every(d => d.started)) break;
      const row = { mes: ym, deudas: {}, prioridad: null, pagoTotal: 0 };
      // 1. intereses y comisiones
      live.forEach(d => {
        let tasa = d.tasa;
        if (d.tipoTasa === 'variable' && opts.ajusteTasaVariable && (!opts.ajusteDesde || ym >= opts.ajusteDesde)) tasa = Math.max(0, tasa + opts.ajusteTasaVariable);
        const it = r2c(d.bal * tasa / 12), fee = d.comisionMensual || 0;
        d.bal += it + fee; d.interes += it; d.comisiones += fee; totalInt += it; totalFee += fee;
        if (d.cuota <= it + fee) insuf.add(d.id);
        row.deudas[d.id] = { saldoInicial: d.bal - it - fee, interes: it, comision: fee, cuota: 0, abono: 0, penalidad: 0, saldo: 0 };
      });
      // 2. cuotas mínimas
      let pagado = 0;
      live.forEach(d => { const p = Math.min(d.cuota, d.bal); d.bal -= p; pagado += p; row.deudas[d.id].cuota = p; });
      // 3. bolsa extra
      let bolsa = 0;
      if (opts.estrategia !== 'minimos') {
        const startedBudget = ds.filter(d => d.started).reduce((s, d) => s + d.cuota, 0);
        const extra = (!opts.extraDesde || ym >= opts.extraDesde) ? (opts.extraMensual || 0) : 0;
        bolsa = Math.max(0, startedBudget - pagado) + extra;
        if (opts.presupuestoMaximo) bolsa = Math.min(bolsa, Math.max(0, opts.presupuestoMaximo - pagado));
      }
      bolsa += (opts.eventos || []).filter(e => e.mes === ym).reduce((s, e) => s + e.monto, 0);
      const prio = order(live);
      row.prioridad = prio[0] ? prio[0].id : null;
      for (const d of prio) {
        if (bolsa <= 0) break;
        if (d.bal <= 0) continue;
        const pen = d.penalidadAbono || 0;
        // con penalidad p, pagar X reduce el saldo X/(1+p)
        const necesario = r2c(d.bal * (1 + pen));
        const pago = Math.min(bolsa, necesario);
        const reduce = pen ? Math.min(d.bal, r2c(pago / (1 + pen))) : pago;
        const penal = pago - reduce;
        d.bal -= reduce; bolsa -= pago; pagado += pago;
        d.penalidades += penal; totalPen += penal;
        row.deudas[d.id].abono = reduce; row.deudas[d.id].penalidad = penal;
      }
      live.forEach(d => { row.deudas[d.id].saldo = d.bal; if (d.bal <= 0 && !payoff[d.id]) payoff[d.id] = ym; });
      row.pagoTotal = pagado; row.saldoTotal = ds.reduce((s, d) => s + Math.max(0, d.bal), 0);
      totalPaid += pagado; maxPago = Math.max(maxPago, pagado);
      cal.push(row);
      m++;
      if (insuf.size && opts.estrategia === 'minimos' && m > 600) break;
    }
    const done = ds.every(d => d.started && d.bal <= 0);
    return {
      estrategia: opts.estrategia, meses: done ? cal.length : Infinity, fechaLibre: done && cal.length ? cal[cal.length - 1].mes : null,
      interes: totalInt, comisiones: totalFee, penalidades: totalPen, costoTotal: totalInt + totalFee + totalPen,
      pagado: totalPaid, pagoMaximoMes: maxPago, payoff, calendario: cal, insuficientes: [...insuf], completo: done, presupuestoBase: baseBudget
    };
    function idx(arr, id) { const i = arr.indexOf(id); return i < 0 ? 999 : i; }
  }

  /** Compara las estrategias con los mismos datos. */
  function compareStrategies(debts, opts) {
    const out = {};
    ['avalancha', 'bola', 'hibrida', 'minimos'].forEach(e => { out[e] = planDebts(debts, { ...opts, estrategia: e }); });
    if (opts && opts.orden && opts.orden.length) out.personalizada = planDebts(debts, { ...opts, estrategia: 'personalizada' });
    const cands = Object.entries(out).filter(([k, r]) => k !== 'minimos' && r.completo);
    const best = (f) => cands.length ? cands.sort((a, b) => f(a[1]) - f(b[1]) || a[1].costoTotal - b[1].costoTotal)[0][0] : null;
    return { resultados: out, menorCosto: best(r => r.costoTotal), masRapida: best(r => r.meses) };
  }

  /**
   * Busca el pago extra mensual mínimo (en pasos de RD$100) para saldar una deuda objetivo
   * antes o en una fecha. Devuelve centavos o null si no es posible con el tope dado.
   */
  function extraNeededFor(debts, opts, targetId, fechaLimite, tope) {
    const ok = extra => { const r = planDebts(debts, { ...opts, extraMensual: extra, extraDesde: opts.extraDesde }); return r.payoff[targetId] && r.payoff[targetId] <= fechaLimite; };
    const hi0 = tope || 100000000;
    if (!ok(hi0)) return null;
    if (ok(0)) return 0;
    let lo = 0, hi = hi0;
    while (hi - lo > 10000) { const mid = Math.floor((lo + hi) / 2 / 10000) * 10000; if (mid === lo) break; if (ok(mid)) hi = mid; else lo = mid; }
    return hi;
  }

  /**
   * Consolidación: reemplaza las deudas indicadas por un préstamo nuevo y compara el costo total.
   * loan: {monto?, tasa, plazo, gastosCierre, seguroMensual, penalidadAbono, tipoTasa}
   * Si no se da monto, usa la suma de saldos consolidados + gastos de cierre.
   */
  function consolidate(debts, ids, loan, opts) {
    const sel = debts.filter(d => ids.includes(d.id));
    const rest = debts.filter(d => !ids.includes(d.id));
    const saldo = sel.reduce((s, d) => s + d.saldo, 0);
    const monto = loan.monto || (saldo + (loan.gastosCierre || 0));
    const cuota = pmt(monto, loan.tasa, loan.plazo);
    const nueva = { id: 'consolidado', nombre: 'Préstamo de consolidación', saldo: monto, tasa: loan.tasa, cuota, comisionMensual: loan.seguroMensual || 0, penalidadAbono: loan.penalidadAbono || 0, tipoTasa: loan.tipoTasa || 'fija' };
    // Mismo presupuesto mensual total que el plan base: lo que se pagaba en cuotas consolidadas pasa a extra.
    const cuotasViejas = sel.reduce((s, d) => s + d.cuota, 0);
    const extraAjuste = cuotasViejas - cuota;
    const base = planDebts(debts, opts);
    const nuevo = planDebts(rest.concat([nueva]), { ...opts, extraMensual: Math.max(0, (opts.extraMensual || 0) + extraAjuste) });
    const sobrante = monto - saldo - (loan.gastosCierre || 0);
    return {
      monto, cuota, cuotasReemplazadas: cuotasViejas, sobrante,
      base, nuevo, costoAdicionalCierre: loan.gastosCierre || 0,
      diferenciaCosto: (nuevo.costoTotal + (loan.gastosCierre || 0)) - base.costoTotal,
      diferenciaMeses: (nuevo.meses === Infinity || base.meses === Infinity) ? null : nuevo.meses - base.meses
    };
  }

  /** Diagnóstico de una deuda. ingresoMensual en centavos. */
  function diagnoseDebt(d, ingresoMensual) {
    const a = amortize(d.saldo, d.tasa, d.cuota, { comisionMensual: d.comisionMensual || 0 });
    return {
      insuficiente: a.insuficiente,
      mesesRestantes: a.meses,
      interesesFuturos: a.interes,
      costoMensualInteres: r2c(d.saldo * d.tasa / 12),
      pctIngreso: ingresoMensual ? d.cuota / ingresoMensual : null
    };
  }

  /* ---------------- tarjetas ---------------- */
  function cardStatus(card, saldoActual, hoy) {
    const util = card.limite ? saldoActual / card.limite : null;
    const proxCorte = card.diaCorte ? nextDayOfMonth(hoy, card.diaCorte) : null;
    const proxPago = card.diaPago ? nextDayOfMonth(hoy, card.diaPago) : null;
    return {
      utilizacion: util, disponible: card.limite ? card.limite - saldoActual : null,
      proximoCorte: proxCorte, proximoPago: proxPago,
      diasParaPago: proxPago ? daysBetween(hoy, proxPago) : null,
      alertaUtilizacion: util !== null && util > 0.3 ? (util > 0.7 ? 'alta' : 'media') : null
    };
  }
  /**
   * Compara pagar siempre el mínimo actual vs. el total vs. un monto intermedio fijo.
   * Supone que el emisor cobra interés mensual = saldo × tasa / 12 sobre el saldo no pagado;
   * cada emisor calcula distinto, por eso se marca como estimado.
   */
  function cardPayoffOptions(saldo, tasa, minimo, intermedio) {
    const opt = pago => { const a = amortize(saldo, tasa, pago); return { pago, meses: a.meses, interes: a.interes, insuficiente: a.insuficiente }; };
    return {
      total: { pago: saldo, meses: 1, interes: 0 },
      minimo: minimo ? opt(minimo) : null,
      intermedio: intermedio ? opt(intermedio) : null
    };
  }

  /* ---------------- presupuesto, flujo y metas ---------------- */
  /** Ocurrencias de un recurrente entre dos fechas (incl.). frecuencia: mensual | quincenal | anual | semanal */
  function occurrences(rec, desde, hasta) {
    const out = [];
    if (rec.frecuencia === 'semanal') {
      let d = rec.inicio || desde; while (d < desde) d = addDays(d, 7);
      for (; d <= hasta; d = addDays(d, 7)) out.push(d);
      return out;
    }
    let ym = desde.slice(0, 7);
    while (ym <= hasta.slice(0, 7)) {
      const dias = rec.frecuencia === 'quincenal' ? [rec.dia || 15, rec.dia2 || 30] : [rec.dia || 1];
      const okMes = rec.frecuencia !== 'anual' || +ym.slice(5, 7) === (rec.mes || 12);
      if (okMes) dias.forEach(dd => { const f = ym + '-' + pad(Math.min(dd, daysInMonth(ym))); if (f >= desde && f <= hasta) out.push(f); });
      ym = addMonths(ym, 1);
    }
    return out;
  }
  /**
   * Proyección de efectivo a N días.
   * escenario: 'conservador' (ingresos variables al mínimo, inciertos fuera), 'central' (promedio), 'optimista' (máximo).
   * obligaciones: [{nombre, monto (positivo), dia}] — cuotas de deudas y pagos de tarjetas.
   */
  function cashForecast(saldoInicial, recurrentes, obligaciones, hoy, dias, escenario) {
    const hasta = addDays(hoy, dias);
    const ev = [];
    recurrentes.filter(r => r.activo !== false).forEach(r => {
      let monto = r.monto;
      if (r.certeza === 'variable') monto = escenario === 'conservador' ? (r.min ?? 0) : escenario === 'optimista' ? (r.max ?? r.monto) : r.monto;
      if (r.certeza === 'incierto' && escenario !== 'optimista') monto = 0;
      if (!monto) return;
      occurrences(r, hoy, hasta).forEach(f => ev.push({ fecha: f, nombre: r.nombre, monto: r.tipo === 'ingreso' ? monto : -monto }));
    });
    obligaciones.forEach(o => occurrences({ frecuencia: 'mensual', dia: o.dia }, hoy, hasta).forEach(f => ev.push({ fecha: f, nombre: o.nombre, monto: -o.monto })));
    ev.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.monto - a.monto);
    let bal = saldoInicial, min = saldoInicial, fechaMin = hoy;
    const at = {};
    const marks = [30, 60, 90].filter(n => n <= dias).map(n => addDays(hoy, n));
    let mi = 0;
    for (const e of ev) {
      while (mi < marks.length && e.fecha > marks[mi]) { at[marks[mi]] = bal; mi++; }
      bal += e.monto; e.saldo = bal;
      if (bal < min) { min = bal; fechaMin = e.fecha; }
    }
    while (mi < marks.length) { at[marks[mi]] = bal; mi++; }
    return { eventos: ev, saldoFinal: bal, minimo: min, fechaMinimo: fechaMin, cortes: at };
  }
  /** Aporte necesario para una meta. */
  function goalContribution(objetivo, actual, fechaMeta, hoy) {
    const falta = Math.max(0, objetivo - actual);
    if (!fechaMeta) return { falta, mensual: null, semanal: null, meses: null };
    const dias = Math.max(0, daysBetween(hoy, fechaMeta));
    const meses = Math.max(1, Math.ceil(dias / 30.4375));
    return { falta, meses, mensual: r2c(falta / meses), semanal: r2c(falta / Math.max(1, Math.ceil(dias / 7))), vencida: dias === 0 && falta > 0 };
  }
  /** Referencia 50/30/20 sobre ingreso neto (solo como guía). */
  const ref503020 = ingreso => ({ necesidades: r2c(ingreso * 0.5), deseos: r2c(ingreso * 0.3), ahorroDeuda: r2c(ingreso * 0.2) });

  return {
    r2c, toCents, fromCents, parseAmount, parseDate, guessDateOrder, parseCSV, guessMapping, tableFromPdfLines, pdfDate,
    addMonths, monthsBetween, daysBetween, addDays, daysInMonth, nextDayOfMonth, ymd,
    normalize, merchantKey, similarity, fingerprint, dedupe, categorize, buildHistory, detectTransfers,
    countsAsFlow, spendByCategory, monthTotals,
    isLiability, accountBalance, fxRate, netWorth,
    pmt, amortize, planDebts, compareStrategies, extraNeededFor, consolidate, diagnoseDebt,
    cardStatus, cardPayoffOptions,
    occurrences, cashForecast, goalContribution, ref503020
  };
});
