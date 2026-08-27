import React, { useRef, useState } from 'react';
import Blueprint from '../../theme/Blueprint';
import { condicionActual } from '../../analista/store';
import { colorDeSeveridad } from '../../analista/severidad';
import { EQUIPO_ICONOS } from '../../gerencia/equipoIcons';
import './gerenciaHMI.css';

const SEVERIDAD_EN_COLOR = true;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 460;
const NODO_ANCHO = 64;
const NODO_ALTO = 56;

// Acorta la línea desde ambos extremos para que la flecha no quede tapada por el
// nodo (rectangular) ni nazca desde su centro.
function acortarLinea(p1, p2, margen) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  return {
    x1: p1.x + ux * margen,
    y1: p1.y + uy * margen,
    x2: p2.x - ux * margen,
    y2: p2.y - uy * margen,
  };
}

// Vista + editor de las plantas reales creadas en Administración (no un demo fijo):
// equipos coloreados por condición actual, posicionables y conectables con flechas
// de flujo de proceso (puramente visuales). Reemplaza el mock "Planta Concentradora"
// del handoff, que quedó en el historial de git si se necesita como referencia.
export default function PlantaConcentradora({ data, moverEquipo, crearPlanta, crearConexion }) {
  const svgRef = useRef(null);
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [conectandoDesde, setConectandoDesde] = useState(null);
  const [arrastre, setArrastre] = useState(null);

  const color = (sev) => colorDeSeveridad(sev, SEVERIDAD_EN_COLOR);

  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);
  const equiposDePlanta = data.equipos.filter((eq) => areasDePlanta.some((a) => a.id === eq.areaId));
  const conexionesDePlanta = data.conexiones.filter((c) => c.plantaId === plantaId);

  const puntoSvg = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onMouseDownNodo = (event, eq) => {
    if (!modoEdicion || conectandoDesde) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    const pos = eq.posicion || { x: 80, y: 80 };
    setArrastre({ id: eq.id, offsetX: p.x - pos.x, offsetY: p.y - pos.y });
  };

  const onMouseMove = (event) => {
    if (!arrastre) return;
    const p = puntoSvg(event);
    moverEquipo(arrastre.id, { x: Math.max(0, Math.round(p.x - arrastre.offsetX)), y: Math.max(0, Math.round(p.y - arrastre.offsetY)) });
  };

  const onMouseUp = () => setArrastre(null);

  const onClickNodo = (eq) => {
    if (!modoEdicion) return;
    if (!conectandoDesde) return; // fuera de "conectar", el clic no hace nada (arrastrar ya lo cubre onMouseDown)
    if (conectandoDesde !== eq.id) {
      crearConexion(plantaId, conectandoDesde, eq.id);
    }
    setConectandoDesde(null);
  };

  const agregarPlanta = () => {
    const nombre = window.prompt('Nombre de la nueva planta:');
    if (nombre && nombre.trim()) {
      const id = crearPlanta(nombre.trim());
      setPlantaId(id);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <aside style={{ width: 236, flexShrink: 0, borderRight: '1px solid var(--color-divider)', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Gerencia</div>
          <h1 style={{ fontSize: 24, margin: 'var(--space-1) 0 0', letterSpacing: '0.01em' }}>PLANTA</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {data.plantas.map((p) => (
            <div
              key={p.id}
              onClick={() => setPlantaId(p.id)}
              style={{
                cursor: 'pointer',
                padding: 'var(--space-2) var(--space-3)',
                fontSize: 14,
                fontFamily: 'var(--font-heading)',
                background: p.id === plantaId ? 'var(--color-accent-100)' : 'transparent',
                boxShadow: p.id === plantaId ? 'inset 2px 0 0 var(--color-accent)' : 'none',
              }}
            >
              {p.nombre}
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={agregarPlanta}>+ Nueva planta</button>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label className="seg-opt" style={{ border: '1px solid var(--color-divider)' }}>
            <input type="checkbox" checked={modoEdicion} onChange={(e) => { setModoEdicion(e.target.checked); setConectandoDesde(null); }} />
            <span>Modo edición</span>
          </label>
          {modoEdicion && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setConectandoDesde(conectandoDesde ? null : '__armar__')}
                style={conectandoDesde ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent-700)' } : undefined}
              >
                {conectandoDesde === '__armar__' ? 'Elige el equipo de origen…' : conectandoDesde ? 'Elige el equipo de destino…' : '+ Conectar equipos'}
              </button>
              <p style={{ fontSize: 11, color: 'var(--color-neutral-600)', margin: 0 }}>
                Arrastra un equipo para reposicionarlo. Para conectar: activa el botón, haz clic en el equipo de origen y luego en el de destino.
              </p>
            </>
          )}
        </div>
      </aside>

      <div style={{ flexGrow: 1, padding: 'var(--space-4) var(--space-6)', overflow: 'auto' }}>
        {!plantaId ? (
          <p style={{ color: 'var(--color-neutral-600)' }}>Crea una planta para empezar.</p>
        ) : (
          <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'inline-block' }}>
            <svg
              ref={svgRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              style={{ display: 'block' }}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <defs>
                <marker id="flecha-conexion" markerWidth="8" markerHeight="8" refX="7" refY="3.5" orient="auto">
                  <path d="M0 0 L7 3.5 L0 7 Z" fill="var(--color-accent)" />
                </marker>
              </defs>

              {conexionesDePlanta.map((c) => {
                const de = equiposDePlanta.find((eq) => eq.id === c.deId);
                const a = equiposDePlanta.find((eq) => eq.id === c.aId);
                if (!de || !a) return null;
                const linea = acortarLinea(de.posicion || { x: 80, y: 80 }, a.posicion || { x: 80, y: 80 }, NODO_ANCHO / 2);
                return (
                  <line
                    key={c.id}
                    x1={linea.x1}
                    y1={linea.y1}
                    x2={linea.x2}
                    y2={linea.y2}
                    stroke="var(--color-accent)"
                    strokeWidth={1.5}
                    markerEnd="url(#flecha-conexion)"
                  />
                );
              })}

              {equiposDePlanta.map((eq) => {
                const cond = condicionActual(eq.id, data.diagnosticos);
                const c = cond ? color(cond.severidad) : 'var(--color-neutral-400)';
                const pos = eq.posicion || { x: 80, y: 80 };
                const origen = conectandoDesde === eq.id;
                const icono = EQUIPO_ICONOS[eq.tipo];
                return (
                  <g
                    key={eq.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onMouseDown={(e) => onMouseDownNodo(e, eq)}
                    onClick={() => onClickNodo(eq)}
                    style={{ cursor: modoEdicion ? (conectandoDesde ? 'pointer' : 'grab') : 'default' }}
                  >
                    <rect
                      x={-NODO_ANCHO / 2}
                      y={-NODO_ALTO / 2}
                      width={NODO_ANCHO}
                      height={NODO_ALTO}
                      fill={origen ? 'var(--color-accent-100)' : 'var(--color-bg)'}
                      stroke={origen ? 'var(--color-accent)' : 'var(--color-neutral-400)'}
                      strokeWidth={origen ? 2 : 1.5}
                    />
                    <rect x={NODO_ANCHO / 2 - 9} y={-NODO_ALTO / 2 + 3} width={6} height={6} fill={c} />
                    {icono && (
                      <svg
                        x={-16}
                        y={-19}
                        width={32}
                        height={20}
                        viewBox={icono.viewBox}
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: origen ? 'var(--color-accent-800)' : 'var(--color-neutral-700)' }}
                      >
                        {icono.svg}
                      </svg>
                    )}
                    <text x={0} y={22} textAnchor="middle" fontSize={10} fontFamily="Barlow Condensed" fontWeight={600} letterSpacing="0.02em" fill="var(--color-text)">
                      {eq.tag}
                    </text>
                  </g>
                );
              })}
            </svg>
          </Blueprint>
        )}
      </div>
    </div>
  );
}
