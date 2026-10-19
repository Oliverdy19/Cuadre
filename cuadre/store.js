/*
 * Cuadre — almacenamiento local, esquema, migraciones, auditoría y datos iniciales.
 * Los datos viven en este dispositivo (localStorage). Respaldo/restauración en JSON.
 */
(function (root) {
  'use strict';
  const KEY = 'cuadre_data';
  const SCHEMA = 1;

  const CATEGORIAS = [
    // grupo: esencial | discrecional | ingreso | ahorro
    ['Salario', 'ingreso'], ['Otros ingresos', 'ingreso'], ['Intereses ganados', 'ingreso'],
    ['Vivienda', 'esencial'], ['Supermercado', 'esencial'], ['Colmado', 'esencial'], ['Luz', 'esencial'], ['Agua', 'esencial'],
    ['Internet y teléfono', 'esencial'], ['Combustible', 'esencial'], ['Transporte', 'esencial'], ['Salud', 'esencial'],
    ['Educación', 'esencial'], ['Seguros', 'esencial'], ['Comisiones bancarias', 'esencial'], ['Intereses pagados', 'esencial'],
    ['Restaurantes y delivery', 'discrecional'], ['Entretenimiento', 'discrecional'], ['Suscripciones', 'discrecional'],
    ['Ropa y cuidado personal', 'discrecional'], ['Hogar', 'discrecional'], ['Viajes', 'discrecional'], ['Regalos', 'discrecional'],
    ['Otros gastos', 'discrecional']
  ];
  // Reglas del sistema: palabras clave comunes en estados de cuenta dominicanos.
  const REGLAS = [
    ['NOMINA', 'Salario', 'ingreso'], ['SALARIO', 'Salario', 'ingreso'], ['PAGO DE NOMINA', 'Salario', 'ingreso'],
    ['SIRENA', 'Supermercado'], ['NACIONAL', 'Supermercado'], ['JUMBO', 'Supermercado'], ['BRAVO', 'Supermercado'], ['PLAZA LAMA', 'Supermercado'], ['OLE', 'Supermercado'], ['PRICESMART', 'Supermercado'],
    ['COLMADO', 'Colmado'],
    ['EDESUR', 'Luz'], ['EDENORTE', 'Luz'], ['EDEESTE', 'Luz'],
    ['CAASD', 'Agua'], ['CORAASAN', 'Agua'],
    ['CLARO', 'Internet y teléfono'], ['ALTICE', 'Internet y teléfono'], ['VIVA', 'Internet y teléfono'],
    ['SHELL', 'Combustible'], ['TEXACO', 'Combustible'], ['ESSO', 'Combustible'], ['SUNIX', 'Combustible'], ['TOTALENERGIES', 'Combustible'], ['ISLA', 'Combustible'],
    ['UBER EATS', 'Restaurantes y delivery'], ['PEDIDOSYA', 'Restaurantes y delivery'], ['PEDIDOS YA', 'Restaurantes y delivery'],
    ['UBER', 'Transporte'], ['INDRIVE', 'Transporte'], ['DIDI', 'Transporte'], ['PEAJE', 'Transporte'], ['PASO RAPIDO', 'Transporte'],
    ['FARMACIA', 'Salud'], ['CAROL', 'Salud'], ['GBC', 'Salud'], ['LOS HIDALGOS', 'Salud'], ['LABORATORIO', 'Salud'], ['CLINICA', 'Salud'],
    ['NETFLIX', 'Suscripciones'], ['SPOTIFY', 'Suscripciones'], ['DISNEY', 'Suscripciones'], ['HBO', 'Suscripciones'], ['APPLE COM', 'Suscripciones'], ['GOOGLE', 'Suscripciones'], ['YOUTUBE', 'Suscripciones'], ['CHATGPT', 'Suscripciones'], ['CLAUDE', 'Suscripciones'],
    ['COMISION', 'Comisiones bancarias'], ['CARGO POR', 'Comisiones bancarias'], ['MANEJO DE CUENTA', 'Comisiones bancarias'], ['ANUALIDAD', 'Comisiones bancarias'],
    ['INTERES', 'Intereses pagados', 'gasto'], ['INTERESES GANADOS', 'Intereses ganados', 'ingreso'],
    ['UNIVERSIDAD', 'Educación'], ['COLEGIO', 'Educación'], ['UNICARIBE', 'Educación'], ['ITLA', 'Educación'],
    ['CINE', 'Entretenimiento'], ['CARIBBEAN CINEMAS', 'Entretenimiento'], ['SMART FIT', 'Entretenimiento'], ['GYM', 'Entretenimiento'], ['TRAMPOLINE', 'Entretenimiento'],
    ['KFC', 'Restaurantes y delivery'], ['MCDONALD', 'Restaurantes y delivery'], ['BURGER KING', 'Restaurantes y delivery'], ['PIZZA', 'Restaurantes y delivery'], ['HELADOS', 'Restaurantes y delivery'], ['RESTAURANT', 'Restaurantes y delivery'], ['CAFE', 'Restaurantes y delivery'], ['STARBUCKS', 'Restaurantes y delivery'],
    ['PAPELERIA', 'Educación'], ['LIBRERIA', 'Educación'], ['EDEESTE WB', 'Luz'], ['HIPER OLE', 'Supermercado'], ['ZARA', 'Ropa y cuidado personal'], ['BELLEZA', 'Ropa y cuidado personal'],
    ['FERRETERIA', 'Hogar'], ['IKEA', 'Hogar'], ['CASA CUESTA', 'Hogar']
  ];

  const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function blank() {
    return {
      schema: SCHEMA, creado: today(), moneda: 'DOP',
      cuentas: [], movs: [], categorias: CATEGORIAS.map(([n, g]) => ({ nombre: n, grupo: g, presupuesto: 0 })),
      reglas: REGLAS.map(([p, c, s]) => ({ id: uid('r'), patron: p, categoria: c, origen: 'sistema', signo: s || null })),
      recurrentes: [], metas: [], fx: [],
      plan: { estrategia: 'avalancha', extraMensual: 0, extraDesde: null, eventos: [], orden: [] },
      auditoria: [], ultimoRespaldo: null
    };
  }

  /** Datos iniciales con la información que Oliver dio en la conversación (editable en la app). */
  function seed() {
    const s = blank();
    const hoy = '2026-10-16';
    s.cuentas = [
      { id: 'ahorro', nombre: 'Ahorros', tipo: 'ahorro', institucion: '', titular: 'Oliver', moneda: 'DOP', saldo: 700000, fechaSaldo: hoy, origen: 'manual', valoracion: 'manual' },
      { id: 'apap', nombre: 'Tarjeta APAP Más Límite', tipo: 'tarjeta', institucion: 'APAP', titular: 'Oliver', moneda: 'DOP', saldo: 12594193, fechaSaldo: hoy, origen: 'manual',
        limite: 13000000, tasa: 0.32, tasaEstimada: true, tipoTasa: 'no_confirmada', pagoMinimo: 472465, diaCorte: 11, diaPago: 2, saldoCorte: 12594193, pagoTotal: false },
      { id: 'isi', nombre: 'Tarjeta ISI', tipo: 'tarjeta', institucion: 'Banco Popular', titular: 'Oliver', moneda: 'DOP', saldo: 3609684, fechaSaldo: hoy, origen: 'manual',
        limite: 8000000, tasa: null, tipoTasa: 'no_confirmada', pagoMinimo: 0, diaPago: 26, pagoTotal: true },
      { id: 'p2495', nombre: 'Préstamo 24.95%', tipo: 'prestamo', institucion: 'Banco Popular', titular: 'Oliver', moneda: 'DOP', saldo: 7247131, fechaSaldo: hoy, origen: 'manual',
        tasa: 0.2495, tipoTasa: 'no_confirmada', cuota: 240461, diaPago: 10, vencimiento: '2030-10-09' },
      { id: 'p185', nombre: 'Préstamo 18.5% variable', tipo: 'prestamo', institucion: '', titular: 'Oliver', moneda: 'DOP', saldo: 28600000, fechaSaldo: hoy, origen: 'manual',
        tasa: 0.185, tipoTasa: 'variable', cuota: 836800, fechaDesembolso: '2026-07-01', montoOriginal: 30600000 }
    ];
    s.recurrentes = [
      { id: uid('rc'), nombre: 'Salario neto', tipo: 'ingreso', monto: 6700000, frecuencia: 'mensual', dia: 29, certeza: 'fija', categoria: 'Salario', activo: true },
      { id: uid('rc'), nombre: 'Gastos fijos del hogar', tipo: 'gasto', monto: 1993200, frecuencia: 'mensual', dia: 1, certeza: 'fija', categoria: 'Vivienda', activo: true },
      { id: uid('rc'), nombre: 'Regalía (estimada)', tipo: 'ingreso', monto: 6700000, frecuencia: 'anual', mes: 12, dia: 20, certeza: 'incierto', categoria: 'Otros ingresos', activo: true }
    ];
    s.metas = [{ id: uid('g'), nombre: 'Fondo de emergencia', tipo: 'emergencia', objetivo: 10000000, cuenta: 'ahorro', actual: 0, fecha: '2027-12-31' }];
    s.plan = { estrategia: 'avalancha', extraMensual: 2650000, extraDesde: null, eventos: [], orden: [] };
    s.auditoria = [{ ts: Date.now(), accion: 'crear', detalle: 'Datos iniciales cargados desde tu plan de deudas' }];
    return s;
  }

  function migrate(d) {
    if (!d || typeof d !== 'object') return null;
    d.schema = d.schema || 1;
    const b = blank();
    for (const k of Object.keys(b)) if (d[k] === undefined) d[k] = b[k];
    d.plan = Object.assign(b.plan, d.plan || {});
    // agrega reglas generales nuevas de versiones posteriores sin tocar las del usuario
    const have = new Set(d.reglas.filter(r => r.origen !== 'usuario').map(r => r.patron));
    REGLAS.forEach(([p, c, s]) => { if (!have.has(p)) d.reglas.push({ id: uid('r'), patron: p, categoria: c, origen: 'sistema', signo: s || null }); });
    return d;
  }

  const Store = {
    data: null,
    ok: true,
    load() {
      let d = null;
      try { const raw = localStorage.getItem(KEY); if (raw) d = JSON.parse(raw); } catch (e) { this.ok = false; }
      this.data = migrate(d) || seed();
      if (!d) this.save();
      try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
      return this.data;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); this.ok = true; } catch (e) { this.ok = false; }
      return this.ok;
    },
    log(accion, detalle) {
      this.data.auditoria.unshift({ ts: Date.now(), accion, detalle });
      if (this.data.auditoria.length > 400) this.data.auditoria.length = 400;
    },
    replace(d) { const m = migrate(d); if (!m || !Array.isArray(m.cuentas) || !Array.isArray(m.movs)) throw new Error('formato'); this.data = m; this.log('restaurar', 'Respaldo restaurado'); this.save(); },
    reset(withSeed) { this.data = withSeed ? seed() : blank(); this.log('borrar', withSeed ? 'Datos reiniciados al plan inicial' : 'Datos borrados'); this.save(); },
    uid, today
  };
  root.CuadreStore = Store;
})(typeof self !== 'undefined' ? self : this);
