# Cuadre — arquitectura (versión 1)

## Qué es
App de finanzas personales para República Dominicana que se instala desde el navegador en Android o iPhone. Funciona sin conexión y guarda los datos solo en el teléfono.

## Piezas

| Archivo | Responsabilidad |
|---|---|
| `engine.js` | **Motor financiero.** Funciones puras, sin interfaz ni almacenamiento. Dinero, fechas, CSV, movimientos, cuentas, deudas, tarjetas, presupuesto, flujo y metas. Corre en el navegador y en Node. |
| `store.js` | Esquema de datos, migraciones, auditoría, datos iniciales, respaldo y restauración. |
| `app.js` | Interfaz: muestra datos, captura entradas y llama al motor. No hace cálculos financieros propios. |
| `sw.js` + `manifest.webmanifest` | Instalación y funcionamiento sin conexión. |
| `tests/engine.test.js` | 48 pruebas del motor (`node tests/engine.test.js`). |

## Reglas del motor
- **Dinero en centavos enteros.** Nada de decimales flotantes en saldos.
- **Interés mensual** = saldo × tasa anual ÷ 12, redondeado al centavo (mitad lejos de cero) en cada período.
- **Deudas:** en cada mes se cobran el interés y los cargos, se pagan las cuotas mínimas, y lo que sobra (pago extra + cuotas liberadas de deudas saldadas + pagos extraordinarios) se abona según la estrategia:
  - *Avalancha:* mayor tasa primero.
  - *Bola de nieve:* menor saldo primero.
  - *Híbrida:* primero las deudas que se pueden saldar con ≤ 3 meses de pago extra; luego avalancha.
  - *Personalizada:* el orden que elige el usuario.
- **Penalidad por abono `p`:** pagar `X` reduce el saldo en `X / (1 + p)`; la diferencia se suma al costo.
- **Tasa variable:** escenarios de ±2 y +4 puntos sobre las deudas marcadas como variables.
- **Consolidación:** reemplaza las deudas elegidas por un préstamo francés y compara el costo total con el **mismo pago mensual total**.
- **Optimizador:** búsqueda binaria del pago extra mínimo para saldar una deuda antes de una fecha.
- **Tarjetas:** compara pagar el total, un monto intermedio y el mínimo actual. Se marca como estimado, porque cada emisor calcula distinto.
- **Movimientos:**
  - Duplicados por huella (cuenta, fecha, monto, descripción normalizada) o por ID de origen.
  - "Parecidos": mismo monto, ±2 días y descripción similar.
  - Categorías en este orden de prioridad: regla del usuario (0.95), historial del usuario (0.85), regla general (0.70).
  - Las transferencias entre cuentas propias y los pagos de deudas se emparejan (mismo monto opuesto, ±3 días) y **no cuentan como gasto ni como ingreso**.
- **Patrimonio:** activos − pasivos. Las monedas sin tasa registrada se excluyen y se avisa. Las tasas siempre llevan fecha y fuente; la app no las inventa ni las busca sola.
- **Flujo de efectivo a 30/60/90 días:**
  - *Conservador:* ingresos variables al mínimo, sin ingresos inciertos.
  - *Central:* ingresos variables al valor normal, sin inciertos.
  - *Optimista:* ingresos variables al máximo, con inciertos.

## Lo que no hace esta versión (y por qué)
- **Conexión bancaria automática.** No hay un agregador con cobertura comprobada para bancos dominicanos que se pueda usar sin servidor. La alternativa es importar CSV/Excel y el registro rápido.
- **Leer notificaciones del banco.** Solo es posible con una app nativa de Android (NotificationListenerService). iOS no lo permite. Queda para la versión nativa.
- **PDF:** se lee en el teléfono con pdf.js (carga una vez desde cdnjs y queda guardado). Agrupa el texto por renglones, detecta fecha, descripción y columnas de montos por su alineación a la derecha. Acepta PDFs con contraseña; la contraseña no se guarda. No lee PDFs escaneados. Formato verificado: estado de tarjeta del Banco Popular (dos fechas sin año, referencia, código de comercio en segunda línea, créditos con signo −). El número de referencia se usa para no repetir movimientos entre estados.
- **OFX.** Pendiente.
- **Sincronización entre dispositivos.** Pendiente; requiere servidor (ver ADR 0001). Hoy se usa el respaldo JSON.
- **Asistente con IA.** Pendiente. Cuando exista, explicará los resultados del motor y no calculará cifras.

## Camino a la versión nativa
`engine.js` no depende del navegador. Se puede importar tal cual en React Native/Expo, y `store.js` se reemplazaría por SQLite o Supabase con el mismo esquema.
