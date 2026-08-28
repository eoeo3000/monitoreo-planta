import React, { useEffect, useRef, useState } from 'react';
import Blueprint from '../../theme/Blueprint';
import { condicionActual } from '../../analista/store';
import { colorDeSeveridad } from '../../analista/severidad';
import { EQUIPO_ICONOS } from '../../gerencia/equipoIcons';
import { puertoHacia, rutaPuertos, rutaHaciaPunto } from '../../gerencia/puertos';
import './gerenciaHMI.css';

const SEVERIDAD_EN_COLOR = true;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 460;
const NODO_ANCHO = 84;
const NODO_ALTO = 72;
const UMBRAL_ARRASTRE = 4; // px de movimiento antes de considerar que es un arrastre y no un clic
const CUADRICULA = 20; // px por celda — al mover un equipo, su posición se ajusta a este tamaño
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_PASO = 0.15;

const ajustarACuadricula = (v) => Math.round(v / CUADRICULA) * CUADRICULA;

// El panel "Tamaños de equipo" guarda, por tipo, una sobrescritura de `escala`
// en el store (data.escalasPorTipo) — cuando no hay una guardada, se usa el
// valor de fábrica de equipoIcons.js.
function iconoConEscala(tipo, escalasPorTipo) {
  const base = EQUIPO_ICONOS[tipo];
  if (!base) return null;
  const escala = escalasPorTipo?.[tipo] ?? base.escala;
  return { ...base, escala };
}

// Ruta de una conexión real entre dos equipos: cada extremo usa el puerto de
// su glifo mejor orientado hacia el otro equipo (handoff §9) — el trazo nace
// y muere exactamente sobre el dibujo, sin margen ni holgura inventados.
function rutaEntreEquipos(deEq, aEq, posDe, posA, escalasPorTipo) {
  const iconoDe = iconoConEscala(deEq.tipo, escalasPorTipo);
  const iconoA = iconoConEscala(aEq.tipo, escalasPorTipo);
  const puertoDe = puertoHacia(posDe, iconoDe, posA);
  const puertoA = puertoHacia(posA, iconoA, posDe);
  if (!puertoDe || !puertoA) return null;
  return rutaPuertos(puertoDe, puertoA);
}

// Vista + editor de las plantas reales creadas en Administración (no un demo fijo):
// equipos coloreados por condición actual, posicionables y conectables con flechas
// de flujo de proceso (puramente visuales). Reemplaza el mock "Planta Concentradora"
// del handoff, que quedó en el historial de git si se necesita como referencia.
export default function PlantaConcentradora({ data, moverEquipo, crearPlanta, crearConexion, eliminarConexion, renombrarEquipo, duplicarEquipo, cambiarEscalaTipo }) {
  const svgRef = useRef(null);
  const tagInputRef = useRef(null);
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState(null);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [mousedownInfo, setMousedownInfo] = useState(null); // { id, startX, startY, offsetX, offsetY } — desde el mousedown, antes de saber si es clic o arrastre
  const [arrastre, setArrastre] = useState(null); // { id, offsetX, offsetY } — se confirma solo si hay movimiento real
  const [posicionArrastre, setPosicionArrastre] = useState(null); // { id, x, y } — posición en vivo, sin tocar el store todavía
  const [zoom, setZoom] = useState(1);

  const color = (sev) => colorDeSeveridad(sev, SEVERIDAD_EN_COLOR);

  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);
  const equiposDePlanta = data.equipos.filter((eq) => areasDePlanta.some((a) => a.id === eq.areaId));
  const conexionesDePlanta = data.conexiones.filter((c) => c.plantaId === plantaId);

  // Mientras se arrastra, la posición vive solo en este componente — recién se
  // guarda en el store (y en localStorage) al soltar el mouse. Escribir en cada
  // mousemove hacía que todo el arrastre se sintiera trabado.
  const posicionDe = (eq) => (posicionArrastre?.id === eq.id ? posicionArrastre : eq.posicion) || { x: 80, y: 80 };

  // getBoundingClientRect ya refleja el zoom aplicado por CSS (transform: scale),
  // así que hay que deshacerlo para volver a las coordenadas intrínsecas del SVG
  // (las mismas en las que están guardadas las posiciones de los equipos).
  const puntoSvg = (event) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
  };

  const cambiarZoom = (delta) => {
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));
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
    } else if (mousedownInfo) {
      // Clic simple fuera del flujo de conexión: selecciona el equipo para
      // mostrar el panel de "Equipo seleccionado" (renombrar TAG / duplicar).
      setEquipoSeleccionado((sel) => (sel === mousedownInfo.id ? null : mousedownInfo.id));
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
    setEquipoSeleccionado(null);
  };

  useEffect(() => {
    if (!modoEdicion) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setOrigenConexion(null);
      setEquipoSeleccionado(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modoEdicion]);

  // Al duplicar, o al hacer clic en un equipo distinto, el campo de TAG queda
  // enfocado y con el texto seleccionado — listo para escribir encima.
  useEffect(() => {
    if (equipoSeleccionado && tagInputRef.current) {
      tagInputRef.current.focus();
      tagInputRef.current.select();
    }
  }, [equipoSeleccionado]);

  const agregarPlanta = () => {
    const nombre = window.prompt('Nombre de la nueva planta:');
    if (nombre && nombre.trim()) {
      const id = crearPlanta(nombre.trim());
      setPlantaId(id);
      setEquipoSeleccionado(null);
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
              onClick={() => {
                setPlantaId(p.id);
                setEquipoSeleccionado(null);
              }}
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

        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', marginBottom: 'var(--space-2)' }}>
            Zoom
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--color-neutral-300)' }}>
            <button className="btn btn-secondary" onClick={() => cambiarZoom(-ZOOM_PASO)} style={{ background: 'var(--color-bg)', borderRadius: 0, width: 30, padding: 0 }}>
              −
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setZoom(1)}
              style={{ background: 'var(--color-bg)', borderRadius: 0, flexGrow: 1, padding: 0, fontVariantNumeric: 'tabular-nums' }}
            >
              {Math.round(zoom * 100)} %
            </button>
            <button className="btn btn-secondary" onClick={() => cambiarZoom(ZOOM_PASO)} style={{ background: 'var(--color-bg)', borderRadius: 0, width: 30, padding: 0 }}>
              +
            </button>
          </div>
        </div>

        <details>
          <summary style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', cursor: 'pointer' }}>
            Tamaños de equipo
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 'var(--space-2)' }}>
            {Object.keys(EQUIPO_ICONOS).map((tipo) => {
              const escalaActual = data.escalasPorTipo?.[tipo] ?? EQUIPO_ICONOS[tipo].escala;
              const cambiar = (delta) => cambiarEscalaTipo(tipo, Math.min(6, Math.max(0.2, Math.round((escalaActual + delta) * 100) / 100)));
              return (
                <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 1, background: 'var(--color-neutral-300)' }}>
                  <span style={{ flexGrow: 1, fontSize: 12, textTransform: 'capitalize', padding: '4px 6px', background: 'var(--color-bg)' }}>{tipo}</span>
                  <button className="btn btn-secondary" onClick={() => cambiar(-0.1)} style={{ background: 'var(--color-bg)', borderRadius: 0, width: 26, padding: 0 }}>
                    −
                  </button>
                  <span style={{ width: 34, textAlign: 'center', fontSize: 12, background: 'var(--color-bg)', fontVariantNumeric: 'tabular-nums' }}>
                    {escalaActual.toFixed(2)}
                  </span>
                  <button className="btn btn-secondary" onClick={() => cambiar(0.1)} style={{ background: 'var(--color-bg)', borderRadius: 0, width: 26, padding: 0 }}>
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </details>

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
                  : 'Arrastra un equipo para reposicionarlo, haz clic para seleccionarlo, o activa "Conectar equipos" para dibujar flechas de flujo.'}
              </p>
              {!modoConectar && equipoSeleccionado && (() => {
                const eqSel = equiposDePlanta.find((eq) => eq.id === equipoSeleccionado);
                if (!eqSel) return null;
                return (
                  <div style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>
                      Equipo seleccionado · {eqSel.tipo}
                    </div>
                    <input
                      key={eqSel.id}
                      ref={tagInputRef}
                      className="input"
                      defaultValue={eqSel.tag}
                      onBlur={(e) => renombrarEquipo(eqSel.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => setEquipoSeleccionado(duplicarEquipo(eqSel.id))}
                    >
                      Duplicar equipo
                    </button>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </aside>

      <div style={{ flexGrow: 1, padding: 'var(--space-4) var(--space-6)', overflow: 'auto' }}>
        {!plantaId ? (
          <p style={{ color: 'var(--color-neutral-600)' }}>Crea una planta para empezar.</p>
        ) : (
          <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'inline-block' }}>
            <div style={{ overflow: 'auto', maxWidth: '100%', maxHeight: '76vh' }}>
              <div style={{ width: Math.round(CANVAS_WIDTH * zoom), height: Math.round(CANVAS_HEIGHT * zoom) }}>
                <svg
                  ref={svgRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  style={{
                    display: 'block',
                    transformOrigin: '0 0',
                    transform: `scale(${zoom})`,
                    cursor: modoConectar && origenConexion ? 'crosshair' : undefined,
                  }}
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
                const ruta = rutaEntreEquipos(de, a, posicionDe(de), posicionDe(a), data.escalasPorTipo);
                if (!ruta) return null;
                return (
                  <g key={c.id}>
                    <path d={ruta.d} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinecap="round" shapeRendering="crispEdges" />
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
                const posOrigen = posicionDe(eqOrigen);
                const puertoOrigen = puertoHacia(posOrigen, iconoConEscala(eqOrigen.tipo, data.escalasPorTipo), mousePos);
                if (!puertoOrigen) return null;
                const ruta = rutaHaciaPunto(puertoOrigen, mousePos);
                return <path d={ruta.d} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinecap="round" strokeDasharray="4 3" pointerEvents="none" />;
              })()}

              {equiposDePlanta.map((eq) => {
                const cond = condicionActual(eq.id, data.diagnosticos);
                const c = cond ? color(cond.severidad) : 'var(--color-neutral-400)';
                const pos = posicionDe(eq);
                const origen = origenConexion === eq.id;
                const seleccionado = equipoSeleccionado === eq.id;
                const icono = iconoConEscala(eq.tipo, data.escalasPorTipo);
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
                      stroke={seleccionado ? 'var(--color-accent)' : 'none'}
                      strokeWidth={seleccionado ? 1 : 0}
                    />
                    <rect x={NODO_ANCHO / 2 - 13} y={-NODO_ALTO / 2 + 4} width={10} height={10} fill={c} />
                    {icono && (() => {
                      // Ancho/alto base 52x35 a escala 1; cada tipo tiene su propio
                      // tamaño relativo (editable en equipoIcons.js) — el borde
                      // inferior queda fijo así el TAG de abajo no se mueve.
                      const anchoIcono = 52 * (icono.escala || 1);
                      const altoIcono = 35 * (icono.escala || 1);
                      return (
                        <svg
                          x={-anchoIcono / 2}
                          y={5 - altoIcono}
                          width={anchoIcono}
                          height={altoIcono}
                          viewBox={icono.viewBox}
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: colorGlifo }}
                        >
                          {icono.svg}
                        </svg>
                      );
                    })()}
                    <text
                      x={0}
                      y={32}
                      textAnchor="middle"
                      fontSize={11}
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
              </div>
            </div>
          </Blueprint>
        )}
      </div>
    </div>
  );
}
