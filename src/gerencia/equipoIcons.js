// Símbolos ISO 10628 (diagramas de flujo de proceso) para los 6 tipos reales de
// equipo (CATALOGO_MODO_FALLA): geometría austera, formas cerradas, sin adorno —
// el triángulo relleno de la bomba marca sentido de flujo, como en el estándar.
// viewBox unificado 0 0 48 32 para que todos los glifos compartan proporción.
//
// `escala` es el tamaño relativo de cada tipo frente al glifo base (1 = tamaño
// base) — ajustable acá sin tocar la lógica de dibujo en PlantaConcentradora.js.
// Un estanque real es más grande que una bomba, así que no todos dibujan igual.
export const EQUIPO_ICONOS = {
  bomba: {
    viewBox: '0 0 48 32',
    escala: 0.85,
    svg: (
      <>
        <circle cx="24" cy="16" r="10" />
        <path d="M20 10 L20 22 L31 16 Z" fill="currentColor" stroke="none" />
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
        <rect x="20" y="2" width="8" height="6" />
        <path d="M24 8 V26" />
        <path d="M13 6 H35 V29 H13 Z" />
        <path d="M17 21 L31 21 L24 27 Z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  compresor: {
    viewBox: '0 0 48 32',
    escala: 1,
    svg: (
      <>
        <path d="M11 8 L37 13 V19 L11 24 Z" />
      </>
    ),
  },
  clarificador: {
    viewBox: '0 0 48 32',
    escala: 1.2,
    svg: (
      <>
        <path d="M9 6 H39 L24 27 Z" />
      </>
    ),
  },
  secador: {
    viewBox: '0 0 48 32',
    escala: 1.2,
    svg: (
      <>
        <rect x="7" y="9" width="34" height="13" />
        <circle cx="16" cy="26" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="32" cy="26" r="2.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
};
