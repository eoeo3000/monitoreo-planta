import React, { useEffect, useRef, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { SEVERIDAD, SEVERIDAD_ORDEN } from '../../analista/severidad';
import { SCADA_ICONOS } from '../../gerencia/scadaIconos';
import { puertoHacia, rutaPuertos, rutaHaciaPunto } from '../../gerencia/puertos';
import './portalScada.css';

const PAD_LIENZO = 100; // margen alrededor de los equipos: el glifo más alto (tanque/agitador) mide 90
const PAD_ZONA = 70;
const PAD_HIT = 8; // margen del área invisible de clic/arrastre alrededor del glifo
const UMBRAL_ARRASTRE = 4; // px de movimiento antes de considerar que es un arrastre y no un clic
const CUADRICULA = 20; // px por celda — al mover un equipo, su posición se ajusta a este tamaño
const ESTADO_COLOR = { normal: 'var(--e-normal)', observacion: 'var(--e-observacion)', alerta: 'var(--e-alerta)', alarma: 'var(--e-alarma)' };
const SIN_DIAGNOSTICO = 'var(--e-sindiagnostico)';
// Regla dura de la piel "Overlook HMI": el único elemento con relieve/degradado
// permitido es el estanque metálico (tanque/agitador) — todo lo demás va plano,
// teñido directamente en el color de estado, sin gradiente ni mezcla.
const TIPOS_VASIJA = ['tanque', 'agitador'];

const ajustarACuadricula = (v) => Math.round(v / CUADRICULA) * CUADRICULA;

// El panel "Tamaños de equipo" sobrescribe, por tipo, un multiplicador de
// escala sobre el tamaño base de scadaIconos.js — mismo dato del store
// (data.escalasPorTipo) que usaba el editor de Planta.
function iconoConEscala(tipo, escalasPorTipo) {
  const base = SCADA_ICONOS[tipo];
  if (!base) return null;
  const escala = escalasPorTipo?.[tipo] ?? 1;
  return { ...base, escala };
}

function rutaEntreEquiposScada(deEq, aEq, posDe, posA, escalasPorTipo) {
  const iconoDe = iconoConEscala(deEq.tipo, escalasPorTipo);
  const iconoA = iconoConEscala(aEq.tipo, escalasPorTipo);
  if (!iconoDe || !iconoA) return null;
  const puertoDe = puertoHacia(posDe, iconoDe, posA);
  const puertoA = puertoHacia(posA, iconoA, posDe);
  if (!puertoDe || !puertoA) return null;
  return rutaPuertos(puertoDe, puertoA);
}

// Portal de gerencia: gramática visual aparte de Industry (piel "Overlook
// HMI"). Reemplaza también al editor de Planta — mismas funciones de edición
// (mover, conectar, seleccionar/renombrar/duplicar, tamaños por tipo) sobre
// los mismos datos reales, ahora en un único lugar. No incluye KPIs de
// producción, color de tubería por fluido ni tendencias: no hay ninguna
// fuente de esos datos en la app todavía.
export default function PortalSCADA({ data, moverEquipo, crearPlanta, crearConexion, eliminarConexion, renombrarEquipo, duplicarEquipo, cambiarEscalaTipo }) {
  const svgRef = useRef(null);
  const tagInputRef = useRef(null);
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || null);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modoConectar, setModoConectar] = useState(false);
  const [origenConexion, setOrigenConexion] = useState(null);
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [mousePos, setMousePos] = useState(null);
  const [mousedownInfo, setMousedownInfo] = useState(null);
  const [arrastre, setArrastre] = useState(null);
  const [posicionArrastre, setPosicionArrastre] = useState(null);

  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);
  const equiposDePlanta = data.equipos.filter((eq) => areasDePlanta.some((a) => a.id === eq.areaId));
  const conexionesDePlanta = data.conexiones.filter((c) => c.plantaId === plantaId);

  const posicionDe = (eq) => (posicionArrastre?.id === eq.id ? posicionArrastre : eq.posicion) || { x: 80, y: 80 };
  const estadoDe = (eq) => {
    const cond = condicionActual(eq.id, data.diagnosticos);
    return cond ? cond.severidad : null;
  };

  // KPIs derivados del arreglo de equipos, nunca escritos a mano.
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
  // quedaron ubicados. El lienzo usa viewBox (no zoom manual con transform):
  // siempre entra completo, y las coordenadas de mouse se convierten con la
  // matriz de pantalla del propio SVG (getScreenCTM), que ya la deshace sola.
  const posiciones = equiposDePlanta.map(posicionDe);
  const minX = Math.min(0, ...posiciones.map((p) => p.x)) - PAD_LIENZO;
  const minY = Math.min(0, ...posiciones.map((p) => p.y)) - PAD_LIENZO;
  const maxX = Math.max(240, ...posiciones.map((p) => p.x)) + PAD_LIENZO;
  const maxY = Math.max(240, ...posiciones.map((p) => p.y)) + PAD_LIENZO;

  const puntoSvg = (event) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

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
      const eq = equiposDePlanta.find((e) => e.id === mousedownInfo.id);
      if (eq) onClickNodo(eq);
    } else if (mousedownInfo) {
      setEquipoSeleccionado((sel) => (sel === mousedownInfo.id ? null : mousedownInfo.id));
    }
    setMousedownInfo(null);
    setArrastre(null);
    setPosicionArrastre(null);
  };

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
    <div className="scada" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 1, padding: 'var(--space-3)', flexWrap: 'wrap', borderBottom: '1px solid var(--scada-borde)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <select
            value={plantaId || ''}
            onChange={(e) => {
              setPlantaId(e.target.value);
              setEquipoSeleccionado(null);
            }}
            style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, padding: '0 10px', height: '100%' }}
          >
            {data.plantas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <button
            onClick={agregarPlanta}
            title="Nueva planta"
            style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 15, width: 30, cursor: 'pointer' }}
          >
            +
          </button>
        </div>
        <KpiTile label="Equipos" valor={equiposDePlanta.length} />
        <KpiTile label="Alarma" valor={conteoPorEstado.alarma || 0} color="var(--e-alarma)" />
        <KpiTile label="Alerta" valor={conteoPorEstado.alerta || 0} color="var(--e-alerta)" />
        <KpiTile label="Observación" valor={conteoPorEstado.observacion || 0} color="var(--e-observacion)" />
        <KpiTile label="Normal" valor={conteoPorEstado.normal || 0} color="var(--e-normal)" />
      </div>

      <div style={{ display: 'flex', flexGrow: 1, minHeight: 0 }}>
        <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--scada-borde)', padding: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', overflowY: 'auto' }}>
          <div>
            <div style={tituloSeccion}>Sistemas</div>
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
          </div>

          <div>
            <div style={tituloSeccion}>Estado</div>
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

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', border: '1px solid var(--scada-borde)', fontSize: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={modoEdicion}
              onChange={(e) => {
                setModoEdicion(e.target.checked);
                setModoConectar(false);
                setOrigenConexion(null);
                setEquipoSeleccionado(null);
              }}
            />
            Modo edición
          </label>

          {modoEdicion && (
            <>
              <button
                onClick={alternarModoConectar}
                style={{
                  background: 'var(--scada-panel)',
                  color: modoConectar ? 'var(--scada-titulo)' : 'var(--scada-texto)',
                  border: `1px solid ${modoConectar ? 'var(--scada-titulo)' : 'var(--scada-borde)'}`,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {!modoConectar ? '+ Conectar equipos' : !origenConexion ? 'Elige el equipo de origen…' : 'Elige el equipo de destino…'}
              </button>
              <p style={{ fontSize: 11, color: 'var(--scada-texto-2)', margin: 0 }}>
                {modoConectar
                  ? origenConexion
                    ? 'Haz clic en el equipo de destino. Clic de nuevo en el origen, o Esc, para cancelar.'
                    : 'Haz clic en el equipo de origen.'
                  : 'Arrastra un equipo para reposicionarlo, haz clic para seleccionarlo, o activa "Conectar equipos".'}
              </p>

              <details>
                <summary style={{ ...tituloSeccion, marginBottom: 0, cursor: 'pointer' }}>Tamaños de equipo</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 6 }}>
                  {Object.keys(SCADA_ICONOS).map((tipo) => {
                    const escalaActual = data.escalasPorTipo?.[tipo] ?? 1;
                    const cambiar = (delta) => cambiarEscalaTipo(tipo, Math.min(4, Math.max(0.3, Math.round((escalaActual + delta) * 100) / 100)));
                    return (
                      <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span style={{ flexGrow: 1, fontSize: 11, textTransform: 'capitalize', padding: '4px 6px', background: 'var(--scada-panel)' }}>{tipo}</span>
                        <button onClick={() => cambiar(-0.1)} style={botonMini}>
                          −
                        </button>
                        <span style={{ width: 32, textAlign: 'center', fontSize: 11, background: 'var(--scada-panel)', fontVariantNumeric: 'tabular-nums' }}>{escalaActual.toFixed(2)}</span>
                        <button onClick={() => cambiar(0.1)} style={botonMini}>
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>
              </details>

              {!modoConectar &&
                equipoSeleccionado &&
                (() => {
                  const eqSel = equiposDePlanta.find((eq) => eq.id === equipoSeleccionado);
                  if (!eqSel) return null;
                  return (
                    <div style={{ borderTop: '1px solid var(--scada-borde)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={tituloSeccion}>Equipo seleccionado · {eqSel.tipo}</div>
                      <input
                        key={eqSel.id}
                        ref={tagInputRef}
                        defaultValue={eqSel.tag}
                        onBlur={(e) => renombrarEquipo(eqSel.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.target.blur();
                        }}
                        style={{ background: 'var(--scada-subpanel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 13, padding: '6px 8px' }}
                      />
                      <button
                        onClick={() => setEquipoSeleccionado(duplicarEquipo(eqSel.id))}
                        style={{ background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: '1px solid var(--scada-borde)', fontFamily: 'inherit', fontSize: 12, padding: '8px 10px', cursor: 'pointer' }}
                      >
                        Duplicar equipo
                      </button>
                    </div>
                  );
                })()}
            </>
          )}
        </div>

        <div style={{ flexGrow: 1, minWidth: 0, padding: 'var(--space-3)', background: 'var(--scada-subpanel)' }}>
          {!plantaId ? (
            <p style={{ color: 'var(--scada-texto-2)' }}>No hay plantas creadas todavía.</p>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: '100%', display: 'block', cursor: modoConectar && origenConexion ? 'crosshair' : undefined }}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <defs>
                <linearGradient id="scadaGradMetal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8f9497" />
                  <stop offset="35%" stopColor="#e2e4e5" />
                  <stop offset="70%" stopColor="#b0b4b6" />
                  <stop offset="100%" stopColor="#6f7477" />
                </linearGradient>
                <pattern id="scadaCuadricula" width={CUADRICULA} height={CUADRICULA} patternUnits="userSpaceOnUse">
                  <circle cx={1} cy={1} r={1} fill="var(--scada-borde)" />
                </pattern>
              </defs>

              {modoEdicion && <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="url(#scadaCuadricula)" pointerEvents="none" />}

              {areasDePlanta.map((area) => {
                const caja = cajaDeArea(area);
                if (!caja) return null;
                return (
                  <g key={area.id}>
                    <rect className="scada-zona" x={caja.x} y={caja.y} width={caja.width} height={caja.height} fill="none" stroke="var(--scada-zona)" strokeWidth={1} strokeDasharray="4 3" />
                    <text x={caja.x + 8} y={caja.y + 14} fontSize={13} fontWeight={700} letterSpacing="0.04em" fill="var(--scada-titulo)">
                      {area.nombre.toUpperCase()}
                    </text>
                  </g>
                );
              })}

              {conexionesDePlanta.map((c) => {
                const de = equiposDePlanta.find((eq) => eq.id === c.deId);
                const a = equiposDePlanta.find((eq) => eq.id === c.aId);
                if (!de || !a) return null;
                const ruta = rutaEntreEquiposScada(de, a, posicionDe(de), posicionDe(a), data.escalasPorTipo);
                if (!ruta) return null;
                return (
                  <g key={c.id}>
                    <path d={ruta.d} fill="none" stroke="var(--scada-tuberia)" strokeWidth={2} strokeLinecap="butt" shapeRendering="crispEdges" />
                    <circle cx={ruta.inicio.x} cy={ruta.inicio.y} r={2.5} fill="var(--scada-tuberia)" />
                    <circle cx={ruta.fin.x} cy={ruta.fin.y} r={2.5} fill="var(--scada-tuberia)" />
                    {modoEdicion && (
                      <g
                        transform={`translate(${ruta.medio.x}, ${ruta.medio.y})`}
                        onClick={() => {
                          if (window.confirm('¿Eliminar esta conexión?')) eliminarConexion(c.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle r={7} fill="var(--scada-subpanel)" stroke="var(--scada-tuberia)" strokeWidth={1} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={9} fill="var(--scada-texto)">
                          ×
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {modoConectar &&
                origenConexion &&
                mousePos &&
                (() => {
                  const eqOrigen = equiposDePlanta.find((eq) => eq.id === origenConexion);
                  if (!eqOrigen) return null;
                  const posOrigen = posicionDe(eqOrigen);
                  const iconoOrigen = iconoConEscala(eqOrigen.tipo, data.escalasPorTipo);
                  const puertoOrigen = puertoHacia(posOrigen, iconoOrigen, mousePos);
                  if (!puertoOrigen) return null;
                  const ruta = rutaHaciaPunto(puertoOrigen, mousePos);
                  return <path d={ruta.d} fill="none" stroke="var(--scada-tuberia)" strokeWidth={2} strokeLinecap="round" strokeDasharray="4 3" pointerEvents="none" />;
                })()}

              {equiposDePlanta.map((eq) => {
                const icono = iconoConEscala(eq.tipo, data.escalasPorTipo);
                if (!icono) return null;
                const pos = posicionDe(eq);
                const estado = estadoDe(eq);
                const colorEstado = estado ? ESTADO_COLOR[estado] : SIN_DIAGNOSTICO;
                const esVasija = TIPOS_VASIJA.includes(eq.tipo);
                const anchoIcono = icono.anchoBase * icono.escala;
                const altoIcono = icono.altoBase * icono.escala;
                const origen = origenConexion === eq.id;
                const seleccionado = equipoSeleccionado === eq.id;
                return (
                  <g
                    key={eq.id}
                    transform={`translate(${pos.x - anchoIcono / 2}, ${pos.y - altoIcono})`}
                    onMouseDown={(e) => onMouseDownNodo(e, eq)}
                    style={{ cursor: !modoEdicion ? 'default' : arrastre?.id === eq.id ? 'grabbing' : 'grab' }}
                  >
                    <rect
                      x={-PAD_HIT}
                      y={-PAD_HIT}
                      width={anchoIcono + PAD_HIT * 2}
                      height={altoIcono + PAD_HIT * 2}
                      fill="transparent"
                      stroke={seleccionado || origen ? 'var(--scada-titulo)' : 'none'}
                      strokeWidth={seleccionado || origen ? 1 : 0}
                      strokeDasharray={origen ? '3 2' : undefined}
                    />
                    <g transform={`scale(${icono.escala})`}>
                      {esVasija ? (
                        <>
                          {/* Único elemento con relieve permitido: el silo/estanque metálico. */}
                          <g fill="url(#scadaGradMetal)" stroke="var(--scada-subpanel)" strokeWidth={1}>
                            {icono.silueta}
                          </g>
                          <rect x={4} y={-10} width={icono.anchoBase - 8} height={8} fill={colorEstado} stroke="var(--scada-subpanel)" strokeWidth={1} />
                        </>
                      ) : (
                        <g fill={colorEstado} stroke="var(--scada-subpanel)" strokeWidth={1}>
                          {icono.silueta}
                        </g>
                      )}
                      {icono.decoracion}
                    </g>
                    <text
                      x={anchoIcono / 2}
                      y={altoIcono + 13}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      letterSpacing="0.02em"
                      fill={origen ? 'var(--scada-titulo)' : 'var(--scada-texto)'}
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

const tituloSeccion = { fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--scada-titulo)', marginBottom: 6 };
const botonMini = { background: 'var(--scada-panel)', color: 'var(--scada-texto)', border: 'none', fontFamily: 'inherit', fontSize: 12, width: 24, cursor: 'pointer' };

function KpiTile({ label, valor, color }) {
  return (
    <div style={{ background: 'var(--scada-panel)', padding: '4px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 72 }}>
      <span style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--scada-texto-2)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--scada-texto)', fontVariantNumeric: 'tabular-nums' }}>{valor}</span>
    </div>
  );
}
