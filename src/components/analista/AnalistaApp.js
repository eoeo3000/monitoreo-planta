import React, { useEffect, useMemo, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { SEVERIDAD, SEVERIDAD_ORDEN, RECOMENDACION_DEFAULT, reglasPorSeveridad, colorDeSeveridad } from '../../analista/severidad';
import { CATALOGO_MODO_FALLA } from '../../analista/mockData';
import Blueprint from '../../theme/Blueprint';
import HistorialDetalleModal from './HistorialDetalleModal';
import NuevoAvisoModal from './NuevoAvisoModal';
import './analista.css';

const TEXTO_MAX = 1000;
const MOSTRAR_SEVERIDAD_ARBOL = true; // provisional — el documento fuente deja pendiente si el árbol debe mostrar severidad
const SEVERIDAD_EN_COLOR = true; // handoff §2 — flag para paleta mono en acero

const FORM_VACIO = { severidad: 'normal', modoFalla: '', diagnosticoTexto: '', recomendacionTexto: '' };

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return iso;
  }
}

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };
const kickerAccent = { ...kicker, letterSpacing: '0.16em', color: 'var(--color-accent-700)' };

export default function AnalistaApp({ data, esDuplicadoReciente, crearDiagnostico, solicitarAviso }) {
  const [equipoSeleccionadoId, setEquipoSeleccionadoId] = useState(null);
  const [colapsadas, setColapsadas] = useState({});
  const [form, setForm] = useState(FORM_VACIO);
  const [evidenciasPendientes, setEvidenciasPendientes] = useState([]);
  const [detalleHistorial, setDetalleHistorial] = useState(null);
  const [mostrarModalAviso, setMostrarModalAviso] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const equipo = data.equipos.find((e) => e.id === equipoSeleccionadoId);

  const historialEquipo = useMemo(() => {
    if (!equipo) return [];
    return data.diagnosticos
      .filter((d) => d.equipoId === equipo.id)
      .sort((a, b) => new Date(b.fechaHora) - new Date(a.fechaHora));
  }, [data.diagnosticos, equipo]);

  const condicion = equipo ? historialEquipo[0] || null : null;

  const avisosEquipo = useMemo(() => {
    if (!equipo) return [];
    return data.avisos.filter((a) => a.equipoId === equipo.id && a.estado !== 'cerrado');
  }, [data.avisos, equipo]);

  useEffect(() => {
    setForm(FORM_VACIO);
    setEvidenciasPendientes([]);
    setMensaje(null);
  }, [equipoSeleccionadoId]);

  const toggleArea = (areaId) => setColapsadas((c) => ({ ...c, [areaId]: !c[areaId] }));

  const pickSeveridad = (sev) => {
    setForm((f) => {
      const next = { ...f, severidad: sev };
      if (!reglasPorSeveridad(sev).recomendacionRequerida && !next.recomendacionTexto) {
        next.recomendacionTexto = RECOMENDACION_DEFAULT;
      }
      if (sev === 'normal') next.modoFalla = '';
      return next;
    });
    setMensaje(null);
  };

  const handlePasteEvidencia = (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = () => {
          setEvidenciasPendientes((ev) => [...ev, { dataUrl: reader.result }]);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const cargarUltimaCondicion = () => {
    if (!condicion) return;
    setForm({
      severidad: condicion.severidad,
      modoFalla: condicion.modoFalla || '',
      diagnosticoTexto: condicion.diagnosticoTexto,
      recomendacionTexto: condicion.recomendacionTexto || '',
    });
    setMensaje(null);
  };

  const validarCamposBase = () => {
    const reglas = reglasPorSeveridad(form.severidad);
    if (reglas.modoFallaRequerido && !form.modoFalla) return 'Falta completar Modo de falla.';
    if (!form.diagnosticoTexto.trim()) return 'Falta completar Diagnóstico.';
    if (reglas.recomendacionRequerida && !form.recomendacionTexto.trim()) return 'Falta completar Recomendación.';
    return null;
  };

  const insertar = () => {
    const error = validarCamposBase();
    if (error) return setMensaje({ tipo: 'error', texto: error });

    const reglas = reglasPorSeveridad(form.severidad);
    if (reglas.avisoRequerido) {
      return setMensaje({
        tipo: 'error',
        texto: 'Esta severidad requiere un aviso o solicitud asociada. Usa "Nuevo aviso" en vez de "Insertar".',
      });
    }

    if (esDuplicadoReciente(equipo.id, form)) {
      return setMensaje({
        tipo: 'error',
        texto: 'Este diagnóstico parece un duplicado del último registrado hace menos de 5 minutos.',
      });
    }

    crearDiagnostico(equipo.id, form, evidenciasPendientes);
    setForm(FORM_VACIO);
    setEvidenciasPendientes([]);
    setMensaje({ tipo: 'ok', texto: 'Diagnóstico registrado.' });
  };

  const abrirModalAviso = () => {
    const error = validarCamposBase();
    if (error) return setMensaje({ tipo: 'error', texto: error });
    const reglas = reglasPorSeveridad(form.severidad);
    if (!reglas.avisoRequerido) {
      return setMensaje({ tipo: 'error', texto: 'Nuevo aviso solo aplica para severidad Alerta o Alarma.' });
    }
    setMensaje(null);
    setMostrarModalAviso(true);
  };

  const confirmarSolicitudAviso = (avisoData) => {
    solicitarAviso(equipo.id, form, avisoData, evidenciasPendientes);
    setForm(FORM_VACIO);
    setEvidenciasPendientes([]);
    setMostrarModalAviso(false);
    setMensaje({ tipo: 'ok', texto: 'Solicitud de aviso registrada junto al diagnóstico.' });
  };

  const modoFallaOpciones = equipo ? CATALOGO_MODO_FALLA[equipo.tipo] || [] : [];
  const reglas = reglasPorSeveridad(form.severidad);
  const color = (sev) => colorDeSeveridad(sev, SEVERIDAD_EN_COLOR);

  return (
    <div style={{ display: 'flex', minHeight: '100%', background: 'var(--color-bg)', color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
      {/* ÁRBOL JERÁRQUICO */}
      <aside style={{ width: 272, flexShrink: 0, borderRight: '1px solid var(--color-divider)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-divider)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 19, letterSpacing: '-0.01em' }}>
            CONDICIÓN DE ACTIVOS
          </div>
          <div style={kickerAccent}>Estación del analista</div>
        </div>

        <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflowY: 'auto', flexGrow: 1 }}>
          {data.plantas.map((planta, i) => (
            <div key={planta.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 'var(--space-2)',
                  borderBottom: '1px solid var(--color-neutral-300)',
                  paddingBottom: 'var(--space-1)',
                }}
              >
                <span style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-neutral-500)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  {planta.nombre}
                </span>
              </div>

              {data.areas
                .filter((a) => a.plantaId === planta.id)
                .map((area) => {
                  const expanded = !colapsadas[area.id];
                  return (
                    <div key={area.id} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <div
                        onClick={() => toggleArea(area.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          cursor: 'pointer',
                          padding: 'var(--space-1) 0',
                          fontSize: 13,
                          color: 'var(--color-neutral-700)',
                        }}
                      >
                        <span style={{ fontSize: 9, width: 8, color: 'var(--color-accent)' }}>{expanded ? '▾' : '▸'}</span>
                        <span style={{ letterSpacing: '0.02em' }}>{area.nombre}</span>
                      </div>

                      {expanded && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                            marginLeft: 'var(--space-3)',
                            borderLeft: '1px solid var(--color-neutral-300)',
                            paddingLeft: 'var(--space-3)',
                          }}
                        >
                          {data.equipos
                            .filter((eq) => eq.areaId === area.id)
                            .map((eq) => {
                              const cond = condicionActual(eq.id, data.diagnosticos);
                              const sel = eq.id === equipoSeleccionadoId;
                              return (
                                <div
                                  key={eq.id}
                                  className="tree-eq"
                                  onClick={() => setEquipoSeleccionadoId(eq.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-2)',
                                    cursor: 'pointer',
                                    padding: 'var(--space-2)',
                                    fontSize: 13,
                                    background: sel ? 'var(--color-accent-100)' : 'transparent',
                                    boxShadow: sel ? 'inset 2px 0 0 var(--color-accent)' : 'none',
                                  }}
                                >
                                  {MOSTRAR_SEVERIDAD_ARBOL && (
                                    <span
                                      title={cond ? SEVERIDAD[cond.severidad].label : 'Sin diagnóstico'}
                                      style={{ width: 7, height: 7, flexShrink: 0, background: cond ? color(cond.severidad) : 'var(--color-neutral-300)' }}
                                    />
                                  )}
                                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 14, letterSpacing: '0.04em' }}>{eq.tag}</span>
                                  <span style={{ marginLeft: 'auto', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-neutral-500)' }}>
                                    {eq.tipo}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ))}
        </div>

        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-divider)', fontSize: 11, color: 'var(--color-neutral-600)', lineHeight: 1.5 }}>
          Sesión: analista.demo · Datos de prueba locales
        </div>
      </aside>

      {/* PANEL PRINCIPAL */}
      <main style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!equipo ? (
          <div style={{ flexGrow: 1, display: 'grid', placeItems: 'center', padding: 'var(--space-8)' }}>
            <Blueprint style={{ padding: '56px 72px', textAlign: 'center', maxWidth: 460 }}>
              <div style={{ ...kickerAccent, marginBottom: 'var(--space-3)' }}>Sin selección</div>
              <h3 style={{ fontSize: 24, margin: '0 0 var(--space-2)' }}>Selecciona un equipo</h3>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-neutral-700)' }}>
                Elige un TAG en el árbol de planta para ver su condición, registrar un diagnóstico y consultar su historial.
              </p>
            </Blueprint>
          </div>
        ) : (
          <div>
            <header
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 'var(--space-6)',
                padding: 'var(--space-6) var(--space-8)',
                borderBottom: '1px solid var(--color-divider)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ ...kickerAccent, marginBottom: 'var(--space-1)' }}>
                  {data.areas.find((a) => a.id === equipo.areaId)?.nombre}
                </div>
                <h1 style={{ fontSize: 44, margin: 0, letterSpacing: '0.01em' }}>{equipo.tag}</h1>
                <div style={{ fontSize: 14, color: 'var(--color-neutral-700)', marginTop: 'var(--space-1)' }}>{equipo.descripcion}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={kicker}>Condición actual</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: 26,
                      lineHeight: 1.1,
                      color: condicion ? color(condicion.severidad) : 'var(--color-neutral-400)',
                    }}
                  >
                    {condicion ? SEVERIDAD[condicion.severidad].label : 'Sin diagnóstico'}
                  </div>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    border: `1px solid ${condicion ? color(condicion.severidad) : 'var(--color-neutral-400)'}`,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <span style={{ width: 12, height: 12, background: condicion ? color(condicion.severidad) : 'var(--color-neutral-400)' }} />
                </div>
              </div>
            </header>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)',
                gap: 'var(--space-6)',
                padding: 'var(--space-6) var(--space-8) var(--space-8)',
              }}
            >
              {/* NUEVO DIAGNÓSTICO */}
              <Blueprint
                as="section"
                style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
                onPaste={handlePasteEvidencia}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div>
                    <div style={kickerAccent}>Registro</div>
                    <h3 style={{ fontSize: 22, margin: 0 }}>Nuevo diagnóstico</h3>
                  </div>
                  <button className="btn btn-secondary" onClick={cargarUltimaCondicion} disabled={!condicion} style={{ marginLeft: 'auto' }}>
                    Última condición
                  </button>
                </div>

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

                <div>
                  <div style={{ ...kicker, marginBottom: 'var(--space-2)' }}>Severidad</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 'var(--space-2)' }}>
                    {SEVERIDAD_ORDEN.map((key) => {
                      const on = form.severidad === key;
                      return (
                        <div
                          key={key}
                          className="sev-row"
                          onClick={() => pickSeveridad(key)}
                          style={{
                            cursor: 'pointer',
                            minWidth: 0,
                            border: `1px solid ${on ? color(key) : 'var(--color-neutral-300)'}`,
                            background: on ? 'var(--color-neutral-100)' : 'transparent',
                            padding: 'var(--space-2) var(--space-3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <span style={{ width: 8, height: 8, background: color(key) }} />
                          <span
                            style={{
                              fontFamily: 'var(--font-heading)',
                              fontSize: 13,
                              letterSpacing: '0.01em',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: on ? 'var(--color-text)' : 'var(--color-neutral-600)',
                            }}
                          >
                            {SEVERIDAD[key].label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <label className="field">
                  <span style={kicker}>Modo de falla {reglas.modoFallaRequerido ? '*' : ''}</span>
                  <select className="input" value={form.modoFalla} onChange={(e) => setForm((f) => ({ ...f, modoFalla: e.target.value }))}>
                    <option value="">—</option>
                    {modoFallaOpciones.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span style={{ display: 'flex', ...kicker }}>
                    Diagnóstico *<span style={{ marginLeft: 'auto', letterSpacing: '0.06em' }}>{form.diagnosticoTexto.length}/{TEXTO_MAX}</span>
                  </span>
                  <textarea
                    className="input"
                    rows={4}
                    maxLength={TEXTO_MAX}
                    value={form.diagnosticoTexto}
                    onChange={(e) => setForm((f) => ({ ...f, diagnosticoTexto: e.target.value }))}
                    placeholder="Hallazgos, mediciones y evidencia técnica."
                  />
                </label>

                <label className="field">
                  <span style={{ display: 'flex', ...kicker }}>
                    Recomendación {reglas.recomendacionRequerida ? '*' : ''}
                    <span style={{ marginLeft: 'auto', letterSpacing: '0.06em' }}>{form.recomendacionTexto.length}/{TEXTO_MAX}</span>
                  </span>
                  <textarea
                    className="input"
                    rows={3}
                    maxLength={TEXTO_MAX}
                    value={form.recomendacionTexto}
                    onChange={(e) => setForm((f) => ({ ...f, recomendacionTexto: e.target.value }))}
                    placeholder="Acción sugerida y ventana de intervención."
                  />
                </label>

                <div>
                  <div style={{ ...kicker, marginBottom: 'var(--space-2)' }}>Evidencia — pega una imagen con Ctrl+V</div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      minHeight: 64,
                      border: '1px dashed var(--color-neutral-400)',
                      padding: 'var(--space-2)',
                    }}
                  >
                    {evidenciasPendientes.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--color-neutral-500)', padding: '0 var(--space-2)' }}>Sin evidencia adjunta.</span>
                    )}
                    {evidenciasPendientes.map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          width: 56,
                          height: 56,
                          backgroundImage: `url(${ev.dataUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          border: '1px solid var(--color-neutral-400)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
                  <button className="btn btn-secondary" onClick={insertar}>
                    Insertar diagnóstico
                  </button>
                  <Blueprint as="button" className="btn btn-primary" onClick={abrirModalAviso} style={{ position: 'relative' }}>
                    Nuevo aviso
                  </Blueprint>
                </div>
              </Blueprint>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 }}>
                {/* ÚLTIMO REGISTRO */}
                <Blueprint as="section" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={kickerAccent}>Estado</div>
                  <h3 style={{ fontSize: 20, margin: 0 }}>Último registro</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-2) var(--space-4)', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-neutral-600)' }}>Severidad</span>
                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '0.03em', color: condicion ? color(condicion.severidad) : 'var(--color-neutral-400)' }}>
                      {condicion ? SEVERIDAD[condicion.severidad].label : 'Sin diagnóstico'}
                    </span>
                    <span style={{ color: 'var(--color-neutral-600)' }}>Modo de falla</span>
                    <span>{condicion ? condicion.modoFalla || '—' : '—'}</span>
                    <span style={{ color: 'var(--color-neutral-600)' }}>Fecha</span>
                    <span>{condicion ? fmt(condicion.fechaHora) : '—'}</span>
                    <span style={{ color: 'var(--color-neutral-600)' }}>Usuario</span>
                    <span>{condicion ? condicion.usuario : '—'}</span>
                  </div>
                </Blueprint>

                {/* AVISOS ABIERTOS */}
                <Blueprint as="section" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                    <div>
                      <div style={kickerAccent}>SAP</div>
                      <h3 style={{ fontSize: 20, margin: 0 }}>Avisos abiertos</h3>
                    </div>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-heading)', fontSize: 22, color: 'var(--color-neutral-500)' }}>
                      {String(avisosEquipo.length).padStart(2, '0')}
                    </span>
                  </div>
                  {avisosEquipo.length === 0 ? (
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>No existen avisos abiertos para este equipo.</p>
                  ) : (
                    avisosEquipo.map((a) => (
                      <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid var(--color-neutral-300)', paddingTop: 'var(--space-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontFamily: 'var(--font-heading)', fontSize: 15, letterSpacing: '0.04em' }}>{a.numeroSap || 'Sin número SAP'}</span>
                          <span className="tag tag-outline" style={{ marginLeft: 'auto' }}>{a.estado}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{a.textoBreve} · {a.clase}</div>
                      </div>
                    ))
                  )}
                </Blueprint>
              </div>

              {/* HISTORIAL */}
              <Blueprint
                as="section"
                style={{ gridColumn: '1 / -1', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                  <div>
                    <div style={kickerAccent}>Trazabilidad</div>
                    <h3 style={{ fontSize: 20, margin: 0 }}>Análisis histórico</h3>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-neutral-600)' }}>Haz clic en una fila para ver el detalle</span>
                </div>
                {historialEquipo.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-600)' }}>Sin registros históricos.</p>
                ) : (
                  <table className="table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 180 }}>Fecha</th>
                        <th style={{ width: 140 }}>Usuario</th>
                        <th style={{ width: 130 }}>Severidad</th>
                        <th style={{ width: 200 }}>Modo de falla</th>
                        <th>Diagnóstico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialEquipo.map((h) => (
                        <tr key={h.id} className="sev-row" onClick={() => setDetalleHistorial(h)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(h.fechaHora)}</td>
                          <td>{h.usuario}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)', letterSpacing: '0.03em', color: color(h.severidad) }}>
                              <span style={{ width: 7, height: 7, background: color(h.severidad) }} />
                              {SEVERIDAD[h.severidad].label}
                            </span>
                          </td>
                          <td>{h.modoFalla || '—'}</td>
                          <td style={{ color: 'var(--color-neutral-700)' }}>
                            {h.diagnosticoTexto.length > 90 ? h.diagnosticoTexto.slice(0, 90) + '…' : h.diagnosticoTexto}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Blueprint>
            </div>
          </div>
        )}
      </main>

      {detalleHistorial && (
        <HistorialDetalleModal
          diagnostico={detalleHistorial}
          aviso={data.avisos.find((a) => a.diagnosticoOrigenId === detalleHistorial.id)}
          onClose={() => setDetalleHistorial(null)}
        />
      )}

      {mostrarModalAviso && (
        <NuevoAvisoModal
          equipo={equipo}
          diagnosticoForm={form}
          onCancel={() => setMostrarModalAviso(false)}
          onSolicitar={confirmarSolicitudAviso}
        />
      )}
    </div>
  );
}
