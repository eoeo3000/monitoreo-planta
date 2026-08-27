import React, { useState } from 'react';
import Blueprint from '../../theme/Blueprint';
import { CATALOGO_MODO_FALLA } from '../../analista/mockData';
import { CATALOGO_SIMBOLOS, GRUPOS_SIMBOLOS, GRUPOS_INFO } from '../../gerencia/simbolosHMI';
import './gerenciaHMI.css';

const MOSTRAR_CODIGOS = true; // handoff §4 prop "mostrarCodigos"
const SELECCION_MULTIPLE = true; // handoff §4 prop "seleccionMultiple"
const GROSOR_TRAZO = 1.5; // handoff §4 prop "grosorTrazo" (1–2)

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };

function GestionPlanta({ data, crearPlanta, crearArea, crearEquipo }) {
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || '');
  const [areaId, setAreaId] = useState('');
  const [tag, setTag] = useState('');
  const [tipo, setTipo] = useState(Object.keys(CATALOGO_MODO_FALLA)[0]);
  const [descripcion, setDescripcion] = useState('');
  const [mensaje, setMensaje] = useState(null);

  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);
  const equiposDeArea = data.equipos.filter((eq) => eq.areaId === areaId);

  const agregarPlanta = () => {
    const nombre = window.prompt('Nombre de la nueva planta:');
    if (nombre && nombre.trim()) {
      const id = crearPlanta(nombre.trim());
      setPlantaId(id);
      setAreaId('');
    }
  };

  const agregarArea = () => {
    if (!plantaId) return;
    const nombre = window.prompt('Nombre de la nueva área:');
    if (nombre && nombre.trim()) {
      const id = crearArea(plantaId, nombre.trim());
      setAreaId(id);
    }
  };

  const crear = () => {
    const tagLimpio = tag.trim();
    if (!areaId) return setMensaje({ tipo: 'error', texto: 'Selecciona (o crea) un área primero.' });
    if (!tagLimpio) return setMensaje({ tipo: 'error', texto: 'El TAG es obligatorio.' });
    if (data.equipos.some((eq) => eq.tag.toLowerCase() === tagLimpio.toLowerCase())) {
      return setMensaje({ tipo: 'error', texto: 'Ya existe un equipo con ese TAG.' });
    }
    crearEquipo(areaId, { tag: tagLimpio, tipo, descripcion: descripcion.trim() });
    setTag('');
    setDescripcion('');
    setMensaje({ tipo: 'ok', texto: `Equipo ${tagLimpio} creado.` });
  };

  return (
    <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Alta de recursos</div>
      <h3 style={{ fontSize: 20, margin: 0 }}>Plantas, áreas y equipos</h3>

      {mensaje && (
        <div
          style={{
            borderLeft: `2px solid ${mensaje.tipo === 'error' ? '#c62828' : 'var(--color-accent-700)'}`,
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 13,
            color: mensaje.tipo === 'error' ? '#c62828' : 'var(--color-accent-700)',
            background: 'var(--color-neutral-100)',
          }}
        >
          {mensaje.texto}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: 200 }}>
          <span style={kicker}>Planta</span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <select
              className="input"
              value={plantaId}
              onChange={(e) => {
                setPlantaId(e.target.value);
                setAreaId('');
              }}
            >
              {data.plantas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={agregarPlanta}>+</button>
          </div>
        </label>

        <label className="field" style={{ minWidth: 200 }}>
          <span style={kicker}>Área</span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!plantaId}>
              <option value="">—</option>
              {areasDePlanta.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            <button className="btn btn-secondary" onClick={agregarArea} disabled={!plantaId}>+</button>
          </div>
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
        <label className="field" style={{ minWidth: 160 }}>
          <span style={kicker}>TAG</span>
          <input className="input" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ej: B-107" />
        </label>

        <label className="field" style={{ minWidth: 160 }}>
          <span style={kicker}>Tipo</span>
          <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.keys(CATALOGO_MODO_FALLA).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ minWidth: 220, flexGrow: 1 }}>
          <span style={kicker}>Descripción</span>
          <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>

        <button className="btn btn-primary" onClick={crear} disabled={!areaId}>
          Crear equipo
        </button>
      </div>

      {areaId && (
        <div>
          <div style={{ ...kicker, marginBottom: 'var(--space-2)' }}>
            Equipos en {data.areas.find((a) => a.id === areaId)?.nombre} ({equiposDeArea.length})
          </div>
          {equiposDeArea.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>Sin equipos en esta área todavía.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {equiposDeArea.map((eq) => (
                <span key={eq.id} className="tag tag-neutral" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.03em' }}>
                  {eq.tag} · {eq.tipo}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Blueprint>
  );
}

export default function Administracion({ data, crearPlanta, crearArea, crearEquipo }) {
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
            Gerencia · Recursos y símbolos
          </div>
          <h1 style={{ fontSize: 30, margin: 'var(--space-1) 0 0', letterSpacing: '0.01em' }}>ADMINISTRACIÓN</h1>
        </div>
        <p style={{ margin: '0 0 4px', maxWidth: 420, fontSize: 13, lineHeight: 1.5, color: 'var(--color-neutral-700)' }}>
          Crea plantas, áreas y equipos, y consulta los símbolos de trazo fino usados en las vistas de planta.
        </p>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-6)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Equipos</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{data.equipos.length}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Símbolos</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{CATALOGO_SIMBOLOS.length}</div>
          </div>
        </div>
      </header>

      <div style={{ padding: 'var(--space-4) var(--space-6) 0' }}>
        <GestionPlanta data={data} crearPlanta={crearPlanta} crearArea={crearArea} crearEquipo={crearEquipo} />
      </div>

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
