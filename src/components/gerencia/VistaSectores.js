import React from 'react';
import { condicionActual } from '../../analista/store';

// Vista "macro" del Portal SCADA: cuando una planta tiene muchas ubicaciones
// (áreas), no tiene sentido dibujarlas todas juntas en un solo lienzo tipo
// P&ID. Esta pantalla agrupa las áreas por sector y muestra, por sector,
// solo los colores y cantidades por severidad — al hacer clic se entra al
// Portal SCADA ya filtrado a ese sector.
const ESTADO_COLOR = { normal: 'var(--e-normal)', observacion: 'var(--e-observacion)', alerta: 'var(--e-alerta)', alarma: 'var(--e-alarma)' };
const SIN_DIAGNOSTICO = 'var(--e-sindiagnostico)';
const ORDEN_ESTADOS = ['alarma', 'alerta', 'observacion', 'normal'];

export default function VistaSectores({ sectores, areas, equipos, diagnosticos, onSeleccionar }) {
  const estadoDe = (eq) => {
    const cond = condicionActual(eq.id, diagnosticos);
    return cond ? cond.severidad : null;
  };

  const grupos = sectores.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    areaIds: areas.filter((a) => a.sectorId === s.id).map((a) => a.id),
  }));
  const idsDeSectorValidos = new Set(sectores.map((s) => s.id));
  const areasSinSector = areas.filter((a) => !a.sectorId || !idsDeSectorValidos.has(a.sectorId));
  if (areasSinSector.length) {
    grupos.push({ id: null, nombre: 'Sin sector', areaIds: areasSinSector.map((a) => a.id) });
  }

  return (
    <div style={{ padding: 'var(--space-4)', overflowY: 'auto', flexGrow: 1, minHeight: 0 }}>
      <p style={{ fontSize: 12, color: 'var(--scada-texto-2)', margin: '0 0 var(--space-3) 0' }}>
        {areas.length} ubicaciones agrupadas en {sectores.length} sectores — hacé clic en uno para ver el detalle.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 'var(--space-3)' }}>
        {grupos.map((grupo) => {
          const eqsDelGrupo = equipos.filter((eq) => grupo.areaIds.includes(eq.areaId));
          const conteo = eqsDelGrupo.reduce((acc, eq) => {
            const est = estadoDe(eq) || 'sinDiagnostico';
            acc[est] = (acc[est] || 0) + 1;
            return acc;
          }, {});
          return (
            <button
              key={grupo.id ?? 'sin-sector'}
              onClick={() => onSeleccionar(grupo)}
              style={{
                textAlign: 'left',
                background: 'var(--scada-panel)',
                border: '1px solid var(--scada-borde)',
                color: 'var(--scada-texto)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>{grupo.nombre}</div>
              <div style={{ fontSize: 11, color: 'var(--scada-texto-2)' }}>
                {grupo.areaIds.length} ubicaciones · {eqsDelGrupo.length} equipos
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, flexWrap: 'wrap' }}>
                {ORDEN_ESTADOS.map((est) => (
                  <span key={est} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: ESTADO_COLOR[est] }} />
                    {conteo[est] || 0}
                  </span>
                ))}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--scada-texto-2)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: SIN_DIAGNOSTICO }} />
                  {conteo.sinDiagnostico || 0}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
