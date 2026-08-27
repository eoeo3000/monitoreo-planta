import React, { useEffect, useRef, useState } from 'react';
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
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [arrastre, setArrastre] = useState(null); // { id, offsetX, offsetY } — offset fijo del punto donde se agarró
  const [posicionArrastre, setPosicionArrastre] = useState(null); // { id, x, y } — posición en vivo, sin tocar el store todavía

  const color = (sev) => colorDeSeveridad(sev, SEVERIDAD_EN_COLOR);

  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);
  const equiposDePlanta = data.equipos.filter((eq) => areasDePlanta.some((a) => a.id === eq.areaId));
  const conexionesDePlanta = data.conexiones.filter((c) => c.plantaId === plantaId);

  // Mientras se arrastra, la posición vive solo en este componente — recién se
  // guarda en el store (y en localStorage) al soltar el mouse. Escribir en cada
  // mousemove hacía que todo el arrastre se sintiera trabado.
  const posicionDe = (eq) => (posicionArrastre?.id === eq.id ? posicionArrastre : eq.posicion) || { x: 80, y: 80 };

  const puntoSvg = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onMouseDownNodo = (event, eq) => {
    if (!modoEdicion || modoConectar) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    const pos = eq.posicion || { x: 80, y: 80 };
    setArrastre({ id: eq.id, offsetX: p.x - pos.x, offsetY: p.y - pos.y });
  };

  const onMouseMove = (event) => {
    const p = puntoSvg(event);
    if (arrastre) {
      setPosicionArrastre({
        id: arrastre.id,
        x: Math.max(0, Math.round(p.x - arrastre.offsetX)),
        y: Math.max(0, Math.round(p.y - arrastre.offsetY)),
      });
    }
    if (modoConectar && origenConexion) {
      setMousePos(p);
    }
  };

  const onMouseUp = () => {
    if (posicionArrastre) {
      moverEquipo(posicionArrastre.id, { x: posicionArrastre.x, y: posicionArrastre.y });
    }
    setArrastre(null);
    setPosicionArrastre(null);
  };

  // Conectar es un flujo de dos clics: el primero fija el origen (origenConexion),
  // el segundo crea la flecha hacia el equipo clickeado. Clic de nuevo sobre el
  // mismo origen, o Escape, cancela sin crear nada.
  const onClickNodo = (eq) => {
    if (!modoEdicion || !modoConectar) return;
    if (!origenConexion) {
      setOrigenConexion(eq.id);
    } else if (origenConexion === eq.id) {
      setOrigenConexion(null);
    } else {
      crearConexion(plantaId, origenConexion, eq.id);
      setOrigenConexion(null);
    }
  };

  const alternarModoConectar = () => {
    setModoConectar((m) => !m);
    setOrigenConexion(null);
  };

  useEffect(() => {
    if (!modoConectar) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOrigenConexion(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modoConectar]);

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
            <input
              type="checkbox"
              checked={modoEdicion}
              onChange={(e) => {
                setModoEdicion(e.target.checked);
                setModoConectar(false);
                setOrigenConexion(null);
              }}
            />
            <span>Modo edición</span>
          </label>
          {modoEdicion && (
            <>
              <button
                className="btn btn-secondary"
                onClick={alternarModoConectar}
                style={modoConectar ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent-700)' } : undefined}
              >
                {!modoConectar ? '+ Conectar equipos' : !origenConexion ? 'Elige el equipo de origen…' : 'Elige el equipo de destino…'}
              </button>
              <p style={{ fontSize: 11, color: 'var(--color-neutral-600)', margin: 0 }}>
                {modoConectar
                  ? origenConexion
                    ? 'Haz clic en el equipo de destino. Clic de nuevo en el origen, o Esc, para cancelar.'
                    : 'Haz clic en el equipo de origen. Puedes conectar varios pares seguidos sin volver a activar el botón.'
                  : 'Arrastra un equipo para reposicionarlo, o activa "Conectar equipos" para dibujar flechas de flujo.'}
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
              style={{ display: 'block', cursor: modoConectar && origenConexion ? 'crosshair' : undefined }}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              {conexionesDePlanta.map((c) => {
                const de = equiposDePlanta.find((eq) => eq.id === c.deId);
                const a = equiposDePlanta.find((eq) => eq.id === c.aId);
                if (!de || !a) return null;
                const linea = acortarLinea(posicionDe(de), posicionDe(a), NODO_ANCHO / 2);
                return (
                  <g key={c.id}>
                    <line x1={linea.x1} y1={linea.y1} x2={linea.x2} y2={linea.y2} stroke="var(--color-accent)" strokeWidth={1} />
                    <circle cx={linea.x1} cy={linea.y1} r={2.5} fill="var(--color-accent)" />
                    <circle cx={linea.x2} cy={linea.y2} r={2.5} fill="var(--color-accent)" />
                  </g>
                );
              })}

              {modoConectar && origenConexion && mousePos && (() => {
                const eqOrigen = equiposDePlanta.find((eq) => eq.id === origenConexion);
                if (!eqOrigen) return null;
                const p1 = posicionDe(eqOrigen);
                return (
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={mousePos.x}
                    y2={mousePos.y}
                    stroke="var(--color-accent)"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    pointerEvents="none"
                  />
                );
              })()}

              {equiposDePlanta.map((eq) => {
                const cond = condicionActual(eq.id, data.diagnosticos);
                const c = cond ? color(cond.severidad) : 'var(--color-neutral-400)';
                const pos = posicionDe(eq);
                const origen = origenConexion === eq.id;
                const icono = EQUIPO_ICONOS[eq.tipo];
                const colorGlifo = origen ? 'var(--color-accent-800)' : 'var(--color-neutral-700)';
                return (
                  <g
                    key={eq.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onMouseDown={(e) => onMouseDownNodo(e, eq)}
                    onClick={() => onClickNodo(eq)}
                    style={{ cursor: modoEdicion ? (modoConectar ? 'pointer' : arrastre?.id === eq.id ? 'grabbing' : 'grab') : 'default' }}
                  >
                    {/* Área invisible para poder arrastrar/hacer clic sin dibujar un recuadro */}
                    <rect
                      x={-NODO_ANCHO / 2}
                      y={-NODO_ALTO / 2}
                      width={NODO_ANCHO}
                      height={NODO_ALTO}
                      fill="transparent"
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
                        style={{ color: colorGlifo }}
                      >
                        {icono.svg}
                      </svg>
                    )}
                    <text
                      x={0}
                      y={22}
                      textAnchor="middle"
                      fontSize={10}
                      fontFamily="Barlow Condensed"
                      fontWeight={600}
                      letterSpacing="0.02em"
                      fill={origen ? 'var(--color-accent-700)' : 'var(--color-text)'}
                    >
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
