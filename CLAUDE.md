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
src/analista/preferencias.js preferencias de quien mira (planta elegida,
                             tamaño de ícono), en su propia clave
src/analista/severidad.js    modelo de severidad — fijo, no configurable
src/gerencia/layout/         geometría pura de acomodado (sin React, testeable)
  grilla.js                    escalas, geometría de grilla, búsqueda de ancho
  skyline.js                   UNA implementación del empaquetado
  compactado.js                el compactado de producción (bloques por área)
  escalonado.js                el layout escalonado y su reparto en vistas
  ensayo.js                    métodos alternativos que se comparan en pantalla
src/gerencia/iconos.js       resuelve íconos de fábrica y personalizados
src/gerencia/puertos.js      puertos de conexión y ruteo de cañerías
src/components/gerencia/PortalSCADA.js     el lienzo editable (~1170 líneas)
src/components/gerencia/VistaOperacion.js  la pantalla de solo lectura
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
- **La escala son DOS capas que se multiplican, no una.** El tamaño elegido
  (`eq.escalaPropia` pisa a `data.escalasPorTipo[tipo]`, que pisa al 1 por
  defecto — el más específico gana) por el factor que puso la app
  (`eq.factorAuto`, o 1). `escalaVisible` en `gerencia/iconos.js` es la única
  que las junta.
- **`escalaDeCatalogo` ≠ `escalaVisible`.** El compactado parte de
  `escalaDeCatalogo` (`layout/grilla.js`), que es solo la capa elegida:
  **ignora `factorAuto`**. Sin eso cada compactada se apila sobre su propio
  resultado — de ahí salieron dos rondas de bugs de escala compuesta — y
  bastaría un equipo cerca del tope de 4 para que nada pudiera volver a
  crecer. El compactado **no escribe `escalaPropia`**: escribe su factor en
  `factorAuto` y deja el tamaño elegido intacto, así el panel "Tamaños de
  equipo" sigue mandando sobre una planta ya compactada. La única excepción
  es un `escalaPropia` por encima de `ESCALA_MAX`, que lo acota al tope
  porque el layout ya lo acotó.
- **`PAD_ZONA` y `ALTO_TITULO` de `layout/grilla.js` espejan `PAD_ZONA` y el
  alto del título de `PortalSCADA.js`.** Si cambian allá, hay que moverlos acá
  o el cuadro punteado queda mal calculado.
- **La caja de un área nunca se reserva de antemano.** La calcula
  `PortalSCADA.js` del bounding box de sus equipos. Por eso el empaquetado
  también tiene que reservar el ancho del TÍTULO cuando es mayor que el de la
  grilla: si no, dos áreas angostas vecinas se pisan los títulos.
- **Los colores de severidad son datos, no decoración** (`severidad.js`). El
  modelo es fijo y no configurable.

## Dos pantallas de planta, a propósito

- **Portal SCADA** — el diagrama de PROCESO. Dibuja las posiciones guardadas
  (`eq.posicion`, puestas a mano o por el compactado de bloques), con las
  cañerías ruteadas y esquivando equipos. Es donde se edita.
- **Vista de operación** — VIGILANCIA de condición, solo lectura. Recalcula
  el layout escalonado en cada render y lo pagina en vistas, así que no
  depende de que alguien haya compactado. **No dibuja cañerías**, y no es un
  olvido: el escalonado reacomoda los equipos ignorando el proceso para
  meter la mayor cantidad legible por pantalla, y encima de ese orden las
  conexiones saldrían como un ovillo.

Son complementarias, no una el reemplazo de la otra. Compactar en el Portal
nunca va a dar el resultado de la Vista de operación: son dos algoritmos.

El **tamaño mínimo/máximo de ícono se comparte** entre las dos (vive en
`preferencias.js`): se ajusta con los sliders del ensayo y la Vista de
operación lo aplica. Es una decisión sobre qué es legible, no un parámetro
de laboratorio. El **selector de pantalla NO se comparte**, y no debe: la
Vista de operación tiene que usar el panel donde realmente dibuja.

Por eso el ensayo y la Vista de operación **solo coinciden con "Panel real de
esta ventana" elegido en el ensayo** — con una pantalla simulada dan repartos
distintos, y eso es lo correcto: el reparto depende del panel. Por eso los
dos paneles laterales miden lo mismo (300 px): con anchos distintos el
lienzo cambia y el reparto deja de coincidir aunque el método sea el mismo.

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
- **Todas las vistas de una planta se dibujan a la MISMA escala.** Cada
  vista tiene su propio lienzo, así que si cada una se encuadrara por su
  cuenta, una vista menos llena se dibujaría más acercada y el mismo motor
  saldría más grande — medido: 39 px en la vista 1 contra 105 en la 4, casi
  el triple. Para un operador que cambia de vista, el mismo equipo tiene
  que verse igual; una vista menos llena debe quedar con aire, no
  agrandada. Por eso se usa el lienzo más grande de todas, y el mínimo
  legible se mide contra el ícono más chico de TODA la planta y no el de
  cada vista.
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
- **Dos datos con dueños distintos van en claves distintas.** La planta que
  se está mirando no es dato de planta: es "en qué estaba" quien mira. Vive
  en `preferencias.js`, con su propia clave, así restablecer los datos de
  prueba no se la lleva puesta. Y se comparte desde `App.js`, no por
  pantalla: el render condicional desmonta la pantalla al cambiar de
  pestaña, así que una variable local se perdía y se volvía siempre a
  `plantas[0]` —la semilla—, nunca a la planta que se estaba mirando.

- **Dos conversiones para el mismo tipo de punto se separan y una queda
  mal.** En `puertos.js` convivían `puntoAbsoluto` (puertos declarados) y
  `aAbsoluto` (extremos arrastrados a mano). Los dos proyectan coordenadas
  crudas del ícono al lienzo, pero solo `aAbsoluto` anclaba donde ancla el
  dibujo; el otro sumaba además `bordeInferior` sin escalar y bajaba cada
  cañería ese tanto. En la planta semilla solo 2 de 6 extremos tocaban su
  equipo —la de B-101 arrancaba 16 px por debajo de la bomba, a la altura
  del TAG— y en la demo de 500 las cañerías atravesaban los 60 TAGs de un
  sector. Ahora `puntoAbsoluto` delega en `aAbsoluto`: una sola conversión.
  De paso se borró `bordeInferior`, que ya no lo leía nadie y sugería un
  anclaje configurable que nunca existió.

- **Un `ref` que nunca se conecta no da error: se degrada en silencio.** En
  el ensayo, `svgRef` estaba declarado y leído en el efecto de medición pero
  nunca puesto en el `<svg>`. `panelReal` quedaba siempre en null y la
  opción "Panel real de esta ventana" caía al 1280×720 de referencia sin
  decir nada: se elegía y el resultado no cambiaba. Se notó recién al
  comparar su reparto contra el de la Vista de operación —4 vistas contra
  3— y pedir que coincidieran.

- **Un parámetro de DIBUJO no puede decidir la paginación.** El máximo de
  tamaño de ícono topa el zoom, y ese zoom alimentaba la prueba del mínimo
  que decide cuántas áreas entran por vista. Con el tipo tanque agrandado a
  3× y un mínimo de 35 px, el tope de 180 px llevaba la planta demo de 19
  vistas a 54, casi todas de una sola área con tres equipos. La prueba usa
  ahora `minPxParaCaber` (el tamaño SIN topar) y el tope se aplica solo al
  dibujar. Con eso el reparto da igual con el máximo en 180 que en 400,
  que es la propiedad que hay que sostener.

- **Una bisección sobre un criterio inalcanzable devuelve el PEOR
  resultado, no ninguno.** Si el mínimo no se cumple ni con un área sola, no
  se cumple con ninguna cantidad —agregar áreas solo aleja la cámara— pero
  la búsqueda terminaba igual en `corte = 1` y escupía una vista por área.
  Hay que detectar el caso antes de buscar: si `entra(1)` falla, partir no
  gana nada; entra todo en una vista y se dice que ese mínimo no es
  alcanzable en esa pantalla.

- **Guardar el resultado de un cálculo donde va una preferencia la deja
  muda.** El compactado escribía su resultado dentro de `escalaPropia`, el
  mismo campo del tamaño puesto a mano. Como ese campo le gana al del tipo,
  toda planta compactada quedaba sorda al panel "Tamaños de equipo": se
  podía bajar "tanque" a la mitad y no pasaba nada, sin ningún error a la
  vista. Se intentó distinguir los dos casos con una marca (`escalaAuto`) y
  una comparación con tolerancia, pero eso solo hacía que el compactado se
  ignorara a sí mismo: no devolvía el control del tamaño. La salida fue
  separar los campos y multiplicarlos. Si un valor lo escriben dos autores
  con intenciones distintas, van dos campos.

- **Un total no compara métodos que no procesan lo mismo.** El ensayo mide
  ahora largo de cañería y cruces por método, pero el escalonado rutea solo
  las conexiones de la VISTA activa (188) y el compactado las de toda la
  planta (470). En totales el escalonado parecía usar 61% menos cañería
  (28.010 contra 72.695) — un espejismo: por conexión son 149 contra 155,
  prácticamente iguales. Lo que sí cambia de verdad son los cruces: 1.04 por
  conexión contra 0.21. Las dos columnas van normalizadas por conexión.

- **Al medir superficies pisadas, medir la UNIÓN y no la suma de los pares.**
  Sumar pares cuenta la misma superficie una vez por cada par que la comparte:
  con 200 áreas daba 2315% de un lienzo.
