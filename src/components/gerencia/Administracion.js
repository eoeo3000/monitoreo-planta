import React, { useState } from 'react';
import Blueprint from '../../theme/Blueprint';
import { CATALOGO_MODO_FALLA } from '../../analista/mockData';
import { CATALOGO_SIMBOLOS, GRUPOS_SIMBOLOS, GRUPOS_INFO } from '../../gerencia/simbolosHMI';
import './gerenciaHMI.css';

const MOSTRAR_CODIGOS = true; // handoff §4 prop "mostrarCodigos"
const SELECCION_MULTIPLE = true; // handoff §4 prop "seleccionMultiple"
const GROSOR_TRAZO = 1.5; // handoff §4 prop "grosorTrazo" (1–2)

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };
const SECCIONES = [
  { id: 'equipos', label: 'Equipos' },
  { id: 'planta', label: 'Planta y ubicaciones técnicas' },
];

function Mensaje({ mensaje }) {
  if (!mensaje) return null;
  return (
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
  );
}

// "Planta y ubicaciones técnicas": alta y listado de plantas y sus áreas.
function SeccionPlanta({ data, crearPlanta, crearArea }) {
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || '');
  const [mensaje, setMensaje] = useState(null);
  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);

  const agregarPlanta = () => {
    const nombre = window.prompt('Nombre de la nueva planta:');
    if (nombre && nombre.trim()) {
      const id = crearPlanta(nombre.trim());
      setPlantaId(id);
      setMensaje({ tipo: 'ok', texto: `Planta "${nombre.trim()}" creada.` });
    }
  };

  const agregarArea = () => {
    if (!plantaId) return;
    const nombre = window.prompt('Nombre de la nueva ubicación técnica (área):');
    if (nombre && nombre.trim()) {
      crearArea(plantaId, nombre.trim());
      setMensaje({ tipo: 'ok', texto: `Ubicación técnica "${nombre.trim()}" creada.` });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Alta de recursos</div>
        <h3 style={{ fontSize: 20, margin: 0 }}>Plantas</h3>
        <Mensaje mensaje={mensaje} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {data.plantas.map((p) => (
            <span
              key={p.id}
              onClick={() => setPlantaId(p.id)}
              className={p.id === plantaId ? 'tag tag-accent' : 'tag tag-neutral'}
              style={{ cursor: 'pointer', fontFamily: 'var(--font-heading)', letterSpacing: '0.03em' }}
            >
              {p.nombre}
            </span>
          ))}
          <button className="btn btn-secondary" onClick={agregarPlanta}>+ Nueva planta</button>
        </div>
      </Blueprint>

      {plantaId && (
        <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>
            {data.plantas.find((p) => p.id === plantaId)?.nombre}
          </div>
          <h3 style={{ fontSize: 20, margin: 0 }}>Ubicaciones técnicas (áreas)</h3>
          {areasDePlanta.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>Esta planta todavía no tiene ubicaciones técnicas.</p>
          ) : (
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th style={{ width: 120 }}>Equipos</th>
                </tr>
              </thead>
              <tbody>
                {areasDePlanta.map((a) => (
                  <tr key={a.id}>
                    <td>{a.nombre}</td>
                    <td>{data.equipos.filter((eq) => eq.areaId === a.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="btn btn-secondary" onClick={agregarArea} style={{ alignSelf: 'flex-start' }}>
            + Nueva ubicación técnica
          </button>
        </Blueprint>
      )}
    </div>
  );
}

// "Equipos": alta y listado de equipos (la ubicación/planta se elige, no se crea acá).
function SeccionEquipos({ data, crearEquipo }) {
  const [plantaId, setPlantaId] = useState(data.plantas[0]?.id || '');
  const [areaId, setAreaId] = useState('');
  const [tag, setTag] = useState('');
  const [tipo, setTipo] = useState(Object.keys(CATALOGO_MODO_FALLA)[0]);
  const [descripcion, setDescripcion] = useState('');
  const [mensaje, setMensaje] = useState(null);

  const areasDePlanta = data.areas.filter((a) => a.plantaId === plantaId);

  const crear = () => {
    const tagLimpio = tag.trim();
    if (!areaId) return setMensaje({ tipo: 'error', texto: 'Selecciona una ubicación técnica (área) primero.' });
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' }}>Alta de recursos</div>
        <h3 style={{ fontSize: 20, margin: 0 }}>Crear equipo</h3>
        <Mensaje mensaje={mensaje} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
          <label className="field" style={{ minWidth: 180 }}>
            <span style={kicker}>Planta</span>
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
          </label>

          <label className="field" style={{ minWidth: 180 }}>
            <span style={kicker}>Ubicación técnica (área)</span>
            <select className="input" value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!plantaId}>
              <option value="">—</option>
              {areasDePlanta.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ minWidth: 140 }}>
            <span style={kicker}>TAG</span>
            <input className="input" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Ej: B-107" />
          </label>

          <label className="field" style={{ minWidth: 140 }}>
            <span style={kicker}>Tipo</span>
            <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {Object.keys(CATALOGO_MODO_FALLA).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ minWidth: 200, flexGrow: 1 }}>
            <span style={kicker}>Descripción</span>
            <input className="input" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </label>

          <button className="btn btn-primary" onClick={crear} disabled={!areaId}>
            Crear equipo
          </button>
        </div>
      </Blueprint>

      <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <h3 style={{ fontSize: 20, margin: 0 }}>Equipos existentes ({data.equipos.length})</h3>
        {data.equipos.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>Todavía no hay equipos creados.</p>
        ) : (
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>TAG</th>
                <th style={{ width: 160 }}>Planta</th>
                <th style={{ width: 180 }}>Ubicación técnica</th>
                <th style={{ width: 130 }}>Tipo</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {data.equipos.map((eq) => {
                const area = data.areas.find((a) => a.id === eq.areaId);
                const planta = data.plantas.find((p) => p.id === area?.plantaId);
                return (
                  <tr key={eq.id}>
                    <td style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.04em' }}>{eq.tag}</td>
                    <td>{planta?.nombre || '—'}</td>
                    <td>{area?.nombre || '—'}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: 12, color: 'var(--color-neutral-600)' }}>{eq.tipo}</td>
                    <td style={{ color: 'var(--color-neutral-700)' }}>{eq.descripcion || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Blueprint>
    </div>
  );
}

function CatalogoSimbolos() {
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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '232px minmax(0, 1fr) 272px',
        alignItems: 'start',
        gap: 'var(--space-4)',
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
  );
}

export default function Administracion({ data, crearPlanta, crearArea, crearEquipo }) {
  const [seccion, setSeccion] = useState('equipos');

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

        <div className="seg">
          {SECCIONES.map((s) => (
            <label key={s.id} className="seg-opt">
              <input type="radio" checked={seccion === s.id} onChange={() => setSeccion(s.id)} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-6)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Plantas</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{data.plantas.length}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>Equipos</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 24, lineHeight: 1 }}>{data.equipos.length}</div>
          </div>
        </div>
      </header>

      <div style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)' }}>
        {seccion === 'planta' && <SeccionPlanta data={data} crearPlanta={crearPlanta} crearArea={crearArea} />}
        {seccion === 'equipos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <SeccionEquipos data={data} crearEquipo={crearEquipo} />
            <CatalogoSimbolos />
          </div>
        )}
      </div>
    </div>
  );
}
