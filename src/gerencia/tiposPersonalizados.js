import React from 'react';

// Tipos de equipo creados desde Administración > Equipos (formulario "Crear
// tipo de equipo"): formas simples (círculo/rectángulo/línea) + puertos de
// conexión, guardadas como datos planos en data.tiposPersonalizados — no como
// JSX, porque tienen que sobrevivir un JSON.stringify a localStorage.

export const TIPOS_FORMA = ['circulo', 'rectangulo', 'linea'];

export function formaAJsx(forma, key) {
  if (forma.tipo === 'circulo') return <circle key={key} cx={forma.cx} cy={forma.cy} r={forma.r} />;
  if (forma.tipo === 'rectangulo') return <rect key={key} x={forma.x} y={forma.y} width={forma.ancho} height={forma.alto} />;
  if (forma.tipo === 'linea') return <line key={key} x1={forma.x1} y1={forma.y1} x2={forma.x2} y2={forma.y2} />;
  return null;
}

// Convierte una definición guardada al mismo contrato que scadaIconos.js
// (viewBox/anchoBase/altoBase/bordeInferior/puertos/silueta) para que
// PortalSCADA.js no tenga que distinguir entre tipos de fábrica y tipos
// creados por el usuario en ningún punto del renderizado ni del ruteo de
// conexiones (puertos.js).
export function iconoDeTipoPersonalizado(tipoDef) {
  return {
    viewBox: `0 0 ${tipoDef.anchoBase} ${tipoDef.altoBase}`,
    anchoBase: tipoDef.anchoBase,
    altoBase: tipoDef.altoBase,
    bordeInferior: tipoDef.altoBase,
    puertos: tipoDef.puertos || {},
    silueta: <>{tipoDef.formas.map((f, i) => formaAJsx(f, i))}</>,
    decoracion: null,
  };
}
