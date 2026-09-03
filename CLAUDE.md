# monitoreo-planta

App de monitoreo de condición de activos de planta. CRA + React 18, sin
backend conectado: los datos viven en `localStorage` (`src/analista/store.js`,
clave `condicion-activos-analista-v6`) y se siembran desde `src/analista/mockData.js`.
Hay un `server/` con Prisma, todavía no enchufado. Se publica con `npm run deploy`
(gh-pages).

Este archivo junta lo que cuesta re-descubrir: invariantes que se rompen en
silencio, vocabulario compartido y cómo verificar. **No es una bitácora** —
si algo de acá dejó de ser cierto, corregilo o borralo; un archivo de reglas
desactualizado miente con confianza.

## Cómo verificar

```bash
CI=true npm run build     # OJO: con CI=true los warnings son errores
CI=true npx react-scripts test --watchAll=false
npm start                 # http://localhost:3000
```

Un import sin usar rompe el build en CI. Conviene correr el build antes de dar
algo por terminado.

## Estructura

```
src/analista/store.js        estado (useAnalistaData) y persistencia. SOLO estado.
src/analista/severidad.js    modelo de severidad — fijo, no configurable
src/gerencia/layout/         geometría pura de acomodado (sin React, testeable)
  grilla.js                    escalas, geometría de grilla, búsqueda de ancho
  skyline.js                   UNA implementación del empaquetado
  compactado.js                el compactado de producción
  ensayo.js                    métodos alternativos que se comparan en pantalla
src/gerencia/iconos.js       resuelve íconos de fábrica y personalizados
src/gerencia/puertos.js      puertos de conexión y ruteo de cañerías
src/components/gerencia/PortalSCADA.js   el lienzo (grande: ~1170 líneas)
scripts/medicion/            mediciones de layout con Playwright (ver su README)
```

La geometría **no va en `store.js`**. Si una pantalla necesita calcular un
layout, importa de `layout/`, no del módulo del hook.

## Vocabulario

Términos acordados con el usuario; conviene usarlos tal cual al conversar.

| Término | Qué es |
|---|---|
| **área** | agrupación de equipos dentro de una planta; se dibuja como cuadro punteado |
| **bloque** | el rectángulo que ocupa un área ya acomodada |
| **encuadre** | el ajuste del `viewBox` del SVG al panel real |
| **skyline** | perfil de altura ocupada por tramo de X; base del empaquetado |
| **borde inferior** | `y + alto` de un bloque |
| **contorno escalonado** | límite de área que sigue las celdas ocupadas, no un rectángulo |
| **lienzo vacío** | superficie del lienzo final que no es ícono |
| **desvío** | `abs(ln((ancho/alto) / proporción del panel))` — 0 es calce perfecto |
| **vista** | tanda de áreas que entra en una pantalla respetando el tamaño mínimo; el resto pasa a la siguiente |

## Invariantes

Cosas que se rompen sin avisar si no se saben.

- **`eq.posicion` es el CENTRO horizontal y el BORDE INFERIOR vertical** del
  ícono, no su centro geométrico. Los íconos altos (tanque, agitador: 90 de
  alto) se salen de cualquier caja calculada asumiendo centro.
- **Escala: el más específico gana.** `eq.escalaPropia` pisa a
  `data.escalasPorTipo[tipo]`, que pisa al 1 por defecto.
- **`escalaDeCatalogo` ≠ `escalaVisible`** (ambas en `layout/grilla.js`). El
  compactado usa `escalaDeCatalogo`, que **descarta** una `escalaPropia` que
  coincide con la marca `escalaAuto` — o sea, la que escribió el compactado
  anterior. Sin eso, cada compactada se apila sobre su propio resultado; de ahí
  salieron dos rondas de bugs de escala compuesta. Si el usuario cambia el
  tamaño a mano, las dos dejan de coincidir y se respeta su cambio.
- **`PAD_ZONA` y `ALTO_TITULO` de `layout/grilla.js` espejan `PAD_ZONA` y el
  alto del título de `PortalSCADA.js`.** Si cambian allá, hay que moverlos acá
  o el cuadro punteado queda mal calculado.
- **La caja de un área nunca se reserva de antemano.** La calcula
  `PortalSCADA.js` del bounding box de sus equipos. Por eso el empaquetado
  también tiene que reservar el ancho del TÍTULO cuando es mayor que el de la
  grilla: si no, dos áreas angostas vecinas se pisan los títulos.
- **Los colores de severidad son datos, no decoración** (`severidad.js`). El
  modelo es fijo y no configurable.

## Dos gramáticas visuales

La app tiene dos, a propósito. No mezclarlas.

- **ERP acero** (Analista, Administración): tokens de `src/theme/tokens.css`.
  Esquinas rectas, tarjetas como dibujos de línea sin relleno ni sombra, íconos
  de trazo fino (`stroke-width: 1.5`, `fill: none`). Sin color decorativo más
  allá del acero.
- **Portal SCADA**: gramática aparte, en `portalScada.css`. Fondo oscuro,
  equipos con volumen, títulos en magenta, tuberías cyan.

## Mediciones de referencia

El acomodado se verifica con números, no a ojo. Estas son las cifras al
2026-09-02, reproducibles con `scripts/medicion/` (ver su README). **Si
cambiás algo de `layout/`, corrélas y comparalas**: si se movieron, hay que
saber por qué.

Compactado (planta semilla): factor global 1.0, bomba renderizada a 75×94,
proporciones del catálogo intactas, idempotente en compactadas sucesivas.

Ensayo de layout, lienzo vacío | desvío | solape (escalonado con el mínimo
por defecto de 28 px; sus cifras son las de la vista activa, no las de la
planta entera):

| Planta | Actual (bloques) | Escalonado | Libre agrupado |
|---|---|---|---|
| Semilla (13 equipos) | 83.3% · 0.138 · 0% | 68.5% · 0.006 · 0% | 68.2% · 0.173 · 34.8% |
| Grande (43) | 87.9% · 0.254 · 0% | 79.6% · 0.071 · 0% | 70.4% · 0.013 · 14.5% |
| Demo (500 / 200 áreas) | 93.0% · 0.077 · 0% | 78.7% · 0.021 · 0% | 75.9% · 0.052 · 84.9% |

Todo lo de arriba está medido contra la pantalla de **referencia**
(1280×720). El ensayo permite elegir otra, y cambia bastante: la misma
planta demo a 28 px de mínimo necesita 4 vistas en la de referencia, 3 en
un notebook de 1440×900, y 2 en un ultrawide de 2560×1080 —donde entran
468 de los 500 equipos en la primera—. Para comparar métodos entre sí hay
que dejar la pantalla fija.

Reparto en vistas de la planta demo (pantalla de referencia): 4 vistas a
28 px de mínimo, 10 a 48 px.

## Trampas ya pisadas

- **Crecer la escala no agranda nada en pantalla.** El encuadre escala el
  contenido para llenar el panel, así que si todo crece, la cámara se aleja y el
  producto queda igual. Lo único que mueve el tamaño en pantalla es la cantidad
  de equipos y la densidad (cuánto del layout es ícono y cuánto es aire). Por
  eso un tamaño mínimo legible no es una preferencia: define cuántos equipos
  entran, y si no entran la única salida es repartirlos en varias vistas.
- **Las vistas salen desparejas en cantidad de equipos, y está bien.** Se
  equilibran por pantalla ocupada, no por cuenta: un tanque tiene celda alta
  (122 px contra 58 de un motor) y en un flujo por filas una celda alta
  estira toda su fila, así que un tramo denso en tanques empaqueta con menos
  densidad y llena la pantalla con menos equipos. En la planta demo el
  reparto da 183 / 84 / 191 / 42. Forzar un reparto parejo lo empeora: se
  probó y dio 5 vistas en vez de 4, con más desbalance (razón 5.92 contra
  4.55).
- **No alcanza con la proporción de la pantalla: también importa su área.**
  Un ultrawide de 2560×1080 tiene tres veces el área de un 1280×720 y se
  lleva casi toda la planta demo en una vista. Pero la proporción pesa
  aparte: a igual área en píxeles, una pantalla vertical de 1080×1920 se
  llevó 12% más equipos que un monitor de 1920×1080.
- **Muestrear más fino la búsqueda de ancho no sirve.** La cantidad de columnas
  es un entero, así que los layouts alcanzables son un conjunto discreto y
  saltan de a escalones grandes. Medido: se salta de una proporción de 1.46 a
  una de 2.03 sin nada en el medio.
- **Ordenar por área no agrupa por área.** En un empaquetado por skyline, ordenar
  deja a los equipos consecutivos en el ORDEN, pero cada uno se ubica donde el
  perfil esté más bajo. Con pocas áreas grandes coincide por accidente; con
  muchas áreas chicas se dispersan del todo.
- **Al medir superficies pisadas, medir la UNIÓN y no la suma de los pares.**
  Sumar pares cuenta la misma superficie una vez por cada par que la comparte:
  con 200 áreas daba 2315% de un lienzo.
