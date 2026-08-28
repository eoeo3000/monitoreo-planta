// Símbolos ISO 10628 (diagramas de flujo de proceso) para los tipos reales de
// equipo (CATALOGO_MODO_FALLA): geometría austera, formas cerradas, sin adorno —
// el triángulo relleno de la bomba marca sentido de flujo, como en el estándar.
// viewBox unificado 0 0 48 32 para que todos los glifos compartan proporción.
//
// El motor es un equipo propio (círculo con "M"), no un adorno dentro de otro
// ícono: se vincula a la bomba/equipo que impulsa con una conexión normal del
// lienzo (línea), igual que cualquier otro flujo de proceso.
//
// `escala` es el tamaño relativo de cada tipo frente al glifo base (1 = tamaño
// base) — ajustable acá sin tocar la lógica de dibujo en PlantaConcentradora.js.
// Un estanque real es más grande que una bomba, así que no todos dibujan igual.
//
// `puertos`: puntos de conexión declarados en coordenadas del propio viewBox
// (handoff §9.1) — cada uno cae exactamente sobre el trazo del glifo (borde
// del círculo, muro del rectángulo, vértice del cono), nunca en el aire. `dir`
// es la normal de salida (N/S/E/W). src/gerencia/puertos.js los usa para que
// las conexiones del lienzo arranquen y terminen justo en el dibujo, sin
// holgura, eligiendo automáticamente el puerto más orientado hacia el otro
// equipo (no hay selector manual de puerto en la UI de "Conectar equipos").
export const EQUIPO_ICONOS = {
  motor: {
    viewBox: '0 0 48 32',
    escala: 0.6,
    puertos: {
      norte: { x: 24, y: 5, dir: 'N' },
      sur: { x: 24, y: 27, dir: 'S' },
      este: { x: 35, y: 16, dir: 'E' },
      oeste: { x: 13, y: 16, dir: 'W' },
    },
    svg: (
      <>
        <circle cx="24" cy="16" r="11" />
        <text x="24" y="20" fontSize="12" fontWeight="700" textAnchor="middle" fill="currentColor" stroke="none">M</text>
      </>
    ),
  },
  bomba: {
    viewBox: '0 0 48 32',
    escala: 0.85,
    puertos: {
      succion: { x: 14, y: 16, dir: 'W' },
      descarga: { x: 31, y: 16, dir: 'E' },
      motor: { x: 24, y: 6, dir: 'N' },
    },
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
    puertos: {
      entradaSup: { x: 24, y: 3, dir: 'N' },
      salidaInf: { x: 24, y: 29, dir: 'S' },
      lateralIzq: { x: 15, y: 16, dir: 'W' },
      lateralDer: { x: 33, y: 16, dir: 'E' },
    },
    svg: (
      <>
        <rect x="15" y="3" width="18" height="26" />
      </>
    ),
  },
  agitador: {
    viewBox: '0 0 48 32',
    escala: 1.15,
    puertos: {
      accionador: { x: 24, y: 2, dir: 'N' },
      salidaInf: { x: 24, y: 29, dir: 'S' },
      lateralIzq: { x: 13, y: 17, dir: 'W' },
      lateralDer: { x: 35, y: 17, dir: 'E' },
    },
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
    puertos: {
      entrada: { x: 11, y: 16, dir: 'W' },
      salida: { x: 37, y: 16, dir: 'E' },
      motor: { x: 24, y: 10.5, dir: 'N' },
    },
    svg: (
      <>
        <path d="M11 8 L37 13 V19 L11 24 Z" />
      </>
    ),
  },
  clarificador: {
    viewBox: '0 0 48 32',
    escala: 1.2,
    puertos: {
      entrada: { x: 24, y: 6, dir: 'N' },
      overflowIzq: { x: 9, y: 6, dir: 'W' },
      overflowDer: { x: 39, y: 6, dir: 'E' },
      underflow: { x: 24, y: 27, dir: 'S' },
    },
    svg: (
      <>
        <path d="M9 6 H39 L24 27 Z" />
      </>
    ),
  },
  secador: {
    viewBox: '0 0 48 32',
    escala: 1.2,
    puertos: {
      entrada: { x: 7, y: 15.5, dir: 'W' },
      salida: { x: 41, y: 15.5, dir: 'E' },
      vaporSup: { x: 24, y: 9, dir: 'N' },
    },
    svg: (
      <>
        <rect x="7" y="9" width="34" height="13" />
        <circle cx="16" cy="26" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="32" cy="26" r="2.6" fill="currentColor" stroke="none" />
      </>
    ),
  },
};
