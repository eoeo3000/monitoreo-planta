import React, { useState } from 'react';
import Blueprint from '../../theme/Blueprint';
import { CATALOGO_SIMBOLOS, GRUPOS_SIMBOLOS, GRUPOS_INFO } from '../../gerencia/simbolosHMI';
import './gerenciaHMI.css';

const MOSTRAR_CODIGOS = true; // handoff §4 prop "mostrarCodigos"
const SELECCION_MULTIPLE = true; // handoff §4 prop "seleccionMultiple"
const GROSOR_TRAZO = 1.5; // handoff §4 prop "grosorTrazo" (1–2)

export default function CatalogoHMI() {
  const [filtro, setFiltro] = useState('todos');
  const [elegidos, setElegidos] = useState(['agitador', 'transmisorPresion']);
  const [aplicado, setAplicado] = useState(null);

  const toggle = (key) => {
    setAplicado(null);
    setElegidos((prev) => {
      const on = prev.includes(key);
      if (!SELECCION_MULTIPLE) return on ? [] : [key];
      return on ? prev.filter((k) => k !== key) : [...prev, key];
    });
  };

  const grupos = Array.from(new Set(CATALOGO_SIMBOLOS.map((s) => s.grupo)));
  const simbolosDeGrupo = (g) => CATALOGO_SIMBOLOS.filter((s) => s.grupo === g);
  const verGrupo = (g) => filtro === 'todos' || filtro === g;

  return (
    <div style={{ minHeight: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            Gerencia · Biblioteca de símbolos
          </div>
          <h1 style={{ fontSize: 30, margin: 'var(--space-1) 0 0', letterSpacing: '0.01em' }}>CATÁLOGO HMI</h1>
        </div>
        <p style={{ margin: '0 0 4px', maxWidth: 420, fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-700)' }}>
          Símbolos de trazo fino para las vistas de planta. Selecciona los tipos que entran en la vista y aplícalos al esquema.
        </p>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-6)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Símbolos</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{CATALOGO_SIMBOLOS.length}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Trazo</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{GROSOR_TRAZO.toFixed(2).replace(/0$/, '')}</div>
          </div>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '232px minmax(0, 1fr) 272px',
          alignItems: 'start',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6) var(--space-6)',
        }}
      >
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', position: 'sticky', top: 'var(--space-4)' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)', marginBottom: 'var(--space-1)' }}>
            Tipo de equipo
          </div>
          {GRUPOS_SIMBOLOS.map((g) => {
            const on = filtro === g.id;
            const count = g.id === 'todos' ? CATALOGO_SIMBOLOS.length : simbolosDeGrupo(g.id).length;
            return (
              <div
                key={g.id}
                className="filtro"
                onClick={() => setFiltro(g.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  cursor: 'pointer',
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 14,
                  color: on ? 'var(--color-accent-900)' : 'var(--color-neutral-600)',
                  background: on ? 'var(--color-accent-100)' : 'transparent',
                  boxShadow: on ? 'inset 2px 0 0 var(--color-accent)' : 'none',
                }}
              >
                <span style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{g.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--color-neutral-500)' }}>
                  {String(count).padStart(2, '0')}
                </span>
              </div>
            );
          })}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0, strokeWidth: GROSOR_TRAZO }}>
          {grupos.filter(verGrupo).map((g) => {
            const info = GRUPOS_INFO[g];
            return (
              <Blueprint as="section" key={g} style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-neutral-500)' }}>{info.orden}</span>
                  <h3 style={{ fontSize: 19, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{info.titulo}</h3>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-neutral-600)' }}>{info.nota}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(132px, 1fr))', gap: 1, background: 'var(--color-neutral-300)' }}>
                  {simbolosDeGrupo(g).map((s) => {
                    const on = elegidos.includes(s.key);
                    return (
                      <div
                        key={s.key}
                        className="cell"
                        onClick={() => toggle(s.key)}
                        style={{
                          cursor: 'pointer',
                          padding: 'var(--space-4) var(--space-2)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          textAlign: 'center',
                          background: on ? 'var(--color-accent-100)' : 'var(--color-bg)',
                          boxShadow: on ? 'inset 0 0 0 1px var(--color-accent)' : 'none',
                        }}
                      >
                        <svg
                          width="36"
                          height="36"
                          viewBox="0 0 40 40"
                          fill="none"
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ color: on ? 'var(--color-accent-800)' : 'var(--color-neutral-700)' }}
                        >
                          {s.svg}
                        </svg>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 13, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                          {s.nombre}
                        </span>
                        {MOSTRAR_CODIGOS && (
                          <span style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--color-neutral-500)' }}>{s.codigo}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Blueprint>
            );
          })}
        </div>

        <Blueprint
          as="aside"
          style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', position: 'sticky', top: 'var(--space-4)' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)' }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Vista HMI</div>
              <h3 style={{ fontSize: 20, margin: 0 }}>Selección</h3>
            </div>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-heading)', fontSize: 34, lineHeight: 0.9, color: 'var(--color-neutral-500)' }}>
              {String(elegidos.length).padStart(2, '0')}
            </span>
          </div>

          {elegidos.length === 0 && (
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-600)' }}>
              Ningún símbolo seleccionado. Haz clic en una celda del catálogo para añadirla.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {elegidos.map((key) => {
              const s = CATALOGO_SIMBOLOS.find((x) => x.key === key);
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-2) 0', borderTop: '1px solid var(--color-neutral-300)' }}>
                  <span style={{ width: 6, height: 6, background: 'var(--color-accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{s.nombre}</span>
                  <span style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-neutral-500)' }}>{s.codigo}</span>
                  <button className="btn btn-ghost" onClick={() => toggle(key)} style={{ marginLeft: 'auto', fontSize: 13 }}>
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>

          {aplicado && (
            <div style={{ borderLeft: '2px solid var(--color-accent)', background: 'var(--color-neutral-100)', padding: 'var(--space-2) var(--space-3)', fontSize: 12, color: 'var(--color-accent-900)' }}>
              {aplicado}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--color-neutral-300)', paddingTop: 'var(--space-4)' }}>
            <Blueprint
              as="button"
              className="btn btn-primary"
              disabled={elegidos.length === 0}
              onClick={() => setAplicado(`${elegidos.length} símbolo(s) aplicados a la vista de planta.`)}
              style={{ position: 'relative' }}
            >
              Aplicar a la vista
            </Blueprint>
            <button className="btn btn-secondary" disabled={elegidos.length === 0} onClick={() => { setElegidos([]); setAplicado(null); }}>
              Limpiar
            </button>
          </div>
        </Blueprint>
      </div>
    </div>
  );
}
