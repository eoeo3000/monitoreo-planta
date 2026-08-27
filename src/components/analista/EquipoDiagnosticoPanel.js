import React from 'react';
import { SEVERIDAD, SEVERIDAD_ORDEN } from '../../analista/severidad';
import { CATALOGO_MODO_FALLA } from '../../analista/mockData';
import Blueprint from '../../theme/Blueprint';

const TEXTO_MAX = 1000;

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };
const kickerAccent = { ...kicker, letterSpacing: '0.16em', color: 'var(--color-accent-700)' };

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

// Presentacional: toda la lógica de negocio (validaciones, inserción, anti-duplicado,
// solicitud de aviso) vive en AnalistaApp y llega acá vía props/handlers, para no
// duplicarla entre la vista de Árbol y la vista de Tabla (que abre esto en un modal).
export default function EquipoDiagnosticoPanel({
  equipo,
  areaNombre,
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
  onAbrirHistorial,
}) {
  const modoFallaOpciones = CATALOGO_MODO_FALLA[equipo.tipo] || [];

  return (
    <div>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-divider)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ ...kickerAccent, marginBottom: 'var(--space-1)' }}>{areaNombre}</div>
          <h1 style={{ fontSize: 32, margin: 0, letterSpacing: '0.01em' }}>{equipo.tag}</h1>
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
          gap: 'var(--space-4)',
          padding: 'var(--space-4) var(--space-6) var(--space-6)',
        }}
      >
        {/* NUEVO DIAGNÓSTICO */}
        <Blueprint
          as="section"
          style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
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
              rows={3}
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
              rows={2}
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
                minHeight: 52,
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
                    width: 44,
                    height: 44,
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>
          {/* ÚLTIMO REGISTRO */}
          <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
          <Blueprint as="section" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
          style={{ gridColumn: '1 / -1', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
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
                  <tr key={h.id} className="sev-row" onClick={() => onAbrirHistorial(h)} style={{ cursor: 'pointer' }}>
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
  );
}
