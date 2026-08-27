import React, { useEffect, useMemo, useState } from 'react';
import { condicionActual } from '../../analista/store';
import { SEVERIDAD, RECOMENDACION_DEFAULT, reglasPorSeveridad, colorDeSeveridad } from '../../analista/severidad';
import Blueprint from '../../theme/Blueprint';
import EquipoDiagnosticoPanel from './EquipoDiagnosticoPanel';
import TablaEquipos from './TablaEquipos';
import HistorialDetalleModal from './HistorialDetalleModal';
import NuevoAvisoModal from './NuevoAvisoModal';
import './analista.css';

const MOSTRAR_SEVERIDAD_ARBOL = true; // provisional — el documento fuente deja pendiente si el árbol debe mostrar severidad
const SEVERIDAD_EN_COLOR = true; // handoff §2 — flag para paleta mono en acero

const FORM_VACIO = { severidad: 'normal', modoFalla: '', diagnosticoTexto: '', recomendacionTexto: '' };

const kickerAccent = { fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent-700)' };

export default function AnalistaApp({ data, esDuplicadoReciente, crearDiagnostico, solicitarAviso }) {
  const [vista, setVista] = useState('arbol'); // 'arbol' | 'tabla'
  const [equipoSeleccionadoId, setEquipoSeleccionadoId] = useState(null);
  const [colapsadas, setColapsadas] = useState({});
  const [form, setForm] = useState(FORM_VACIO);
  const [evidenciasPendientes, setEvidenciasPendientes] = useState([]);
  const [detalleHistorial, setDetalleHistorial] = useState(null);
  const [mostrarModalAviso, setMostrarModalAviso] = useState(false);
  const [mostrarModalDiagnostico, setMostrarModalDiagnostico] = useState(false);
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

  const seleccionarDesdeArbol = (id) => {
    setEquipoSeleccionadoId(id);
  };

  const abrirDesdeTabla = (id) => {
    setEquipoSeleccionadoId(id);
    setMostrarModalDiagnostico(true);
  };

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

  const reglas = reglasPorSeveridad(form.severidad);
  const color = (sev) => colorDeSeveridad(sev, SEVERIDAD_EN_COLOR);

  const panelProps = equipo && {
    equipo,
    areaNombre: data.areas.find((a) => a.id === equipo.areaId)?.nombre,
    condicion,
    historialEquipo,
    avisosEquipo,
    form,
    setForm,
    mensaje,
    evidenciasPendientes,
    reglas,
    color,
    pickSeveridad,
    cargarUltimaCondicion,
    handlePasteEvidencia,
    insertar,
    abrirModalAviso,
    onAbrirHistorial: setDetalleHistorial,
  };

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

        <div style={{ padding: 'var(--space-3) var(--space-4) 0' }}>
          <div className="seg" style={{ width: '100%' }}>
            <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={vista === 'arbol'} onChange={() => setVista('arbol')} />
              <span>Árbol</span>
            </label>
            <label className="seg-opt" style={{ flex: 1, justifyContent: 'center' }}>
              <input type="radio" checked={vista === 'tabla'} onChange={() => setVista('tabla')} />
              <span>Tabla</span>
            </label>
          </div>
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
                              const sel = eq.id === equipoSeleccionadoId && vista === 'arbol';
                              return (
                                <div
                                  key={eq.id}
                                  className="tree-eq"
                                  onClick={() => {
                                    setVista('arbol');
                                    seleccionarDesdeArbol(eq.id);
                                  }}
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
        {vista === 'tabla' ? (
          <TablaEquipos data={data} onAbrirEquipo={abrirDesdeTabla} color={color} />
        ) : !equipo ? (
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
          <EquipoDiagnosticoPanel {...panelProps} />
        )}
      </main>

      {mostrarModalDiagnostico && equipo && (
        <div className="dialog-backdrop" onClick={() => setMostrarModalDiagnostico(false)} style={{ zIndex: 90 }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1100px, 96vw)', maxHeight: '92vh', overflowY: 'auto', background: 'var(--color-bg)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'var(--space-2) var(--space-4) 0' }}>
              <button className="btn btn-icon btn-secondary" onClick={() => setMostrarModalDiagnostico(false)}>✕</button>
            </div>
            <EquipoDiagnosticoPanel {...panelProps} />
          </div>
        </div>
      )}

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
