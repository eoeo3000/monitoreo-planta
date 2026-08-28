# Handoff — Rediseño HMI (monitoreo-planta)

Prompt para Claude Code. Repo: `eoeo3000/monitoreo-planta` (branch `master`, CRA + React 18, sin backend conectado: los datos vienen de `src/analista/store.js` con `localStorage`).

---

## Objetivo

Aplicar un sistema visual tipo ERP industrial ("wireframe azul acero") a la app existente, y añadir dos pantallas nuevas de Gerencia: un catálogo de símbolos HMI y una vista de proceso de la planta concentradora. Las reglas de negocio actuales NO cambian.

## 1. Sistema visual — crear `src/theme/tokens.css`

Importar en `src/index.js`. Todo el CSS de la app debe leer estas variables; nunca hex sueltos.

```css
:root {
  --color-bg: #f2f2f3;
  --color-surface: #f2f2f3;      /* las tarjetas NO tienen relleno propio */
  --color-text: #1d1f20;
  --color-accent: #5980a6;
  --color-divider: #d4d4d7;

  --color-neutral-100:#f5f5f8; --color-neutral-200:#e7e7ea; --color-neutral-300:#d4d4d7;
  --color-neutral-400:#b7b7ba; --color-neutral-500:#98989b; --color-neutral-600:#7a7a7d;
  --color-neutral-700:#5d5d60; --color-neutral-800:#424244; --color-neutral-900:#2b2b2d;

  --color-accent-100:#eef6ff; --color-accent-300:#a9c2dc; --color-accent-500:#5980a6;
  --color-accent-700:#3f5e7d; --color-accent-800:#2f4760; --color-accent-900:#1f2d3a;

  --font-heading: "Barlow Condensed", system-ui, sans-serif;  /* pesos 600 */
  --font-body: "Barlow", system-ui, sans-serif;               /* 400/500 */

  --space-1:3.4px; --space-2:6.8px; --space-3:10.2px; --space-4:13.6px; --space-6:20.4px; --space-8:27.2px;
  --radius-sm:2px; --radius-md:4px;
}
```

Cargar Barlow y Barlow Condensed (400,500,600) desde Google Fonts en `public/index.html`.

Reglas del sistema, no negociables:

- **Esquinas rectas.** Nada de `border-radius` en tarjetas, celdas, figuras ni botones (máx. `--radius-md` en inputs).
- **Tarjetas = dibujos de línea.** `border: 1px solid var(--color-divider)`, fondo transparente, sin sombra. Cada tarjeta lleva cuatro marcas de registro "+" en las esquinas (ver `.blueprint` abajo).
- **Un solo objeto sólido:** el botón primario, relleno `var(--color-accent)` con texto `#fff`, esquinas rectas y sus marcas de registro.
- **Títulos** en Barlow Condensed, mayúsculas, `letter-spacing: 0.03em–0.05em`. **Cuerpo** en Barlow.
- **Etiquetas de campo / kickers:** 10px, `letter-spacing: 0.14em`, mayúsculas, `var(--color-neutral-600)`.
- **Iconos:** trazo fino, `stroke-width: 1.5`, `fill: none`, `stroke: currentColor`. Estilo Lucide / P&ID. Nada de iconos rellenos ni emoji.
- **Foco de teclado:** `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` en todo lo interactivo. Hover con tinte `var(--color-accent-100)`.
- **Sin color decorativo** más allá del acero. Los colores de severidad son datos, no decoración (ver §2).

Utilidad `.blueprint` (marcas de registro):

```css
.blueprint { position: relative; border: 1px solid var(--color-divider); background: transparent; }
.blueprint > .corner { position: absolute; width: 7px; height: 7px; color: var(--color-accent); }
.blueprint > .corner::before,
.blueprint > .corner::after { content: ""; position: absolute; background: currentColor; }
.blueprint > .corner::before { left: 3px; top: 0; width: 1px; height: 7px; }
.blueprint > .corner::after  { top: 3px; left: 0; height: 1px; width: 7px; }
.corner.tl { left: -4px; top: -4px; } .corner.tr { right: -4px; top: -4px; }
.corner.bl { left: -4px; bottom: -4px; } .corner.br { right: -4px; bottom: -4px; }
```

Componente `<Blueprint as="section">` que renderiza el borde + los cuatro `<i class="corner …" />`.

## 2. Severidad

`src/analista/severidad.js` se mantiene tal cual (normal / observacion / alerta / alarma y las reglas de obligatoriedad). Añadir dos paletas y un flag de configuración:

```js
export const SEV_COLOR = { normal:'#2e7d32', observacion:'#1565c0', alerta:'#f9a825', alarma:'#c62828' };
export const SEV_MONO  = { normal:'var(--color-neutral-400)', observacion:'var(--color-accent-300)',
                           alerta:'var(--color-accent-500)', alarma:'var(--color-accent-900)' };
```

La severidad se representa como **un cuadrado de 7–10px** del color + la etiqueta en Barlow Condensed mayúsculas. **Nunca** como píldora redondeada de fondo sólido. Un flag `severidadEnColor` (default `true`) permite cambiar a la paleta mono.

## 3. Rediseñar `src/components/analista/AnalistaApp.js`

Misma lógica y mismos handlers; sólo cambia la presentación. Extraer los estilos inline actuales a CSS Modules o a un `analista.css` que lea los tokens.

Layout: `aside` fijo de 272px + `main` fluido.

**Sidebar** — cabecera con "CONDICIÓN DE ACTIVOS" (Condensed 19px) y kicker "Estación del analista" en `--color-accent-700`. Árbol Planta → Área → Equipo:
- Planta: número de orden `01` en `--color-neutral-500` + nombre en Condensed mayúsculas, con regla inferior de 1px.
- Área: fila clicable con caret `▾`/`▸` en color acento; colapsable.
- Equipo: fila con el cuadrado de severidad (7px), el TAG en Condensed `letter-spacing:.04em`, y el tipo a la derecha en 10px mayúsculas. Seleccionado: `background: var(--color-accent-100)` + `box-shadow: inset 2px 0 0 var(--color-accent)`. Hover: `--color-accent-100`.
- Los equipos se indentan con una línea vertical de 1px (`border-left`) — la jerarquía se dibuja, no se sugiere.
- Pie: "Sesión: analista.demo · Datos de prueba locales".

**Cabecera del panel** — kicker con el nombre del área, `h1` con el TAG a 44px, descripción del equipo debajo. A la derecha: "CONDICIÓN ACTUAL" + la etiqueta de severidad a 26px en su color, y un cuadro de 44px con borde del color de severidad y un cuadrado relleno dentro.

**Cuerpo** — grid de dos columnas `minmax(0,1.25fr) minmax(0,1fr)`, `gap: var(--space-6)`:

1. `Blueprint` **Nuevo diagnóstico** (columna izquierda, mantiene el `onPaste` de evidencias):
   - Botón secundario "Última condición", deshabilitado sin condición previa.
   - Mensajes de validación como banda con `border-left: 2px solid` del color del mensaje y fondo `--color-neutral-100` (rojo `#c62828` en error, `--color-accent-700` en éxito).
   - **La severidad deja de ser un `<select>`**: cuatro celdas en grid de 4 columnas, cada una con el cuadrado de color y la etiqueta; la activa lleva borde del color de severidad y fondo `--color-neutral-100`. Al elegir `normal` se limpia el modo de falla; al pasar a una severidad sin recomendación obligatoria se autocompleta `RECOMENDACION_DEFAULT` si está vacía (comportamiento actual).
   - Modo de falla: `<select>` con el catálogo por tipo de equipo. Diagnóstico y Recomendación: `<textarea>` con contador `n/1000` alineado a la derecha en la etiqueta y `*` cuando el campo es obligatorio según `reglasPorSeveridad`.
   - Evidencia: zona con `border: 1px dashed var(--color-neutral-400)`, miniaturas de 56px cuadradas. **Renderizar la miniatura como `div` con `background-image`**, no como `<img src>` (evita peticiones fallidas mientras no hay dato).
   - Acciones: "Insertar diagnóstico" (secundario) y "Nuevo aviso" (primario sólido con marcas de registro).
2. `Blueprint` **Último registro** (columna derecha): grid `auto 1fr` con Severidad / Modo de falla / Fecha / Usuario.
3. `Blueprint` **Avisos abiertos** (columna derecha): contador de dos dígitos a la derecha del título; cada aviso con el número SAP (o "Sin número SAP") en Condensed, un tag outline con el estado, y `textoBreve · clase` debajo. Filas separadas por `border-top` de 1px.
4. `Blueprint` **Análisis histórico** (ancho completo, `grid-column: 1/-1`): tabla con cabecera en 11px mayúsculas `letter-spacing:.08em`, columnas Fecha / Usuario / Severidad / Modo de falla / Diagnóstico (resumen truncado a 90 caracteres). Filas clicables → modal de detalle. Fechas con `es-CL` y `font-variant-numeric: tabular-nums`.

**Modales** — mantener `NuevoAvisoModal` y `HistorialDetalleModal` con su lógica. Backdrop `color-mix(in srgb, var(--color-neutral-900) 50%, transparent)`, diálogo `Blueprint` de 560px sobre `--color-bg`, esquinas rectas, campos con las mismas etiquetas de 10px. En el detalle, la severidad va en una banda con borde de su color.

## 4. Pantalla nueva — `src/components/gerencia/CatalogoHMI.js`

Catálogo de símbolos de proceso, seleccionables.

- 16 símbolos SVG propios (`viewBox="0 0 40 40"`, `fill:none`, `stroke:currentColor`, `stroke-linecap/linejoin: round`, sin `stroke-width` en el SVG: se hereda del contenedor). Cuatro grupos:
  - **Bombas:** centrífuga (PMP-C), dosificadora (PMP-D), vacío (PMP-V), sumergible (PMP-S)
  - **Tanques y vasijas:** atmosférico (TQ-A), presurizada (TQ-P), silo (SIL), intercambiador (HEX)
  - **Rotativos:** agitador (AG), compresor (CP), motor (MOT), soplador (BLW)
  - **Instrumentos:** presión (PT), vibración (VT), caudal (FT), válvula de control (FCV)
- Layout `232px | 1fr | 316px`. Izquierda: filtro por tipo (Todos + 4 grupos) con contador de dos dígitos; activo con `inset 2px 0 0 var(--color-accent)`.
- Centro: una `Blueprint` por grupo, con número de orden (`01`…`04`), título en mayúsculas y una nota descriptiva a la derecha. Dentro, **grid de 4 columnas con `gap: 1px` sobre fondo `--color-neutral-300`** y celdas en `--color-bg`: así la retícula se ve como líneas de plano, sin enmarcar cada celda. Celda seleccionada: fondo `--color-accent-100` + `inset 0 0 0 1px var(--color-accent)`, icono en `--color-accent-800`.
- Derecha: `Blueprint` "Selección" con contador grande de dos dígitos, lista de elegidos (cuadrado acento + nombre + código + "Quitar"), y acciones "Aplicar a la vista" (primario) / "Limpiar".
- Configurable: `seleccionMultiple` (default true), `mostrarCodigos` (default true), `grosorTrazo` (1–2, paso 0.25, default 1.5 — se aplica como `stroke-width` en el contenedor del grid y se hereda a los SVG).

## 5. Pantalla nueva — `src/components/gerencia/PlantaConcentradora.js`

Diagrama de flujo de la concentradora, con los mismos glifos de trazo fino.

- Lienzo de **1320 × 810** en coordenadas absolutas. Nodos de 108 × 104 posicionados en una retícula: `left` ∈ {40, 200, 360, 520, 680, 840, 1000, 1160} (paso 160), `top` ∈ {40, 250, 460, 670}.
- 24 equipos, en este orden de proceso:
  - **Fila 1 (chancado):** Mina subterránea → Balanza 35 t → Tolva de gruesos → Ch. primario de quijada → Ch. secundario cónico → Criba vibratoria → Tolva de finos
  - **Fila 2 (molienda, de derecha a izquierda):** Molino de bolas → Sumidero 01 → Bomba B-101 → Hidrociclón 01 → Acondicionador
  - **Fila 3 (flotación y filtrado):** F. Desbaste → F. Recuperación → F. Limpieza → F. Re-limpieza → Espesador → Filtro de discos → Horno de secado → Conc. seco 6 % Hu
  - **Fila 4 (relaves):** Sumidero 02 → Bomba B-201 → Hidrociclón 02 → Relavera
  - Ramales: Tolva de finos baja al Molino; el Acondicionador baja al Desbaste; el relave del Desbaste baja al Sumidero 02; el overflow del Espesador vuelve al Molino como "AGUA CLARA A RECICLAJE".
- **Conectores:** un único `<svg>` de 1320×810 en `position:absolute; inset:0; pointer-events:none`, detrás de los nodos, con `<path>` ortogonales, `stroke: var(--color-accent)` y un `<marker id="flecha">` triangular al final de cada tramo. Etiquetas de tramo (`FAJA Nº1`, `OVERFLOW`, `RELAVE DESBASTE`, `CONCENTRADO`, …) como `<text>` de 11px en `--color-neutral-600`. Los tramos arrancan y terminan en el borde del nodo, no en su centro.
- Cada nodo: cuadrado de severidad de 7px arriba a la derecha, glifo de 48×32 y nombre en Condensed 12px centrado a dos líneas. Seleccionado / hover: `inset 0 0 0 1px var(--color-accent)` y fondo `--color-accent-100`.
- **Zoom:** controles `−` / `%` / `+` en la cabecera del diagrama (0.40–2.00, paso 0.15). El lienzo va dentro de un contenedor con `overflow:auto`; se aplica `transform: scale(z)` con `transform-origin: 0 0` y un espaciador de `1320*z × 810*z` para que el scroll sea correcto. El botón del porcentaje hace "ajustar al ancho": `z = wrap.clientWidth / 1320`, redondeado hacia abajo a dos decimales. Calcularlo con un **`ResizeObserver` sobre el contenedor** (y una primera medición en `requestAnimationFrame` tras el montaje), no midiendo una sola vez en `componentDidMount`; si el usuario ajusta el zoom a mano, dejar de re-ajustar automáticamente.
- Panel derecho de 316px, `Blueprint` sticky: etapa (kicker), nombre, banda de severidad, y grid con TAG / Tipo / Recibe de / Entrega a / Monitoreo, más una nota técnica.
- Cabecera con KPIs "Equipos" y "En alerta" (dos dígitos). **Derivarlos del arreglo de nodos**, nunca escribirlos a mano. La cabecera del diagrama debe usar `flex-wrap: wrap` para que la leyenda de severidades no se recorte en anchos estrechos.

## 6. Navegación

Añadir una barra superior con tres destinos: **Analista**, **Catálogo HMI**, **Planta**. `react-router-dom` si ya está disponible; si no, un estado local en `App.js` es suficiente. Marca de la barra en Condensed, ítem activo subrayado con 2px en `var(--color-accent)`.

## 7. Criterios de aceptación

- `npm start` sin warnings nuevos; `npm run build` limpio.
- Ninguna regla de negocio alterada: obligatoriedad por severidad, bloqueo de "Insertar" en alerta/alarma, anti-duplicado de 5 minutos, autocompletado de recomendación, persistencia en `localStorage`.
- Cero `border-radius` en tarjetas, celdas, figuras y botones; toda tarjeta enmarcada lleva sus cuatro marcas de registro.
- Cero valores de color, fuente o espaciado escritos a mano fuera de `tokens.css`.
- Todos los SVG a `stroke-width: 1.5` heredado, `fill: none`.
- Foco de teclado visible en árbol, celdas del catálogo, nodos del diagrama, campos y botones.
- Con `severidadEnColor: false` la interfaz queda monocroma en acero, sin perder legibilidad.
- El zoom ajusta al ancho sin recorte horizontal tras el ajuste automático, en anchos de ventana de 1280 a 1920.

## 8. Densidad — la app debe leerse como un ERP, no como una landing

Los prototipos dejan demasiado aire. Comprimir sin cambiar la jerarquía ni el sistema visual: se reduce el espacio en blanco, **no** el tamaño de los textos de lectura ni los objetivos de clic.

Escala base: bajar la densidad de 0.85 a **0.72** en la escala de espaciado, y trabajar siempre con las variables.

```css
:root {
  --space-1:2.9px; --space-2:5.8px; --space-3:8.6px;
  --space-4:11.5px; --space-6:17.3px; --space-8:23px;
}
```

Ajustes concretos:

- **Padding de tarjeta:** `var(--space-6)` → `var(--space-4)`. Los diálogos, de `var(--space-8)` a `var(--space-6)`.
- **Separación entre tarjetas y columnas:** `var(--space-6)` → `var(--space-4)`.
- **Padding de página:** `var(--space-6) var(--space-8)` → `var(--space-4) var(--space-6)`.
- **Cabeceras de pantalla:** el `h1` baja de 44px a 32px y de 40px a 30px; el bloque de cabecera pasa a `padding: var(--space-4) var(--space-6)`. Los KPI de 30px a 24px.
- **Filas de tabla:** `padding` vertical a `var(--space-2)`; altura de fila objetivo ≈ 32px. Cabecera de tabla a `var(--space-2)`.
- **Filas del árbol y del panel lateral:** `padding` vertical a `var(--space-1)`, altura ≈ 28px.
- **Celdas del catálogo HMI:** de `var(--space-6) var(--space-3)` a `var(--space-4) var(--space-2)`; el glifo baja de 44px a 36px. Con el ancho ganado, el grid pasa de 4 a **6 columnas** en viewports ≥1600px (`repeat(auto-fill, minmax(132px, 1fr))`).
- **Formulario de diagnóstico:** `gap` de la columna a `var(--space-3)`; los `textarea` de 4 y 3 filas bajan a 3 y 2; la zona de evidencia de `min-height: 64px` a 52px y las miniaturas de 56px a 44px.
- **Diagrama de planta:** el paso de la retícula baja de 160 a **132px** en horizontal y de 210 a **176px** en vertical; los nodos de 108×104 a 96×84 y el glifo de 48×32 a 40×26. El lienzo queda en **1104 × 690**; reescalar los trazados de los conectores en la misma proporción (×0.825 en X, ×0.838 en Y) — no reescalar con `transform`, corregir las coordenadas.
- **Panel lateral de detalle y de selección:** de 316px a 272px.
- **Sidebar del analista:** de 272px a 236px.

Lo que NO se toca:

- Cuerpo de texto a 13px mínimo; etiquetas de 10px se mantienen (ya son el mínimo).
- Altura mínima de 32px en cualquier elemento clicable; los botones conservan `padding` horizontal cómodo.
- El grosor de trazo de los iconos (1.5), las marcas de registro, las esquinas rectas y los tokens de color.
- La jerarquía tipográfica: los títulos siguen siendo claramente mayores que el cuerpo.

Criterio de aceptación de densidad: en una ventana de 1440×900 la pantalla del Analista muestra la cabecera, el formulario completo, las dos tarjetas laterales y **al menos 6 filas** del histórico sin hacer scroll.

## 9. Conexiones: puertos, sin holgura, y escala relativa

Hoy los conectores del diagrama son `<path>` con coordenadas escritas a mano y arrancan cerca del borde del nodo, dejando aire. Hay que sustituir eso por un modelo de **puertos declarados**. Nadie vuelve a escribir una coordenada de conector a mano.

### 9.1 Cada símbolo declara sus puertos

Un símbolo es su geometría SVG **más** una lista de puntos de conexión, expresados en el sistema de coordenadas del propio `viewBox`. El puerto se ubica sobre la línea dibujada, no sobre la caja del símbolo.

```js
// src/simbologia/simbolos.js
export const SIMBOLOS = {
  bomba: {
    viewBox: [0, 0, 40, 32],
    escala: 'inline',                 // ver §9.3
    path: (props) => (/* … el SVG actual … */),
    puertos: {
      succion:  { x: 11, y: 18, dir: 'W' },   // cuadrante izquierdo del círculo
      descarga: { x: 20, y: 9,  dir: 'N' },   // boca superior de la voluta
      motor:    { x: 20, y: 27, dir: 'S' },
    },
  },
  tanqueAgitado: {
    viewBox: [0, 0, 40, 40],
    escala: 'mayor',
    path: (props) => (/* … */),
    puertos: {
      entradaSup: { x: 20, y: 4,  dir: 'N' },  // borde superior
      lateralIzq: { x: 5,  y: 22, dir: 'W' },  // muro izquierdo
      salidaInf:  { x: 20, y: 36, dir: 'S' },
      accionador: { x: 20, y: 4,  dir: 'N' },
    },
  },
  // … un entry por símbolo del catálogo
};
```

Reglas de los puertos:

- `x`/`y` caen **exactamente sobre el trazo** de la geometría: el cuadrante del círculo (`cx - r`), el muro del rectángulo (`x` del `rect`), el vértice del cono. Nunca en el aire ni en la esquina del `viewBox`.
- `dir` es la normal de salida (`N`/`S`/`E`/`W`) y es la que decide cómo arranca el ruteo ortogonal: un puerto `W` sale siempre hacia la izquierda antes de girar.
- El nombre del puerto es semántico (`succion`, `descarga`, `overflow`, `underflow`, `relave`), no geométrico (`izq`, `p1`).

### 9.2 Sin holgura entre línea y equipo

`puntoAbsoluto(nodo, puerto)` convierte el puerto a coordenadas del lienzo:

```js
export function puntoAbsoluto(nodo, nombrePuerto) {
  const sim = SIMBOLOS[nodo.simbolo];
  const p = sim.puertos[nombrePuerto];
  const [, , vbW, vbH] = sim.viewBox;
  const k = nodo.ancho / vbW;                 // el glifo llena el nodo, misma k en X e Y
  return { x: nodo.x + p.x * k, y: nodo.y + p.y * k, dir: p.dir };
}
```

El conector se dibuja **desde ese punto exacto** hasta el punto exacto del puerto destino. Requisitos:

- **Cero holgura, cero solape.** El `d` del `path` empieza en el punto del puerto, no a 4px de distancia. Prohibido cualquier `offset`, `inset`, `gap` o "acercarse al borde".
- El primer y el último tramo salen **perpendiculares** al borde según `dir`, con un tramo mínimo de 8px antes del primer giro. Así la línea nunca nace en diagonal desde el símbolo.
- Ruteo ortogonal en L o en Z (`M … H … V … H …`), nunca diagonales ni curvas.
- **El conector va detrás del símbolo.** El `<svg>` de conectores en `z-index` inferior a los nodos: si el remate quedara 1px corto, el trazo del símbolo lo tapa y la unión se ve perfecta. Al revés se ve un pico sobresaliendo.
- `shape-rendering="crispEdges"` en el grupo de conectores y coordenadas enteras: media unidad de subpíxel se lee como holgura.
- Grosor del conector **2px**, `stroke-linecap="round"`, `stroke: var(--color-accent)`. El trazo del símbolo es más pesado (ver §9.3): el conector es subordinado, nunca compite con el equipo.
- La flecha del final se dibuja con `marker-end`, que consume el remate: el `refX` del marker debe ser su ancho completo para que la punta termine justo en el puerto y no lo pase.

### 9.3 Relación de tamaños

Tres clases de tamaño, no una. Un tanque no puede medir lo mismo que un instrumento.

| Clase | Lado del glifo | Grosor de trazo | Qué es |
| --- | --- | --- | --- |
| `mayor` | 100 % (base) | 2.5 | Tanques, molinos, celdas de flotación, espesador, silos, hornos |
| `inline` | 34 % | 2 | Bombas, válvulas, reductores, sopladores — máquinas en línea |
| `bubble` | 26 % | 1.5 | Burbujas de instrumento ISA (M, PT, FT, VT) |

- Un único `--glifo-mayor` (por ejemplo 132px) manda: las otras dos clases se derivan con esos factores. Cambiar el zoom o la densidad ajusta **una** variable.
- La proporción se conserva a cualquier escala; nunca fijar el tamaño de un símbolo caso por caso.
- La burbuja de instrumento se **ancla** a su equipo: se coloca respecto al puerto `motor` / `instrumento` del padre a una distancia de `0.5 × lado bubble`, con un conector recto de 2px. No es un nodo suelto del lienzo.
- El texto del TAG vive **fuera** del glifo, debajo, en Barlow Condensed. Nunca dentro de la figura — la única letra admitida dentro de una figura es la de la burbuja ISA.

### 9.4 Modelo de datos del diagrama

```js
export const NODOS = [
  { id: 'TQ-102', simbolo: 'tolva',        clase: 'mayor',  col: 3, fila: 1 },
  { id: 'B-101',  simbolo: 'bomba',        clase: 'inline', col: 4, fila: 2 },
];

export const CONEXIONES = [
  { de: ['TQ-102', 'salidaInf'], a: ['B-101', 'succion'],  fluido: 'pulpa', etiqueta: '' },
  { de: ['B-101', 'descarga'],   a: ['HC-201', 'entrada'], fluido: 'pulpa', etiqueta: 'CARGA CIRC.' },
];
```

- La posición se declara en **celdas de retícula** (`col`/`fila`), no en píxeles; el layout resuelve `x`/`y` desde el paso de retícula. Mover un equipo es cambiar un número.
- Un solo `<svg>` para todos los conectores, generado recorriendo `CONEXIONES`. Cero `<path>` escrito a mano en el JSX.
- La etiqueta del tramo se posiciona automáticamente sobre el segmento más largo del recorrido, con un desplazamiento de 6px.

### 9.5 Criterios de aceptación

- Ampliando al 200 %, **ningún** conector muestra holgura ni sobresale del trazo del símbolo en ninguna de las 24 conexiones.
- Ningún `<path>` de conector con coordenadas literales en un componente: todos derivan de `NODOS` + `CONEXIONES` + `puertos`.
- Mover un nodo de celda re-rutea sus conexiones solas, sin editar nada más.
- Las tres clases de tamaño son visibles de un vistazo: el tanque domina, la bomba es claramente menor, la burbuja es la más pequeña.
- Todo tramo nace y muere perpendicular al borde del símbolo.

## 10. Referencia

Las tres pantallas están prototipadas en HTML y son la fuente visual de verdad: `Monitoreo Analista.dc.html`, `Gerencia HMI.dc.html`, `Planta Concentradora HMI.dc.html`. Contienen los glifos SVG, las coordenadas de los nodos, los trazados de los conectores y los textos definitivos — cópialos de ahí en lugar de redibujarlos.
