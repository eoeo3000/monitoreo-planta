// Glifos de trazo fino para los 6 tipos reales de equipo (CATALOGO_MODO_FALLA),
// en el mismo lenguaje visual del handoff (stroke:currentColor, sin relleno,
// round linecap/linejoin). bomba/clarificador/secador se copian tal cual de los
// nodos "bomba1", "espesador" y "horno" del demo Planta Concentradora original;
// tanque/agitador/compresor se copian del catálogo de símbolos HMI.
export const EQUIPO_ICONOS = {
  bomba: {
    viewBox: '0 0 48 32',
    svg: (
      <>
        <circle cx="24" cy="18" r="9" />
        <path d="M24 9 V4 H34" />
        <path d="M15 18 H8" />
        <path d="M24 18 L30 14 M24 18 L20 25" />
      </>
    ),
  },
  tanque: {
    viewBox: '0 0 40 40',
    svg: (
      <>
        <rect x="8" y="8" width="24" height="26" />
        <path d="M8 22 H32" />
        <path d="M20 8 V3" />
      </>
    ),
  },
  agitador: {
    viewBox: '0 0 40 40',
    svg: (
      <>
        <path d="M8 10 V33 H32 V10" />
        <path d="M20 4 V27" />
        <path d="M13 22 H27" />
        <path d="M15 27 H25" />
        <path d="M14 4 H26" />
      </>
    ),
  },
  compresor: {
    viewBox: '0 0 40 40',
    svg: (
      <>
        <circle cx="20" cy="20" r="11" />
        <path d="M12 12 L28 16 V24 L12 28" />
      </>
    ),
  },
  clarificador: {
    viewBox: '0 0 48 32',
    svg: (
      <>
        <path d="M5 8 H43 L24 27 Z" />
        <path d="M5 13 H43" />
        <path d="M24 4 V8" />
      </>
    ),
  },
  secador: {
    viewBox: '0 0 48 32',
    svg: (
      <>
        <path d="M8 20 H40 V10 H8 Z" />
        <path d="M18 10 V20 M30 10 V20" />
        <circle cx="16" cy="25" r="3" />
        <circle cx="32" cy="25" r="3" />
      </>
    ),
  },
};
