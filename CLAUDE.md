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
src/components/gerencia/EditorPlanta.js    donde se arma la planta
src/components/gerencia/VistaOperacion.js  la misma vista, solo lectura
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

- **Editor de planta** — donde se arma. Dibuja con el escalonado y el mismo
  reparto en vistas que operación, así se edita viendo el resultado. Tiene el
  panel de comparación de métodos, los sliders de tamaño legible, el selector
  de pantalla, las cañerías y las métricas.
- **Vista de operación** — VIGILANCIA de condición, solo lectura. Lo mismo,
  sin controles.

**Las posiciones NO son dato.** El escalonado las calcula en cada render
desde los tipos y las áreas. Lo que se autora son las ENTRADAS del layout:
conexiones, tamaños, el mínimo legible que decide cuántas vistas hacen falta,
y el orden de las áreas. Arrastrar un equipo deja un **override**
(`eq.posicionPropia`) sobre el cálculo, igual que `escalaPropia` pisa a la
escala del tipo; "Restablecer posiciones" los borra.

Por eso se retiró el Portal SCADA, que editaba `eq.posicion`, y con él
`compactarPlanta` y `acomodarEnFlujo`, que existían para escribirla. Mantener
dos modelos de posición en paralelo fue el origen de casi todas las
confusiones de esta parte.

Del Portal se conservan sus herramientas de autoría, ya migradas: arrastre de
equipos, **quiebres manuales de cañería** (el tirador redondo sobre cada
trazo; doble clic lo suelta), títulos de área movibles, zoom, renombrar y
duplicar equipos, y el botón que genera la planta de prueba de 500 equipos
—que se había quedado sin pantalla al retirar el Portal, y es el caso con el
que se mide todo—.

El **tamaño mínimo/máximo de ícono se comparte** entre las dos (vive en
`preferencias.js`). El **selector de pantalla NO**, y no debe: operación
tiene que usar el panel donde realmente dibuja. Por eso las dos solo
coinciden con "Panel real de esta ventana" elegido en el editor, y por eso
los dos paneles laterales miden lo mismo (300 px).

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

Ruteo de cañerías de la planta demo (470 conexiones, los tres métodos), de
clic en "Cañerías" a tabla completa: **0,6 s**. Si eso se va a varios
segundos, algo volvió a comparar de más — el perfil por etapas está en las
trampas de más abajo.

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

- **Un total no compara métodos que no procesan lo mismo.** El editor mide
  largo de cañería y cruces por método, pero el escalonado rutea solo las
  conexiones de la VISTA activa (173 en la planta demo, pantalla de
  referencia) y el compactado las de toda la planta (470). En totales el
  escalonado parece usar casi la mitad de cañería (≈38.600 contra ≈72.400),
  y es un espejismo: por conexión son 223 contra 154, o sea 45% MÁS. Los
  cruces van en la misma dirección: 1.86 por conexión contra 0.19. Las dos
  columnas van normalizadas por conexión, y las cifras dependen de la
  pantalla elegida —cambia el reparto en vistas y con él qué conexiones se
  rutean—, así que para comparar hay que dejarla fija.

- **El escalonado solo es legible con contorno escalonado.** Sus áreas se
  entrelazan por construcción, así que dibujarlas como rectángulo —lo que
  hace el Portal, desde el bounding box de sus equipos— las superpone. Al
  traer el escalonado al Portal, los 4 títulos de la planta semilla se
  dibujaban uno encima de otro. Los títulos ahora se esquivan (bajan hasta
  encontrar lugar, salvo los movidos a mano), pero los cuadros siguen
  superponiéndose: es inherente, no un bug a cazar.

- **Al medir superficies pisadas, medir la UNIÓN y no la suma de los pares.**
  Sumar pares cuenta la misma superficie una vez por cada par que la comparte:
  con 200 áreas daba 2315% de un lienzo.

- **Una búsqueda de desvío sin límites se va de la pantalla.** Cuando el
  trazo por defecto atraviesa un equipo, `buscarQuiebreLibre` (`puertos.js`)
  busca en espiral un quiebre que lo esquive. Sin acotarla, en la planta
  semilla la conexión `con1` esquivaba por un punto **108 unidades arriba
  del borde**: la cañería salía del lienzo y volvía, y su tirador de quiebre
  quedaba donde nadie lo podía agarrar. Ahora los candidatos se descartan
  fuera del lienzo (que es el bounding box de lo dibujado, así que sale de
  las mismas cajas de equipo). Un trazo que roza un ícono adentro es mejor
  que uno impecable que se va afuera. Medido en la semilla, revirtiendo solo
  `puertos.js` y `ensayo.js`: 259 → 177 de cañería por conexión en el
  escalonado (−32%), con los mismos cruces. En la demo casi no se nota (223
  antes y después): ahí el lienzo es tan grande que la espiral rara vez se
  le escapa; el problema aparece en lienzos chicos.

- **Una espiral que barre dx y después dy siempre devuelve la esquina.** La
  misma búsqueda probaba los candidatos en el orden del barrido, así que de
  cada anillo devolvía la esquina superior izquierda: la más lejana del
  anillo (√2 veces el radio) y, encima, un sesgo sistemático de todos los
  desvíos hacia arriba y a la izquierda. Los candidatos de cada anillo se
  ordenan ahora por distancia real al punto de partida.

- **La espiral de ruteo casi nunca encuentra salida, y ese es el caso a
  optimizar.** Medido en la planta demo: de las conexiones cuyo trazo por
  defecto choca, esquivan **7 de 169** (compactado), **0 de 60**
  (escalonado) y **3 de 420** (libre). El resto se rinde y se queda con el
  trazo por defecto. No es un bug: mover UN quiebre no puede despejar una
  ruta larga que cruza varias áreas llenas; la búsqueda está pensada para
  "un equipo de por medio", como dice su propio comentario. Lo que importa
  es que el fracaso salga barato, porque es el caso normal: antes cada
  fracaso probaba los 1.680 candidatos del radio 400 para terminar sin
  nada. Los desvíos que sí salen están todos dentro de 160, así que el
  radio se bajó a 200 — verificado ruta por ruta: las 1.113 rutas de la
  demo salen **idénticas** con 200 y con 400, mismo largo y mismos cruces.

- **Preguntar "¿choca?" contra las 500 cajas es el 86% del ruteo.** Con la
  espiral probando cientos de candidatos, cada uno con 6 tramos, la
  comparación una-por-una llegaba a millones de pruebas por conexión. La
  respuesta es un índice espacial (`indiceDeObstaculos` en `puertos.js`):
  celdas del tamaño típico de un equipo, cada caja guardada ya ensanchada
  por el margen, y como los tramos son ortogonales las celdas que cruza un
  tramo son un rectángulo de la grilla. Se arma UNA vez por método, no por
  conexión. Y los equipos de los extremos se saltean por id en la consulta:
  antes se armaba un array filtrado por conexión, o sea 470 copias de 500
  cajas por método.

- **Los cruces no necesitan mirar todos los pares.** Eran 3,2 millones de
  pares y 1,5 s por método. Dos hechos lo vuelven casi lineal sin cambiar un
  resultado: todos los tramos son ortogonales y, con el test de orientación
  que se usaba, dos tramos PARALELOS nunca cuentan como cruce (los signos
  empatan; colineales dan 0 y 0), así que solo hay que mirar los pares
  horizontal × vertical; y para ese par el test se reduce a que se toquen
  los rangos. Con las verticales ordenadas por x, cada horizontal mira solo
  su franja. 1,5 s → 5 ms, con los conteos intactos (90 / 321 / 911 en la
  demo). Los dos atajos están atados a su versión ingenua por tests: si
  alguien los cambia y dejan de coincidir, saltan.

- **Un `waitForTimeout` fijo no es una medición.** El primer número que se
  anotó del ruteo —161 s— era el tiempo que el script de Playwright esperaba
  a propósito, no lo que tardaba la app (eran 10,2 s). Para medir hay que
  esperar a que aparezca el RESULTADO (`waitForFunction` sobre la tabla), no
  dejar pasar un rato largo y leer el reloj.
