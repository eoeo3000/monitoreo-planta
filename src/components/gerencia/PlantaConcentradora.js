import React, { useEffect, useRef, useState } from 'react';
import Blueprint from '../../theme/Blueprint';
import { colorDeSeveridad, SEVERIDAD } from '../../analista/severidad';
import { NODOS, CONECTORES, ETIQUETAS_CONECTORES } from '../../gerencia/plantaConcentradoraData';
import './gerenciaHMI.css';

const GROSOR_TRAZO = 1.5; // handoff §5 prop "grosorTrazo"
const SEVERIDAD_EN_COLOR = true; // handoff §5 prop "severidadEnColor"

export default function PlantaConcentradora() {
  const wrapRef = useRef(null);
  const manualRef = useRef(false);
  const [seleccionado, setSeleccionado] = useState('criba');
  const [zoom, setZoom] = useState(1);

  const color = (sev) => colorDeSeveridad(sev, SEVERIDAD_EN_COLOR);

  const ajustar = () => {
    if (!wrapRef.current) return;
    manualRef.current = false;
    const z = Math.min(1, Math.max(0.4, wrapRef.current.clientWidth / 1320));
    setZoom(Math.floor(z * 100) / 100);
  };

  useEffect(() => {
    const raf = requestAnimationFrame(ajustar);
    let ro;
    if (typeof ResizeObserver !== 'undefined' && wrapRef.current) {
      ro = new ResizeObserver(() => {
        if (!manualRef.current) ajustar();
      });
      ro.observe(wrapRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paso = (dir) => {
    manualRef.current = true;
    setZoom((z) => Math.min(2, Math.max(0.4, Math.round((z + dir * 0.15) * 100) / 100)));
  };

  const nodo = NODOS.find((n) => n.key === seleccionado) || null;
  const enAlerta = NODOS.filter((n) => n.sev === 'alerta' || n.sev === 'alarma').length;

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-6)',
          padding: 'var(--space-6) var(--space-8)',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            Gerencia · Vista de proceso
          </div>
          <h1 style={{ fontSize: 40, margin: 'var(--space-1) 0 0', letterSpacing: '0.01em' }}>PLANTA CONCENTRADORA</h1>
        </div>
        <p style={{ margin: '0 0 4px', maxWidth: 400, fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-700)' }}>
          Diagrama de flujo con los símbolos del catálogo. Haz clic en un equipo para ver su condición monitoreada.
        </p>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-6)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Equipos</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1 }}>{String(NODOS.length).padStart(2, '0')}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>En alerta</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 30, lineHeight: 1, color: color('alerta') }}>
              {String(enAlerta).padStart(2, '0')}
            </div>
          </div>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 316px', alignItems: 'start', gap: 'var(--space-6)', padding: 'var(--space-6) var(--space-8) var(--space-8)' }}>
        <Blueprint as="section" style={{ padding: 'var(--space-6)', minWidth: 0, overflowX: 'auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <h3 style={{ fontSize: 19, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Circuito general</h3>
            <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-neutral-500)', whiteSpace: 'nowrap' }}>
              Chancado · Molienda · Flotación · Filtrado
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1, background: 'var(--color-neutral-300)' }}>
              <button className="btn btn-secondary" onClick={() => paso(-1)} style={{ background: 'var(--color-bg)', borderRadius: 0, width: 30, padding: 0 }}>
                −
              </button>
              <button
                className="btn btn-secondary"
                onClick={ajustar}
                style={{ background: 'var(--color-bg)', borderRadius: 0, minWidth: 62, padding: 0, fontVariantNumeric: 'tabular-nums' }}
              >
                {Math.round(zoom * 100)} %
              </button>
              <button className="btn btn-secondary" onClick={() => paso(1)} style={{ background: 'var(--color-bg)', borderRadius: 0, width: 30, padding: 0 }}>
                +
              </button>
            </span>
            <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2) var(--space-4)', fontSize: 11, color: 'var(--color-neutral-600)' }}>
              {Object.keys(SEVERIDAD).map((key) => (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, background: color(key) }} />
                  {SEVERIDAD[key].label}
                </span>
              ))}
            </span>
          </div>

          <div ref={wrapRef} style={{ overflow: 'auto', maxHeight: '76vh' }}>
            <div style={{ width: Math.round(1320 * zoom), height: Math.round(810 * zoom) }}>
              <div style={{ position: 'relative', width: 1320, height: 810, transformOrigin: '0 0', transform: `scale(${zoom})`, strokeWidth: GROSOR_TRAZO }}>
                <svg width={1320} height={810} viewBox="0 0 1320 810" fill="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', color: 'var(--color-accent)' }}>
                  <defs>
                    <marker id="flecha-planta" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                      <path d="M0 0 L6 3 L0 6 Z" fill="var(--color-accent)" stroke="none" />
                    </marker>
                  </defs>
                  <g stroke="currentColor" markerEnd="url(#flecha-planta)">
                    {CONECTORES.map((d, i) => (
                      <path key={i} d={d} />
                    ))}
                  </g>
                  <g fill="var(--color-neutral-600)" stroke="none" fontFamily="Barlow" fontSize="11" letterSpacing="0.08em">
                    {ETIQUETAS_CONECTORES.map((et, i) => (
                      <text key={i} x={et.x} y={et.y}>
                        {et.texto}
                      </text>
                    ))}
                  </g>
                </svg>

                {NODOS.map((n) => {
                  const act = seleccionado === n.key;
                  return (
                    <div
                      key={n.key}
                      className="nodo"
                      onClick={() => setSeleccionado(n.key)}
                      style={{
                        position: 'absolute',
                        left: n.left,
                        top: n.top,
                        width: 108,
                        height: 104,
                        cursor: 'pointer',
                        zIndex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-2)',
                        background: act ? 'var(--color-accent-100)' : 'transparent',
                        boxShadow: act ? 'inset 0 0 0 1px var(--color-accent)' : 'none',
                      }}
                    >
                      <span style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, background: color(n.sev) }} />
                      <svg
                        width="48"
                        height="32"
                        viewBox="0 0 48 32"
                        fill="none"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ color: act ? 'var(--color-accent-800)' : 'var(--color-neutral-700)' }}
                      >
                        {n.svg}
                      </svg>
                      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, letterSpacing: '0.03em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1 }}>
                        {n.nombre}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Blueprint>

        <Blueprint as="aside" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', position: 'sticky', top: 'var(--space-6)' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
              {nodo ? nodo.etapa : 'Sin selección'}
            </div>
            <h3 style={{ fontSize: 22, margin: 0 }}>{nodo ? nodo.nombre : 'Ningún equipo'}</h3>
          </div>

          {!nodo ? (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-600)' }}>
              Selecciona un equipo del diagrama para ver su TAG, su condición monitoreada y su posición en el circuito.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', border: `1px solid ${color(nodo.sev)}`, padding: 'var(--space-2) var(--space-3)' }}>
                <span style={{ width: 10, height: 10, background: color(nodo.sev) }} />
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', color: color(nodo.sev) }}>
                  {SEVERIDAD[nodo.sev].label}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-2) var(--space-4)', fontSize: 13 }}>
                <span style={{ color: 'var(--color-neutral-600)' }}>TAG</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '0.05em' }}>{nodo.tag}</span>
                <span style={{ color: 'var(--color-neutral-600)' }}>Tipo</span>
                <span>{nodo.tipo}</span>
                <span style={{ color: 'var(--color-neutral-600)' }}>Recibe de</span>
                <span>{nodo.de}</span>
                <span style={{ color: 'var(--color-neutral-600)' }}>Entrega a</span>
                <span>{nodo.a}</span>
                <span style={{ color: 'var(--color-neutral-600)' }}>Monitoreo</span>
                <span>{nodo.mon}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-700)' }}>{nodo.nota}</p>
            </div>
          )}
        </Blueprint>
      </div>
    </div>
  );
}
