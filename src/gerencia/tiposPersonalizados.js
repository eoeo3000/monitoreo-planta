import React from 'react';
import { formaAJsx } from './formas';

// Tipos de equipo creados desde Administración > Equipos (formulario "Crear
// tipo de equipo"): formas simples (círculo/rectángulo/línea) + puertos de
// conexión, guardadas como datos planos en data.tiposPersonalizados — no como
// JSX, porque tienen que sobrevivir un JSON.stringify a localStorage.

export const TIPOS_FORMA = ['circulo', 'rectangulo', 'linea'];

// Re-exportado para no cambiarle el import a Administracion.js — el dibujo
// de una forma primitiva vive en formas.js, compartido con scadaIconos.js.
export { formaAJsx };

// Convierte una definición guardada al mismo contrato que scadaIconos.js
// (viewBox/anchoBase/altoBase/bordeInferior/puertos/formas/silueta) para que
// PortalSCADA.js no tenga que distinguir entre tipos de fábrica y tipos
// creados por el usuario en ningún punto del renderizado ni del ruteo de
// conexiones (puertos.js) — `formas` es lo que usa este último para calcular
// el punto del perímetro real más cercano al conectar a mano.
export function iconoDeTipoPersonalizado(tipoDef) {
  return {
    viewBox: `0 0 ${tipoDef.anchoBase} ${tipoDef.altoBase}`,
    anchoBase: tipoDef.anchoBase,
    altoBase: tipoDef.altoBase,
    bordeInferior: tipoDef.altoBase,
    puertos: tipoDef.puertos || {},
    formas: tipoDef.formas,
    silueta: <>{tipoDef.formas.map((f, i) => formaAJsx(f, i))}</>,
    decoracion: null,
  };
}
