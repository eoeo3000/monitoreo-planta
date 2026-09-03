import { SCADA_ICONOS } from './scadaIconos';
import { iconoDeTipoPersonalizado } from './tiposPersonalizados';

// Resuelve el ícono de un tipo tanto si es de fábrica (scadaIconos.js) como
// si fue creado por el usuario (data.tiposPersonalizados) — el resto de la
// app no distingue entre ambos casos. Compartido entre PortalSCADA.js (para
// dibujar) y layout/ (para calcular tamaños, ej. al compactar una planta).
export function iconoBaseDe(tipo, data) {
  if (SCADA_ICONOS[tipo]) return SCADA_ICONOS[tipo];
  const personalizado = (data.tiposPersonalizados || []).find((t) => t.clave === tipo);
  return personalizado ? iconoDeTipoPersonalizado(personalizado) : null;
}

// Escala con la que se DIBUJA un equipo. Dos capas que se multiplican, y no
// compiten entre sí:
//
//   tamaño elegido   eq.escalaPropia → data.escalasPorTipo[tipo] → 1
//   factor de la app eq.factorAuto (o 1)
//
// La primera capa es de quien mira: el panel "Tamaños de equipo" fija el
// tipo y el doble clic sobre un equipo lo pisa solo para ese — el más
// específico gana. La segunda la escribe la app y nadie la edita a mano: es
// el factor con el que el compactado agrandó TODA una planta (y el tamaño
// con el que nace la planta demo).
//
// Están separadas a propósito. Antes el compactado escribía su resultado
// dentro de escalaPropia, así que después de compactar una planta el panel
// por tipo dejaba de tener efecto sobre ella: cada equipo ya traía un valor
// propio que le ganaba. Multiplicando, bajar "tanque" a la mitad se nota
// siempre, esté la planta compactada o no.
export function escalaVisible(eq, data) {
  const elegida = eq.escalaPropia ?? data.escalasPorTipo?.[eq.tipo] ?? 1;
  return elegida * (eq.factorAuto ?? 1);
}

export function iconoConEscala(eq, data) {
  const base = iconoBaseDe(eq.tipo, data);
  if (!base) return null;
  return { ...base, escala: escalaVisible(eq, data) };
}
