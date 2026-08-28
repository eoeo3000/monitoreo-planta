// Símbolos ISO 10628 (diagramas de flujo de proceso) para los 6 tipos reales de
// equipo (CATALOGO_MODO_FALLA): geometría austera, formas cerradas, sin adorno —
// el triángulo relleno de la bomba marca sentido de flujo, como en el estándar.
// viewBox unificado 0 0 48 32 para que todos los glifos compartan proporción.
//
// Todo equipo con accionamiento motorizado (bomba, agitador, compresor,
// clarificador con rastra, secador rotatorio) lleva el símbolo de motor
// estándar: círculo con "M" unido por una línea corta al eje o carcasa. El
// tanque queda sin motor por ser un recipiente pasivo.
//
// `escala` es el tamaño relativo de cada tipo frente al glifo base (1 = tamaño
// base) — ajustable acá sin tocar la lógica de dibujo en PlantaConcentradora.js.
// Un estanque real es más grande que una bomba, así que no todos dibujan igual.
const MOTOR = (
  <>
    <circle cx="24" cy="5" r="3.2" />
    <text x="24" y="7" fontSize="5" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">M</text>
  </>
);

export const EQUIPO_ICONOS = {
  bomba: {
    viewBox: '0 0 48 32',
    escala: 0.85,
    svg: (
      <>
        {MOTOR}
        <path d="M24 8.2 V12" />
        <circle cx="24" cy="20" r="8" />
        <path d="M20 16 L20 24 L29 20 Z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  tanque: {
    viewBox: '0 0 48 32',
    escala: 2,
    svg: (
      <>
        <rect x="15" y="3" width="18" height="26" />
      </>
    ),
  },
  agitador: {
    viewBox: '0 0 48 32',
    escala: 1.15,
    svg: (
      <>
        {MOTOR}
        <path d="M24 8.2 V22" />
        <path d="M13 10 H35 V29 H13 Z" />
        <path d="M17 22 L31 22 L24 28 Z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  compresor: {
    viewBox: '0 0 48 32',
    escala: 1,
    svg: (
      <>
        {MOTOR}
        <path d="M24 8.2 V15.5" />
        <path d="M11 13 L37 18 V24 L11 29 Z" />
      </>
    ),
  },
  clarificador: {
    viewBox: '0 0 48 32',
    escala: 1.2,
    svg: (
      <>
        {MOTOR}
        <path d="M24 8.2 V11" />
        <path d="M9 11 H39 L24 29 Z" />
      </>
    ),
  },
  secador: {
    viewBox: '0 0 48 32',
    escala: 1.2,
    svg: (
      <>
        {MOTOR}
        <path d="M24 8.2 V13" />
        <rect x="7" y="13" width="34" height="13" />
        <circle cx="16" cy="29" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="32" cy="29" r="2.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
};
