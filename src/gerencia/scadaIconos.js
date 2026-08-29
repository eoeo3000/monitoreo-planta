import { formaAJsx } from './formas';

// Glifos "con volumen" para el Portal de gerencia SCADA — figuras rellenas,
// no íconos de trazo. Es la única gramática de equipos que usa la app; ver
// PortalSCADA.js.
//
// Cada tipo declara `formas` (círculos/óvalos/rectángulos/polígonos, en las
// mismas coordenadas que `puertos`) — es la silueta real, que puertos.js usa
// para calcular el punto del perímetro más cercano al conectar a mano (no
// una caja invisible que envuelve al glifo). `silueta` (la versión dibujable,
// SIN fill/stroke propio: PortalSCADA.js decide degradado + insignia de
// estado en tanque/agitador, relleno plano en el color de estado para el
// resto) se deriva de `formas` una sola vez acá. `decoracion` son detalles
// que van encima sin ser parte del contorno conectable (el eje del agitador,
// la letra "M" del motor).
//
// El tamaño relativo entre tipos (tanque = agitador > clarificador = secador
// > compresor > bomba = motor) sigue el mismo orden acordado con el usuario,
// ajustable en vivo por tipo desde el panel "Tamaños de equipo" del Portal.
function icono(datos) {
  return { ...datos, silueta: datos.formas.map((f, i) => formaAJsx(f, i)) };
}

export const SCADA_ICONOS = {
  tanque: icono({
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
    formas: [
      { tipo: 'rectangulo', x: 4, y: 14, ancho: 36, alto: 68 },
      { tipo: 'elipse', cx: 22, cy: 14, rx: 18, ry: 6 },
      { tipo: 'elipse', cx: 22, cy: 82, rx: 18, ry: 6 },
    ],
  }),
  agitador: {
    ...icono({
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
      formas: [
        { tipo: 'rectangulo', x: 4, y: 14, ancho: 36, alto: 68 },
        { tipo: 'elipse', cx: 22, cy: 14, rx: 18, ry: 6 },
        { tipo: 'elipse', cx: 22, cy: 82, rx: 18, ry: 6 },
        { tipo: 'rectangulo', x: 16, y: 0, ancho: 12, alto: 10 },
      ],
    }),
    decoracion: <line x1="22" y1="10" x2="22" y2="38" stroke="var(--scada-subpanel)" strokeWidth="2" />,
  },
  clarificador: icono({
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
    formas: [
      { tipo: 'rectangulo', x: 4, y: 18, ancho: 72, alto: 28 },
      { tipo: 'elipse', cx: 40, cy: 18, rx: 36, ry: 10 },
      { tipo: 'elipse', cx: 40, cy: 46, rx: 36, ry: 10 },
    ],
  }),
  secador: icono({
    viewBox: '0 0 90 50',
    anchoBase: 90,
    altoBase: 50,
    bordeInferior: 50,
    puertos: {
      entrada: { x: 8, y: 25, dir: 'W' },
      salida: { x: 82, y: 25, dir: 'E' },
      vaporSup: { x: 45, y: 6, dir: 'N' },
    },
    formas: [
      { tipo: 'rectangulo', x: 14, y: 6, ancho: 62, alto: 38 },
      { tipo: 'elipse', cx: 14, cy: 25, rx: 6, ry: 19 },
      { tipo: 'elipse', cx: 76, cy: 25, rx: 6, ry: 19 },
    ],
  }),
  compresor: icono({
    viewBox: '0 0 50 36',
    anchoBase: 50,
    altoBase: 36,
    bordeInferior: 36,
    puertos: {
      entrada: { x: 6, y: 24, dir: 'W' },
      salida: { x: 44, y: 24, dir: 'E' },
      motor: { x: 25, y: 1, dir: 'N' },
    },
    formas: [
      {
        tipo: 'poligono',
        puntos: [
          { x: 8, y: 32 },
          { x: 42, y: 32 },
          { x: 36, y: 12 },
          { x: 14, y: 12 },
        ],
      },
      { tipo: 'circulo', cx: 25, cy: 9, r: 7 },
    ],
  }),
  // altoBase queda en 29, no 26: el círculo (cy=16) no está centrado en un
  // cuadro de 26 porque la tobera ocupa espacio arriba sin nada abajo que lo
  // compense. Con 29, la distancia del borde inferior al centro del círculo
  // (29-16=13) queda igual a la del motor (26-13=13) — mismo Y en los dos
  // equipos alinea los centros de verdad, no solo los bordes inferiores. Los
  // puertos y formas no cambian: la razón puerto.y/altoBase se mantiene
  // porque bordeInferior sigue igual a altoBase.
  bomba: icono({
    viewBox: '0 0 26 29',
    anchoBase: 26,
    altoBase: 29,
    bordeInferior: 29,
    puertos: {
      succion: { x: 2, y: 16, dir: 'W' },
      descarga: { x: 24, y: 16, dir: 'E' },
      motor: { x: 13, y: 1, dir: 'N' },
    },
    formas: [
      { tipo: 'circulo', cx: 13, cy: 16, r: 10 },
      { tipo: 'rectangulo', x: 9, y: 0, ancho: 8, alto: 8 },
    ],
  }),
  motor: {
    ...icono({
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
      formas: [{ tipo: 'circulo', cx: 13, cy: 13, r: 11 }],
    }),
    decoracion: (
      <text x="13" y="17" fontSize="11" fontWeight="700" textAnchor="middle" fill="var(--scada-texto)">
        M
      </text>
    ),
  },
};
