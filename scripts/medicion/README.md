# Mediciones de layout

Scripts que miden el acomodado de equipos con números en vez de a ojo. Manejan
el navegador de verdad, así que miden lo que se ve —incluyendo el encuadre y
los TAGs— y no lo que el algoritmo cree que hizo.

Las cifras de referencia están en `CLAUDE.md`. **Si cambiás algo de
`src/gerencia/layout/`, corré estos scripts y compará**: si un número se movió,
hay que saber por qué.

## Para correrlos

No son parte del build ni de `npm test`: necesitan un navegador y la app
levantada. Playwright no es dependencia del proyecto a propósito —se instala
solo cuando hace falta medir— así que:

```bash
npm install --no-save playwright-core   # usa el Chromium ya instalado
npm start                               # en otra terminal
node scripts/medicion/metodos-de-layout.js semilla
```

Si el Chromium está en otro lado, `CHROMIUM=/ruta/al/chromium node scripts/...`
— la ruta se resuelve en `comun.js`, no en cada script.

Los scripts se apoyan en marcadores del DOM (`data-quiebre`, `data-salida`,
`data-titulo-area`) y no en estilos. No es un detalle: filtrando títulos de
área por `font-size` y `font-weight` se colaban los TAG de equipo, que usan
los mismos, y el script informaba 17 títulos en una planta de 4 áreas y
miles de pares pisados que no existían. **Si medís algo del lienzo, pedí un
marcador; no lo deduzcas del estilo.**

## Qué mide cada uno

| Script | Qué responde |
|---|---|
| `metodos-de-layout.js [semilla\|grande\|demo]` | lienzo vacío, desvío de proporción y solape entre áreas, para los tres métodos del Editor de planta |
| `canerias.js [semilla\|demo]` | cañería por conexión, cruces por conexión y cuánto tarda el ruteo; además, si algún trazo o tirador se sale del lienzo |
| `entre-vistas.js [semilla\|demo]` | recorre todas las vistas: conectores de salida (la cañería que sigue en otra) y títulos de área que se pisan |

`comun.js` no se corre solo: junta lo que comparten (abrir el editor con datos
limpios, armar cada planta, encender las cañerías y esperar el resultado).

Las tres plantas de prueba:

- **semilla** — los 13 equipos en 4 áreas del set inicial.
- **grande** — duplica una bomba 30 veces: 43 equipos, un área enorme contra
  tres chicas. El caso donde se ven los problemas de forma.
- **demo** — aprieta "Generar planta de prueba": 500 equipos en 200
  ubicaciones, con conexiones. El caso donde se ven los problemas de
  agrupamiento y el único con varias vistas.

Cada corrida arranca de `localStorage` vacío a propósito: una medición que
depende de lo que quedó de la corrida anterior no es reproducible.

Las capturas van a `salida/`, que está fuera del control de versiones.
