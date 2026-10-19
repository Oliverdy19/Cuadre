// Pruebas del motor financiero. Ejecutar: node tests/engine.test.js
const E = require('../engine.js');
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); } }
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ` esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`); }
function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error((msg || '') + ` esperado ≈${b}, obtenido ${a}`); }
const RD = n => Math.round(n * 100);

console.log('Dinero e importes');
t('redondeo mitad lejos de cero', () => { eq(E.r2c(2.5), 3); eq(E.r2c(-2.5), -3); eq(E.r2c(2.4999), 2); });
t('importes en formatos dominicanos', () => {
  eq(E.parseAmount('RD$ 1,234.56'), 123456);
  eq(E.parseAmount('(1,234.56)'), -123456);
  eq(E.parseAmount('-500'), -50000);
  eq(E.parseAmount('1.234,56'), 123456);
  eq(E.parseAmount('12,50'), 1250);
  eq(E.parseAmount('1,234'), 123400);
  eq(E.parseAmount('US$12'), 1200);
  eq(E.parseAmount('250.00-'), -25000);
  eq(E.parseAmount('abc'), null);
  eq(E.parseAmount(''), null);
});

console.log('Fechas');
t('dd/mm/yyyy por defecto', () => eq(E.parseDate('05/11/2026'), '2026-11-05'));
t('yyyy-mm-dd', () => eq(E.parseDate('2026-11-05'), '2026-11-05'));
t('mm/dd cuando el día > 12', () => eq(E.parseDate('11/25/2026'), '2026-11-25'));
t('serial de Excel', () => eq(E.parseDate(46331), '2026-11-05'));
t('fecha inválida', () => eq(E.parseDate('31/02/2026'), null));
t('mes en texto', () => eq(E.parseDate('5 nov 2026'), '2026-11-05'));
t('detecta orden de columna', () => eq(E.guessDateOrder(['01/02/2026', '13/02/2026']), 'dmy'));

console.log('CSV');
t('separador punto y coma, comillas y saltos', () => {
  const r = E.parseCSV('Fecha;Descripción;Monto\n01/11/2026;"SUPERMERCADO ""LA"" SIRENA";-1.250,00\r\n02/11/2026;NOMINA;33500\n');
  eq(r.length, 3); eq(r[1][1], 'SUPERMERCADO "LA" SIRENA'); eq(r[1][2], '-1.250,00');
});
t('mapeo sugerido por encabezados', () => {
  const m = E.guessMapping(['Fecha Transacción', 'Descripción', 'Débito', 'Crédito']);
  eq(m.fecha, 0); eq(m.descripcion, 1); eq(m.debito, 2); eq(m.credito, 3);
});

console.log('Movimientos');
const ex = [{ id: 'a', cuenta: 'c1', fecha: '2026-11-01', monto: -125000, descripcion: 'COMPRA POS SIRENA 0001234567' }];
t('duplicado exacto', () => eq(E.dedupe([{ cuenta: 'c1', fecha: '2026-11-01', monto: -125000, descripcion: 'COMPRA POS SIRENA 0001234567' }], ex)[0].estado, 'duplicado'));
t('posible duplicado (fecha ±2, texto parecido)', () => eq(E.dedupe([{ cuenta: 'c1', fecha: '2026-11-02', monto: -125000, descripcion: 'SIRENA COMPRA' }], ex)[0].estado, 'posible'));
t('nuevo', () => eq(E.dedupe([{ cuenta: 'c1', fecha: '2026-11-02', monto: -99900, descripcion: 'SIRENA' }], ex)[0].estado, 'nuevo'));
t('duplicados dentro del mismo archivo', () => {
  const c = { cuenta: 'c1', fecha: '2026-11-05', monto: -100, descripcion: 'X' };
  const r = E.dedupe([c, { ...c }], []); eq(r[0].estado, 'nuevo'); eq(r[1].estado, 'duplicado');
});
const rules = [{ patron: 'SIRENA', categoria: 'Supermercado', origen: 'sistema' }, { patron: 'NOMINA', categoria: 'Salario', origen: 'sistema', signo: 'ingreso' }, { patron: 'SIRENA', categoria: 'Hogar', origen: 'usuario' }];
t('regla del usuario gana a la del sistema', () => { const r = E.categorize({ descripcion: 'POS LA SIRENA', monto: -1 }, rules, {}); eq(r.categoria, 'Hogar'); eq(r.catOrigen, 'regla'); });
t('historial por comercio', () => { const r = E.categorize({ descripcion: 'POS FERRETERIA OCHOA 123', monto: -1 }, [], { 'FERRETERIA OCHOA': 'Hogar' }); eq(r.categoria, 'Hogar'); eq(r.confianza, 0.85); });
t('regla de ingreso no aplica a un gasto', () => eq(E.categorize({ descripcion: 'NOMINA', monto: -100 }, rules.slice(0, 2), {}).categoria, null));
t('transferencia entre cuentas propias', () => {
  const accs = [{ id: 'c1', tipo: 'corriente' }, { id: 'c2', tipo: 'ahorro' }, { id: 'tc', tipo: 'tarjeta' }];
  const tx = [
    { id: '1', cuenta: 'c1', fecha: '2026-11-01', monto: -500000 }, { id: '2', cuenta: 'c2', fecha: '2026-11-02', monto: 500000 },
    { id: '3', cuenta: 'c1', fecha: '2026-11-10', monto: -300000 }, { id: '4', cuenta: 'tc', fecha: '2026-11-10', monto: 300000 }];
  const p = E.detectTransfers(tx, accs);
  eq(p.length, 2); eq(p[0][2], 'transferencia'); eq(p[1][2], 'pago_deuda');
});
t('transferencias y pagos no cuentan como gasto', () => {
  const tx = [{ fecha: '2026-11-01', monto: -1000, tipo: 'gasto', categoria: 'A' }, { fecha: '2026-11-01', monto: -5000, tipo: 'pago_deuda' }, { fecha: '2026-11-01', monto: -7000, tipo: 'transferencia' }, { fecha: '2026-11-01', monto: 9000, tipo: 'ingreso' }];
  const m = E.monthTotals(tx, '2026-11'); eq(m.gastos, 1000); eq(m.ingresos, 9000);
});

console.log('Cuentas y patrimonio');
t('saldo calculado de activo y de pasivo', () => {
  const tx = [{ cuenta: 'a', fecha: '2026-11-02', monto: -1000 }, { cuenta: 't', fecha: '2026-11-02', monto: -2000 }, { cuenta: 't', fecha: '2026-11-03', monto: 500 }, { cuenta: 'a', fecha: '2026-10-01', monto: -999 }];
  eq(E.accountBalance({ id: 'a', tipo: 'ahorro', saldo: 10000, fechaSaldo: '2026-11-01' }, tx), 9000);
  eq(E.accountBalance({ id: 't', tipo: 'tarjeta', saldo: 10000, fechaSaldo: '2026-11-01' }, tx), 11500);
});
t('patrimonio con US$ y tasa con fecha', () => {
  const accs = [{ id: 'a', tipo: 'ahorro', saldo: RD(100000), moneda: 'DOP' }, { id: 'u', tipo: 'ahorro', saldo: RD(1000), moneda: 'USD' }, { id: 'p', tipo: 'prestamo', saldo: RD(50000), moneda: 'DOP' }];
  const fx = [{ moneda: 'USD', tasa: 60, fecha: '2026-10-01', fuente: 'manual' }, { moneda: 'USD', tasa: 63, fecha: '2026-11-01', fuente: 'manual' }];
  const nw = E.netWorth(accs, [], fx, '2026-10-15');
  eq(nw.activos, RD(160000)); eq(nw.pasivos, RD(50000)); eq(nw.neto, RD(110000));
});
t('moneda sin tasa queda fuera y se reporta', () => {
  const nw = E.netWorth([{ id: 'u', tipo: 'ahorro', saldo: 100, moneda: 'USD' }], [], [], '2026-11-01');
  eq(nw.activos, 0); eq(nw.sinTasa[0], 'USD');
});

console.log('Préstamos y deudas');
t('cuota francesa conocida', () => near(E.pmt(RD(500000), 0.1595, 48), RD(14157.34), 1));
t('tasa cero', () => { eq(E.pmt(RD(1200), 0, 12), RD(100)); const a = E.amortize(RD(1200), 0, RD(100)); eq(a.meses, 12); eq(a.interes, 0); });
t('última cuota menor', () => { const a = E.amortize(RD(1000), 0, RD(300), { rows: true }); eq(a.meses, 4); eq(a.rows[3].pago, RD(100)); });
t('cuota que no cubre interés', () => eq(E.amortize(RD(100000), 0.36, RD(2000)).insuficiente, true));
t('comisión mensual suma al costo', () => { const a = E.amortize(RD(1200), 0, RD(100), { comisionMensual: RD(10) }); eq(a.comisiones > 0, true); });
const oliver = [
  { id: 'apap', saldo: RD(125941.93), tasa: 0.32, cuota: RD(4724.65) },
  { id: 'p25', saldo: RD(72471.31), tasa: 0.2495, cuota: RD(2404.61) },
  { id: 'p18', saldo: RD(286000), tasa: 0.185, cuota: RD(8368), tipoTasa: 'variable' }];
t('avalancha salda primero la tasa más alta', () => {
  const r = E.planDebts(oliver, { inicio: '2026-11', estrategia: 'avalancha', extraMensual: RD(26500) });
  eq(r.payoff.apap < r.payoff.p25 && r.payoff.p25 < r.payoff.p18, true); eq(r.completo, true);
});
t('bola de nieve salda primero el saldo menor', () => { const r = E.planDebts(oliver, { inicio: '2026-11', estrategia: 'bola', extraMensual: RD(26500) }); eq(r.payoff.p25 <= r.payoff.apap, true); });
t('avalancha cuesta menos o igual que bola de nieve', () => {
  const c = E.compareStrategies(oliver, { inicio: '2026-11', extraMensual: RD(26500) });
  eq(c.resultados.avalancha.interes <= c.resultados.bola.interes, true);
  eq(c.resultados.minimos.meses > c.resultados.avalancha.meses, true);
});
t('pago extraordinario adelanta la fecha', () => {
  const a = E.planDebts(oliver, { inicio: '2026-11', extraMensual: RD(20000) });
  const b = E.planDebts(oliver, { inicio: '2026-11', extraMensual: RD(20000), eventos: [{ mes: '2026-12', monto: RD(50000) }] });
  eq(b.interes < a.interes, true); eq(b.meses <= a.meses, true);
});
t('subida de tasa variable encarece el plan', () => {
  const a = E.planDebts(oliver, { inicio: '2026-11', extraMensual: RD(20000) });
  const b = E.planDebts(oliver, { inicio: '2026-11', extraMensual: RD(20000), ajusteTasaVariable: 0.03 });
  eq(b.interes > a.interes, true);
});
t('penalidad por abono reduce menos el saldo', () => {
  const r = E.planDebts([{ id: 'x', saldo: RD(10000), tasa: 0, cuota: RD(1000), penalidadAbono: 0.03 }], { inicio: '2026-11', extraMensual: RD(1030) });
  eq(r.calendario[0].deudas.x.abono, RD(1000)); eq(r.calendario[0].deudas.x.penalidad, RD(30)); eq(r.penalidades > 0, true);
});
t('deuda que entra después', () => {
  const r = E.planDebts([{ id: 'a', saldo: RD(1000), tasa: 0, cuota: RD(500) }, { id: 'b', saldo: RD(1000), tasa: 0, cuota: RD(500), desde: '2027-01' }], { inicio: '2026-11' });
  eq(r.payoff.a, '2026-12'); eq(r.calendario[0].deudas.b, undefined); eq(r.completo, true);
});
t('cuotas liberadas pasan a la siguiente deuda', () => {
  const r = E.planDebts([{ id: 'a', saldo: RD(500), tasa: 0, cuota: RD(500) }, { id: 'b', saldo: RD(3000), tasa: 0, cuota: RD(500) }], { inicio: '2026-11' });
  eq(r.calendario[1].deudas.b.abono, RD(500));
});
t('optimizador: extra mínimo para meta', () => {
  const x = E.extraNeededFor(oliver, { inicio: '2026-11' }, 'apap', '2027-06', RD(200000));
  const r = E.planDebts(oliver, { inicio: '2026-11', extraMensual: x });
  eq(r.payoff.apap <= '2027-06', true);
  const r2 = E.planDebts(oliver, { inicio: '2026-11', extraMensual: x - RD(100) });
  eq(!(r2.payoff.apap && r2.payoff.apap <= '2027-06'), true);
});
t('consolidación con penalidad: compara contra el plan base', () => {
  const c = E.consolidate(oliver, ['apap', 'p25', 'p18'], { tasa: 0.1595, plazo: 48, penalidadAbono: 0.03 }, { inicio: '2026-11', extraMensual: RD(26500) });
  near(c.cuota, E.pmt(c.monto, 0.1595, 48), 1); eq(typeof c.diferenciaCosto, 'number'); eq(c.nuevo.penalidades > 0, true);
});

console.log('Tarjetas');
t('estado: utilización y fechas', () => {
  const s = E.cardStatus({ limite: RD(130000), diaCorte: 11, diaPago: 2 }, RD(125941.93), '2026-10-18');
  near(s.utilizacion, 0.9688, 0.001); eq(s.proximoPago, '2026-11-02'); eq(s.alertaUtilizacion, 'alta'); eq(s.diasParaPago, 15);
});
t('mínimo vs total', () => {
  const o = E.cardPayoffOptions(RD(36096.84), 0.486, RD(1800), RD(5000));
  eq(o.total.interes, 0); eq(o.minimo.interes > o.intermedio.interes, true);
});

console.log('Flujo y metas');
t('ocurrencias quincenales y fin de mes', () => eq(E.occurrences({ frecuencia: 'quincenal', dia: 15, dia2: 30 }, '2027-02-01', '2027-02-28').join(), '2027-02-15,2027-02-28'));
t('flujo: conservador excluye ingresos inciertos', () => {
  const recs = [{ nombre: 'Salario', tipo: 'ingreso', monto: RD(67000), frecuencia: 'mensual', dia: 29 }, { nombre: 'Regalía', tipo: 'ingreso', monto: RD(67000), frecuencia: 'anual', mes: 12, dia: 20, certeza: 'incierto' }, { nombre: 'Gastos', tipo: 'gasto', monto: RD(20000), frecuencia: 'mensual', dia: 1 }];
  const c = E.cashForecast(RD(7000), recs, [{ nombre: 'Cuota', monto: RD(15000), dia: 10 }], '2026-11-01', 90, 'conservador');
  const o = E.cashForecast(RD(7000), recs, [{ nombre: 'Cuota', monto: RD(15000), dia: 10 }], '2026-11-01', 90, 'optimista');
  eq(o.saldoFinal - c.saldoFinal, RD(67000));
  eq(c.minimo < RD(7000), true);
});
t('meta: aporte mensual', () => { const g = E.goalContribution(RD(100000), RD(7000), '2027-10-18', '2026-10-18'); eq(g.meses, 12); eq(g.mensual, RD(7750)); });


console.log('PDF');
const L = (y, page, ...its) => ({ page, y, items: its.map(([x, str, w]) => ({ x, str, w: w || str.length * 4 })) });
const pdfLines = [
  L(750, 1, [40, 'BANCO EJEMPLO']), L(722, 1, [40, 'Balance anterior: 12,500.00']),
  L(700, 1, [40, 'Fecha'], [110, 'Descripción'], [376, 'Débito', 24], [456, 'Crédito', 24], [532, 'Balance', 28]),
  L(684, 1, [40, '01/11/2026'], [110, 'COMPRA POS SUPERMERCADO'], [372, '2,450.75', 28], [524, '10,049.25', 36]),
  L(668, 1, [40, '14/11/2026'], [110, 'PAGO DE NOMINA'], [444, '33,500.00', 36], [524, '43,549.25', 36]),
  L(652, 1, [40, '16/11/2026 TRANSFERENCIA'], [372, '5,000.00', 28], [524, '38,549.25', 36]),
  L(641, 1, [110, 'REF 9988 A JUAN']),
  L(600, 1, [40, 'Página 1 de 2']),
  L(720, 2, [40, '25/11'], [110, 'INTERESES'], [460, '12.40', 20], [524, '38,561.65', 36])];
t('tabla desde PDF: columnas por posición y encabezados', () => {
  const tb = E.tableFromPdfLines(pdfLines);
  eq(tb.headers.join('|'), 'Fecha|Descripción|Débito|Crédito|Balance');
  eq(tb.rows.length, 4);
  eq(tb.rows[0].join('|'), '2026-11-01|COMPRA POS SUPERMERCADO|2,450.75||10,049.25');
  eq(tb.rows[1][3], '33,500.00');
  eq(tb.rows[2][1], 'TRANSFERENCIA REF 9988 A JUAN');
  eq(tb.rows[3][0], '2026-11-25'); eq(tb.rows[3][3], '12.40');
});
t('formato tarjeta Popular: dos fechas, referencia, código de comercio y signo', () => {
  const ls = [
    L(710, 1, [40, 'VISA ISI'], [210, 'LÍNEA DE CRÉDITO'], [510, 'BALANCE ANTERIOR', 50]),
    L(700, 1, [40, '****-****-****-4917'], [215, '80,000.00', 30], [355, '01/10/2026'], [430, '26/10/2026'], [525, '37,886.23', 35]),
    L(684, 1, [40, 'ENTRADA TRANSAC.'], [110, 'NO. DE REFERENCIA'], [240, 'CARGOS, PAGOS, CRÉDITOS Y AJUSTES ANTERIORES'], [530, 'CANTIDAD', 30]),
    L(660, 1, [40, '09/09'], [75, '09/09'], [110, '0650524914'], [240, 'Pago Via App'], [526, '-3,000.00', 34]),
    L(638, 1, [40, '17/09'], [75, '16/09'], [110, '74763946259636042259890'], [240, 'IKEA REST STO DGO'], [536, '165.00', 24]),
    L(630, 1, [240, '5311  040369']),
    L(616, 1, [40, '17/09'], [75, '16/09'], [110, '74763946259636042259882'], [240, 'IKEA REST STO DGO'], [536, '165.00', 24]),
    L(580, 1, [200, 'UNA CANTIDAD CON EL SIGNO (-) DE MENOS ES UN CRÉDITO.'])];
  const tb = E.tableFromPdfLines(ls);
  eq(tb.headers.join('|'), 'Fecha|Descripción|CANTIDAD|Referencia'); eq(tb.signoCredito, 'negativo');
  eq(tb.rows.length, 3); eq(tb.rows[1].join('|'), '2026-09-16|IKEA REST STO DGO|165.00|74763946259636042259890');
  const m = E.guessMapping(tb.headers); eq(m.monto, 2); eq(m.referencia, 3);
  const d = E.dedupe(tb.rows.map(r => ({ cuenta: 'isi', fecha: r[0], descripcion: r[1], monto: -E.parseAmount(r[2]), origenId: r[3] })), []);
  eq(d.filter(x => x.estado === 'nuevo').length, 3);
});
t('estado de enero con movimientos de diciembre', () => {
  const tb = E.tableFromPdfLines([L(700, 1, [355, '01/01/2027']), L(660, 1, [40, '28/12'], [240, 'SIRENA'], [536, '500.00', 24]), L(640, 1, [40, '02/01'], [240, 'NACIONAL'], [536, '700.00', 24])]);
  eq(tb.rows[0][0], '2026-12-28'); eq(tb.rows[1][0], '2027-01-02');
});
t('fechas de estado de cuenta sin año o con mes en texto', () => { eq(E.pdfDate('05/11', 2026), '2026-11-05'); eq(E.pdfDate('05-NOV', 2026), '2026-11-05'); eq(E.pdfDate('5 dic 25', 2026), '2025-12-05'); });
t('ignora números de referencia como monto', () => { const tb = E.tableFromPdfLines([L(700, 1, [40, '01/11/2026'], [110, 'DEP 123456'], [372, '1,000.00', 28])]); eq(tb.rows[0][1], 'DEP 123456'); eq(tb.headers.length, 3); });

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
