import { SCADA_ICONOS } from './scadaIconos';
import { iconoDeTipoPersonalizado } from './tiposPersonalizados';

// Resuelve el ícono de un tipo tanto si es de fábrica (scadaIconos.js) como
// si fue creado por el usuario (data.tiposPersonalizados) — el resto de la
// app no distingue entre ambos casos. Compartido entre PortalSCADA.js (para
// dibujar) y store.js (para calcular tamaños, ej. al compactar una planta).
export function iconoBaseDe(tipo, data) {
  if (SCADA_ICONOS[tipo]) return SCADA_ICONOS[tipo];
  const personalizado = (data.tiposPersonalizados || []).find((t) => t.clave === tipo);
  return personalizado ? iconoDeTipoPersonalizado(personalizado) : null;
}

// El panel "Tamaños de equipo" sobrescribe, por tipo, un multiplicador de
// escala sobre el tamaño base del ícono (data.escalasPorTipo); el doble clic
// sobre UN equipo puede sobrescribirlo de nuevo solo para ese equipo
// (eq.escalaPropia) — el más específico gana.
export function iconoConEscala(eq, data) {
  const base = iconoBaseDe(eq.tipo, data);
  if (!base) return null;
  const escala = eq.escalaPropia ?? data.escalasPorTipo?.[eq.tipo] ?? 1;
  return { ...base, escala };
}
