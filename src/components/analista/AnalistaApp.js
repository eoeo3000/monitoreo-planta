import React, { useEffect, useMemo, useState } from 'react';
import { useAnalistaData, condicionActual } from '../../analista/store';
import { SEVERIDAD, RECOMENDACION_DEFAULT, reglasPorSeveridad } from '../../analista/severidad';
import { CATALOGO_MODO_FALLA } from '../../analista/mockData';
import HistorialDetalleModal from './HistorialDetalleModal';
import NuevoAvisoModal from './NuevoAvisoModal';

const TEXTO_MAX = 1000;

const FORM_VACIO = { severidad: 'normal', modoFalla: '', diagnosticoTexto: '', recomendacionTexto: '' };

export default function AnalistaApp() {
  const { data, esDuplicadoReciente, crearDiagnostico, solicitarAviso } = useAnalistaData();
  const [equipoSeleccionadoId, setEquipoSeleccionadoId] = useState(null);
  const [expandido, setExpandido] = useState({});
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

  // Autocompletado editable de recomendación en Normal/Observación (sección 3).
  useEffect(() => {
    const reglas = reglasPorSeveridad(form.severidad);
    if (!reglas.recomendacionRequerida && !form.recomendacionTexto) {
      setForm((f) => ({ ...f, recomendacionTexto: RECOMENDACION_DEFAULT }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.severidad]);

  const toggleArea = (areaId) => setExpandido((e) => ({ ...e, [areaId]: !e[areaId] }));

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
        texto: 'Esta severidad requiere un aviso o solicitud asociada. Usa "Nuevo Aviso" en vez de "Insertar".',
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
      return setMensaje({ tipo: 'error', texto: 'Nuevo Aviso solo aplica para severidad Alerta o Alarma.' });
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

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#f5f5f5', color: '#222' }}>
      {/* ÁRBOL JERÁRQUICO */}
      <aside style={{ width: 260, background: '#fff', borderRight: '1px solid #e0e0e0', overflowY: 'auto', padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>Planta</h3>
        {data.plantas.map((planta) => (
          <div key={planta.id} style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: '0.9rem' }}>{planta.nombre}</strong>
            {data.areas
              .filter((a) => a.plantaId === planta.id)
              .map((area) => (
                <div key={area.id} style={{ marginLeft: 8 }}>
                  <div
                    onClick={() => toggleArea(area.id)}
                    style={{ cursor: 'pointer', padding: '4px 0', fontSize: '0.85rem', color: '#555' }}
                  >
                    {expandido[area.id] === false ? '▸' : '▾'} {area.nombre}
                  </div>
                  {expandido[area.id] !== false &&
                    data.equipos
                      .filter((eq) => eq.areaId === area.id)
                      .map((eq) => {
                        const cond = condicionActual(eq.id, data.diagnosticos);
                        return (
                          <div
                            key={eq.id}
                            onClick={() => setEquipoSeleccionadoId(eq.id)}
                            style={{
                              marginLeft: 14,
                              padding: '4px 6px',
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                              borderRadius: 4,
                              background: eq.id === equipoSeleccionadoId ? '#e3f2fd' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span
                              title={cond ? SEVERIDAD[cond.severidad].label : 'Sin diagnóstico'}
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: cond ? SEVERIDAD[cond.severidad].color : '#ccc',
                                flexShrink: 0,
                              }}
                            />
                            {eq.tag}
                          </div>
                        );
                      })}
                </div>
              ))}
          </div>
        ))}
        <p style={{ fontSize: '0.7rem', color: '#999', marginTop: 16 }}>
          Nota: el punto de color junto al TAG es provisional — el documento fuente deja pendiente si el árbol debe
          mostrar severidad o no.
        </p>
      </aside>

      {/* PANEL PRINCIPAL */}
      <main style={{ flexGrow: 1, overflowY: 'auto', padding: 24 }}>
        {!equipo ? (
          <p style={{ color: '#666' }}>Selecciona un equipo en el árbol para ver su diagnóstico.</p>
        ) : (
          <>
            {/* 1. IDENTIFICACIÓN */}
            <h2 style={{ marginBottom: 0 }}>{equipo.tag}</h2>
            <p style={{ color: '#666', marginTop: 4 }}>
              {data.areas.find((a) => a.id === equipo.areaId)?.nombre} — {equipo.descripcion}
            </p>

            {/* 2. CONDICIÓN ACTUAL */}
            <section style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <h4 style={{ marginTop: 0 }}>Condición actual</h4>
              {condicion ? (
                <>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: 12,
                      background: SEVERIDAD[condicion.severidad].color,
                      color: '#fff',
                      fontSize: '0.85rem',
                    }}
                  >
                    {SEVERIDAD[condicion.severidad].label}
                  </span>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 0 }}>
                    Último diagnóstico: {new Date(condicion.fechaHora).toLocaleString()} — {condicion.usuario}
                  </p>
                </>
              ) : (
                <p style={{ color: '#888', margin: 0 }}>Sin diagnóstico registrado.</p>
              )}
            </section>

            {/* 3. NUEVO DIAGNÓSTICO */}
            <section style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 20 }} onPaste={handlePasteEvidencia}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>Nuevo diagnóstico</h4>
                <button onClick={cargarUltimaCondicion} disabled={!condicion}>
                  Última condición
                </button>
              </div>

              {mensaje && (
                <p style={{ color: mensaje.tipo === 'error' ? '#c62828' : '#2e7d32', fontSize: '0.85rem' }}>
                  {mensaje.texto}
                </p>
              )}

              <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 10 }}>Severidad</label>
              <select
                value={form.severidad}
                onChange={(e) => setForm((f) => ({ ...f, severidad: e.target.value }))}
                style={{ width: '100%', color: SEVERIDAD[form.severidad].color, fontWeight: 'bold' }}
              >
                {Object.entries(SEVERIDAD).map(([key, cfg]) => (
                  <option key={key} value={key} style={{ color: cfg.color }}>
                    {cfg.label}
                  </option>
                ))}
              </select>

              <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 10 }}>
                Modo de falla {reglas.modoFallaRequerido ? '*' : ''}
              </label>
              <select
                value={form.modoFalla}
                onChange={(e) => setForm((f) => ({ ...f, modoFalla: e.target.value }))}
                style={{ width: '100%' }}
              >
                <option value="">-</option>
                {modoFallaOpciones.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 10 }}>
                Diagnóstico * ({form.diagnosticoTexto.length}/{TEXTO_MAX})
              </label>
              <textarea
                value={form.diagnosticoTexto}
                maxLength={TEXTO_MAX}
                onChange={(e) => setForm((f) => ({ ...f, diagnosticoTexto: e.target.value }))}
                rows={3}
                style={{ width: '100%' }}
              />

              <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 10 }}>
                Recomendación {reglas.recomendacionRequerida ? '*' : ''} ({form.recomendacionTexto.length}/{TEXTO_MAX})
              </label>
              <textarea
                value={form.recomendacionTexto}
                maxLength={TEXTO_MAX}
                onChange={(e) => setForm((f) => ({ ...f, recomendacionTexto: e.target.value }))}
                rows={3}
                style={{ width: '100%' }}
              />

              {/* 5. EVIDENCIA */}
              <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 10 }}>
                Evidencia (pega una imagen con Ctrl+V en esta sección)
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', minHeight: 40 }}>
                {evidenciasPendientes.length === 0 && (
                  <span style={{ fontSize: '0.8rem', color: '#999' }}>Sin evidencia adjunta todavía.</span>
                )}
                {evidenciasPendientes.map((ev, i) => (
                  <img
                    key={i}
                    src={ev.dataUrl}
                    alt={`evidencia-${i}`}
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }}
                  />
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={insertar} style={{ padding: '8px 14px' }}>
                  Insertar
                </button>
                <button
                  onClick={abrirModalAviso}
                  style={{ padding: '8px 14px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 4 }}
                >
                  Nuevo Aviso
                </button>
              </div>
            </section>

            {/* 4. AVISOS */}
            <section style={{ background: '#fff', borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <h4 style={{ marginTop: 0 }}>Avisos</h4>
              {avisosEquipo.length === 0 ? (
                <p style={{ color: '#888', margin: 0 }}>No existen avisos abiertos asociados a este equipo.</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {avisosEquipo.map((a) => (
                    <li key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee', fontSize: '0.85rem' }}>
                      <strong>{a.numeroSap || 'Solicitud (sin número SAP)'}</strong> — {a.textoBreve} — {a.estado}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 6. HISTORIAL */}
            <section style={{ background: '#fff', borderRadius: 8, padding: 16 }}>
              <h4 style={{ marginTop: 0 }}>Análisis histórico</h4>
              {historialEquipo.length === 0 ? (
                <p style={{ color: '#888', margin: 0 }}>Sin registros históricos.</p>
              ) : (
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                      <th>Fecha</th>
                      <th>Usuario</th>
                      <th>Severidad</th>
                      <th>Modo de falla</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialEquipo.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => setDetalleHistorial(d)}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                      >
                        <td>{new Date(d.fechaHora).toLocaleString()}</td>
                        <td>{d.usuario}</td>
                        <td>
                          <span style={{ color: SEVERIDAD[d.severidad].color, fontWeight: 'bold' }}>
                            {SEVERIDAD[d.severidad].label}
                          </span>
                        </td>
                        <td>{d.modoFalla || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
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
