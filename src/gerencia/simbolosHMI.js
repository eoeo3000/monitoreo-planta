// Catálogo de 16 símbolos de proceso (handoff §4, copiados de
// handoff/Gerencia HMI.dc.html). viewBox 40x40, fill:none, stroke:currentColor,
// stroke-linecap/linejoin:round; el grosor de trazo se hereda del contenedor.
export const GRUPOS_SIMBOLOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'bombas', label: 'Bombas' },
  { id: 'tanques', label: 'Tanques' },
  { id: 'rotativos', label: 'Rotativos' },
  { id: 'instrumentos', label: 'Instrumentos' },
];

export const GRUPOS_INFO = {
  bombas: { orden: '01', titulo: 'Bombas', nota: 'Elementos de transporte de fluido' },
  tanques: { orden: '02', titulo: 'Tanques y vasijas', nota: 'Contención y transferencia térmica' },
  rotativos: { orden: '03', titulo: 'Equipos rotativos', nota: 'Sujetos a ruta de vibraciones' },
  instrumentos: { orden: '04', titulo: 'Instrumentos', nota: 'Medición y control en línea' },
};

export const CATALOGO_SIMBOLOS = [
  {
    key: 'bombaCentrifuga', nombre: 'Centrífuga', codigo: 'PMP-C', grupo: 'bombas',
    svg: (
      <>
        <circle cx="20" cy="22" r="10" />
        <path d="M20 12 V5 H31" />
        <path d="M10 22 H3" />
        <path d="M20 22 L27 17 M20 22 L15 30" />
      </>
    ),
  },
  {
    key: 'bombaDosificadora', nombre: 'Dosificadora', codigo: 'PMP-D', grupo: 'bombas',
    svg: (
      <>
        <rect x="6" y="15" width="17" height="13" />
        <path d="M23 21.5 H31" />
        <path d="M31 16 V27" />
        <path d="M6 21.5 H2" />
        <path d="M14.5 15 V9 H24" />
      </>
    ),
  },
  {
    key: 'bombaVacio', nombre: 'Vacío', codigo: 'PMP-V', grupo: 'bombas',
    svg: (
      <>
        <circle cx="20" cy="21" r="10" />
        <path d="M14 17 L20 26 L26 17" />
        <path d="M20 11 V4" />
        <path d="M30 21 H37" />
      </>
    ),
  },
  {
    key: 'bombaSumergible', nombre: 'Sumergible', codigo: 'PMP-S', grupo: 'bombas',
    svg: (
      <>
        <path d="M7 6 V33 H33 V6" />
        <path d="M7 14 H33" />
        <circle cx="20" cy="25" r="6" />
        <path d="M20 19 V9" />
      </>
    ),
  },
  {
    key: 'tanqueAtmosferico', nombre: 'Atmosférico', codigo: 'TQ-A', grupo: 'tanques',
    svg: (
      <>
        <rect x="8" y="8" width="24" height="26" />
        <path d="M8 22 H32" />
        <path d="M20 8 V3" />
      </>
    ),
  },
  {
    key: 'vasijaPresion', nombre: 'Presurizada', codigo: 'TQ-P', grupo: 'tanques',
    svg: (
      <>
        <path d="M10 12 V28 A10 6 0 0 0 30 28 V12 A10 6 0 0 0 10 12" />
        <path d="M10 12 A10 6 0 0 0 30 12" />
        <path d="M20 6 V3" />
      </>
    ),
  },
  {
    key: 'silo', nombre: 'Silo', codigo: 'SIL', grupo: 'tanques',
    svg: (
      <>
        <path d="M9 7 H31 V24 L22 34 H18 L9 24 Z" />
        <path d="M9 15 H31" />
      </>
    ),
  },
  {
    key: 'intercambiador', nombre: 'Intercambiador', codigo: 'HEX', grupo: 'tanques',
    svg: (
      <>
        <rect x="5" y="12" width="30" height="17" />
        <path d="M5 20.5 H12 L15 15 L20 26 L25 15 L28 20.5 H35" />
      </>
    ),
  },
  {
    key: 'agitador', nombre: 'Agitador', codigo: 'AG', grupo: 'rotativos',
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
  {
    key: 'compresor', nombre: 'Compresor', codigo: 'CP', grupo: 'rotativos',
    svg: (
      <>
        <circle cx="20" cy="20" r="11" />
        <path d="M12 12 L28 16 V24 L12 28" />
      </>
    ),
  },
  {
    key: 'motor', nombre: 'Motor', codigo: 'MOT', grupo: 'rotativos',
    svg: (
      <>
        <rect x="6" y="13" width="21" height="15" />
        <path d="M27 20.5 H35" />
        <path d="M11 13 V28 M16 13 V28 M21 13 V28" />
      </>
    ),
  },
  {
    key: 'soplador', nombre: 'Soplador', codigo: 'BLW', grupo: 'rotativos',
    svg: (
      <>
        <circle cx="20" cy="20" r="11" />
        <circle cx="20" cy="20" r="3" />
        <path d="M20 17 C20 10 14 9 12 13" />
        <path d="M22.6 21.5 C28.6 25 31 20 28 17" />
        <path d="M17.4 21.5 C11.4 25 12 30 16 30" />
      </>
    ),
  },
  {
    key: 'transmisorPresion', nombre: 'Presión', codigo: 'PT', grupo: 'instrumentos',
    svg: (
      <>
        <circle cx="20" cy="17" r="10" />
        <path d="M20 17 L26 12" />
        <path d="M20 27 V34" />
        <path d="M13 34 H27" />
      </>
    ),
  },
  {
    key: 'sensorVibracion', nombre: 'Vibración', codigo: 'VT', grupo: 'instrumentos',
    svg: (
      <>
        <rect x="5" y="14" width="11" height="13" />
        <path d="M21 13 C25 17 25 24 21 28" />
        <path d="M26 9 C32 15 32 26 26 32" />
        <path d="M5 27 V33 H16 V27" />
      </>
    ),
  },
  {
    key: 'caudalimetro', nombre: 'Caudal', codigo: 'FT', grupo: 'instrumentos',
    svg: (
      <>
        <path d="M3 14 H37 M3 26 H37" />
        <circle cx="20" cy="20" r="8" />
        <path d="M15 15 L25 20 L15 25" />
      </>
    ),
  },
  {
    key: 'valvulaControl', nombre: 'Válvula ctrl.', codigo: 'FCV', grupo: 'instrumentos',
    svg: (
      <>
        <path d="M9 22 L31 32 L31 22 L9 32 Z" />
        <path d="M20 27 V15" />
        <path d="M12 8 H28 V15 H12 Z" />
      </>
    ),
  },
];
