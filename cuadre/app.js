/* Cuadre — interfaz. Todos los cálculos vienen de CuadreEngine (E); aquí solo se presenta y se capturan datos. */
(() => {
'use strict';
const E = window.CuadreEngine, Store = window.CuadreStore;
const S = Store.load();
let D = Store.data;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoy = () => Store.today();
const ymNow = () => hoy().slice(0, 7);
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mLabel = (ym, long) => { if (!ym) return '—'; const [y, m] = ym.split('-').map(Number); return (long ? MESL : MES)[m - 1] + ' ' + y; };
const dLabel = d => { const [y, m, dd] = d.split('-').map(Number); return dd + ' ' + MES[m - 1] + (y !== +hoy().slice(0, 4) ? ' ' + y : ''); };
const SYM = { DOP: 'RD$', USD: 'US$', EUR: '€' };
const f0 = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** centavos → texto */
const money = (c, cur, dec) => c == null || !isFinite(c) ? '—' : (c < 0 ? '−' : '') + (SYM[cur || 'DOP'] || cur + ' ') + (dec ? f2 : f0).format(Math.abs(c) / 100);
const pct = (x, d = 0) => x == null || !isFinite(x) ? '—' : (x * 100).toFixed(d) + '%';
const cents = v => E.parseAmount(v);
const inputMoney = c => c ? (c / 100).toFixed(2) : '';
const TIPOS = {
  corriente: 'Cuenta corriente', ahorro: 'Cuenta de ahorro', efectivo: 'Efectivo', certificado: 'Certificado / depósito a plazo',
  inversion: 'Inversión', vehiculo: 'Vehículo', inmueble: 'Inmueble', otro_activo: 'Otro activo',
  tarjeta: 'Tarjeta de crédito', prestamo: 'Préstamo', otro_pasivo: 'Otra deuda'
};
const GRUPOS = [
  ['Disponible', ['corriente', 'ahorro', 'efectivo']], ['Certificados e inversiones', ['certificado', 'inversion']],
  ['Bienes', ['vehiculo', 'inmueble', 'otro_activo']], ['Tarjetas de crédito', ['tarjeta']], ['Préstamos y otras deudas', ['prestamo', 'otro_pasivo']]
];
const LIQUIDOS = ['corriente', 'ahorro', 'efectivo'];
let toastT;
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400); };
function save(msg, audit) {
  if (audit) Store.log(audit[0], audit[1]);
  if (!Store.save()) toast('No se pudo guardar en este teléfono'); else if (msg) toast(msg);
  render();
}
let tab = 'inicio', movMonth = ymNow(), movFilter = 'todos', movCuenta = '', budMonth = ymNow(), flujoEsc = 'central';
try { tab = localStorage.getItem('cuadre_tab') || 'inicio'; } catch (e) {}

/* ---------- datos derivados ---------- */
const acc = id => D.cuentas.find(a => a.id === id);
const activeAccounts = () => D.cuentas.filter(a => !a.archivada);
const bal = a => E.accountBalance(a, D.movs);
const catGroup = n => (D.categorias.find(c => c.nombre === n) || {}).grupo;
const colorOf = (id, i) => `var(--c${(i ?? Math.abs([...id].reduce((s, ch) => s + ch.charCodeAt(0), 0))) % 8})`;
function debtsForEngine() {
  return activeAccounts().filter(a => (a.tipo === 'tarjeta' || a.tipo === 'prestamo' || a.tipo === 'otro_pasivo') && !a.pagoTotal && (a.moneda || 'DOP') === 'DOP')
    .map(a => ({ id: a.id, nombre: a.nombre, saldo: Math.max(0, bal(a)), tasa: a.tasa || 0, tasaFalta: a.tasa == null,
      cuota: a.tipo === 'tarjeta' ? (a.pagoMinimo || 0) : (a.cuota || 0), comisionMensual: a.comisionMensual || 0,
      penalidadAbono: a.penalidadAbono || 0, tipoTasa: a.tipoTasa, tipo: a.tipo }))
    .filter(d => d.saldo > 0);
}
const planOpts = () => ({ inicio: ymNow(), extraMensual: D.plan.extraMensual || 0, extraDesde: D.plan.extraDesde || null, eventos: D.plan.eventos || [], orden: D.plan.orden || [], estrategia: D.plan.estrategia });
function ingresoMensualFijo() {
  return D.recurrentes.filter(r => r.activo !== false && r.tipo === 'ingreso' && r.certeza !== 'incierto')
    .reduce((s, r) => s + (r.frecuencia === 'mensual' ? r.monto : r.frecuencia === 'quincenal' ? r.monto * 2 : r.frecuencia === 'semanal' ? Math.round(r.monto * 52 / 12) : 0), 0);
}
function gastoRecurrenteMensual() {
  return D.recurrentes.filter(r => r.activo !== false && r.tipo === 'gasto')
    .reduce((s, r) => s + (r.frecuencia === 'mensual' ? r.monto : r.frecuencia === 'quincenal' ? r.monto * 2 : r.frecuencia === 'anual' ? Math.round(r.monto / 12) : r.frecuencia === 'semanal' ? Math.round(r.monto * 52 / 12) : 0), 0);
}
function metaActual(g) { if (g.cuenta && acc(g.cuenta)) return bal(acc(g.cuenta)); return g.actual || 0; }
function obligaciones() {
  return activeAccounts().filter(a => a.tipo === 'prestamo' && a.cuota && a.diaPago && bal(a) > 0).map(a => ({ nombre: 'Cuota ' + a.nombre, monto: Math.min(a.cuota, bal(a)), dia: a.diaPago }))
    .concat(activeAccounts().filter(a => a.tipo === 'tarjeta' && a.diaPago && bal(a) > 0).map(a => ({ nombre: (a.pagoTotal ? 'Pago total ' : 'Pago mínimo ') + a.nombre, monto: a.pagoTotal ? bal(a) : (a.pagoMinimo || 0), dia: a.diaPago })))
    .filter(o => o.monto > 0);
}
const liquido = () => activeAccounts().filter(a => LIQUIDOS.includes(a.tipo) && (a.moneda || 'DOP') === 'DOP').reduce((s, a) => s + bal(a), 0);

/* ---------- alertas (reglas deterministas) ---------- */
function alertas() {
  const out = [], h = hoy();
  activeAccounts().forEach(a => {
    const b = bal(a);
    if (a.tipo === 'tarjeta' && b > 0) {
      const st = E.cardStatus(a, b, h);
      if (st.diasParaPago != null && st.diasParaPago <= 5) out.push({ n: st.diasParaPago <= 2 ? 'bad' : '', t: `${a.nombre}: pago en ${st.diasParaPago === 0 ? 'hoy' : st.diasParaPago + ' días'}`, s: `${a.pagoTotal ? 'Pago total' : 'Pago mínimo'} ${money(a.pagoTotal ? b : a.pagoMinimo)} antes del ${dLabel(st.proximoPago)}.` });
      if (st.alertaUtilizacion === 'alta') out.push({ n: '', t: `${a.nombre} usa el ${pct(st.utilizacion)} del límite`, s: 'Una utilización alta afecta tu historial de crédito.' });
    }
    if (a.tipo === 'prestamo' && a.diaPago && b > 0) {
      const d = E.daysBetween(h, E.nextDayOfMonth(h, a.diaPago));
      if (d <= 5) out.push({ n: d <= 2 ? 'bad' : '', t: `Cuota de ${a.nombre} en ${d === 0 ? 'hoy' : d + ' días'}`, s: money(a.cuota) });
    }
    if ((a.tipo === 'prestamo' || a.tipo === 'tarjeta') && !a.pagoTotal && b > 0) {
      const cu = a.tipo === 'tarjeta' ? a.pagoMinimo : a.cuota;
      if (a.tasa != null && cu && cu <= E.r2c(b * a.tasa / 12)) out.push({ n: 'bad', t: `La cuota de ${a.nombre} no cubre los intereses`, s: 'El saldo crecerá cada mes si solo pagas esa cuota.' });
      if (a.tasa == null) out.push({ n: 'info', t: `Falta la tasa de ${a.nombre}`, s: 'Sin tasa el plan supone 0% para esta deuda.' });
    }
    if (a.fechaSaldo && E.daysBetween(a.fechaSaldo, h) > 35 && !D.movs.some(m => m.cuenta === a.id && m.fecha > a.fechaSaldo)) out.push({ n: 'info', t: `${a.nombre} sin actualizar desde ${dLabel(a.fechaSaldo)}`, s: 'Confirma el saldo con el banco en Cuentas.' });
  });
  const rev = D.movs.filter(m => !m.excluida && (m.tipo === 'gasto' || m.tipo === 'ingreso') && (!m.categoria || (m.confianza ?? 1) < 0.75)).length;
  if (rev) out.push({ n: 'info', t: `${rev} movimiento${rev > 1 ? 's' : ''} por revisar`, s: 'Confirma su categoría para que la app aprenda.', go: 'revisar' });
  const ym = ymNow(), sp = E.spendByCategory(D.movs, ym);
  D.categorias.filter(c => c.presupuesto > 0 && (sp[c.nombre] || 0) > c.presupuesto).forEach(c => out.push({ n: '', t: `${c.nombre} pasó su presupuesto`, s: `${money(sp[c.nombre])} de ${money(c.presupuesto)} este mes.` }));
  const fc = E.cashForecast(liquido(), D.recurrentes, obligaciones(), h, 30, 'conservador');
  if (fc.minimo < 0) out.push({ n: 'bad', t: 'Tu efectivo podría quedar en negativo', s: `Escenario conservador: ${money(fc.minimo)} el ${dLabel(fc.fechaMinimo)}.` });
  const nw = E.netWorth(activeAccounts(), D.movs, D.fx, h);
  if (nw.sinTasa.length) out.push({ n: 'info', t: `Falta tasa de cambio para ${nw.sinTasa.join(', ')}`, s: 'Esas cuentas no se suman al patrimonio hasta que agregues una tasa.' });
  const days = D.ultimoRespaldo ? E.daysBetween(D.ultimoRespaldo, h) : 999;
  if (days > 30 && (D.movs.length > 5 || D.cuentas.length > 2)) out.push({ n: 'info', t: 'Haz un respaldo de tus datos', s: 'Viven solo en este teléfono.', go: 'respaldo' });
  return out;
}

/* ---------- navegación ---------- */
function showTab(t) {
  tab = t; try { localStorage.setItem('cuadre_tab', t); } catch (e) {}
  ['inicio', 'movs', 'deudas', 'presupuesto', 'cuentas'].forEach(k => { $('#v-' + k).hidden = k !== t; });
  $$('.tab').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
}
$$('.tab').forEach(b => b.onclick = () => { showTab(b.dataset.tab); render(); window.scrollTo({ top: 0 }); });

function render() {
  D = Store.data;
  $('#topChip').textContent = mLabel(ymNow(), true);
  const r = { inicio: renderInicio, movs: renderMovs, deudas: renderDeudas, presupuesto: renderPresupuesto, cuentas: renderCuentas };
  try { r[tab](); } catch (e) { console.error(e); $('#v-' + tab).innerHTML = `<div class="card empty"><strong>Algo salió mal en esta pantalla</strong>${esc(e.message)}</div>`; }
  showTab(tab);
}

/* =========================================================
   INICIO
   ========================================================= */
function renderInicio() {
  const h = hoy(), ym = ymNow();
  const nw = E.netWorth(activeAccounts(), D.movs, D.fx, h);
  const mt = E.monthTotals(D.movs, ym);
  const presTotal = D.categorias.filter(c => c.grupo !== 'ingreso').reduce((s, c) => s + (c.presupuesto || 0), 0);
  const debts = debtsForEngine();
  const totalDeuda = activeAccounts().filter(E.isLiability).reduce((s, a) => s + Math.max(0, bal(a)), 0);
  const plan = debts.length ? E.planDebts(debts, planOpts()) : null;
  const al = alertas();
  // próximos 14 días
  const fc = E.cashForecast(liquido(), D.recurrentes, obligaciones(), h, 14, 'central');
  const prox = fc.eventos.slice(0, 8);
  const tot = nw.activos + nw.pasivos || 1;
  $('#v-inicio').innerHTML = `
    <div class="card hero">
      <div class="label">Patrimonio neto</div>
      <div class="big num ${nw.neto < 0 ? '' : ''}">${money(nw.neto)}</div>
      <p class="hint" style="margin:2px 0 12px">Lo que tienes menos lo que debes · en RD$</p>
      <div class="splitbar" aria-hidden="true"><i style="width:${nw.activos / tot * 100}%;background:var(--pos)"></i><i style="width:${nw.pasivos / tot * 100}%;background:var(--neg)"></i></div>
      <div class="legend" style="margin-top:8px"><span><i class="sw" style="--c:var(--pos)"></i>Activos ${money(nw.activos)}</span><span><i class="sw" style="--c:var(--neg)"></i>Deudas ${money(nw.pasivos)}</span></div>
    </div>

    <div class="sec-h"><h2>Este mes</h2><span class="aside">${mLabel(ym, true)}</span></div>
    <div class="card stack">
      <div class="tiles">
        <div class="tile"><div class="label">Entró</div><div class="v num pos">${money(mt.ingresos)}</div></div>
        <div class="tile"><div class="label">Gastaste</div><div class="v num">${money(mt.gastos)}</div></div>
        <div class="tile"><div class="label">Neto</div><div class="v num ${mt.neto < 0 ? 'neg' : ''}">${money(mt.neto)}</div></div>
      </div>
      ${presTotal ? `<div><div class="row hint"><span>Presupuesto usado</span><span class="num">${money(mt.gastos)} de ${money(presTotal)}</span></div>
        <div class="bar ${mt.gastos > presTotal ? 'over' : ''}" style="margin-top:6px"><b style="width:${Math.min(100, mt.gastos / presTotal * 100)}%"></b></div></div>`
      : `<p class="hint">Define presupuestos por categoría en Presupuesto para ver tu avance.</p>`}
      ${!D.movs.length ? `<p class="note info">Aún no hay movimientos. Usa el botón + o importa un CSV o Excel del banco en Movimientos.</p>` : ''}
    </div>

    ${al.length ? `<div class="sec-h"><h2>Atención</h2><span class="aside">${al.length}</span></div>
    <div class="card">${al.map((a, i) => `<div class="alert ${a.n}" ${a.go ? `data-go="${a.go}" role="button" tabindex="0"` : ''}><div><strong>${esc(a.t)}</strong><span class="hint">${esc(a.s)}</span></div></div>`).join('')}</div>` : ''}

    <div class="sec-h"><h2>Deudas</h2><span class="aside">${plan && plan.completo ? 'Libre en ' + mLabel(plan.fechaLibre, true) : ''}</span></div>
    <div class="card stack" data-goto="deudas" role="button" tabindex="0" style="cursor:pointer">
      <div class="row"><div><div class="label">Debes en total</div><div class="mid num">${money(totalDeuda)}</div></div>
        ${plan && plan.calendario[0] && plan.calendario[0].prioridad ? `<div style="text-align:right"><div class="label">Prioridad del mes</div><strong>${esc(acc(plan.calendario[0].prioridad).nombre)}</strong></div>` : ''}</div>
      ${plan ? `<div class="kv"><span>Estrategia</span><strong>${nombreEstrategia(D.plan.estrategia)} · ${money(D.plan.extraMensual)} extra/mes</strong></div>
      <div class="kv"><span>Intereses y cargos que faltan</span><strong class="num">${plan.completo ? money(plan.costoTotal) : 'no termina con este pago'}</strong></div>` : '<p class="hint">Sin deudas activas con interés.</p>'}
    </div>

    <div class="sec-h"><h2>Próximos 14 días</h2><span class="aside">Saldo disponible ${money(liquido())}</span></div>
    <div class="card list">${prox.length ? prox.map(e => `<div class="item"><div class="ico">${e.fecha.slice(8)}</div><div><div class="t">${esc(e.nombre)}</div><div class="s">${dLabel(e.fecha)}</div></div><div class="a num ${e.monto > 0 ? 'pos' : ''}">${e.monto > 0 ? '+' : ''}${money(e.monto)}</div></div>`).join('')
      : '<div class="empty">Sin pagos ni cobros programados. Agrégalos en Presupuesto → Recurrentes, o pon el día de pago en tus deudas.</div>'}</div>
  `;
  $$('#v-inicio [data-go]').forEach(el => el.onclick = () => { if (el.dataset.go === 'revisar') { movFilter = 'revisar'; showTab('movs'); render(); } else { showTab('cuentas'); render(); setTimeout(() => $('#datos')?.scrollIntoView({ behavior: 'smooth' }), 50); } });
  $$('#v-inicio [data-goto]').forEach(el => el.onclick = () => { showTab(el.dataset.goto); render(); window.scrollTo({ top: 0 }); });
}
const nombreEstrategia = e => ({ avalancha: 'Avalancha', bola: 'Bola de nieve', hibrida: 'Híbrida', personalizada: 'Personalizada', minimos: 'Solo mínimos' }[e] || e);

/* =========================================================
   MOVIMIENTOS
   ========================================================= */
const TIPO_MOV = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', pago_deuda: 'Pago de deuda', ajuste: 'Ajuste' };
function renderMovs() {
  const needsReview = m => !m.excluida && (m.tipo === 'gasto' || m.tipo === 'ingreso') && (!m.categoria || (m.confianza ?? 1) < 0.75);
  let list = D.movs.filter(m => movFilter === 'revisar' ? needsReview(m) : m.fecha.slice(0, 7) === movMonth);
  if (movCuenta) list = list.filter(m => m.cuenta === movCuenta);
  list.sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0));
  const nRev = D.movs.filter(needsReview).length;
  const mt = E.monthTotals(D.movs.filter(m => !movCuenta || m.cuenta === movCuenta), movMonth);
  let lastDay = '';
  const rows = list.map(m => {
    const a = acc(m.cuenta);
    const day = m.fecha !== lastDay ? `<div class="dayhead">${dLabel(m.fecha)}</div>` : ''; lastDay = m.fecha;
    const badge = m.tipo === 'transferencia' ? '<span class="pill acc">Transferencia</span>' : m.tipo === 'pago_deuda' ? '<span class="pill acc">Pago de deuda</span>' : m.tipo === 'ajuste' ? '<span class="pill">Ajuste</span>' : '';
    const rev = needsReview(m) ? '<span class="pill warn">Revisar</span>' : '';
    const ex = m.excluida ? '<span class="pill">Excluido</span>' : '';
    const cat = m.categoria || (m.tipo === 'gasto' || m.tipo === 'ingreso' ? 'Sin categoría' : '');
    return day + `<button class="item" data-mov="${esc(m.id)}"><div class="ico" style="color:${m.monto > 0 ? 'var(--pos)' : 'var(--muted)'}">${m.monto > 0 ? '+' : '−'}</div>
      <div style="min-width:0"><div class="t">${esc(m.descripcion || cat || TIPO_MOV[m.tipo])}</div><div class="s">${esc(cat)}${cat ? ' · ' : ''}${esc(a ? a.nombre : 'Cuenta borrada')} ${badge}${rev}${ex}</div></div>
      <div class="a num ${m.monto > 0 ? 'pos' : ''}">${m.monto > 0 ? '+' : ''}${money(m.monto, m.moneda, true)}</div></button>`;
  }).join('');
  $('#v-movs').innerHTML = `
    <div class="toolbar">
      <div class="monthnav" ${movFilter === 'revisar' ? 'hidden' : ''}><button id="mPrev" aria-label="Mes anterior">‹</button><span>${mLabel(movMonth, true)}</span><button id="mNext" aria-label="Mes siguiente">›</button></div>
      <select id="mCuenta" style="flex:1;min-width:140px"><option value="">Todas las cuentas</option>${activeAccounts().map(a => `<option value="${esc(a.id)}" ${a.id === movCuenta ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select>
    </div>
    <div class="chips"><button data-f="todos" aria-pressed="${movFilter === 'todos'}">Del mes</button><button data-f="revisar" aria-pressed="${movFilter === 'revisar'}">Por revisar${nRev ? ' (' + nRev + ')' : ''}</button></div>
    ${movFilter !== 'revisar' ? `<div class="card"><div class="tiles">
      <div class="tile"><div class="label">Ingresos</div><div class="v num pos">${money(mt.ingresos)}</div></div>
      <div class="tile"><div class="label">Gastos</div><div class="v num">${money(mt.gastos)}</div></div>
      <div class="tile"><div class="label">Neto</div><div class="v num ${mt.neto < 0 ? 'neg' : ''}">${money(mt.neto)}</div></div></div>
      <p class="hint" style="margin-top:8px">Transferencias entre tus cuentas y pagos de deudas no cuentan como gasto.</p></div>` : `<p class="hint">Movimientos sin categoría o con categoría dudosa. Al confirmarlos, la app aprende para la próxima vez.</p>`}
    <div class="grid2"><button class="btn ghost" id="btnImport">Importar estado de cuenta</button><button class="btn ghost" id="btnTransfers">Buscar transferencias</button></div>
    <div class="card list">${rows || `<div class="empty"><strong>${movFilter === 'revisar' ? 'Todo revisado' : 'Sin movimientos este mes'}</strong>${movFilter === 'revisar' ? '' : 'Registra uno con el botón + o importa el estado de cuenta.'}</div>`}</div>`;
  $('#mPrev') && ($('#mPrev').onclick = () => { movMonth = E.addMonths(movMonth, -1); render(); });
  $('#mNext') && ($('#mNext').onclick = () => { movMonth = E.addMonths(movMonth, 1); render(); });
  $('#mCuenta').onchange = e => { movCuenta = e.target.value; render(); };
  $$('#v-movs [data-f]').forEach(b => b.onclick = () => { movFilter = b.dataset.f; render(); });
  $$('#v-movs [data-mov]').forEach(b => b.onclick = () => editMov(b.dataset.mov));
  $('#btnImport').onclick = importWizard;
  $('#btnTransfers').onclick = () => { const n = linkTransfers(); save(n ? `${n} transferencia${n > 1 ? 's' : ''} detectada${n > 1 ? 's' : ''}` : 'No se encontraron transferencias nuevas', n ? ['transferencias', n + ' pares detectados'] : null); };
}

/** Empareja transferencias y pagos de deuda; devuelve cuántos pares nuevos. */
function linkTransfers() {
  const pairs = E.detectTransfers(D.movs, D.cuentas);
  pairs.forEach(([o, i, tipo]) => {
    const a = D.movs.find(m => m.id === o), b = D.movs.find(m => m.id === i);
    a.par = b.id; b.par = a.id; a.tipo = b.tipo = tipo; a.categoria = b.categoria = null; a.catOrigen = b.catOrigen = 'transferencia'; a.confianza = b.confianza = 1;
  });
  return pairs.length;
}

/* ---------- registro rápido ---------- */
function quickAdd(pre = {}) {
  const accs = activeAccounts();
  if (!accs.length) { toast('Primero crea una cuenta'); showTab('cuentas'); render(); return; }
  const liquid = accs.filter(a => !E.isLiability(a));
  const debts = accs.filter(E.isLiability);
  let tipo = pre.tipo || 'gasto';
  const catOpts = g => D.categorias.filter(c => g === 'ingreso' ? c.grupo === 'ingreso' : c.grupo !== 'ingreso').map(c => `<option>${esc(c.nombre)}</option>`).join('');
  openSheet(`
    <h2>Registrar</h2>
    <div class="seg" id="qTipo"><button data-t="gasto">Gasto</button><button data-t="ingreso">Ingreso</button><button data-t="transferencia">Transferir</button><button data-t="pago_deuda">Pagar deuda</button></div>
    <label class="field"><span>Monto</span><input id="qMonto" inputmode="decimal" placeholder="0.00" value="${pre.monto ? inputMoney(pre.monto) : ''}"></label>
    <label class="field" id="qDescF"><span>Descripción</span><input id="qDesc" placeholder="Ej. Supermercado Nacional"></label>
    <div class="grid2">
      <label class="field" id="qCuentaF"><span id="qCuentaL">Cuenta</span><select id="qCuenta">${accs.map(a => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('')}</select></label>
      <label class="field" id="qDestF"><span>Hacia</span><select id="qDest"></select></label>
      <label class="field" id="qCatF"><span>Categoría</span><select id="qCat"></select></label>
    </div>
    <label class="field"><span>Fecha</span><input id="qFecha" type="date" value="${hoy()}"></label>
    <p class="hint" id="qHint"></p>
    <button class="btn" id="qSave">Guardar</button>`, () => {
    const setT = t => {
      tipo = t;
      $$('#qTipo button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === t));
      const isPair = t === 'transferencia' || t === 'pago_deuda';
      $('#qDestF').hidden = !isPair; $('#qCatF').hidden = isPair;
      $('#qCuentaL').textContent = isPair ? 'Desde' : 'Cuenta';
      $('#qCuenta').innerHTML = (isPair ? liquid : (t === 'ingreso' ? liquid : accs)).map(a => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('') || accs.map(a => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('');
      $('#qDest').innerHTML = (t === 'pago_deuda' ? debts : liquid).map(a => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join('');
      if (pre.cuenta && t === 'pago_deuda') $('#qDest').value = pre.cuenta;
      $('#qCat').innerHTML = catOpts(t === 'ingreso' ? 'ingreso' : 'gasto');
      $('#qHint').textContent = t === 'pago_deuda' ? 'Sale de tu cuenta y baja el saldo de la deuda. No cuenta como gasto.' : t === 'transferencia' ? 'Mueve dinero entre tus cuentas. No es ingreso ni gasto.' : t === 'gasto' ? 'Si pagas con tarjeta, elige la tarjeta como cuenta: sube lo que debes.' : '';
    };
    $$('#qTipo button').forEach(b => b.onclick = () => setT(b.dataset.t));
    setT(tipo);
    $('#qDesc').addEventListener('change', () => { const c = E.categorize({ descripcion: $('#qDesc').value, monto: tipo === 'ingreso' ? 1 : -1 }, D.reglas, E.buildHistory(D.movs)); if (c.categoria && [...$('#qCat').options].some(o => o.value === c.categoria)) $('#qCat').value = c.categoria; });
    setTimeout(() => $('#qMonto').focus({ preventScroll: true }), 260);
    $('#qSave').onclick = () => {
      const m = cents($('#qMonto').value);
      if (!m || m <= 0) { toast('Escribe un monto mayor que cero'); return; }
      const fecha = $('#qFecha').value || hoy(), cuenta = $('#qCuenta').value, desc = $('#qDesc').value.trim();
      const base = { fecha, creado: Date.now(), origen: 'manual', moneda: (acc(cuenta) || {}).moneda || 'DOP' };
      if (tipo === 'transferencia' || tipo === 'pago_deuda') {
        const dest = $('#qDest').value;
        if (!dest || dest === cuenta) { toast('Elige una cuenta de destino distinta'); return; }
        const a = { ...base, id: Store.uid('m'), cuenta, monto: -m, tipo, descripcion: desc || (tipo === 'pago_deuda' ? 'Pago a ' + acc(dest).nombre : 'Transferencia a ' + acc(dest).nombre), catOrigen: 'transferencia', confianza: 1 };
        const b = { ...base, id: Store.uid('m'), cuenta: dest, monto: m, tipo, descripcion: a.descripcion, catOrigen: 'transferencia', confianza: 1, moneda: acc(dest).moneda || 'DOP' };
        a.par = b.id; b.par = a.id; D.movs.push(a, b);
      } else {
        const mov = { ...base, id: Store.uid('m'), cuenta, monto: tipo === 'ingreso' ? m : -m, tipo, descripcion: desc, categoria: $('#qCat').value, catOrigen: 'usuario', confianza: 1 };
        D.movs.push(mov);
      }
      closeSheet(); save('Movimiento guardado', ['crear movimiento', `${TIPO_MOV[tipo]} ${money(m)}`]);
    };
  });
}
$('#fab').onclick = () => quickAdd();

/* ---------- editar movimiento ---------- */
function editMov(id) {
  const m = D.movs.find(x => x.id === id); if (!m) return;
  const a = acc(m.cuenta);
  const isFlow = m.tipo === 'gasto' || m.tipo === 'ingreso';
  const cats = D.categorias.filter(c => m.monto > 0 ? c.grupo === 'ingreso' : c.grupo !== 'ingreso');
  const key = E.merchantKey(m.descripcion);
  openSheet(`
    <h2>${esc(m.descripcion || TIPO_MOV[m.tipo])}</h2>
    <div class="kv"><span>${esc(a ? a.nombre : 'Cuenta borrada')} · ${dLabel(m.fecha)}</span><strong class="num ${m.monto > 0 ? 'pos' : ''}">${money(m.monto, m.moneda, true)}</strong></div>
    <div class="kv"><span>Origen</span><strong>${esc(m.origen === 'manual' ? 'Registro manual' : 'Importado (' + (m.archivo || m.origen) + ')')}</strong></div>
    ${m.catOrigen && isFlow ? `<div class="kv"><span>Categoría asignada por</span><strong>${{ usuario: 'ti', regla: 'tu regla', historial: 'tu historial', sistema: 'regla general', ninguna: 'nadie todavía' }[m.catOrigen] || m.catOrigen}${m.confianza != null && m.catOrigen !== 'usuario' ? ' · confianza ' + pct(m.confianza) : ''}</strong></div>` : ''}
    <label class="field"><span>Tipo</span><select id="eTipo">${Object.entries(TIPO_MOV).map(([k, v]) => `<option value="${k}" ${k === m.tipo ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="field" id="eCatF"><span>Categoría</span><select id="eCat"><option value="">Sin categoría</option>${cats.map(c => `<option ${c.nombre === m.categoria ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></label>
    ${key ? `<label class="check" id="eLearnF"><input type="checkbox" id="eLearn" checked> Usar esta categoría para "${esc(key)}" en adelante</label>` : ''}
    <div class="grid2"><label class="field"><span>Descripción</span><input id="eDesc" value="${esc(m.descripcion)}"></label><label class="field"><span>Fecha</span><input id="eFecha" type="date" value="${m.fecha}"></label></div>
    <label class="field"><span>Nota</span><input id="eNota" value="${esc(m.nota || '')}"></label>
    <label class="check"><input type="checkbox" id="eExcl" ${m.excluida ? 'checked' : ''}> Excluir de presupuestos y reportes</label>
    <button class="btn" id="eSave">Guardar cambios</button>
    <div class="grid2"><button class="btn ghost" id="eSplit">Dividir</button><button class="btn danger" id="eDel">Borrar</button></div>
    ${m.par ? '<p class="hint">Está emparejado con otro movimiento. Borrarlo borra los dos.</p>' : ''}`, () => {
    const sync = () => { const fl = ['gasto', 'ingreso'].includes($('#eTipo').value); $('#eCatF').hidden = !fl; if ($('#eLearnF')) $('#eLearnF').hidden = !fl; };
    $('#eTipo').onchange = sync; sync();
    $('#eSave').onclick = () => {
      const before = JSON.stringify({ t: m.tipo, c: m.categoria });
      m.tipo = $('#eTipo').value; m.descripcion = $('#eDesc').value.trim(); m.fecha = $('#eFecha').value || m.fecha; m.nota = $('#eNota').value.trim(); m.excluida = $('#eExcl').checked;
      if (m.tipo === 'gasto' || m.tipo === 'ingreso') {
        const nc = $('#eCat').value || null;
        if (nc !== m.categoria || m.catOrigen !== 'usuario') { m.categoria = nc; m.catOrigen = nc ? 'usuario' : 'ninguna'; m.confianza = nc ? 1 : 0; }
        if (nc && key && $('#eLearn') && $('#eLearn').checked) {
          const r = D.reglas.find(x => x.origen === 'usuario' && E.normalize(x.patron) === key);
          if (r) r.categoria = nc; else D.reglas.push({ id: Store.uid('r'), patron: key, categoria: nc, origen: 'usuario' });
          // aplica a los pendientes con el mismo comercio
          D.movs.filter(x => x !== m && x.catOrigen !== 'usuario' && E.merchantKey(x.descripcion) === key && Math.sign(x.monto) === Math.sign(m.monto)).forEach(x => { x.categoria = nc; x.catOrigen = 'regla'; x.confianza = 0.95; });
        }
      }
      closeSheet(); save('Cambios guardados', ['editar movimiento', `${m.descripcion}: ${before} → ${JSON.stringify({ t: m.tipo, c: m.categoria })}`]);
    };
    armed($('#eDel'), 'Toca otra vez para borrar', () => {
      D.movs = D.movs.filter(x => x.id !== m.id && x.id !== m.par);
      closeSheet(); save('Movimiento borrado', ['borrar movimiento', `${m.descripcion} ${money(m.monto)}`]);
    });
    $('#eSplit').onclick = () => splitMov(m);
  });
}
function splitMov(m) {
  const cats = D.categorias.filter(c => m.monto > 0 ? c.grupo === 'ingreso' : c.grupo !== 'ingreso');
  const opt = sel => cats.map(c => `<option ${c.nombre === sel ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
  openSheet(`<h2>Dividir ${money(Math.abs(m.monto), m.moneda, true)}</h2>
    <p class="hint">Reparte el monto en dos categorías. La segunda parte se calcula sola.</p>
    <div class="grid2"><label class="field"><span>Parte 1</span><input id="s1" inputmode="decimal" value="${inputMoney(Math.round(Math.abs(m.monto) / 2))}"></label><label class="field"><span>Categoría</span><select id="c1">${opt(m.categoria)}</select></label></div>
    <div class="grid2"><div class="field"><span>Parte 2</span><div class="num" id="s2" style="padding:11px 2px;font-weight:700"></div></div><label class="field"><span>Categoría</span><select id="c2">${opt()}</select></label></div>
    <button class="btn" id="sOk">Dividir</button>`, () => {
    const upd = () => { const a = cents($('#s1').value) || 0; $('#s2').textContent = money(Math.abs(m.monto) - a, m.moneda, true); };
    $('#s1').oninput = upd; upd();
    $('#sOk').onclick = () => {
      const a = cents($('#s1').value) || 0, total = Math.abs(m.monto);
      if (a <= 0 || a >= total) { toast('La parte 1 debe ser menor que el total'); return; }
      const sign = Math.sign(m.monto);
      const p2 = { ...m, id: Store.uid('m'), monto: sign * (total - a), categoria: $('#c2').value, catOrigen: 'usuario', confianza: 1, dividido: m.id, huella: null };
      m.monto = sign * a; m.categoria = $('#c1').value; m.catOrigen = 'usuario'; m.confianza = 1; m.dividido = m.id;
      D.movs.push(p2); closeSheet(); save('Movimiento dividido', ['dividir movimiento', m.descripcion]);
    };
  });
}

/* ---------- importación ---------- */
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = XLSX_URL; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el lector de Excel. Conéctate a internet una vez o guarda el archivo como CSV.')); document.head.appendChild(s); });
}
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
async function loadPDFJS() {
  if (!window.pdfjsLib) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = PDFJS_URL; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar el lector de PDF. Conéctate a internet una vez para descargarlo.')); document.head.appendChild(s); });
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // el worker se carga como blob para evitar el bloqueo entre dominios
    try { const t = await (await fetch(PDFJS_WORKER)).text(); pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([t], { type: 'text/javascript' })); }
    catch (e) { pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; }
  }
}
/** Lee el texto del PDF en el teléfono y lo agrupa en renglones. La contraseña no se guarda. */
async function pdfLines(buf, password) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), password: password || undefined, isEvalSupported: false }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const byY = new Map();
    tc.items.forEach(it => { if (!it.str || !it.str.trim()) return; const y = Math.round(it.transform[5] / 2) * 2; if (!byY.has(y)) byY.set(y, []); byY.get(y).push({ x: it.transform[4], w: it.width, str: it.str }); });
    [...byY.keys()].sort((a, b) => b - a).forEach(y => out.push({ page: p, y, items: byY.get(y) }));
  }
  doc.destroy();
  return out;
}
async function importPdf(buf, cuenta, name, password) {
  try {
    const lines = await pdfLines(buf.slice(0), password);
    if (!lines.length) throw new Error('Este PDF no tiene texto (parece escaneado). Pide al banco el estado de cuenta digital.');
    const t = E.tableFromPdfLines(lines);
    if (!t.rows.length) throw new Error('No encontré movimientos con fecha y monto en este PDF.');
    mapStep([t.headers].concat(t.rows), cuenta, name, { pdf: true, signoCredito: t.signoCredito });
  } catch (e) {
    if (e && e.name === 'PasswordException') {
      const wrong = e.code === 2;
      openSheet(`<h2>PDF con contraseña</h2>
        <p class="hint">${wrong ? '<span class="neg">Contraseña incorrecta.</span> ' : ''}Muchos bancos protegen el estado de cuenta con tu cédula u otro número. Se usa solo para abrirlo aquí y no se guarda.</p>
        <label class="field"><span>Contraseña</span><input id="pwIn" type="password" inputmode="text" autocomplete="off"></label>
        <button class="btn" id="pwOk">Abrir</button>`, () => {
        setTimeout(() => $('#pwIn').focus(), 260);
        const go = () => { const pw = $('#pwIn').value; if (!pw) return; $('#pwOk').disabled = true; $('#pwOk').textContent = 'Abriendo…'; importPdf(buf, cuenta, name, pw); };
        $('#pwOk').onclick = go; $('#pwIn').onkeydown = ev => { if (ev.key === 'Enter') go(); };
      });
      return;
    }
    toast(e.message || 'No se pudo leer el PDF');
  }
}
function importWizard() {
  const accs = activeAccounts();
  if (!accs.length) { toast('Primero crea la cuenta a la que pertenece el archivo'); showTab('cuentas'); render(); return; }
  openSheet(`<h2>Importar movimientos</h2>
    <p class="hint">Sube el estado de cuenta del banco en PDF, Excel o CSV. Se lee en tu teléfono; nada se envía a ningún lado.</p>
    <label class="field"><span>Cuenta del archivo</span><select id="iCuenta">${accs.map(a => `<option value="${esc(a.id)}" ${a.id === movCuenta ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}</select></label>
    <button class="btn" id="iPick">Elegir archivo</button>
    <p class="hint">El PDF debe ser el digital del banco (no una foto o escaneo). OFX todavía no.</p>`, () => {
    $('#iPick').onclick = () => {
      const fi = $('#fileInput'); fi.accept = '.csv,.txt,.xlsx,.xls,.pdf,text/csv,application/pdf'; fi.value = '';
      fi.onchange = async () => {
        const f = fi.files[0]; if (!f) return;
        try {
          let rows;
          if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') { $('#iPick').textContent = 'Leyendo PDF…'; await loadPDFJS(); await importPdf(await f.arrayBuffer(), $('#iCuenta').value, f.name); return; }
          if (/\.xlsx?$/i.test(f.name)) { await loadXLSX(); const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: false }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }).map(r => r.map(c => typeof c === 'number' ? c : String(c).trim())).filter(r => r.some(c => c !== '')); }
          else rows = E.parseCSV(await f.text());
          if (rows.length < 2) throw new Error('El archivo no tiene filas suficientes.');
          mapStep(rows, $('#iCuenta').value, f.name);
        } catch (e) { toast(e.message || 'No se pudo leer el archivo'); }
      };
      fi.click();
    };
  });
}
function mapStep(rows, cuenta, archivo, meta) {
  meta = meta || {};
  // busca la fila de encabezados: la primera con ≥ 2 textos que parezcan títulos
  let hRow = rows.findIndex(r => { const m = E.guessMapping(r.map(String)); return m.fecha != null && (m.monto != null || m.debito != null || m.credito != null); });
  if (hRow < 0) hRow = 0;
  const headers = rows[hRow].map((h, i) => String(h || 'Columna ' + (i + 1)));
  const data = rows.slice(hRow + 1);
  const g = E.guessMapping(headers);
  const order = E.guessDateOrder(data.map(r => r[g.fecha ?? 0]));
  const sel = (id, v, opt) => `<select id="${id}"><option value="">${opt ? '— ninguna —' : '— elegir —'}</option>${headers.map((h, i) => `<option value="${i}" ${v === i ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select>`;
  const a = acc(cuenta);
  openSheet(`<h2>Columnas del archivo</h2>
    <p class="hint">${esc(archivo)} · ${data.length} filas · cuenta ${esc(a.nombre)}</p>
    <div class="grid2"><label class="field"><span>Fecha</span>${sel('mF', g.fecha)}</label><label class="field"><span>Descripción</span>${sel('mD', g.descripcion)}</label></div>
    <div class="seg" id="mModo"><button data-m="uno">Un solo monto</button><button data-m="dos">Débito y crédito</button></div>
    <div class="grid2" id="mUno"><label class="field"><span>Monto</span>${sel('mM', g.monto)}</label><label class="field"><span>Los gastos vienen</span><select id="mSigno"><option value="neg">En negativo</option><option value="pos" ${meta.signoCredito === 'negativo' || (a.tipo === 'tarjeta' && meta.pdf) ? 'selected' : ''}>En positivo</option></select></label></div>
    <div class="grid2" id="mDos"><label class="field"><span>Débito (sale)</span>${sel('mDe', g.debito, true)}</label><label class="field"><span>Crédito (entra)</span>${sel('mCr', g.credito, true)}</label></div>
    <div class="grid2"><label class="field"><span>Formato de fecha</span><select id="mOrd"><option value="dmy" ${order === 'dmy' ? 'selected' : ''}>día/mes/año</option><option value="mdy" ${order === 'mdy' ? 'selected' : ''}>mes/día/año</option></select></label>
      <label class="field"><span>Moneda</span>${sel('mMon', g.moneda, true)}</label></div>
    <label class="field"><span>Número de referencia (opcional, evita repetidos entre estados)</span>${sel('mRef', g.referencia, true)}</label>
    ${meta.pdf ? '<p class="note info">Leí el PDF y separé las columnas de montos por su posición. Revisa que Débito y Crédito estén bien y que no hayas elegido la columna de balance.</p>' : ''}
    ${a.tipo === 'tarjeta' ? '<p class="note info">Es una tarjeta: las compras suben lo que debes y los pagos lo bajan.</p>' : ''}
    <div id="wPrev"></div>
    <button class="btn" id="wNext">Revisar antes de importar</button>`, () => {
    let modo = g.monto != null ? 'uno' : (g.debito != null || g.credito != null ? 'dos' : 'uno');
    const setM = x => { modo = x; $$('#mModo button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === x)); $('#mUno').hidden = x !== 'uno'; $('#mDos').hidden = x !== 'dos'; preview(); };
    $$('#mModo button').forEach(b => b.onclick = () => setM(b.dataset.m));
    const parse = () => {
      const v = id => $('#' + id).value === '' ? null : +$('#' + id).value;
      const fi = v('mF'), di = v('mD'), mi = v('mM'), dei = v('mDe'), cri = v('mCr'), moi = v('mMon'), rfi = v('mRef'), ord = $('#mOrd').value, inv = $('#mSigno').value === 'pos';
      return data.map((r, idx) => {
        const fecha = fi == null ? null : E.parseDate(r[fi], ord);
        let monto = null;
        if (modo === 'uno') { monto = mi == null ? null : E.parseAmount(r[mi]); if (monto != null && inv) monto = -monto; }
        else { const de = dei == null ? null : E.parseAmount(r[dei]), cr = cri == null ? null : E.parseAmount(r[cri]); if (de || cr) monto = (cr ? Math.abs(cr) : 0) - (de ? Math.abs(de) : 0); }
        let moneda = a.moneda || 'DOP';
        if (moi != null) { const t = String(r[moi]).toUpperCase(); moneda = /US|DOLAR|USD/.test(t) ? 'USD' : /EUR/.test(t) ? 'EUR' : 'DOP'; }
        const descripcion = di == null ? '' : String(r[di]).trim();
        const err = !fecha ? 'fecha' : (monto == null || monto === 0) ? 'monto' : null;
        const origenId = rfi == null ? null : (String(r[rfi]).trim() || null);
        return { fila: idx + 1, fecha, monto, descripcion, moneda, err, origenId };
      });
    };
    const preview = () => {
      const p = parse(), ok = p.filter(x => !x.err).length;
      $('#wPrev').innerHTML = `<p class="hint">${ok} filas válidas${p.length - ok ? ` · ${p.length - ok} con error (se omiten)` : ''}</p>
        <div class="tbl"><table class="preview"><thead><tr><th>Fecha</th><th>Descripción</th><th>Monto</th></tr></thead><tbody>
        ${p.slice(0, 6).map(x => `<tr><td>${x.fecha || '<span class="neg">error</span>'}</td><td style="text-align:left;max-width:160px;overflow:hidden;text-overflow:ellipsis">${esc(x.descripcion)}</td><td class="${x.monto > 0 ? 'pos' : ''}">${x.monto == null ? '<span class="neg">error</span>' : money(x.monto, x.moneda, true)}</td></tr>`).join('')}</tbody></table></div>`;
      return p;
    };
    $$('#v-x, .sheet select').forEach(s => s.onchange = preview);
    setM(modo);
    $('#wNext').onclick = () => {
      const p = parse().filter(x => !x.err);
      if (!p.length) { toast('Ninguna fila válida: revisa las columnas'); return; }
      reviewStep(p.map(x => ({ cuenta, fecha: x.fecha, monto: x.monto, descripcion: x.descripcion, moneda: x.moneda, origenId: x.origenId })), archivo, cuenta);
    };
  });
}
function reviewStep(cands, archivo, cuenta) {
  const res = E.dedupe(cands, D.movs);
  const n = k => res.filter(r => r.estado === k).length;
  openSheet(`<h2>Confirmar importación</h2>
    <div class="tiles"><div class="tile"><div class="label">Nuevos</div><div class="v num">${n('nuevo')}</div></div><div class="tile"><div class="label">Repetidos</div><div class="v num">${n('duplicado')}</div></div><div class="tile"><div class="label">Parecidos</div><div class="v num">${n('posible')}</div></div></div>
    <p class="hint">Los repetidos ya están en la app y no se importan. Los parecidos tienen el mismo monto y una fecha cercana: revisa si son el mismo.</p>
    ${n('posible') ? `<label class="check"><input type="checkbox" id="rPos"> Importar también los ${n('posible')} parecidos</label>` : ''}
    <button class="btn" id="rOk" ${n('nuevo') + n('posible') ? '' : 'disabled'}>Importar</button>`, () => {
    $('#rOk').onclick = () => {
      const incl = r => r.estado === 'nuevo' || (r.estado === 'posible' && $('#rPos') && $('#rPos').checked);
      const hist = E.buildHistory(D.movs);
      const cardAcc = E.isLiability(acc(cuenta));
      let count = 0;
      res.filter(incl).forEach(r => {
        const c = E.categorize(r, D.reglas, hist);
        const nd = E.normalize(r.descripcion);
        // en una tarjeta, un crédito con "PAGO" es tu pago; otros créditos (reembolso, rebate) cuentan como ingreso
        const tipo = /PAGO.*(TARJETA|TC|PRESTAMO)|ABONO A (TARJETA|PRESTAMO)/.test(nd) ? 'pago_deuda' : (r.monto > 0 ? (cardAcc ? (/PAGO|ABONO/.test(nd) ? 'pago_deuda' : 'ingreso') : 'ingreso') : 'gasto');
        D.movs.push({ id: Store.uid('m'), cuenta: r.cuenta, fecha: r.fecha, monto: r.monto, moneda: r.moneda, descripcion: r.descripcion, tipo, origenId: r.origenId || null,
          categoria: tipo === 'gasto' || tipo === 'ingreso' ? c.categoria : null, catOrigen: c.catOrigen, confianza: c.confianza,
          origen: /\.pdf$/i.test(archivo) ? 'pdf' : /\.xlsx?$/i.test(archivo) ? 'excel' : 'csv', archivo, huella: r.huella, creado: Date.now() });
        count++;
      });
      const tr = linkTransfers();
      const cnt = {}; res.filter(incl).forEach(r => { const k = r.fecha.slice(0, 7); cnt[k] = (cnt[k] || 0) + 1; });
      closeSheet(); movMonth = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0] || movMonth; movFilter = 'todos';
      save(`${count} movimientos importados${tr ? ' · ' + tr + ' transferencias detectadas' : ''}`, ['importar', `${count} desde ${archivo} a ${acc(cuenta).nombre}`]);
    };
  });
}

/* =========================================================
   DEUDAS Y TARJETAS
   ========================================================= */
let escTasa = 0;
function renderDeudas() {
  const debts = debtsForEngine();
  const allDebtAccs = activeAccounts().filter(E.isLiability);
  const total = allDebtAccs.reduce((s, a) => s + Math.max(0, bal(a)), 0);
  const ingreso = ingresoMensualFijo();
  const cuotas = debts.reduce((s, d) => s + d.cuota, 0);
  const opts = planOpts();
  const cmp = debts.length ? E.compareStrategies(debts, opts) : null;
  const plan = cmp ? cmp.resultados[D.plan.estrategia] || E.planDebts(debts, opts) : null;
  const capacidad = ingreso - gastoRecurrenteMensual() - cuotas - activeAccounts().filter(a => a.tipo === 'tarjeta' && a.pagoTotal).reduce((s, a) => s + 0, 0);
  const cards = activeAccounts().filter(a => a.tipo === 'tarjeta');
  const prestamos = allDebtAccs.filter(a => a.tipo !== 'tarjeta');
  const varDebts = debts.filter(d => d.tipoTasa === 'variable');
  const escen = escTasa && plan ? E.planDebts(debts, { ...opts, ajusteTasaVariable: escTasa }) : null;
  const rowsCmp = cmp ? ['avalancha', 'bola', 'hibrida'].concat(cmp.resultados.personalizada ? ['personalizada'] : []).concat(['minimos']).map(k => {
    const r = cmp.resultados[k];
    return `<tr class="${k === cmp.menorCosto ? 'best' : ''} ${k === D.plan.estrategia ? 'sel' : ''}"><td>${nombreEstrategia(k)}${k === cmp.menorCosto ? ' ★' : ''}</td><td>${r.completo ? mLabel(r.fechaLibre) : '+50 años'}</td><td class="num">${r.completo ? r.meses : '—'}</td><td class="num">${r.completo ? money(r.costoTotal) : '—'}</td></tr>`;
  }).join('') : '';

  $('#v-deudas').innerHTML = `
    <div class="card hero">
      <div class="label">Debes en total</div>
      <div class="big num">${money(total)}</div>
      <p class="hint" style="margin-top:4px">${plan && plan.completo ? `Libre en <strong>${mLabel(plan.fechaLibre, true)}</strong> con ${nombreEstrategia(D.plan.estrategia).toLowerCase()} y ${money(D.plan.extraMensual)} extra al mes` : debts.length ? 'Con estos pagos las deudas no terminan: sube el pago extra.' : 'Sin deudas con interés.'}</p>
      <div class="tiles" style="margin-top:12px">
        <div class="tile" style="background:rgba(127,127,127,.15)"><div class="label">Cuotas/mes</div><div class="v num">${money(cuotas)}</div></div>
        <div class="tile" style="background:rgba(127,127,127,.15)"><div class="label">De tu ingreso</div><div class="v num">${ingreso ? pct(cuotas / ingreso) : '—'}</div></div>
        <div class="tile" style="background:rgba(127,127,127,.15)"><div class="label">Intereses que faltan</div><div class="v num">${plan && plan.completo ? money(plan.interes) : '—'}</div></div>
      </div>
    </div>

    ${debts.length ? `
    <div class="sec-h"><h2>Tu plan</h2><span class="aside">Se recalcula al cambiar</span></div>
    <div class="card stack">
      <div class="seg" id="dEst"><button data-e="avalancha">Avalancha</button><button data-e="bola">Bola de nieve</button><button data-e="hibrida">Híbrida</button><button data-e="personalizada">Mi orden</button></div>
      <p class="hint" id="dEstHint">${{ avalancha: 'Primero la tasa más alta. Es la que menos intereses paga.', bola: 'Primero el saldo más pequeño. Ves resultados antes.', hibrida: 'Primero lo que puedes saldar en ≤ 3 meses; después, la tasa más alta.', personalizada: 'Tú decides el orden.' }[D.plan.estrategia] || ''}</p>
      ${D.plan.estrategia === 'personalizada' ? `<div class="list" id="dOrden">${(D.plan.orden.length ? D.plan.orden.filter(id => debts.some(d => d.id === id)).concat(debts.map(d => d.id).filter(id => !D.plan.orden.includes(id))) : debts.map(d => d.id)).map((id, i, arr) => `<div class="item"><div class="ico">${i + 1}</div><div class="t">${esc(acc(id).nombre)}</div><div><button class="btn small ghost" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">↑</button></div></div>`).join('')}</div>` : ''}
      <div class="grid2">
        <label class="field"><span>Pago extra al mes</span><input id="dExtra" inputmode="decimal" value="${inputMoney(D.plan.extraMensual)}"></label>
        <label class="field"><span>Desde</span><input id="dDesde" type="month" value="${D.plan.extraDesde || ymNow()}"></label>
      </div>
      ${ingreso ? `<p class="hint">Según tus recurrentes, después de gastos y cuotas te quedan unos <strong class="num">${money(capacidad)}</strong> al mes. ${capacidad > 0 ? `<button class="linkbtn" id="dUseCap">Usar esa cifra</button>` : ''}</p>` : '<p class="hint">Agrega tu salario en Presupuesto → Recurrentes para calcular cuánto puedes abonar.</p>'}
      <details class="more"><summary class="linkbtn">Pagos extraordinarios (${D.plan.eventos.length})</summary>
        <div class="stack" style="margin-top:8px">${D.plan.eventos.map((e, i) => `<div class="row"><span>${mLabel(e.mes, true)} · <strong class="num">${money(e.monto)}</strong>${e.nota ? ' · ' + esc(e.nota) : ''}</span><button class="linkbtn danger" data-evx="${i}">Quitar</button></div>`).join('')}
        <div class="grid3"><input id="evMes" type="month" value="${E.addMonths(ymNow(), 1)}" aria-label="Mes"><input id="evMonto" inputmode="decimal" placeholder="Monto" aria-label="Monto"><button class="btn small" id="evAdd">Agregar</button></div>
        <p class="hint">Ej. regalía, bono o venta de algo. Se abona completo a la deuda prioritaria de ese mes.</p></div></details>
    </div>

    <div class="sec-h"><h2>Comparación</h2><span class="aside">Mismo pago total</span></div>
    <div class="card"><div class="tbl"><table><thead><tr><th>Estrategia</th><th>Libre en</th><th>Meses</th><th>Intereses y cargos</th></tr></thead><tbody>${rowsCmp}</tbody></table></div>
      <p class="hint" style="margin-top:8px">★ menor costo. "Solo mínimos" pagas las cuotas y nada más.${debts.some(d => d.tasaFalta) ? ' Hay deudas sin tasa: se calculan al 0% hasta que la agregues.' : ''}</p></div>

    <div class="sec-h"><h2>Escenarios</h2></div>
    <div class="card stack">
      ${varDebts.length ? `<div><div class="label">Si cambia la tasa variable (${varDebts.map(d => esc(d.nombre)).join(', ')})</div>
        <div class="chips" style="margin-top:8px">${[-0.02, 0, 0.02, 0.04].map(v => `<button data-tasa="${v}" aria-pressed="${escTasa === v}">${v === 0 ? 'Igual' : (v > 0 ? '+' : '') + (v * 100) + ' pts'}</button>`).join('')}</div>
        ${escen ? `<div class="kv"><span>Libre en</span><strong>${escen.completo ? mLabel(escen.fechaLibre, true) : 'no termina'}</strong></div><div class="kv"><span>Intereses vs. plan actual</span><strong class="num ${escen.interes > plan.interes ? 'neg' : 'pos'}">${escen.interes > plan.interes ? '+' : ''}${money(escen.interes - plan.interes)}</strong></div>` : ''}</div><hr class="divider">` : ''}
      <div class="row"><div><strong>Consolidar en un préstamo</strong><p class="hint">Compara una oferta del banco contra tu plan, con cierre, seguro y penalidad.</p></div><button class="btn small" id="dCons">Comparar</button></div>
      <hr class="divider">
      <div class="row"><div><strong>Saldar una deuda antes de una fecha</strong><p class="hint">Calcula el pago extra mínimo que necesitas.</p></div><button class="btn small" id="dMeta">Calcular</button></div>
    </div>

    <div class="sec-h"><h2>Calendario</h2><button class="linkbtn" id="dCsv">Exportar CSV</button></div>
    <div class="card"><div class="tbl"><table><thead><tr><th>Mes</th><th>Prioridad</th><th>Pago</th><th>Interés</th><th>Debes</th></tr></thead><tbody>
      ${plan.calendario.slice(0, 36).map(r => `<tr><td style="text-transform:capitalize">${mLabel(r.mes)}</td><td style="text-align:left">${r.prioridad ? esc(acc(r.prioridad)?.nombre || '') : '—'}</td><td class="num">${money(r.pagoTotal)}</td><td class="num">${money(Object.values(r.deudas).reduce((s, x) => s + x.interes, 0))}</td><td class="num">${money(r.saldoTotal)}</td></tr>`).join('')}
    </tbody></table></div>${plan.calendario.length > 36 ? `<p class="hint">Mostrando 36 de ${plan.calendario.length} meses. El CSV trae todos.</p>` : ''}</div>` : ''}

    <div class="sec-h"><h2>Préstamos</h2><button class="linkbtn" data-new="prestamo">+ Agregar</button></div>
    ${prestamos.length ? prestamos.map(a => debtCard(a, plan, ingreso)).join('') : '<div class="card empty">Sin préstamos registrados.</div>'}

    <div class="sec-h"><h2>Tarjetas de crédito</h2><button class="linkbtn" data-new="tarjeta">+ Agregar</button></div>
    ${cards.length ? cards.map(a => cardCard(a, plan)).join('') : '<div class="card empty">Sin tarjetas registradas.</div>'}
  `;
  $$('#dEst button').forEach(b => { b.setAttribute('aria-pressed', b.dataset.e === D.plan.estrategia); b.onclick = () => { D.plan.estrategia = b.dataset.e; save(); }; });
  $$('#dOrden [data-up]').forEach(b => b.onclick = () => {
    const cur = (D.plan.orden.length ? D.plan.orden.filter(id => debts.some(d => d.id === id)).concat(debts.map(d => d.id).filter(id => !D.plan.orden.includes(id))) : debts.map(d => d.id));
    const i = +b.dataset.up; [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]]; D.plan.orden = cur; save();
  });
  const ex = $('#dExtra'); if (ex) ex.onchange = () => { D.plan.extraMensual = Math.max(0, cents(ex.value) || 0); save('Plan actualizado', ['plan', 'Pago extra ' + money(D.plan.extraMensual)]); };
  const dd = $('#dDesde'); if (dd) dd.onchange = () => { D.plan.extraDesde = dd.value || null; save(); };
  const uc = $('#dUseCap'); if (uc) uc.onclick = () => { D.plan.extraMensual = Math.max(0, capacidad); save('Plan actualizado'); };
  const ea = $('#evAdd'); if (ea) ea.onclick = () => { const m = cents($('#evMonto').value); if (!m || m <= 0 || !$('#evMes').value) { toast('Escribe mes y monto'); return; } D.plan.eventos.push({ mes: $('#evMes').value, monto: m }); save('Pago extraordinario agregado'); };
  $$('[data-evx]').forEach(b => b.onclick = () => { D.plan.eventos.splice(+b.dataset.evx, 1); save(); });
  $$('[data-tasa]').forEach(b => b.onclick = () => { escTasa = +b.dataset.tasa; render(); });
  const dc = $('#dCons'); if (dc) dc.onclick = () => consolidationSheet(debts);
  const dm = $('#dMeta'); if (dm) dm.onclick = () => targetSheet(debts);
  const csv = $('#dCsv'); if (csv) csv.onclick = () => exportPlanCSV(plan, debts);
  $$('[data-acc]').forEach(b => b.onclick = () => accountSheet(b.dataset.acc));
  $$('[data-pay]').forEach(b => b.onclick = () => quickAdd({ tipo: 'pago_deuda', cuenta: b.dataset.pay }));
  $$('[data-new]').forEach(b => b.onclick = () => accountSheet(null, b.dataset.new));
}
function debtCard(a, plan, ingreso) {
  const b = Math.max(0, bal(a));
  const d = { saldo: b, tasa: a.tasa || 0, cuota: a.cuota || 0, comisionMensual: a.comisionMensual || 0 };
  const dg = E.diagnoseDebt(d, ingreso);
  const orig = a.montoOriginal || 0;
  return `<div class="card stack" style="--c:${colorOf(a.id)}">
    <div class="row"><div style="min-width:0"><div class="t" style="font-weight:700"><i class="sw"></i> ${esc(a.nombre)}</div><div class="hint">${esc(a.institucion || 'Institución por indicar')} · ${a.tasa != null ? pct(a.tasa, 2) : 'tasa por indicar'} ${tasaPill(a)}</div></div>
      <div style="text-align:right"><div class="mid num">${money(b)}</div><div class="hint">${b <= 0 ? 'Saldada' : plan && plan.payoff[a.id] ? 'Saldada en ' + mLabel(plan.payoff[a.id]) : ''}</div></div></div>
    ${orig ? `<div class="bar"><b style="width:${Math.max(0, Math.min(100, (1 - b / orig) * 100))}%"></b></div>` : ''}
    <div class="kv"><span>Cuota</span><strong class="num">${money(a.cuota)}${a.diaPago ? ' · día ' + a.diaPago : ''}</strong></div>
    ${b > 0 ? (dg.insuficiente ? `<p class="note">La cuota no cubre los intereses (${money(dg.costoMensualInteres)} al mes). El saldo crece.</p>` :
    `<div class="kv"><span>Pagando solo la cuota</span><strong class="num">${dg.mesesRestantes} meses · ${money(dg.interesesFuturos)} de interés</strong></div>
     <div class="kv"><span>Interés de este mes</span><strong class="num">${money(dg.costoMensualInteres)}</strong></div>
     ${ingreso ? `<div class="kv"><span>Peso en tu ingreso</span><strong class="num">${pct(dg.pctIngreso, 1)}</strong></div>` : ''}`) : ''}
    ${a.penalidadAbono ? `<div class="kv"><span>Penalidad por abono</span><strong>${pct(a.penalidadAbono, 1)} del abono</strong></div>` : ''}
    <div class="grid2"><button class="btn small ghost" data-acc="${esc(a.id)}">Editar</button><button class="btn small" data-pay="${esc(a.id)}">Registrar pago</button></div>
  </div>`;
}
const tasaPill = a => a.tipoTasa === 'variable' ? '<span class="pill warn">variable</span>' : a.tipoTasa === 'fija' ? '<span class="pill ok">fija</span>' : a.tasaEstimada ? '<span class="pill">estimada</span>' : a.tasa != null ? '<span class="pill">sin confirmar</span>' : '';
function cardCard(a, plan) {
  const b = Math.max(0, bal(a)), st = E.cardStatus(a, b, hoy());
  const util = st.utilizacion;
  const opts = a.tasa ? E.cardPayoffOptions(b, a.tasa, a.pagoMinimo || 0, a.pagoMinimo ? Math.max(a.pagoMinimo * 2, Math.round(b / 12)) : 0) : null;
  return `<div class="card stack" style="--c:${util > 0.7 ? 'var(--neg)' : util > 0.3 ? 'var(--warn)' : 'var(--pos)'}">
    <div class="row"><div style="min-width:0"><div class="t" style="font-weight:700">${esc(a.nombre)}</div><div class="hint">${esc(a.institucion || '')}${a.tasa != null ? ' · ' + pct(a.tasa, 2) : ''} ${tasaPill(a)} ${a.pagoTotal ? '<span class="pill ok">la pagas completa</span>' : ''}</div></div>
      <div style="text-align:right"><div class="mid num">${money(b)}</div><div class="hint">${a.limite ? 'de ' + money(a.limite) : ''}</div></div></div>
    ${a.limite ? `<div class="bar"><b style="width:${Math.min(100, util * 100)}%"></b></div><div class="kv"><span>Usado ${pct(util)}</span><strong class="num">Disponible ${money(st.disponible)}</strong></div>` : ''}
    <div class="grid2">
      <div class="tile"><div class="label">Corte</div><div class="v">${st.proximoCorte ? dLabel(st.proximoCorte) : '—'}</div></div>
      <div class="tile"><div class="label">Pagar antes de</div><div class="v">${st.proximoPago ? dLabel(st.proximoPago) + ` <span class="hint">(${st.diasParaPago} d)</span>` : '—'}</div></div>
    </div>
    ${a.saldoCorte != null && !a.pagoTotal ? `<div class="kv"><span>Saldo al corte</span><strong class="num">${money(a.saldoCorte)}</strong></div>` : ''}
    ${!a.pagoTotal && a.pagoMinimo ? `<div class="kv"><span>Pago mínimo</span><strong class="num">${money(a.pagoMinimo)}</strong></div>` : ''}
    ${opts && !a.pagoTotal && b > 0 ? `<details class="more"><summary class="linkbtn">¿Mínimo o total? Compara</summary>
      <div class="tbl" style="margin-top:6px"><table><thead><tr><th>Si pagas cada mes</th><th>Meses</th><th>Intereses</th></tr></thead><tbody>
        <tr><td>El total ${money(b)}</td><td class="num">1</td><td class="num pos">${money(0)}</td></tr>
        ${opts.intermedio ? `<tr><td>${money(opts.intermedio.pago)}</td><td class="num">${opts.intermedio.insuficiente ? '∞' : opts.intermedio.meses}</td><td class="num">${opts.intermedio.insuficiente ? 'no baja' : money(opts.intermedio.interes)}</td></tr>` : ''}
        ${opts.minimo ? `<tr><td>El mínimo ${money(opts.minimo.pago)}</td><td class="num">${opts.minimo.insuficiente ? '∞' : opts.minimo.meses}</td><td class="num neg">${opts.minimo.insuficiente ? 'no baja' : money(opts.minimo.interes)}</td></tr>` : ''}
      </tbody></table></div><p class="hint">Estimado con interés mensual = saldo × tasa ÷ 12 y sin compras nuevas. Cada banco calcula distinto; confirma con tu estado de cuenta.</p></details>` : ''}
    ${a.pagoTotal ? '<p class="hint">Como la pagas completa en cada corte, no genera intereses y no entra al plan de deudas.</p>' : ''}
    <div class="grid2"><button class="btn small ghost" data-acc="${esc(a.id)}">Editar</button><button class="btn small" data-pay="${esc(a.id)}">Registrar pago</button></div>
  </div>`;
}
function consolidationSheet(debts) {
  openSheet(`<h2>Consolidar deudas</h2>
    <p class="hint">Compara la oferta contra tu plan actual, con el mismo pago total al mes. Si la tasa es variable o hay cargos que no conoces, confírmalos con el banco.</p>
    <div class="field"><span>Deudas a consolidar</span>${debts.map(d => `<label class="check"><input type="checkbox" data-cs="${esc(d.id)}" checked> ${esc(d.nombre)} · ${money(d.saldo)}</label>`).join('')}</div>
    <div class="grid2"><label class="field"><span>Monto del préstamo</span><input id="cMonto" inputmode="decimal" placeholder="Igual a las deudas"></label><label class="field"><span>Tasa anual %</span><input id="cTasa" inputmode="decimal" placeholder="15.95"></label></div>
    <div class="grid2"><label class="field"><span>Plazo (meses)</span><input id="cPlazo" inputmode="numeric" placeholder="48"></label><label class="field"><span>Gastos de cierre</span><input id="cCierre" inputmode="decimal" placeholder="0"></label></div>
    <div class="grid2"><label class="field"><span>Seguro/cargo mensual</span><input id="cSeg" inputmode="decimal" placeholder="0"></label><label class="field"><span>Penalidad por abono %</span><input id="cPen" inputmode="decimal" placeholder="0"></label></div>
    <label class="check"><input type="checkbox" id="cVar"> La tasa es variable</label>
    <button class="btn" id="cGo">Comparar</button><div id="cRes"></div>`, () => {
    $('#cGo').onclick = () => {
      const ids = $$('[data-cs]').filter(x => x.checked).map(x => x.dataset.cs);
      const tasa = (parseFloat($('#cTasa').value) || 0) / 100, plazo = parseInt($('#cPlazo').value) || 0;
      if (!ids.length || !tasa || !plazo) { toast('Elige deudas, tasa y plazo'); return; }
      const loan = { monto: cents($('#cMonto').value) || 0, tasa, plazo, gastosCierre: cents($('#cCierre').value) || 0, seguroMensual: cents($('#cSeg').value) || 0, penalidadAbono: (parseFloat($('#cPen').value) || 0) / 100, tipoTasa: $('#cVar').checked ? 'variable' : 'fija' };
      const r = E.consolidate(debts, ids, loan, planOpts());
      const up = $('#cVar').checked ? E.consolidate(debts.map(d => ({ ...d })), ids, loan, { ...planOpts(), ajusteTasaVariable: 0.03 }) : null;
      const better = r.diferenciaCosto < 0;
      $('#cRes').innerHTML = `<div class="card flat stack" style="margin-top:6px">
        <div class="kv"><span>Préstamo nuevo</span><strong class="num">${money(r.monto)} · cuota ${money(r.cuota)}</strong></div>
        <div class="kv"><span>Reemplaza cuotas por</span><strong class="num">${money(r.cuotasReemplazadas)}</strong></div>
        ${r.sobrante > 0 ? `<div class="kv"><span>Dinero de más que te prestan</span><strong class="num warn-t">${money(r.sobrante)}</strong></div>` : ''}
        <div class="tbl"><table><thead><tr><th></th><th>Libre en</th><th>Costo total</th></tr></thead><tbody>
          <tr><td>Tu plan</td><td>${r.base.completo ? mLabel(r.base.fechaLibre) : '—'}</td><td class="num">${money(r.base.costoTotal)}</td></tr>
          <tr><td>Consolidando</td><td>${r.nuevo.completo ? mLabel(r.nuevo.fechaLibre) : '—'}</td><td class="num">${money(r.nuevo.costoTotal + r.costoAdicionalCierre)}</td></tr>
        </tbody></table></div>
        <p class="${better ? 'note info' : 'note'}"><strong>${better ? 'Ahorrarías ' + money(-r.diferenciaCosto) : 'Te costaría ' + money(r.diferenciaCosto) + ' más'}</strong> en intereses, cargos y penalidades${r.diferenciaMeses != null ? `, y terminarías ${r.diferenciaMeses === 0 ? 'el mismo mes' : Math.abs(r.diferenciaMeses) + ' meses ' + (r.diferenciaMeses < 0 ? 'antes' : 'después')}` : ''}.${r.nuevo.penalidades ? ` Incluye ${money(r.nuevo.penalidades)} de penalidad por abonos.` : ''}</p>
        ${up ? `<p class="hint">Si la tasa variable sube 3 puntos: ${up.diferenciaCosto < 0 ? 'aún ahorrarías ' + money(-up.diferenciaCosto) : 'te costaría ' + money(up.diferenciaCosto) + ' más'}.</p>` : ''}
        <p class="hint">Una cuota más baja no significa que sea mejor: compara el costo total.</p></div>`;
    };
  });
}
function targetSheet(debts) {
  openSheet(`<h2>Saldar antes de una fecha</h2>
    <label class="field"><span>Deuda</span><select id="tD">${debts.map(d => `<option value="${esc(d.id)}">${esc(d.nombre)}</option>`).join('')}</select></label>
    <label class="field"><span>Antes de</span><input id="tF" type="month" value="${E.addMonths(ymNow(), 6)}"></label>
    <button class="btn" id="tGo">Calcular</button><div id="tRes"></div>`, () => {
    $('#tGo').onclick = () => {
      const id = $('#tD').value, f = $('#tF').value;
      const x = E.extraNeededFor(debts, { ...planOpts(), estrategia: 'personalizada', orden: [id].concat(debts.map(d => d.id).filter(i => i !== id)) }, id, f, 100000000);
      $('#tRes').innerHTML = x == null ? '<p class="note">No es posible antes de esa fecha con menos de RD$1,000,000 extra al mes.</p>'
        : `<p class="note info">Necesitas <strong>${money(x)}</strong> extra al mes (además de las cuotas), dando prioridad a ${esc(acc(id).nombre)}.</p><button class="btn ghost" id="tUse">Usar en mi plan</button>`;
      const u = $('#tUse'); if (u) u.onclick = () => { D.plan.extraMensual = x; D.plan.estrategia = 'personalizada'; D.plan.orden = [id].concat(debts.map(d => d.id).filter(i => i !== id)); closeSheet(); save('Plan actualizado'); };
    };
  });
}
function exportPlanCSV(plan, debts) {
  const head = ['Mes', 'Deuda', 'Saldo inicial', 'Interés', 'Cargos', 'Cuota', 'Abono extra', 'Penalidad', 'Saldo final', 'Prioridad del mes'];
  const lines = [head.join(',')];
  plan.calendario.forEach(r => Object.entries(r.deudas).forEach(([id, x]) => lines.push([r.mes, '"' + (acc(id)?.nombre || id).replace(/"/g, '""') + '"', ...[x.saldoInicial, x.interes, x.comision, x.cuota, x.abono, x.penalidad, x.saldo].map(c => (c / 100).toFixed(2)), r.prioridad === id ? 'sí' : ''].join(','))));
  download(`plan-deudas-${hoy()}.csv`, '﻿' + lines.join('\n'), 'text/csv');
}

/* =========================================================
   PRESUPUESTO, FLUJO Y METAS
   ========================================================= */
function renderPresupuesto() {
  const ym = budMonth, sp = E.spendByCategory(D.movs, ym), mt = E.monthTotals(D.movs, ym);
  const cats = D.categorias.filter(c => c.grupo !== 'ingreso');
  const conGasto = cats.filter(c => c.presupuesto > 0 || sp[c.nombre] > 0).sort((a, b) => (sp[b.nombre] || 0) - (sp[a.nombre] || 0));
  const sinCat = sp['Sin categoría'] || 0;
  const pres = cats.reduce((s, c) => s + (c.presupuesto || 0), 0);
  const ingreso = ingresoMensualFijo() || mt.ingresos;
  const grp = g => cats.filter(c => c.grupo === g).reduce((s, c) => s + Math.max(0, sp[c.nombre] || 0), 0);
  const ref = E.ref503020(ingreso);
  const prev = E.spendByCategory(D.movs, E.addMonths(ym, -1));
  const fc = E.cashForecast(liquido(), D.recurrentes, obligaciones(), hoy(), 90, flujoEsc);
  const marks = Object.entries(fc.cortes);
  $('#v-presupuesto').innerHTML = `
    <div class="toolbar"><div class="monthnav"><button id="bPrev" aria-label="Mes anterior">‹</button><span>${mLabel(ym, true)}</span><button id="bNext" aria-label="Mes siguiente">›</button></div></div>
    <div class="card stack">
      <div class="tiles"><div class="tile"><div class="label">Presupuesto</div><div class="v num">${money(pres)}</div></div><div class="tile"><div class="label">Gastado</div><div class="v num ${mt.gastos > pres && pres ? 'neg' : ''}">${money(mt.gastos)}</div></div><div class="tile"><div class="label">Queda</div><div class="v num">${pres ? money(pres - mt.gastos) : '—'}</div></div></div>
      ${ingreso ? `<p class="hint">Por asignar: <strong class="num">${money(ingreso - pres)}</strong> de ${money(ingreso)} de ingreso${ingresoMensualFijo() ? ' fijo' : ''}. Asigna cada peso a una categoría, a deudas o a metas.</p>` : ''}
    </div>

    <div class="sec-h"><h2>Por categoría</h2><button class="linkbtn" id="bAll">Editar presupuestos</button></div>
    <div class="card list">${conGasto.length ? conGasto.map(c => {
      const g = Math.max(0, sp[c.nombre] || 0), p = c.presupuesto || 0, d = (prev[c.nombre] || 0);
      return `<button class="item" data-cat="${esc(c.nombre)}" style="grid-template-columns:1fr auto"><div style="min-width:0"><div class="t">${esc(c.nombre)} <span class="pill">${c.grupo}</span></div>
        ${p ? `<div class="bar ${g > p ? 'over' : ''}" style="margin:6px 0 2px"><b style="width:${Math.min(100, g / p * 100)}%"></b></div>` : ''}
        <div class="s">${d ? (g > d ? '▲ ' : '▼ ') + money(Math.abs(g - d)) + ' vs. mes anterior' : 'Sin gasto el mes anterior'}</div></div>
        <div class="a num">${money(g)}<small>${p ? 'de ' + money(p) : 'sin presupuesto'}</small></div></button>`;
    }).join('') : '<div class="empty">Sin gastos registrados este mes.</div>'}
    ${sinCat > 0 ? `<div class="item" style="grid-template-columns:1fr auto"><div class="t">Sin categoría</div><div class="a num">${money(sinCat)}</div></div>` : ''}</div>

    ${ingreso ? `<div class="sec-h"><h2>Referencia 50/30/20</h2><span class="aside">Solo como guía</span></div>
    <div class="card stack">
      ${[['Esenciales', grp('esencial'), ref.necesidades, 'c2'], ['Discrecionales', grp('discrecional'), ref.deseos, 'c3']].map(([n, v, r, c]) => `<div><div class="row hint"><span>${n}</span><span class="num">${money(v)} · guía ${money(r)}</span></div><div class="bar" style="--c:var(--${c});margin-top:4px"><b style="width:${Math.min(100, v / (r || 1) * 100)}%"></b></div></div>`).join('')}
      <p class="hint">El 20% restante (${money(ref.ahorroDeuda)}) sería para ahorro y abonos a deudas. Tus cuotas de deuda no se cuentan aquí como gasto.</p>
    </div>` : ''}

    <div class="sec-h"><h2>Flujo de efectivo</h2><span class="aside">Desde ${money(liquido())} disponibles</span></div>
    <div class="card stack">
      <div class="seg" id="fEsc"><button data-e="conservador">Conservador</button><button data-e="central">Central</button><button data-e="optimista">Optimista</button></div>
      <div class="tiles">${marks.map(([f, v], i) => `<div class="tile"><div class="label">${[30, 60, 90][i]} días</div><div class="v num ${v < 0 ? 'neg' : ''}">${money(v)}</div></div>`).join('')}</div>
      <div class="kv"><span>Punto más bajo</span><strong class="num ${fc.minimo < 0 ? 'neg' : ''}">${money(fc.minimo)} · ${dLabel(fc.fechaMinimo)}</strong></div>
      ${fc.minimo < 0 ? '<p class="note">En algún momento no te alcanza. Mueve un pago, baja un gasto o usa parte del fondo.</p>' : ''}
      <p class="hint">${{ conservador: 'Conservador: ingresos variables al mínimo y sin ingresos inciertos (como la regalía).', central: 'Central: ingresos variables al valor normal, sin ingresos inciertos.', optimista: 'Optimista: ingresos variables al máximo e incluye los inciertos.' }[flujoEsc]} Usa tus recurrentes, las cuotas y los pagos de tarjetas con día de pago.</p>
    </div>

    <div class="sec-h"><h2>Recurrentes</h2><button class="linkbtn" id="rAdd">+ Agregar</button></div>
    <div class="card list">${D.recurrentes.length ? D.recurrentes.map(r => `<button class="item" data-rec="${esc(r.id)}" style="grid-template-columns:1fr auto"><div><div class="t">${esc(r.nombre)} ${r.certeza === 'incierto' ? '<span class="pill warn">incierto</span>' : r.certeza === 'variable' ? '<span class="pill">variable</span>' : ''}${r.activo === false ? ' <span class="pill">pausado</span>' : ''}</div><div class="s">${{ mensual: 'Cada mes, día ' + r.dia, quincenal: 'Días ' + (r.dia || 15) + ' y ' + (r.dia2 || 30), anual: 'Cada ' + MESL[(r.mes || 12) - 1] + ', día ' + r.dia, semanal: 'Cada semana' }[r.frecuencia]}</div></div><div class="a num ${r.tipo === 'ingreso' ? 'pos' : ''}">${r.tipo === 'ingreso' ? '+' : '−'}${money(r.monto)}</div></button>`).join('') : '<div class="empty">Agrega tu salario y tus gastos fijos para proyectar el flujo.</div>'}</div>

    <div class="sec-h"><h2>Metas</h2><button class="linkbtn" id="gAdd">+ Agregar</button></div>
    ${D.metas.length ? D.metas.map(g => goalCard(g)).join('') : '<div class="card empty">Sin metas. Empieza por el fondo de emergencia.</div>'}
  `;
  $('#bPrev').onclick = () => { budMonth = E.addMonths(budMonth, -1); render(); };
  $('#bNext').onclick = () => { budMonth = E.addMonths(budMonth, 1); render(); };
  $$('#fEsc button').forEach(b => { b.setAttribute('aria-pressed', b.dataset.e === flujoEsc); b.onclick = () => { flujoEsc = b.dataset.e; render(); }; });
  $$('[data-cat]').forEach(b => b.onclick = () => budgetSheet(b.dataset.cat));
  $('#bAll').onclick = () => budgetSheet(null);
  $('#rAdd').onclick = () => recurrenteSheet(null);
  $$('[data-rec]').forEach(b => b.onclick = () => recurrenteSheet(b.dataset.rec));
  $('#gAdd').onclick = () => goalSheet(null);
  $$('[data-goal]').forEach(b => b.onclick = () => goalSheet(b.dataset.goal));
}
function goalCard(g) {
  const actual = metaActual(g), c = E.goalContribution(g.objetivo, actual, g.fecha, hoy());
  const p = g.objetivo ? Math.min(1, actual / g.objetivo) : 0;
  const gastoEsencial = gastoRecurrenteMensual() + debtsForEngine().reduce((s, d) => s + d.cuota, 0);
  return `<button class="card stack" data-goal="${esc(g.id)}" style="text-align:left;--c:var(--pos)">
    <div class="row"><strong>${esc(g.nombre)}</strong><span class="num">${money(actual)} <span class="hint">de ${money(g.objetivo)}</span></span></div>
    <div class="bar"><b style="width:${p * 100}%"></b></div>
    <div class="kv"><span>${g.fecha ? 'Para ' + mLabel(g.fecha.slice(0, 7), true) : 'Sin fecha'}</span><strong class="num">${c.falta <= 0 ? 'Lograda' : c.mensual != null ? money(c.mensual) + '/mes · ' + money(c.semanal) + '/semana' : 'Falta ' + money(c.falta)}</strong></div>
    ${g.tipo === 'emergencia' && gastoEsencial ? `<p class="hint">Cubre ${(actual / gastoEsencial).toFixed(1)} meses de gastos fijos y cuotas (${money(gastoEsencial)}/mes).</p>` : ''}
    ${g.cuenta && acc(g.cuenta) ? `<p class="hint">Saldo tomado de ${esc(acc(g.cuenta).nombre)}.</p>` : ''}
  </button>`;
}
function budgetSheet(catName) {
  const cats = D.categorias.filter(c => c.grupo !== 'ingreso' && (!catName || c.nombre === catName));
  const avg = n => { let s = 0; for (let i = 1; i <= 3; i++) s += Math.max(0, E.spendByCategory(D.movs, E.addMonths(budMonth, -i))[n] || 0); return Math.round(s / 3); };
  openSheet(`<h2>${catName ? esc(catName) : 'Presupuestos'}</h2>
    <p class="hint">Monto mensual por categoría. A la derecha, tu promedio de los últimos 3 meses.</p>
    <div class="stack">${cats.map((c, i) => `<div class="grid2" style="align-items:end"><label class="field"><span>${esc(c.nombre)}</span><input data-bud="${i}" inputmode="decimal" value="${inputMoney(c.presupuesto)}" placeholder="0"></label><div class="hint num" style="padding-bottom:12px">Prom. ${money(avg(c.nombre))}</div></div>`).join('')}</div>
    ${catName ? `<label class="field"><span>Grupo</span><select id="bGrupo"><option value="esencial" ${cats[0].grupo === 'esencial' ? 'selected' : ''}>Esencial</option><option value="discrecional" ${cats[0].grupo === 'discrecional' ? 'selected' : ''}>Discrecional</option></select></label>` : `<label class="field"><span>Nueva categoría</span><input id="bNew" placeholder="Ej. Mascotas"></label>`}
    <button class="btn" id="bSave">Guardar</button>`, () => {
    $('#bSave').onclick = () => {
      $$('[data-bud]').forEach(inp => { cats[+inp.dataset.bud].presupuesto = Math.max(0, cents(inp.value) || 0); });
      if (catName && $('#bGrupo')) cats[0].grupo = $('#bGrupo').value;
      const nn = $('#bNew') && $('#bNew').value.trim();
      if (nn && !D.categorias.some(c => c.nombre.toLowerCase() === nn.toLowerCase())) D.categorias.push({ nombre: nn, grupo: 'discrecional', presupuesto: 0 });
      closeSheet(); save('Presupuesto guardado', ['presupuesto', catName || 'varias categorías']);
    };
  });
}
function recurrenteSheet(id) {
  const r = id ? D.recurrentes.find(x => x.id === id) : { tipo: 'gasto', frecuencia: 'mensual', dia: 1, certeza: 'fija', activo: true };
  openSheet(`<h2>${id ? 'Editar' : 'Nuevo'} recurrente</h2>
    <div class="seg" id="rT"><button data-t="ingreso">Ingreso</button><button data-t="gasto">Gasto</button></div>
    <label class="field"><span>Nombre</span><input id="rN" value="${esc(r.nombre || '')}" placeholder="Ej. Salario, alquiler, Netflix"></label>
    <div class="grid2"><label class="field"><span>Monto</span><input id="rM" inputmode="decimal" value="${inputMoney(r.monto)}"></label>
      <label class="field"><span>Frecuencia</span><select id="rF">${['mensual', 'quincenal', 'anual', 'semanal'].map(f => `<option ${f === r.frecuencia ? 'selected' : ''}>${f}</option>`).join('')}</select></label></div>
    <div class="grid3"><label class="field"><span>Día</span><input id="rD" inputmode="numeric" value="${r.dia || ''}"></label><label class="field" id="rD2F"><span>2º día</span><input id="rD2" inputmode="numeric" value="${r.dia2 || 30}"></label><label class="field" id="rMesF"><span>Mes</span><select id="rMes">${MESL.map((m, i) => `<option value="${i + 1}" ${(r.mes || 12) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label></div>
    <label class="field"><span>¿Qué tan seguro es?</span><select id="rC"><option value="fija" ${r.certeza === 'fija' ? 'selected' : ''}>Fijo: siempre el mismo monto</option><option value="variable" ${r.certeza === 'variable' ? 'selected' : ''}>Variable: cambia cada vez</option><option value="incierto" ${r.certeza === 'incierto' ? 'selected' : ''}>Incierto: puede no llegar</option></select></label>
    <div class="grid2" id="rVar"><label class="field"><span>Mínimo</span><input id="rMin" inputmode="decimal" value="${inputMoney(r.min)}"></label><label class="field"><span>Máximo</span><input id="rMax" inputmode="decimal" value="${inputMoney(r.max)}"></label></div>
    <label class="check"><input type="checkbox" id="rA" ${r.activo !== false ? 'checked' : ''}> Activo</label>
    <button class="btn" id="rS">Guardar</button>${id ? '<button class="btn danger" id="rX">Borrar</button>' : ''}`, () => {
    let t = r.tipo;
    const sync = () => { $$('#rT button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === t)); $('#rD2F').hidden = $('#rF').value !== 'quincenal'; $('#rMesF').hidden = $('#rF').value !== 'anual'; $('#rVar').hidden = $('#rC').value !== 'variable'; };
    $$('#rT button').forEach(b => b.onclick = () => { t = b.dataset.t; sync(); }); $('#rF').onchange = sync; $('#rC').onchange = sync; sync();
    $('#rS').onclick = () => {
      const m = cents($('#rM').value); if (!$('#rN').value.trim() || !m) { toast('Escribe nombre y monto'); return; }
      Object.assign(r, { nombre: $('#rN').value.trim(), tipo: t, monto: m, frecuencia: $('#rF').value, dia: Math.min(31, Math.max(1, parseInt($('#rD').value) || 1)), dia2: Math.min(31, Math.max(1, parseInt($('#rD2').value) || 30)), mes: +$('#rMes').value, certeza: $('#rC').value, min: cents($('#rMin').value), max: cents($('#rMax').value), activo: $('#rA').checked });
      if (!id) { r.id = Store.uid('rc'); D.recurrentes.push(r); }
      closeSheet(); save('Recurrente guardado', ['recurrente', r.nombre]);
    };
    if (id) armed($('#rX'), 'Toca otra vez para borrar', () => { D.recurrentes = D.recurrentes.filter(x => x.id !== id); closeSheet(); save('Recurrente borrado', ['borrar recurrente', r.nombre]); });
  });
}
function goalSheet(id) {
  const g = id ? D.metas.find(x => x.id === id) : { tipo: 'otra', objetivo: 0 };
  const assets = activeAccounts().filter(a => !E.isLiability(a));
  const gastoEsencial = gastoRecurrenteMensual() + debtsForEngine().reduce((s, d) => s + d.cuota, 0);
  openSheet(`<h2>${id ? 'Editar' : 'Nueva'} meta</h2>
    <label class="field"><span>Nombre</span><input id="gN" value="${esc(g.nombre || '')}" placeholder="Ej. Inicial del carro"></label>
    <label class="field"><span>Tipo</span><select id="gT">${[['emergencia', 'Fondo de emergencia'], ['vehiculo', 'Vehículo'], ['vivienda', 'Vivienda'], ['viaje', 'Viaje'], ['educacion', 'Educación'], ['inversion', 'Inversión'], ['otra', 'Otra']].map(([k, v]) => `<option value="${k}" ${g.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="grid2"><label class="field"><span>Monto objetivo</span><input id="gO" inputmode="decimal" value="${inputMoney(g.objetivo)}"></label><label class="field"><span>Fecha deseada</span><input id="gF" type="date" value="${g.fecha || ''}"></label></div>
    <p class="hint" id="gEm">${gastoEsencial ? `Tus gastos fijos más cuotas son ${money(gastoEsencial)} al mes: 3 meses = ${money(gastoEsencial * 3)}, 6 meses = ${money(gastoEsencial * 6)}. Si tu ingreso es estable, 3 suele bastar; si es variable, apunta más alto.` : ''}</p>
    <label class="field"><span>¿Dónde está el dinero?</span><select id="gC"><option value="">Lo anoto a mano</option>${assets.map(a => `<option value="${esc(a.id)}" ${g.cuenta === a.id ? 'selected' : ''}>${esc(a.nombre)} (${money(bal(a), a.moneda)})</option>`).join('')}</select></label>
    <label class="field" id="gAF"><span>Llevas ahorrado</span><input id="gA" inputmode="decimal" value="${inputMoney(g.actual)}"></label>
    <button class="btn" id="gS">Guardar</button>${id ? '<button class="btn danger" id="gX">Borrar</button>' : ''}`, () => {
    const sync = () => { $('#gAF').hidden = !!$('#gC').value; $('#gEm').hidden = $('#gT').value !== 'emergencia'; };
    $('#gC').onchange = sync; $('#gT').onchange = sync; sync();
    $('#gS').onclick = () => {
      const o = cents($('#gO').value); if (!$('#gN').value.trim() || !o) { toast('Escribe nombre y monto objetivo'); return; }
      Object.assign(g, { nombre: $('#gN').value.trim(), tipo: $('#gT').value, objetivo: o, fecha: $('#gF').value || null, cuenta: $('#gC').value || null, actual: cents($('#gA').value) || 0 });
      if (!id) { g.id = Store.uid('g'); D.metas.push(g); }
      closeSheet(); save('Meta guardada', ['meta', g.nombre]);
    };
    if (id) armed($('#gX'), 'Toca otra vez para borrar', () => { D.metas = D.metas.filter(x => x.id !== id); closeSheet(); save('Meta borrada', ['borrar meta', g.nombre]); });
  });
}

/* =========================================================
   CUENTAS Y PATRIMONIO
   ========================================================= */
function renderCuentas() {
  const nw = E.netWorth(activeAccounts(), D.movs, D.fx, hoy());
  const usd = E.fxRate(D.fx, 'USD', hoy());
  const groups = GRUPOS.map(([n, tipos]) => {
    const list = activeAccounts().filter(a => tipos.includes(a.tipo));
    if (!list.length) return '';
    return `<div class="sec-h"><h2>${n}</h2></div><div class="card list">${list.map(a => {
      const b = bal(a), estimado = D.movs.some(m => m.cuenta === a.id && m.fecha > (a.fechaSaldo || '')), viejo = a.fechaSaldo && E.daysBetween(a.fechaSaldo, hoy()) > 35;
      return `<button class="item" data-acc="${esc(a.id)}"><div class="ico" style="background:color-mix(in srgb, ${colorOf(a.id)} 18%, transparent);color:${colorOf(a.id)}">${esc((a.institucion || a.nombre).slice(0, 2).toUpperCase())}</div>
        <div style="min-width:0"><div class="t">${esc(a.nombre)}</div><div class="s">${esc(a.institucion || TIPOS[a.tipo])}${a.moneda !== 'DOP' ? ' · ' + a.moneda : ''} · ${estimado ? 'estimado' : 'confirmado'} ${a.fechaSaldo ? dLabel(a.fechaSaldo) : ''}${viejo ? ' <span class="pill warn">actualizar</span>' : ''}${a.valoracion && a.valoracion !== 'manual' && !E.isLiability(a) ? ' · ' + a.valoracion : ''}</div></div>
        <div class="a num ${E.isLiability(a) ? 'neg' : ''}">${E.isLiability(a) && b > 0 ? '−' : ''}${money(Math.abs(b), a.moneda, true)}</div></button>`;
    }).join('')}</div>`;
  }).join('');
  const dist = Object.entries(nw.porTipo).filter(([t]) => !['tarjeta', 'prestamo', 'otro_pasivo'].includes(t)).sort((a, b) => b[1] - a[1]);
  const tot = dist.reduce((s, [, v]) => s + Math.max(0, v), 0) || 1;
  $('#v-cuentas').innerHTML = `
    <div class="card stack">
      <div class="row"><div><div class="label">Patrimonio neto</div><div class="mid num">${money(nw.neto)}</div></div><button class="btn small" id="aNew">+ Cuenta</button></div>
      <div class="kv"><span>Activos</span><strong class="num pos">${money(nw.activos)}</strong></div>
      <div class="kv"><span>Deudas</span><strong class="num neg">${money(nw.pasivos)}</strong></div>
      ${dist.length ? `<div class="splitbar">${dist.map(([t, v], i) => `<i style="width:${Math.max(0, v) / tot * 100}%;background:var(--c${i % 8})"></i>`).join('')}</div>
      <div class="legend">${dist.map(([t, v], i) => `<span><i class="sw" style="--c:var(--c${i % 8})"></i>${TIPOS[t]} ${money(v)}</span>`).join('')}</div>` : ''}
      ${nw.sinTasa.length ? `<p class="note">${nw.sinTasa.join(', ')} sin tasa de cambio: no se suman. Agrégala abajo.</p>` : ''}
      <p class="hint">"Confirmado" es el saldo que pusiste del banco. "Estimado" suma los movimientos registrados después; confírmalo de vez en cuando.</p>
    </div>
    ${groups || '<div class="card empty"><strong>Sin cuentas</strong>Agrega tu cuenta de nómina, tus tarjetas y préstamos.</div>'}

    <div class="sec-h"><h2>Tasa de cambio</h2><button class="linkbtn" id="fxAdd">+ Agregar</button></div>
    <div class="card">${usd && usd.fecha ? `<div class="kv"><span>US$ 1 =</span><strong class="num">RD$${f2.format(usd.tasa)}</strong></div><p class="hint">Del ${dLabel(usd.fecha)} · fuente: ${esc(usd.fuente || 'manual')}. La app no consulta tasas en línea; usa la de tu banco o la del Banco Central.</p>` : '<p class="hint">Sin tasas. Solo hace falta si tienes cuentas en US$.</p>'}</div>

    <div class="sec-h"><h2>Reglas de categoría</h2><span class="aside">${D.reglas.filter(r => r.origen === 'usuario').length} tuyas</span></div>
    <div class="card list">${D.reglas.filter(r => r.origen === 'usuario').map(r => `<div class="item" style="grid-template-columns:1fr auto"><div><div class="t">${esc(r.patron)}</div><div class="s">→ ${esc(r.categoria)}</div></div><button class="linkbtn danger" data-rx="${esc(r.id)}">Quitar</button></div>`).join('') || '<div class="empty">Se crean solas cuando corriges la categoría de un movimiento.</div>'}
      <p class="hint" style="padding-top:8px">Además hay ${D.reglas.filter(r => r.origen !== 'usuario').length} reglas generales para comercios comunes en RD.</p></div>

    <div class="sec-h" id="datos"><h2>Tus datos</h2></div>
    <div class="card stack">
      <p class="hint">Todo se guarda solo en este teléfono: sin servidor, sin cuentas, sin conexión bancaria. Descarga un respaldo para no perder nada si cambias de teléfono.</p>
      <div class="kv"><span>Último respaldo</span><strong>${D.ultimoRespaldo ? dLabel(D.ultimoRespaldo) : 'nunca'}</strong></div>
      ${Store.ok ? '' : '<p class="note">Este navegador no está guardando los datos (modo privado o espacio lleno).</p>'}
      <div class="grid2"><button class="btn small" id="bkOut">Descargar respaldo</button><button class="btn small ghost" id="bkIn">Restaurar</button></div>
      <button class="btn small ghost" id="movCsv">Exportar movimientos (CSV)</button>
      <button class="btn small ghost" id="instBtn" hidden>Instalar en este teléfono</button>
      <details class="more"><summary class="linkbtn">Historial de cambios</summary><div class="list" style="margin-top:6px">${D.auditoria.slice(0, 40).map(x => `<div class="item" style="grid-template-columns:1fr"><div><div class="t" style="font-size:13px">${esc(x.detalle)}</div><div class="s">${new Date(x.ts).toLocaleString('es-DO')} · ${esc(x.accion)}</div></div></div>`).join('')}</div></details>
      <button class="linkbtn danger" id="wipe">Borrar todos los datos</button>
    </div>`;
  $('#aNew').onclick = () => accountSheet(null);
  $$('#v-cuentas [data-acc]').forEach(b => b.onclick = () => accountSheet(b.dataset.acc));
  $('#fxAdd').onclick = fxSheet;
  $$('[data-rx]').forEach(b => b.onclick = () => { D.reglas = D.reglas.filter(r => r.id !== b.dataset.rx); save('Regla quitada', ['regla', 'quitada']); });
  $('#bkOut').onclick = backup;
  $('#bkIn').onclick = restore;
  $('#movCsv').onclick = () => {
    const lines = ['Fecha,Cuenta,Descripción,Monto,Moneda,Tipo,Categoría,Excluido'];
    [...D.movs].sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(m => lines.push([m.fecha, q(acc(m.cuenta)?.nombre || ''), q(m.descripcion), (m.monto / 100).toFixed(2), m.moneda || 'DOP', TIPO_MOV[m.tipo], q(m.categoria || ''), m.excluida ? 'sí' : ''].join(',')));
    download(`movimientos-${hoy()}.csv`, '﻿' + lines.join('\n'), 'text/csv');
  };
  armed($('#wipe'), 'Se borra todo. Toca otra vez', () => { Store.reset(false); render(); toast('Datos borrados'); });
  if (deferredPrompt) { $('#instBtn').hidden = false; $('#instBtn').onclick = doInstall; }
}
const q = s => '"' + String(s || '').replace(/"/g, '""') + '"';

function accountSheet(id, tipoNuevo) {
  const a = id ? acc(id) : { tipo: tipoNuevo || 'corriente', moneda: 'DOP', saldo: 0, fechaSaldo: hoy(), origen: 'manual', valoracion: 'manual', titular: '' };
  const isNew = !id;
  const b = id ? bal(a) : 0;
  openSheet(`<h2>${isNew ? 'Nueva cuenta' : esc(a.nombre)}</h2>
    ${!isNew ? `<div class="card flat stack" style="background:var(--surface-2)"><div class="kv"><span>Saldo ${D.movs.some(m => m.cuenta === a.id && m.fecha > a.fechaSaldo) ? 'estimado' : 'confirmado'}</span><strong class="num">${money(b, a.moneda, true)}</strong></div>
      <div class="grid2" style="align-items:end"><label class="field"><span>Saldo hoy según el banco</span><input id="xBank" inputmode="decimal" placeholder="${inputMoney(b)}"></label><button class="btn small" id="xConc">Conciliar</button></div><div id="xConcR"></div></div>` : ''}
    <label class="field"><span>Tipo</span><select id="xT">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${a.tipo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="field"><span>Nombre</span><input id="xN" value="${esc(a.nombre || '')}" placeholder="Ej. Nómina BHD"></label>
    <div class="grid2"><label class="field"><span>Institución</span><input id="xI" value="${esc(a.institucion || '')}" placeholder="Ej. Banco Popular" list="bancos"></label><label class="field"><span>Titular</span><input id="xTi" value="${esc(a.titular || '')}"></label></div>
    <datalist id="bancos">${['Banco Popular', 'Banreservas', 'BHD', 'Scotiabank', 'APAP', 'Asociación Cibao', 'Asociación La Nacional', 'Banco Santa Cruz', 'Banesco', 'Promerica', 'Banco Caribe', 'Banco BDI', 'Banco Vimenca', 'Banco López de Haro', 'Qik', 'Banco Ademi'].map(x => `<option value="${x}">`).join('')}</datalist>
    <div class="grid2"><label class="field"><span>Moneda</span><select id="xM"><option value="DOP" ${a.moneda === 'DOP' ? 'selected' : ''}>RD$</option><option value="USD" ${a.moneda === 'USD' ? 'selected' : ''}>US$</option><option value="EUR" ${a.moneda === 'EUR' ? 'selected' : ''}>€</option></select></label>
      ${isNew ? `<label class="field"><span id="xSL">Saldo actual</span><input id="xS" inputmode="decimal" placeholder="0.00"></label>` : `<label class="field"><span>Valoración</span><select id="xV">${[['manual', 'Manual'], ['mercado', 'Precio de mercado'], ['estimado', 'Estimación']].map(([k, v]) => `<option value="${k}" ${a.valoracion === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`}</div>
    <div id="xDebt" class="stack">
      <div class="grid2"><label class="field"><span>Tasa anual %</span><input id="xTa" inputmode="decimal" value="${a.tasa != null ? +(a.tasa * 100).toFixed(4) : ''}" placeholder="Ej. 24.95"></label>
        <label class="field"><span>Tipo de tasa</span><select id="xTT">${[['fija', 'Fija'], ['variable', 'Variable'], ['no_confirmada', 'No confirmada']].map(([k, v]) => `<option value="${k}" ${(a.tipoTasa || 'no_confirmada') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="grid2" id="xLoan"><label class="field"><span>Cuota mensual</span><input id="xCu" inputmode="decimal" value="${inputMoney(a.cuota)}"></label><label class="field"><span>Día de pago</span><input id="xDP" inputmode="numeric" value="${a.diaPago || ''}"></label></div>
      <div class="grid2" id="xLoan2"><label class="field"><span>Monto original</span><input id="xMO" inputmode="decimal" value="${inputMoney(a.montoOriginal)}"></label><label class="field"><span>Vence</span><input id="xVe" type="date" value="${a.vencimiento || ''}"></label></div>
      <div class="grid2" id="xCard"><label class="field"><span>Límite</span><input id="xLi" inputmode="decimal" value="${inputMoney(a.limite)}"></label><label class="field"><span>Pago mínimo</span><input id="xPM" inputmode="decimal" value="${inputMoney(a.pagoMinimo)}"></label></div>
      <div class="grid3" id="xCard2"><label class="field"><span>Día de corte</span><input id="xDC" inputmode="numeric" value="${a.diaCorte || ''}"></label><label class="field"><span>Día límite pago</span><input id="xDP2" inputmode="numeric" value="${a.diaPago || ''}"></label><label class="field"><span>Saldo al corte</span><input id="xSC" inputmode="decimal" value="${inputMoney(a.saldoCorte)}"></label></div>
      <label class="check" id="xPTF"><input type="checkbox" id="xPT" ${a.pagoTotal ? 'checked' : ''}> La pago completa en cada corte</label>
      <div class="grid2"><label class="field"><span>Seguro/cargo mensual</span><input id="xCo" inputmode="decimal" value="${inputMoney(a.comisionMensual)}"></label><label class="field"><span>Penalidad por abono %</span><input id="xPe" inputmode="decimal" value="${a.penalidadAbono ? +(a.penalidadAbono * 100).toFixed(2) : ''}"></label></div>
    </div>
    <div id="xCert" class="grid2"><label class="field"><span>Tasa anual %</span><input id="xCT" inputmode="decimal" value="${a.tasa != null && !E.isLiability(a) ? +(a.tasa * 100).toFixed(4) : ''}"></label><label class="field"><span>Vencimiento</span><input id="xCV" type="date" value="${a.vencimiento || ''}"></label></div>
    <label class="check"><input type="checkbox" id="xEx" ${a.excluir ? 'checked' : ''}> No sumar al patrimonio (evita contar dos veces)</label>
    <button class="btn" id="xS2">Guardar</button>
    ${!isNew ? `<div class="grid2"><button class="btn ghost" id="xMovs">Ver movimientos</button><button class="btn danger" id="xDel">Archivar</button></div>` : ''}`, () => {
    const sync = () => {
      const t = $('#xT').value, debt = ['tarjeta', 'prestamo', 'otro_pasivo'].includes(t);
      $('#xDebt').hidden = !debt; $('#xLoan').hidden = t === 'tarjeta'; $('#xLoan2').hidden = t === 'tarjeta';
      $('#xCard').hidden = t !== 'tarjeta'; $('#xCard2').hidden = t !== 'tarjeta'; $('#xPTF').hidden = t !== 'tarjeta';
      $('#xCert').hidden = !['certificado', 'inversion'].includes(t);
      if ($('#xSL')) $('#xSL').textContent = debt ? 'Lo que debes hoy' : t === 'vehiculo' || t === 'inmueble' ? 'Valor estimado' : 'Saldo actual';
    };
    $('#xT').onchange = sync; sync();
    if (!isNew) {
      $('#xConc').onclick = () => {
        const v = cents($('#xBank').value); if (v == null) { toast('Escribe el saldo del banco'); return; }
        const diff = v - b;
        $('#xConcR').innerHTML = Math.abs(diff) < 1 ? '<p class="note info">Cuadra: el saldo coincide.</p>' :
          `<p class="hint">Diferencia: <strong class="num">${money(diff, a.moneda, true)}</strong>. ${E.isLiability(a) ? 'Suele ser interés, cargos o compras sin registrar.' : 'Suele ser algún movimiento sin registrar o una comisión.'}</p>
           <div class="grid2"><button class="btn small" id="xAdj">Crear ajuste</button><button class="btn small ghost" id="xSet">Solo fijar saldo</button></div>`;
        const adj = $('#xAdj'); if (adj) adj.onclick = () => {
          const monto = E.isLiability(a) ? -diff : diff;
          D.movs.push({ id: Store.uid('m'), cuenta: a.id, fecha: hoy(), monto, moneda: a.moneda, descripcion: 'Ajuste de conciliación', tipo: 'ajuste', origen: 'manual', creado: Date.now(), catOrigen: 'usuario', confianza: 1 });
          closeSheet(); save('Ajuste creado: cuadra con el banco', ['conciliar', `${a.nombre}: ajuste ${money(diff)}`]);
        };
        const st = $('#xSet'); if (st) st.onclick = () => {
          // fija el saldo declarado a hoy; los movimientos anteriores quedan como historial
          a.saldo = v; a.fechaSaldo = hoy();
          if (D.movs.some(m => m.cuenta === a.id && m.fecha === hoy())) { a.fechaSaldo = hoy(); }
          closeSheet(); save('Saldo confirmado', ['conciliar', `${a.nombre}: saldo fijado en ${money(v)}`]);
        };
      };
      $('#xMovs').onclick = () => { closeSheet(); movCuenta = a.id; movFilter = 'todos'; showTab('movs'); render(); };
      armed($('#xDel'), 'Toca otra vez para archivar', () => { a.archivada = true; closeSheet(); save('Cuenta archivada', ['archivar cuenta', a.nombre]); });
    }
    $('#xS2').onclick = () => {
      const nombre = $('#xN').value.trim(); if (!nombre) { toast('Ponle un nombre'); return; }
      const t = $('#xT').value, debt = ['tarjeta', 'prestamo', 'otro_pasivo'].includes(t);
      const pctv = id2 => { const v = $(id2).value.trim(); return v === '' ? null : parseFloat(v.replace(',', '.')) / 100; };
      Object.assign(a, { nombre, tipo: t, institucion: $('#xI').value.trim(), titular: $('#xTi').value.trim(), moneda: $('#xM').value, excluir: $('#xEx').checked });
      if (isNew) { a.saldo = cents($('#xS').value) || 0; a.fechaSaldo = hoy(); } else a.valoracion = $('#xV').value;
      if (debt) {
        a.tasa = pctv('#xTa'); a.tipoTasa = $('#xTT').value; a.tasaEstimada = a.tasaEstimada && a.tipoTasa === 'no_confirmada';
        a.comisionMensual = cents($('#xCo').value) || 0; a.penalidadAbono = pctv('#xPe') || 0;
        if (t === 'tarjeta') { a.limite = cents($('#xLi').value) || 0; a.pagoMinimo = cents($('#xPM').value) || 0; a.diaCorte = parseInt($('#xDC').value) || null; a.diaPago = parseInt($('#xDP2').value) || null; a.saldoCorte = cents($('#xSC').value); a.pagoTotal = $('#xPT').checked; }
        else { a.cuota = cents($('#xCu').value) || 0; a.diaPago = parseInt($('#xDP').value) || null; a.montoOriginal = cents($('#xMO').value) || null; a.vencimiento = $('#xVe').value || null; }
      } else if (['certificado', 'inversion'].includes(t)) { a.tasa = pctv('#xCT'); a.vencimiento = $('#xCV').value || null; }
      if (isNew) { a.id = Store.uid('a'); D.cuentas.push(a); }
      closeSheet(); save(isNew ? 'Cuenta creada' : 'Cuenta guardada', [isNew ? 'crear cuenta' : 'editar cuenta', a.nombre]);
    };
  });
}
function fxSheet() {
  openSheet(`<h2>Tasa de cambio</h2>
    <div class="grid2"><label class="field"><span>Moneda</span><select id="fM"><option>USD</option><option>EUR</option></select></label><label class="field"><span>RD$ por unidad</span><input id="fT" inputmode="decimal" placeholder="Ej. 63.50"></label></div>
    <div class="grid2"><label class="field"><span>Fecha</span><input id="fF" type="date" value="${hoy()}"></label><label class="field"><span>Fuente</span><input id="fS" placeholder="Ej. Banco Central, mi banco"></label></div>
    <p class="hint">Escribe la tasa que ves en tu banco o en el Banco Central. La app no la inventa ni la busca sola.</p>
    <button class="btn" id="fOk">Guardar</button>`, () => {
    $('#fOk').onclick = () => {
      const t = parseFloat($('#fT').value.replace(',', '.')); if (!t || t <= 0) { toast('Escribe la tasa'); return; }
      D.fx.push({ moneda: $('#fM').value, tasa: t, fecha: $('#fF').value || hoy(), fuente: $('#fS').value.trim() || 'manual' });
      closeSheet(); save('Tasa guardada', ['tasa de cambio', `${$('#fM').value} ${t}`]);
    };
  });
}

/* ---------- respaldo ---------- */
function download(name, text, type) {
  const blob = new Blob([text], { type: type + ';charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function backup() { D.ultimoRespaldo = hoy(); Store.log('respaldo', 'Respaldo descargado'); Store.save(); download(`cuadre-respaldo-${hoy()}.json`, JSON.stringify(D, null, 1), 'application/json'); render(); toast('Respaldo descargado'); }
function restore() {
  const fi = $('#fileInput'); fi.accept = '.json,application/json'; fi.value = '';
  fi.onchange = async () => { const f = fi.files[0]; if (!f) return; try { Store.replace(JSON.parse(await f.text())); render(); toast('Respaldo restaurado'); } catch (e) { toast('Ese archivo no es un respaldo de Cuadre'); } };
  fi.click();
}

/* ---------- hoja inferior ---------- */
function openSheet(html, mount) {
  $('#sheetBody').innerHTML = '<div class="row"><span></span><div class="grab"></div><button class="linkbtn" id="sheetClose" aria-label="Cerrar">Cerrar</button></div>' + html;
  $('#sheetClose').onclick = closeSheet;
  $('#sheet').classList.add('open'); $('#scrim').classList.add('open'); $('#sheet').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  if (mount) mount();
}
function closeSheet() { $('#sheet').classList.remove('open'); $('#scrim').classList.remove('open'); document.body.style.overflow = ''; }
$('#scrim').onclick = closeSheet;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
/** Botón que pide un segundo toque antes de una acción destructiva. */
function armed(b, confirmText, action) {
  if (!b) return; const normal = b.textContent;
  b.onclick = () => { if (b.dataset.armed) { action(); return; } b.dataset.armed = '1'; b.textContent = confirmText; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = normal; } }, 3500); };
}

/* ---------- instalación ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; if (tab === 'cuentas') render(); });
async function doInstall() { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; render(); }
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
  let seen = false; try { seen = localStorage.getItem('cuadre_ios_tip') === '1'; } catch (e) {}
  if (!seen) { $('#banner').innerHTML = `<div class="card flat row" style="margin-bottom:10px;background:var(--accent-soft)"><span class="hint" style="color:var(--accent)">Para instalarla: en Safari toca <strong>Compartir</strong> → <strong>Agregar a inicio</strong>.</span><button class="linkbtn" id="iosOk">Listo</button></div>`; $('#iosOk').onclick = () => { $('#banner').innerHTML = ''; try { localStorage.setItem('cuadre_ios_tip', '1'); } catch (e) {} }; }
}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

render();
})();
