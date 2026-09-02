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

Si no hay un Chromium en el sistema, ajustá `executablePath` al principio de
cada script.

## Qué mide cada uno

| Script | Qué responde |
|---|---|
| `metodos-de-layout.js [semilla\|grande\|demo]` | lienzo vacío, desvío de proporción y solape entre áreas, para los tres métodos de la pestaña "Ensayo de layout" |
| `compactado-idempotente.js` | que compactar dos veces dé lo mismo, y que un tamaño puesto a mano sobreviva |
| `proporciones-por-area.js` | escala final por área y tamaño renderizado de cada tipo — detecta si el compactado rompe las proporciones del catálogo |

Las tres plantas de prueba:

- **semilla** — los 13 equipos en 4 áreas del set inicial.
- **grande** — duplica una bomba 30 veces: 43 equipos, un área enorme contra
  tres chicas. El caso donde se ven los problemas de forma.
- **demo** — aprieta "Demo escala": 500 equipos en 200 ubicaciones. El caso
  donde se ven los problemas de agrupamiento.

Las capturas van a `salida/`, que está fuera del control de versiones.
