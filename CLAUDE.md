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
                             tamaño de ícono POR PLANTA), en su propia clave
src/analista/severidad.js    modelo de severidad — fijo, no configurable
src/gerencia/layout/         geometría pura de acomodado (sin React, testeable)
  grilla.js                    escalas, geometría de grilla, búsqueda de ancho
  skyline.js                   UNA implementación del empaquetado
  compactado.js                el compactado de producción (bloques por área)
  escalonado.js                el layout escalonado y su reparto en vistas
  overrides.js                 la posición puesta a mano que pisa a la calculada
  ensayo.js                    métodos alternativos que se comparan en pantalla,
                               más la geometría de cañerías que comparten el
                               editor y operación (métricas y conectores de salida)
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
  sin controles, y con las **cañerías apagadas por defecto**: acá se viene a
  mirar condición, y sobre el escalonado las conexiones se cruzan mucho
  (1.86 por conexión contra 0.19 del compactado). Se prenden con un
  interruptor, persistido en `preferencias.js`. Antes no estaban y punto,
  con el argumento de que el diagrama de proceso era el Portal SCADA; el
  Portal se retiró y el editor dibuja las cañerías sobre ESTE MISMO layout,
  así que negarlas dejaba a dos pantallas del mismo acomodado mostrando
  cosas distintas. Que estén apagadas por defecto sigue siendo razonable;
  que no estuvieran, no.

**Lo que se edita en el editor tiene que verse en operación.** Es la promesa
de la pantalla y hay que revisarla cada vez que se agrega un dato editable.
Comprobado dato por dato: posición movida a mano, tamaño por tipo, nombre,
duplicados, quiebre a mano y extremos fijados llegan todos. Con la pantalla
de destino en "Panel real de esta ventana", los trazos de cañería salen
**idénticos** en las dos; con otra pantalla difieren, y eso es correcto —el
reparto depende del panel, no es dato perdido—.

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
equipos, títulos de área movibles, zoom, renombrar y duplicar equipos, y el
botón que genera la planta de prueba de 500 equipos —que se había quedado sin
pantalla al retirar el Portal, y es el caso con el que se mide todo—.

Edición de cañerías, toda sobre el tirador del codo:

| Gesto | Qué hace |
|---|---|
| arrastrar el codo | fija por dónde pasa (`quiebreManual`), y los puertos lo siguen |
| doble clic en el codo | lo suelta, vuelve al ruteo automático |
| **un clic** en el codo | **elige** la conexión |
| arrastrar un extremo (solo en la elegida) | fija por qué punto del perímetro sale (`puertoDe`/`puertoA`), pegado a la silueta real |
| doble clic en un extremo | lo suelta |
| clic en la × (solo en la elegida) | borra la conexión |

Las manijas de extremo se dibujan **solo para la conexión elegida**: con 173
cañerías en la vista de la demo, dos manijas por conexión taparían el dibujo.

**Con quiebre a mano, el puerto mira AL QUIEBRE y no al otro equipo.** El
primer tramo de la ruta va al quiebre, así que ese es el lado por el que
conviene salir: mirando al otro equipo, subir el codo dejaba la cañería
saliendo de costado y pegando el salto después. Mover el codo mueve entonces
también el punto donde la línea toca el equipo — medido en la semilla, de
`324,48` (el costado) a `342,2` (arriba) al llevar el codo por encima. Un
extremo fijado a mano no se toca: ahí ya mandó quien lo fijó.

Los arrastres de codo y de extremo **se ven mientras se arrastran**: la ruta
en vuelo se recalcula en cada movimiento. Es UNA ruta por cuadro y sin
esquivar obstáculos (con quiebre a mano el ruteo no los mira), así que sale
gratis al lado del re-render.

Una conexión con un extremo en OTRA vista se dibuja como **conector de salida**
de P&ID: un cabo corto que apunta afuera del dibujo, con el TAG del otro
extremo y a qué vista ir (un clic lleva). El cabo apunta al borde, no hacia
donde está el otro equipo: ese equipo vive en otro lienzo y su posición acá no
querría decir nada.
Elegida una conexión aparece además su **×** (la que tenían las líneas en el
Portal) y el panel lateral con lo mismo: borrar **una** conexión, que antes
solo se podía haciendo "borrar todas" las de un equipo. La × va solo en la
elegida y borra directo, sin confirmar: no es un clic al voleo sobre una
línea cualquiera, hubo que elegirla antes.

Al elegir el destino de una conexión nueva hay línea de previsualización
(`rutaHaciaPunto`), que sale del mismo puerto por el que saldrá la cañería
definitiva.

El **tamaño mínimo/máximo de ícono se comparte entre las dos pantallas**
(vive en `preferencias.js`) pero es **de cada planta**: el mínimo decide
cuántas vistas hacen falta, y eso depende de la planta —una de 500 equipos
no quiere el mismo mínimo que una de 13—. Compartido entre PANTALLAS, propio
de cada PLANTA. El **selector de pantalla NO se comparte**, y no debe:
operación tiene que usar el panel donde realmente dibuja. Por eso las dos
solo coinciden con "Panel real de esta ventana" elegido en el editor, y por
eso los dos paneles laterales miden lo mismo (300 px).

Los **multiplicadores de tamaño por tipo también son de cada planta**
(`data.escalasPorPlanta[plantaId]`). Todo el layout los lee de
`data.escalasPorTipo`, así que cada pantalla resuelve la tabla de su planta
una vez con `datosDePlanta(data, plantaId)` y trabaja con eso — así ninguna
función de geometría necesita saber qué planta es.

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

El compactado ya no se aplica con un botón —se retiró con el Portal, ver más
arriba—, así que no hay nada que medir de "compactar dos veces". Sigue vivo
como el método **Actual** de la tabla, y ahí es donde se lo compara.

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

Conexiones que CRUZAN de vista: 0 de 3 en la semilla, **3 de 470 (0.6%)** en
la demo a 28 px, 6 (1.3%) a 48 px. Son pocas porque el reparto nunca parte un
área entre vistas y la demo conecta con colectores DENTRO de cada área: solo
cruza lo que une áreas distintas. Una planta con un flujo de proceso que
atraviesa áreas daría muchas más, así que el número dice más de los datos que
del algoritmo.

Vista de operación con la planta demo: abre en **0,2 s** con las cañerías
apagadas, y prenderlas cuesta otros **0,2 s** (rutea solo la vista activa y
un solo método, contra los tres de la tabla del editor).

Ruteo de cañerías de la planta demo (470 conexiones, los tres métodos), de
clic en "Cañerías" a tabla completa: **0,6–0,7 s** según la corrida
(`canerias.js demo`). Si eso se va a varios segundos, algo volvió a comparar
de más — el perfil por etapas está en las trampas de más abajo. Por método,
cañería y cruces POR CONEXIÓN: 154 · 0.19 el compactado, 223 · 1.86 el
escalonado, 797 · 1.94 el libre.

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
  ahora `minPxParaCaber` (el tamaño SIN topar). Con eso el reparto da igual
  con el máximo en 180 que en 400, que es la propiedad que hay que sostener.

  **El tope tampoco se aplicaba al dibujar, y eso ya se corrigió.** Se dijo
  que sí lo hacía y no era cierto — medido en la planta semilla con la bomba
  en 3.50: con el máximo en 180, en 120 y en 60, se dibujaba siempre a 191 px.
  El editor y operación encuadran con el lienzo COMÚN a todas las vistas y el
  `zoom` del panel (la lupa), sin pasar por el `zoomTope` de `encuadrar` —que
  además se calculaba contra el ícono más grande DE LA VISTA, no de la
  planta, inconsistente con el criterio del mínimo—. El slider "Máximo" no
  hacía nada.

  Ahora sí topa: cada pantalla calcula su propio `altoIconoMaxPlanta` (el
  ícono más grande de TODA la planta, mismo criterio que el mínimo) y un
  `factorTope` que agranda el `viewBox` más allá del lienzo cuando el ícono
  más grande superaría el máximo — sobra lienzo vacío en vez de agrandarse,
  la misma idea que "una vista menos llena queda con aire, no agrandada".
  La lupa manual no se entera: sigue siendo la acción explícita de la
  persona, y el tope solo topa la cámara AUTOMÁTICA. Medido en la semilla con
  B-101: máximo 60 → 30 px, 120 → 60 px, 180 → 90 px (escala linealmente
  mientras el tope ata) y 400 → 118 px (deja de moverse: ahí ata el llenado
  del panel, no el máximo). Editor y Vista de operación dan el mismo
  resultado con el mismo panel y el mismo máximo — 17.3 px los dos, medido.

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
  entrelazan por construcción, así que dibujarlas como rectángulo —desde el
  bounding box de sus equipos— las superpone. Por eso el escalonado se dibuja
  con `contornosDeArea` en las dos pantallas y su solape medido es 0. Los
  otros dos métodos sí usan rectángulo, y ahí el solape es real y se mide
  (34.8% en el libre sobre la semilla, 84.9% sobre la demo): es inherente al
  método, no un bug a cazar.

  Los TÍTULOS son otra cosa y sí se arreglan: dos áreas vecinas comparten
  borde de arriba y sus títulos se dibujaban uno encima del otro —medido, 2
  de 4 pares en la semilla y 1 en la vista activa de la demo—. Se recorren de
  arriba hacia abajo y cada uno baja hasta encontrar lugar; uno movido a mano
  no se toca. Después del esquive: 0 pares en las dos plantas.

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

- **En SVG el orden de dibujo ES el orden de los clics, y eso ya mordió dos
  veces.** No hay `z-index`: lo que se dibuja después queda encima y se lleva
  el `mousedown`. Cada equipo tiene un rectángulo de clic TRANSPARENTE más
  grande que su ícono, así que cualquier cosa dibujada antes que los equipos
  y que caiga sobre uno deja de poder agarrarse, sin ningún error a la vista
  —solo un arrastre que no hace nada—. Pasó con los tiradores de quiebre y
  otra vez con los títulos de área, que al bajar para esquivarse caen sobre
  un ícono. Los dos van ahora DESPUÉS de los equipos. Regla: lo que se
  arrastra se dibuja al final.

- **Un elemento que se acomoda solo tiene que poder agarrarse donde SE VE.**
  El arrastre del título partía del ancla calculada (la esquina del área),
  no de donde el título había quedado después de esquivar: al primer clic
  saltaba hacia arriba el tamaño del esquive. El arrastre parte ahora de la
  posición dibujada (`base` en `titulosDeArea`), así que agarrarlo no lo
  mueve.

- **Un resultado intermedio no se guarda como si fuera dato.**
  `puntoPerimetroCercano` devolvía `{x, y, dir, dist}` —`dist` es de la
  búsqueda de `formas.js`, así elige el candidato más cercano— y el Portal
  guardaba ese objeto entero dentro de la conexión, contra lo que decía el
  comentario de la propia función. Queda un campo persistido que nadie lee y
  que el próximo que abra el JSON va a interpretar como parte del formato.
  Devuelve ahora solo `{x, y, dir}`; `puertoElegido` ignora los extras, así
  que los datos viejos siguen funcionando.

- **Seguir el puntero re-renderiza toda la planta.** La previsualización de
  conexión y los arrastres actualizan estado en cada `mousemove`, y eso
  reconcilia los 183 equipos de la vista: medido, 43 ms por cuadro en la
  demo. No es nuevo de la previsualización —arrastrar un equipo cuesta lo
  mismo— pero es el techo actual. La salida, cuando moleste, es memoizar la
  capa de equipos para que no dependa del estado que cambia por movimiento.

- **Un cartel que se sale del viewBox no se dibuja, y el aire del encuadre no
  alcanza.** Los conectores de salida nacen en el borde del dibujo por
  definición —son equipos pegados al límite—, así que el texto se iba afuera:
  medido, 4 de 6 invisibles en la planta demo, justo el mal que el conector
  viene a curar. Ahora el cartel se acota al lienzo visible (el lienzo más los
  20 de aire que agrega el viewBox) y, si no entra del lado de afuera, se pasa
  al otro lado del cabo en vez de salirse. Es el mismo error que la búsqueda
  de quiebre sin límites, en otra parte del dibujo: **todo lo que se coloca
  cerca de un borde necesita saber dónde está el borde.**

- **Medir el lienzo por el ESTILO cuenta cualquier cosa.** El script que
  cuenta títulos de área pisados los filtraba por `font-size: 13` y
  `font-weight: 700`, que son también los del TAG de cada equipo: informaba
  17 títulos en una planta de 4 áreas y 33.805 pares pisados en la demo, casi
  todos TAGs. Los elementos que se miden llevan marcador propio
  (`data-quiebre`, `data-salida`, `data-titulo-area`) y los scripts los
  buscan por ahí. Una medición que se apoya en el estilo se rompe sola la
  próxima vez que alguien cambie una tipografía.

- **Un tirador que se mueve solo, sin que se mueva lo que representa, no
  dice nada.** Al arrastrar el codo o un extremo se movía el círculo y la
  cañería se quedaba quieta hasta soltar: se editaba a ciegas y el resultado
  aparecía de golpe. Ahora la ruta del arrastre se recalcula en cada
  movimiento. Cuesta una sola ruta por cuadro, contra las 470 de la tabla,
  porque solo se rehace la que se está tocando.

- **Un arrastre que escucha en el elemento se cancela solo al salir de él.**
  Los listeners vivían en el `<svg>`, así que sacar el puntero del lienzo
  disparaba `onMouseLeave` y el arrastre se perdía entero: sin guardar, sin
  aviso, con el tirador volviendo a su lugar. En la planta demo los íconos
  quedan pegados al borde de arriba, o sea que **cualquier arrastre hacia
  arriba se cancelaba solo**. Medido: pidiendo 328 unidades de movimiento, el
  tirador se movía 0 y no se guardaba nada. Mientras dura un arrastre los
  listeners van en `window` —`getScreenCTM` convierte igual de bien un punto
  de afuera del SVG— y soltar afuera compromete el arrastre. La
  previsualización de conexión sí sigue atada al SVG: no es un arrastre, es
  el puntero eligiendo destino.

- **El extremo de una cañería se pega a la silueta, así que se mueve MUCHO
  menos que el puntero.** Es lo correcto —una cañería tiene que tocar su
  equipo— pero se lee como que "no sigue el mouse": arrastrando 166 unidades
  sobre un motor de la demo, el tirador se corre 7, deslizándose por el
  círculo. El punto que sí es libre es el CODO, que por eso puede quedar
  lejos de todo. Los dos tiradores se pintan del color de "fijado a mano"
  cuando lo están, y eso los hace fáciles de confundir.

- **Un override que aplica una sola de las dos pantallas es peor que no
  tenerlo.** `eq.posicionPropia` lo aplicaba el editor y lo ignoraba
  operación: arrastrar un equipo lo movía en la pantalla donde se edita y no
  en la que se mira, que es exactamente al revés de lo que el editor promete.
  Medido: el editor lo dibujaba en (59,38) con `posicionPropia {x:72,y:67}`
  guardado, y operación lo devolvía a (13,0). La aplicación quedó en
  `layout/overrides.js`, una sola función que usan las dos; el arrastre EN
  CURSO se le suma encima solo en el editor, porque es lo único de esto que
  no existe en operación.

- **Un campo que nadie lee es una promesa falsa en los datos.**
  `eq.etiquetaOffset` (mover el TAG a mano) sobrevivió al Portal: el store
  tenía `moverEtiquetaEquipo`, "Restablecer posiciones" avisaba que lo iba a
  resetear, y ninguna pantalla lo escribía ni lo leía. Quien abriera el JSON
  habría creído que los TAG se pueden mover. Borrado, junto con la línea del
  aviso que lo mencionaba.

- **Una tabla global escondida detrás de un selector de planta miente.** Los
  multiplicadores de tamaño por tipo eran globales a toda la app, y el panel
  que los edita vive debajo del selector de planta: se subía "tanque"
  mirando una planta y TODAS cambiaban de tamaño sin avisar. El síntoma con
  el que apareció es de manual: dos plantas que el doble clic informaba con
  el mismo 3.5 se veían distinto, porque las capturas eran de antes y de
  después del cambio global. Ahora la tabla es de cada planta y el panel lo
  dice. Lo guardado se migra copiándolo a todas las plantas existentes, así
  ninguna cambia de aspecto al actualizar.

- **El número del panel no es un tamaño: es un peso relativo.** Con el mismo
  "3.50", una bomba se dibuja a 132 px en la planta semilla y a 72 px en la
  demo. Dos causas se suman y ninguna se ve en el número: `factorAuto` (el
  generador de la demo pone 1.3, así que "3.5" dibuja con 4.55) y el
  encuadre (el lienzo mide 660 en la semilla y 1570 en la demo, o sea que la
  cámara se aleja 2,4×). Por eso el que tiene el número interno MÁS grande
  termina más chico. Lo que fija los píxeles es la densidad, no el número.

- **Un botón ± que calcula desde el valor dibujado se pisa a sí mismo.** Los
  ± del panel de tamaños tomaban el valor renderizado y le sumaban el paso,
  así que dos clics antes de que React re-renderizara partían del mismo
  número: medido, 5 clics movían de 1.00 a 1.10 en vez de a 1.50. La acción
  del store va ahora por DELTA y lee el valor actual adentro del `setData`.

- **Un número informado que no sale del mismo cálculo que el dibujo es
  ficción.** La línea "Ícono más chico a X px, el más grande a Y px" salía de
  `encuadre`, que calcula con el lienzo de SU vista y aplicando el tope del
  máximo; el dibujo usa el lienzo común a todas las vistas y no aplica ese
  tope. Medido en la semilla: la línea decía 180 px y en pantalla eran 191.
  Ahora los px que se informan —en esa línea, en cada fila del panel de
  tamaños y en el doble clic— salen de `pxPorUnidad`, la misma conversión con
  la que se dibuja, y se verifican contra el rectángulo de clic de un equipo,
  que es el único elemento cuya caja en el DOM es exactamente la del ícono
  (el `getBoundingClientRect` de un glifo mide la TINTA: la bomba declara
  altoBase 29 y dibuja 26, un 11% de diferencia que hacía fallar la
  comparación).

- **La CÁMARA era la variable que nadie podía ver ni tocar.** El tamaño en
  pantalla es `peso × factorAuto × cámara`, y de los tres solo el peso era
  editable. La cámara se ajusta sola para llenar el panel con lo que haya, o
  sea que depende de cuántos equipos tenga la planta: medido, 2,622 px por
  unidad con 13 equipos contra 0,796 con 500 —3,3× que no sale de ningún
  número—. Ahora se muestra y se edita en el panel del editor (px por
  unidad). Fijándola, dos plantas se vuelven comparables, y el resto de la
  diferencia queda al descubierto:

  | | Salar (13) | Demo (500) | razón |
  |---|---|---|---|
  | cámara automática | 76 px | 30 px | 3,3× ← la cámara |
  | cámara fijada en 1.000 | 29 px | 38 px | 1,31× ← el `factorAuto` |
  | cámara fijada + "Restablecer tamaños" | **29 px** | **29 px** | idénticos |

  La receta para que dos plantas se vean igual: **misma cámara, mismos pesos
  y sin `factorAuto`** (que lo borra "Restablecer tamaños"). No hay un cuarto
  factor escondido — está verificado equipo por equipo.

- **Guardar un ZOOM fijo no sostiene una cámara fija — hay que guardar el
  OBJETIVO.** El mismo problema de arriba aparece igual entre MÉTODOS: la
  planta demo daba 33 px en "Actual" y 101 en "Escalonado" para el mismo
  tanque, porque "Actual" mete TODA la planta en una vista (lienzo enorme,
  cámara lejos) y "Escalonado" solo dibuja una vista paginada (lienzo mucho
  más chico, cámara más cerca) — cada método llena el panel con lo que
  tiene, como antes pasaba entre plantas. El campo "Cámara" hacía
  `setZoom(v / zoomDeAjuste)` una sola vez al tipear: guardaba un ZOOM
  (`pxObjetivo/zoomDeAjuste` DE ESE MOMENTO), no un objetivo, así que apenas
  cambiaba el método (o la planta, o la vista) el `zoomDeAjuste` de referencia
  cambiaba y el zoom guardado dejaba de apuntar al mismo número. Ahora el
  estado que se guarda es el ABSOLUTO (`pxObjetivo`, px por unidad) y el zoom
  se recalcula en cada render contra el `zoomDeAjuste` de turno para
  llegar a él — sostenido al cambiar de método, vista, pantalla o planta.
  Verificado: fijando 0,5 px/unidad, "Actual", "Escalonado" y "Libre" dan
  0,500 / 0,4999… / 0,500 (ruido de punto flotante, no del método). El
  objetivo bypasea el tope del "Máximo" igual que la lupa —los dos son la
  acción explícita de la persona— recalculando `zoomDeAjuste` sin `Math.min`
  contra `zoomTopeMax` cuando `pxObjetivo` está fijado.

  **Ojo: esto iguala la CÁMARA, no el tamaño MUNDO.** "Actual" no solo tiene
  su propia cámara: `calcularLayoutCompacto` calcula su propio
  `factorGlobal` y lo escribe (en memoria, para esta previsualización) sobre
  el `factorAuto` de CADA equipo, pisando el 1.3 real que trae la planta.
  Con la misma cámara fijada, el tanque salió 50 px en "Actual" contra 58-59
  en "Escalonado"/"Libre" —un ~16% que no es de cámara: es que "Actual"
  literalmente dibuja con un tamaño-mundo distinto, propio de lo que ese
  algoritmo decidió para empaquetar parejo. Iguala método por método su
  aporte a la densidad, pero no busca calzar sus píxeles con los de los
  otros dos — son cosas distintas, no una cámara sin corregir.

- **Cuando el mínimo ata, la cámara deja de ser libre — y ahí subir un tipo
  NO achica a los demás.** Es la mitad que faltaba de lo de arriba, y
  contradice el atajo de "lo que fija los píxeles es la densidad": en una
  planta densa el layout escala para que el ícono más chico llegue al
  mínimo, así que ese queda CLAVADO y agrandar otro tipo se paga con más
  vistas, no con alejar la cámara. Medido en la planta demo, subiendo solo
  el peso del tanque:

  | peso del tanque | cámara | vistas | tanque | bomba | motor |
  |---|---|---|---|---|---|
  | 1.00 | 0,796 | 4 | 93 px | 30 px | 27 px |
  | 2.00 | 0,786 | 6 | **184 px** | **30 px** | **27 px** |
  | 3.60 | 0,802 | 19 | — | **30 px** | **27 px** |

  El tanque se duplica y la bomba y el motor no se mueven un píxel. De ahí
  sale la asimetría que parece un factor por tipo escondido y no lo es: los
  tipos chicos los ancla el mínimo, los grandes viajan con su peso.
  `celdaDeEquipo` fija la escala una sola vez y el empaquetado solo
  posiciona — no hay ningún factor por tipo en el layout.

- **Un peso relativo mostrado sin píxeles no se puede comparar entre
  plantas.** El panel decía "3.50" y el doble clic también, y esa misma
  bomba medía 132 px en la semilla y 72 en la demo: el peso es cuánto mide un
  equipo RESPECTO DE LOS DEMÁS, y los píxeles dependen además de `factorAuto`
  y de cuánto acerca la cámara. Ahora cada fila del panel muestra "· N px" y
  el doble clic desglosa peso × factor = efectivo y el alto real. El número
  sigue siendo relativo —no hay forma de que el mismo peso dé los mismos
  píxeles en dos plantas con densidades distintas— pero deja de aparentar ser
  un tamaño.
