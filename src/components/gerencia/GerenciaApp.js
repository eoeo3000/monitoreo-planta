import React, { useMemo, useRef, useState } from 'react';
import { SEVERIDAD } from '../../analista/severidad';
import { EQUIPO_ICONOS } from '../../gerencia/equipoIcons';
import { SECUENCIA_AREAS } from '../../analista/mockData';
import EquipoDetalleModal from './EquipoDetalleModal';
import NuevoEquipoModal from './NuevoEquipoModal';

const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 420;

export default function GerenciaApp({ data, crearArea, actualizarZonaArea, crearEquipo, moverEquipo }) {
  const svgRef = useRef(null);
  const [plantaSeleccionadaId, setPlantaSeleccionadaId] = useState(data.plantas[0]?.id || null);
  const [equipoDetalleId, setEquipoDetalleId] = useState(null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [mostrarNuevoEquipo, setMostrarNuevoEquipo] = useState(false);
  const [arrastre, setArrastre] = useState(null); // { tipo: 'equipo'|'zona'|'zona-resize', id, offsetX, offsetY, posInicial }

  const areasDePlanta = data.areas
    .filter((a) => a.plantaId === plantaSeleccionadaId)
    .sort((a, b) => SECUENCIA_AREAS.indexOf(a.id) - SECUENCIA_AREAS.indexOf(b.id));
  const equiposDePlanta = data.equipos.filter((eq) => areasDePlanta.some((a) => a.id === eq.areaId));

  // Flechas de flujo entre zonas consecutivas de la secuencia (solo entre las que están
  // ordenadas en SECUENCIA_AREAS; un área nueva agregada fuera de la secuencia no genera flecha).
  const flechasSecuencia = areasDePlanta
    .filter((a) => SECUENCIA_AREAS.includes(a.id))
    .sort((a, b) => SECUENCIA_AREAS.indexOf(a.id) - SECUENCIA_AREAS.indexOf(b.id))
    .reduce((flechas, area, i, arr) => {
      if (i === 0) return flechas;
      const anterior = data.zonas[arr[i - 1].id];
      const actual = data.zonas[area.id];
      if (!anterior || !actual) return flechas;
      flechas.push({
        id: `${arr[i - 1].id}-${area.id}`,
        x1: anterior.x + anterior.width,
        y1: anterior.y + anterior.height / 2,
        x2: actual.x,
        y2: actual.y + actual.height / 2,
      });
      return flechas;
    }, []);

  const historialPorEquipo = (equipoId) =>
    data.diagnosticos
      .filter((d) => d.equipoId === equipoId)
      .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));

  const equipoDetalle = data.equipos.find((eq) => eq.id === equipoDetalleId);
  const detalleData = useMemo(() => {
    if (!equipoDetalle) return null;
    const historial = historialPorEquipo(equipoDetalle.id);
    return {
      historial,
      avisosAbiertos: data.avisos.filter((a) => a.equipoId === equipoDetalle.id && a.estado !== 'cerrado'),
      evidencias: data.evidencias.filter((ev) => historial.some((d) => d.id === ev.diagnosticoId)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipoDetalle, data]);

  const puntoSvg = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const iniciarArrastreEquipo = (event, eq) => {
    if (!modoEdicion) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    const pos = eq.posicion || { x: 60, y: 60 };
    setArrastre({ tipo: 'equipo', id: eq.id, offsetX: p.x - pos.x, offsetY: p.y - pos.y });
  };

  const iniciarArrastreZona = (event, area) => {
    if (!modoEdicion) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    const zona = data.zonas[area.id];
    setArrastre({ tipo: 'zona', id: area.id, offsetX: p.x - zona.x, offsetY: p.y - zona.y });
  };

  const iniciarResizeZona = (event, area) => {
    if (!modoEdicion) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    const zona = data.zonas[area.id];
    setArrastre({ tipo: 'zona-resize', id: area.id, offsetX: p.x - (zona.x + zona.width), offsetY: p.y - (zona.y + zona.height) });
  };

  const onMouseMove = (event) => {
    if (!arrastre) return;
    const p = puntoSvg(event);
    if (arrastre.tipo === 'equipo') {
      moverEquipo(arrastre.id, { x: Math.round(p.x - arrastre.offsetX), y: Math.round(p.y - arrastre.offsetY) });
    } else if (arrastre.tipo === 'zona') {
      const zona = data.zonas[arrastre.id];
      actualizarZonaArea(arrastre.id, {
        ...zona,
        x: Math.round(p.x - arrastre.offsetX),
        y: Math.round(p.y - arrastre.offsetY),
      });
    } else if (arrastre.tipo === 'zona-resize') {
      const zona = data.zonas[arrastre.id];
      actualizarZonaArea(arrastre.id, {
        ...zona,
        width: Math.max(80, Math.round(p.x - arrastre.offsetX - zona.x)),
        height: Math.max(60, Math.round(p.y - arrastre.offsetY - zona.y)),
      });
    }
  };

  const onMouseUp = () => setArrastre(null);

  const agregarArea = () => {
    const nombre = window.prompt('Nombre de la nueva área:');
    if (nombre && nombre.trim()) crearArea(plantaSeleccionadaId, nombre.trim());
  };

  const confirmarNuevoEquipo = ({ tag, tipo, areaId, descripcion }) => {
    const zona = data.zonas[areaId];
    const posicion = zona
      ? { x: Math.round(zona.x + zona.width / 2), y: Math.round(zona.y + zona.height / 2) }
      : { x: 60, y: 60 };
    crearEquipo(areaId, { tag, tipo, descripcion, posicion });
    setMostrarNuevoEquipo(false);
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: '#f5f5f5' }}>
      {/* PANEL IZQUIERDO: VISTAS/PLANTAS */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #e0e0e0', padding: 16, overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Vistas</h3>
        {data.plantas.map((planta) => (
          <div
            key={planta.id}
            onClick={() => setPlantaSeleccionadaId(planta.id)}
            style={{
              padding: '8px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              background: planta.id === plantaSeleccionadaId ? '#e3f2fd' : 'transparent',
              fontSize: '0.9rem',
            }}
          >
            {planta.nombre}
          </div>
        ))}

        <h4 style={{ marginTop: 24, marginBottom: 8, fontSize: '0.8rem' }}>Leyenda de condición</h4>
        {Object.entries(SEVERIDAD).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color }} />
            <span style={{ fontSize: '0.75rem' }}>{cfg.label}</span>
          </div>
        ))}
        <p style={{ fontSize: '0.7rem', color: '#999', marginTop: 12 }}>
          El color representa la condición vibratoria del equipo, no su estado operacional
          (encendido/apagado).
        </p>

        <hr style={{ margin: '20px 0' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={modoEdicion} onChange={(e) => setModoEdicion(e.target.checked)} />
          Modo edición
        </label>

        {modoEdicion && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => setMostrarNuevoEquipo(true)}>+ Nuevo equipo</button>
            <button onClick={agregarArea}>+ Nueva área</button>
            <p style={{ fontSize: '0.7rem', color: '#999' }}>
              Arrastra un equipo para reposicionarlo, o el borde inferior derecho de una zona para
              redimensionarla.
            </p>
          </div>
        )}
      </aside>

      {/* DIAGRAMA DE PLANTA (placeholder hasta contar con el layout real) */}
      <main style={{ flexGrow: 1, padding: 24, overflow: 'auto' }}>
        <svg
          ref={svgRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{ background: '#fff', borderRadius: 8, cursor: modoEdicion ? 'default' : 'default' }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <defs>
            <marker id="flecha-secuencia" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#1565c0" />
            </marker>
          </defs>

          {flechasSecuencia.map((f) => (
            <line
              key={f.id}
              x1={f.x1}
              y1={f.y1}
              x2={f.x2}
              y2={f.y2}
              stroke="#1565c0"
              strokeWidth={2}
              markerEnd="url(#flecha-secuencia)"
            />
          ))}

          {areasDePlanta.map((area) => {
            const zona = data.zonas[area.id];
            if (!zona) return null;
            return (
              <g key={area.id}>
                <rect
                  x={zona.x}
                  y={zona.y}
                  width={zona.width}
                  height={zona.height}
                  fill="#fafafa"
                  stroke="#ccc"
                  strokeDasharray="4 3"
                  onMouseDown={(e) => iniciarArrastreZona(e, area)}
                  style={{ cursor: modoEdicion ? 'move' : 'default' }}
                />
                <text x={zona.x + 8} y={zona.y + 18} fontSize={12} fill="#888">
                  {area.nombre}
                </text>
                {modoEdicion && (
                  <rect
                    x={zona.x + zona.width - 10}
                    y={zona.y + zona.height - 10}
                    width={10}
                    height={10}
                    fill="#1565c0"
                    onMouseDown={(e) => iniciarResizeZona(e, area)}
                    style={{ cursor: 'nwse-resize' }}
                  />
                )}
              </g>
            );
          })}

          {equiposDePlanta.map((eq) => {
            const historial = historialPorEquipo(eq.id);
            const condicion = historial[0] || null;
            const color = condicion ? SEVERIDAD[condicion.severidad].color : '#bbb';
            const icono = EQUIPO_ICONOS[eq.tipo];
            const { x, y } = eq.posicion || { x: 60, y: 60 };
            return (
              <g
                key={eq.id}
                transform={`translate(${x - 20}, ${y - 20})`}
                onMouseDown={(e) => iniciarArrastreEquipo(e, eq)}
                onDoubleClick={() => !modoEdicion && setEquipoDetalleId(eq.id)}
                style={{ cursor: modoEdicion ? 'grab' : 'pointer' }}
              >
                <circle cx={20} cy={20} r={24} fill="#fff" stroke={color} strokeWidth={3} />
                <foreignObject x={0} y={0} width={40} height={40} style={{ pointerEvents: 'none' }}>
                  {icono ? icono(color) : null}
                </foreignObject>
                <text x={20} y={58} fontSize={11} fontWeight="bold" textAnchor="middle" fill="#333">
                  {eq.tag}
                </text>
              </g>
            );
          })}
        </svg>
        <p style={{ fontSize: '0.75rem', color: '#999', marginTop: 8 }}>
          Diagrama placeholder — reemplazar por el layout real de planta cuando esté disponible.
          {modoEdicion ? ' Modo edición activo.' : ' Doble clic en un equipo para ver su detalle.'}
        </p>
      </main>

      {equipoDetalle && detalleData && (
        <EquipoDetalleModal
          equipo={equipoDetalle}
          historial={detalleData.historial}
          avisosAbiertos={detalleData.avisosAbiertos}
          evidencias={detalleData.evidencias}
          onClose={() => setEquipoDetalleId(null)}
        />
      )}

      {mostrarNuevoEquipo && (
        <NuevoEquipoModal
          areas={areasDePlanta}
          areaIdInicial={areasDePlanta[0]?.id}
          tagsExistentes={data.equipos.map((eq) => eq.tag)}
          onCancel={() => setMostrarNuevoEquipo(false)}
          onCrear={confirmarNuevoEquipo}
        />
      )}
    </div>
  );
}
