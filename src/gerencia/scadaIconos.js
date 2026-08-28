// Glifos "con volumen" para el Portal de gerencia SCADA (handoff §10.2) — figuras
// rellenas, no íconos de trazo. El catálogo de línea fina de equipoIcons.js NO se
// usa acá: es la gramática visual opuesta (ver PortalSCADA.js).
//
// Cada tipo expone `silueta` (las formas SIN fill/stroke propio — se pintan dos
// veces: como glifo relleno con el degradado metálico, y como <clipPath> para
// recortar el teñido de severidad) y `decoracion` (detalles que van encima, sin
// recortar, como el eje del agitador o la letra "M" del motor).
//
// El tamaño relativo entre tipos replica el mismo orden ya acordado para
// equipoIcons.js (tanque = agitador > clarificador = secador > compresor >
// bomba = motor), pero en la escala de píxeles propia de este lienzo — no son
// los mismos números porque es un lienzo de circuito completo, no un ícono por
// nodo con zoom.
export const SCADA_ICONOS = {
  tanque: {
    viewBox: '0 0 44 90',
    anchoBase: 44,
    altoBase: 90,
    bordeInferior: 90,
    puertos: {
      entradaSup: { x: 22, y: 14, dir: 'N' },
      salidaInf: { x: 22, y: 82, dir: 'S' },
      lateralIzq: { x: 4, y: 48, dir: 'W' },
      lateralDer: { x: 40, y: 48, dir: 'E' },
    },
    silueta: (
      <>
        <rect x="4" y="14" width="36" height="68" />
        <ellipse cx="22" cy="14" rx="18" ry="6" />
        <ellipse cx="22" cy="82" rx="18" ry="6" />
      </>
    ),
  },
  agitador: {
    viewBox: '0 0 44 90',
    anchoBase: 44,
    altoBase: 90,
    bordeInferior: 90,
    puertos: {
      accionador: { x: 22, y: 2, dir: 'N' },
      salidaInf: { x: 22, y: 82, dir: 'S' },
      lateralIzq: { x: 4, y: 48, dir: 'W' },
      lateralDer: { x: 40, y: 48, dir: 'E' },
    },
    silueta: (
      <>
        <rect x="4" y="14" width="36" height="68" />
        <ellipse cx="22" cy="14" rx="18" ry="6" />
        <ellipse cx="22" cy="82" rx="18" ry="6" />
        <rect x="16" y="0" width="12" height="10" />
      </>
    ),
    decoracion: <line x1="22" y1="10" x2="22" y2="38" stroke="#23262a" strokeWidth="2" />,
  },
  clarificador: {
    viewBox: '0 0 80 56',
    anchoBase: 80,
    altoBase: 56,
    bordeInferior: 56,
    puertos: {
      entrada: { x: 40, y: 8, dir: 'N' },
      underflow: { x: 40, y: 48, dir: 'S' },
      lateralIzq: { x: 4, y: 32, dir: 'W' },
      lateralDer: { x: 76, y: 32, dir: 'E' },
    },
    silueta: (
      <>
        <rect x="4" y="18" width="72" height="28" />
        <ellipse cx="40" cy="18" rx="36" ry="10" />
        <ellipse cx="40" cy="46" rx="36" ry="10" />
      </>
    ),
  },
  secador: {
    viewBox: '0 0 90 50',
    anchoBase: 90,
    altoBase: 50,
    bordeInferior: 50,
    puertos: {
      entrada: { x: 8, y: 25, dir: 'W' },
      salida: { x: 82, y: 25, dir: 'E' },
      vaporSup: { x: 45, y: 6, dir: 'N' },
    },
    silueta: (
      <>
        <rect x="14" y="6" width="62" height="38" />
        <ellipse cx="14" cy="25" rx="6" ry="19" />
        <ellipse cx="76" cy="25" rx="6" ry="19" />
      </>
    ),
  },
  compresor: {
    viewBox: '0 0 50 36',
    anchoBase: 50,
    altoBase: 36,
    bordeInferior: 36,
    puertos: {
      entrada: { x: 6, y: 24, dir: 'W' },
      salida: { x: 44, y: 24, dir: 'E' },
      motor: { x: 25, y: 1, dir: 'N' },
    },
    silueta: (
      <>
        <path d="M8 32 L42 32 L36 12 L14 12 Z" />
        <circle cx="25" cy="9" r="7" />
      </>
    ),
  },
  bomba: {
    viewBox: '0 0 26 26',
    anchoBase: 26,
    altoBase: 26,
    bordeInferior: 26,
    puertos: {
      succion: { x: 2, y: 16, dir: 'W' },
      descarga: { x: 24, y: 16, dir: 'E' },
      motor: { x: 13, y: 1, dir: 'N' },
    },
    silueta: (
      <>
        <circle cx="13" cy="16" r="10" />
        <rect x="9" y="0" width="8" height="8" />
      </>
    ),
  },
  motor: {
    viewBox: '0 0 26 26',
    anchoBase: 26,
    altoBase: 26,
    bordeInferior: 26,
    puertos: {
      norte: { x: 13, y: 2, dir: 'N' },
      sur: { x: 13, y: 24, dir: 'S' },
      este: { x: 24, y: 13, dir: 'E' },
      oeste: { x: 2, y: 13, dir: 'W' },
    },
    silueta: <circle cx="13" cy="13" r="11" />,
    decoracion: (
      <text x="13" y="17" fontSize="11" fontWeight="700" textAnchor="middle" fill="#23262a">
        M
      </text>
    ),
  },
};
