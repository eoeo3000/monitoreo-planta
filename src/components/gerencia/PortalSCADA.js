import React, { useState } from 'react';
import { condicionActual } from '../../analista/store';
import { SEVERIDAD, SEVERIDAD_ORDEN } from '../../analista/severidad';
import { SCADA_ICONOS } from '../../gerencia/scadaIconos';
import { puertoHacia, rutaPuertos } from '../../gerencia/puertos';
import './portalScada.css';

const PAD_LIENZO = 100; // margen alrededor de los equipos: el glifo más alto (tanque/agitador) mide 90
const PAD_ZONA = 70;
const ESTADO_COLOR = { normal: 'var(--e-normal)', observacion: 'var(--e-observacion)', alerta: 'var(--e-alerta)', alarma: 'var(--e-alarma)' };
const SIN_DIAGNOSTICO = 'var(--e-sindiagnostico)';

function rutaEntreEquiposScada(deEq, aEq, posDe, posA) {
  const iconoDe = SCADA_ICONOS[deEq.tipo];
  const iconoA = SCADA_ICONOS[aEq.tipo];
  if (!iconoDe || !iconoA) return null;
  const puertoDe = puertoHacia(posDe, iconoDe, posA);
  const puertoA = puertoHacia(posA, iconoA, posDe);
  if (!puertoDe || !puertoA) return null;
  return rutaPuertos(puertoDe, puertoA);
}

// Portal de gerencia: gramática visual aparte de Industry (handoff §10). Usa
// los mismos datos reales (equipos/áreas/conexiones/severidad y la posición
// ya ubicada en el editor de Planta) con otra piel — SCADA de operación,
// equipos con volumen teñidos por estado, tuberías, zonas por área. No
// incluye KPIs de producción, color de tubería por fluido ni tendencias:
// no hay ninguna fuente de esos datos en la app todavía.
export default function PortalSCADA({ data }) {
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);

  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);
  const equiposDePlanta = data.equipos.filter((eq) => areasDePlanta.some((a) => a.id === eq.areaId));
  const conexionesDePlanta = data.conexiones.filter((c) => c.plantaId === plantaId);

  const posicionDe = (eq) => eq.posicion || { x: 80, y: 80 };
  const estadoDe = (eq) => {
    const cond = condicionActual(eq.id, data.diagnosticos);
    return cond ? cond.severidad : null;
  };

  // KPIs derivados del arreglo de equipos, nunca escritos a mano (handoff §5/§10.5).
  const conteoPorEstado = equiposDePlanta.reduce((acc, eq) => {
    const est = estadoDe(eq) || 'sinDiagnostico';
    acc[est] = (acc[est] || 0) + 1;
    return acc;
  }, {});

  const peorEstadoDeArea = (area) => {
    const eqs = equiposDePlanta.filter((eq) => eq.areaId === area.id);
    let peor = null;
    eqs.forEach((eq) => {
      const est = estadoDe(eq);
      if (est && (!peor || SEVERIDAD_ORDEN.indexOf(est) > SEVERIDAD_ORDEN.indexOf(peor))) peor = est;
    });
    return peor;
  };

  const cajaDeArea = (area) => {
    const eqs = equiposDePlanta.filter((eq) => eq.areaId === area.id);
    if (eqs.length === 0) return null;
    const xs = eqs.map((eq) => posicionDe(eq).x);
    const ys = eqs.map((eq) => posicionDe(eq).y);
    return {
      x: Math.min(...xs) - PAD_ZONA,
      y: Math.min(...ys) - PAD_ZONA - 18,
      width: Math.max(...xs) - Math.min(...xs) + PAD_ZONA * 2,
      height: Math.max(...ys) - Math.min(...ys) + PAD_ZONA * 2 + 18,
    };
  };

  // Caja del lienzo: encierra todos los equipos de la planta con margen, para
  // que el circuito completo entre sin importar cuántos equipos ni dónde
  // quedaron ubicados en el editor de Planta.
  const posiciones = equiposDePlanta.map(posicionDe);
  const minX = Math.min(0, ...posiciones.map((p) => p.x)) - PAD_LIENZO;
  const minY = Math.min(0, ...posiciones.map((p) => p.y)) - PAD_LIENZO;
  const maxX = Math.max(240, ...posiciones.map((p) => p.x)) + PAD_LIENZO;
  const maxY = Math.max(240, ...posiciones.map((p) => p.y)) + PAD_LIENZO;

  return (
    <div className="scada" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 1, padding: 'var(--space-3)', flexWrap: 'wrap', borderBottom: '1px solid var(--scada-borde)' }}>
        <select
          value={plantaId || ''}
          onChange={(e) => setPlantaId(e.target.value)}
          style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, padding: '0 10px' }}
        >
          {data.plantas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <KpiTile label="Equipos" valor={equiposDePlanta.length} />
        <KpiTile label="Alarma" valor={conteoPorEstado.alarma || 0} color="var(--e-alarma)" />
        <KpiTile label="Alerta" valor={conteoPorEstado.alerta || 0} color="var(--e-alerta)" />
        <KpiTile label="Observación" valor={conteoPorEstado.observacion || 0} color="var(--e-observacion)" />
        <KpiTile label="Normal" valor={conteoPorEstado.normal || 0} color="var(--e-normal)" />
      </div>

      <div style={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
        <div style={{ width: 150, flexShrink: 0, borderRight: '1px solid var(--scada-borde)', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--scada-texto-2)', marginBottom: 6 }}>Sistemas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {areasDePlanta.map((area) => {
              const peor = peorEstadoDeArea(area);
              return (
                <div key={area.id} className="scada-sistema" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', fontSize: 12 }}>
                  <span>{area.nombre}</span>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: peor ? ESTADO_COLOR[peor] : SIN_DIAGNOSTICO }} />
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--scada-borde)' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--scada-texto-2)', marginBottom: 6 }}>Estado</div>
            {SEVERIDAD_ORDEN.map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, flexShrink: 0, background: ESTADO_COLOR[s] }} />
                {SEVERIDAD[s].label.toUpperCase()}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, flexShrink: 0, background: SIN_DIAGNOSTICO }} />
              SIN DIAGNÓSTICO
            </div>
          </div>
        </div>

        <div style={{ flexGrow: 1, minWidth: 0, padding: 'var(--space-3)' }}>
          {!plantaId ? (
            <p style={{ color: 'var(--scada-texto-2)' }}>No hay plantas creadas todavía.</p>
          ) : (
            <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}>
              <defs>
                <linearGradient id="scadaGradMetal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8f9497" />
                  <stop offset="35%" stopColor="#e2e4e5" />
                  <stop offset="70%" stopColor="#b0b4b6" />
                  <stop offset="100%" stopColor="#6f7477" />
                </linearGradient>
                {Object.entries(SCADA_ICONOS).map(([tipo, icono]) => (
                  <clipPath key={tipo} id={`scada-clip-${tipo}`}>
                    {icono.silueta}
                  </clipPath>
                ))}
              </defs>

              {areasDePlanta.map((area) => {
                const caja = cajaDeArea(area);
                if (!caja) return null;
                return (
                  <g key={area.id}>
                    <rect className="scada-zona" x={caja.x} y={caja.y} width={caja.width} height={caja.height} fill="none" stroke="var(--scada-zona)" strokeWidth={1} strokeDasharray="4 3" />
                    <text x={caja.x + 8} y={caja.y + 14} fontSize={11} fontFamily="Barlow Condensed" fontWeight={600} letterSpacing="0.04em" fill="var(--scada-texto-2)">
                      {area.nombre.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {conexionesDePlanta.map((c) => {
                const de = equiposDePlanta.find((eq) => eq.id === c.deId);
                const a = equiposDePlanta.find((eq) => eq.id === c.aId);
                if (!de || !a) return null;
                const ruta = rutaEntreEquiposScada(de, a, posicionDe(de), posicionDe(a));
                if (!ruta) return null;
                return <path key={c.id} d={ruta.d} fill="none" stroke="var(--scada-tuberia)" strokeWidth={2} strokeLinecap="butt" shapeRendering="crispEdges" />;
              })}

              {equiposDePlanta.map((eq) => {
                const icono = SCADA_ICONOS[eq.tipo];
                if (!icono) return null;
                const pos = posicionDe(eq);
                const estado = estadoDe(eq);
                const colorEstado = estado ? ESTADO_COLOR[estado] : SIN_DIAGNOSTICO;
                return (
                  <g key={eq.id} transform={`translate(${pos.x - icono.anchoBase / 2}, ${pos.y - icono.altoBase})`}>
                    <g fill="url(#scadaGradMetal)" stroke="#23262a" strokeWidth={1}>
                      {icono.silueta}
                    </g>
                    <g clipPath={`url(#scada-clip-${eq.tipo})`} style={{ mixBlendMode: 'multiply' }}>
                      <rect x={0} y={0} width={icono.anchoBase} height={icono.altoBase} fill={colorEstado} opacity={0.45} />
                    </g>
                    {icono.decoracion}
                    <text
                      x={icono.anchoBase / 2}
                      y={icono.altoBase + 13}
                      textAnchor="middle"
                      fontSize={10}
                      fontFamily="Barlow Condensed"
                      fontWeight={600}
                      letterSpacing="0.02em"
                      fill="var(--scada-texto)"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {eq.tag}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, valor, color }) {
  return (
    <div style={{ background: 'var(--scada-panel)', padding: '4px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 72 }}>
      <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--scada-texto-2)' }}>{label}</span>
      <span style={{ fontSize: 22, fontFamily: 'Barlow Condensed', fontWeight: 600, color: color || 'var(--scada-texto)', fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}
