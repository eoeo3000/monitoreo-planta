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
const UMBRAL_ARRASTRE = 4; // px de movimiento antes de considerar que es un arrastre y no un clic
const CUADRICULA = 20; // px por celda — al mover un equipo, su posición se ajusta a este tamaño

const ajustarACuadricula = (v) => Math.round(v / CUADRICULA) * CUADRICULA;

// Conector ortogonal (en ángulo recto, no diagonal) con un quiebre a medio camino
// en X — mismo lenguaje visual que los conectores del demo original. Los extremos
// se corren un poco hacia el quiebre para que el punto no quede tapado por el nodo.
function rutaOrtogonal(p1, p2, margen) {
  const midX = (p1.x + p2.x) / 2;
  const dir1 = Math.sign(midX - p1.x);
  const dir2 = Math.sign(p2.x - midX);
  const inicio = { x: p1.x + dir1 * margen, y: p1.y };
  const fin = { x: p2.x - dir2 * margen, y: p2.y };
  return {
    d: `M ${inicio.x} ${inicio.y} H ${midX} V ${p2.y} H ${fin.x}`,
    inicio,
    fin,
    medio: { x: midX, y: (p1.y + p2.y) / 2 },
  };
}

// Vista + editor de las plantas reales creadas en Administración (no un demo fijo):
// equipos coloreados por condición actual, posicionables y conectables con flechas
// de flujo de proceso (puramente visuales). Reemplaza el mock "Planta Concentradora"
// del handoff, que quedó en el historial de git si se necesita como referencia.
export default function PlantaConcentradora({ data, moverEquipo, crearPlanta, crearConexion, eliminarConexion }) {
  const svgRef = useRef(null);
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [mousedownInfo, setMousedownInfo] = useState(null); // { id, startX, startY, offsetX, offsetY } — desde el mousedown, antes de saber si es clic o arrastre
  const [arrastre, setArrastre] = useState(null); // { id, offsetX, offsetY } — se confirma solo si hay movimiento real
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

  // No decidimos en el mousedown si es clic o arrastre: guardamos el punto de
  // partida y recién en el mousemove, si hay movimiento real, se confirma como
  // arrastre. Así se puede reposicionar un equipo aunque "Conectar equipos"
  // siga activo — antes había que desactivarlo primero para poder moverlo.
  const onMouseDownNodo = (event, eq) => {
    if (!modoEdicion) return;
    event.stopPropagation();
    const p = puntoSvg(event);
    const pos = eq.posicion || { x: 80, y: 80 };
    setMousedownInfo({ id: eq.id, startX: p.x, startY: p.y, offsetX: p.x - pos.x, offsetY: p.y - pos.y });
  };

  const onMouseMove = (event) => {
    const p = puntoSvg(event);
    if (mousedownInfo && !arrastre) {
      const dist = Math.hypot(p.x - mousedownInfo.startX, p.y - mousedownInfo.startY);
      if (dist > UMBRAL_ARRASTRE) {
        setArrastre({ id: mousedownInfo.id, offsetX: mousedownInfo.offsetX, offsetY: mousedownInfo.offsetY });
      }
    }
    if (arrastre) {
      setPosicionArrastre({
        id: arrastre.id,
        x: Math.max(0, ajustarACuadricula(p.x - arrastre.offsetX)),
        y: Math.max(0, ajustarACuadricula(p.y - arrastre.offsetY)),
      });
    }
    if (modoConectar && origenConexion) {
      setMousePos(p);
    }
  };

  const onMouseUp = () => {
    if (posicionArrastre) {
      moverEquipo(posicionArrastre.id, { x: posicionArrastre.x, y: posicionArrastre.y });
    } else if (mousedownInfo && modoConectar) {
      // Sin movimiento real: fue un clic, no un arrastre.
      const eq = equiposDePlanta.find((e) => e.id === mousedownInfo.id);
      if (eq) onClickNodo(eq);
    }
    setMousedownInfo(null);
    setArrastre(null);
    setPosicionArrastre(null);
  };

  // Conectar es un flujo de dos clics: el primero fija el origen (origenConexion),
  // el segundo crea la flecha hacia el equipo clickeado. Clic de nuevo sobre el
  // mismo origen, o Escape, cancela sin crear nada.
  const onClickNodo = (eq) => {
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
                    ? 'Haz clic en el equipo de destino. Clic de nuevo en el origen, o Esc, para cancelar. Arrastrar sigue funcionando igual.'
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
              <defs>
                <pattern id="cuadricula" width={CUADRICULA} height={CUADRICULA} patternUnits="userSpaceOnUse">
                  <circle cx={1} cy={1} r={1} fill="var(--color-neutral-300)" />
                </pattern>
              </defs>
              {modoEdicion && (
                <rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#cuadricula)" pointerEvents="none" />
              )}

              {conexionesDePlanta.map((c) => {
                const de = equiposDePlanta.find((eq) => eq.id === c.deId);
                const a = equiposDePlanta.find((eq) => eq.id === c.aId);
                if (!de || !a) return null;
                const ruta = rutaOrtogonal(posicionDe(de), posicionDe(a), NODO_ANCHO / 2);
                return (
                  <g key={c.id}>
                    <path d={ruta.d} fill="none" stroke="var(--color-accent)" strokeWidth={1} />
                    <circle cx={ruta.inicio.x} cy={ruta.inicio.y} r={2.5} fill="var(--color-accent)" />
                    <circle cx={ruta.fin.x} cy={ruta.fin.y} r={2.5} fill="var(--color-accent)" />
                    {modoEdicion && (
                      <g
                        transform={`translate(${ruta.medio.x}, ${ruta.medio.y})`}
                        onClick={() => {
                          if (window.confirm('¿Eliminar esta conexión?')) eliminarConexion(c.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle r={7} fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth={1} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={9} fill="var(--color-accent-700)">
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {modoConectar && origenConexion && mousePos && (() => {
                const eqOrigen = equiposDePlanta.find((eq) => eq.id === origenConexion);
                if (!eqOrigen) return null;
                const ruta = rutaOrtogonal(posicionDe(eqOrigen), mousePos, 0);
                return <path d={ruta.d} fill="none" stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="4 3" pointerEvents="none" />;
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
                    style={{ cursor: !modoEdicion ? 'default' : arrastre?.id === eq.id ? 'grabbing' : 'grab' }}
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
                        x={-20}
                        y={-24}
                        width={40}
                        height={25}
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
