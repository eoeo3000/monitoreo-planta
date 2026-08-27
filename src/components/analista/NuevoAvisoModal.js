import React, { useState } from 'react';
import Blueprint from '../../theme/Blueprint';

const CLASES = ['PM01', 'PM02', 'PM03', 'PM04'];
const TEXTO_BREVE_MAX = 40; // provisional: largo típico de campo corto SAP, ajustable

function descripcionSugerida(equipo, form) {
  return `${equipo.tag} - ${form.modoFalla} - ${form.severidad.toUpperCase()} / Diagnóstico: ${form.diagnosticoTexto} / Recomendación: ${form.recomendacionTexto}`;
}

const kicker = { fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' };

export default function NuevoAvisoModal({ equipo, diagnosticoForm, onCancel, onSolicitar }) {
  const [textoBreve, setTextoBreve] = useState(
    `${equipo.tag} ${diagnosticoForm.modoFalla || ''}`.slice(0, TEXTO_BREVE_MAX)
  );
  const [clase, setClase] = useState('PM02');
  const [descripcion, setDescripcion] = useState(descripcionSugerida(equipo, diagnosticoForm));

  return (
    <div className="dialog-backdrop" style={{ zIndex: 100 }}>
      <Blueprint
        style={{
          width: 'min(560px, 100%)',
          background: 'var(--color-bg)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        <div>
          <div style={{ ...kicker, letterSpacing: '0.16em', color: 'var(--color-accent-700)' }}>Formulario SAP</div>
          <h3 style={{ fontSize: 26, margin: 0 }}>Solicitud de nuevo aviso</h3>
          <p style={{ margin: 'var(--space-2) 0 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>
            Se registra como solicitud, sin número SAP. El supervisor la convierte en aviso formal.
          </p>
        </div>

        <label className="field">
          <span style={{ display: 'flex', ...kicker }}>
            Texto breve<span style={{ marginLeft: 'auto' }}>{textoBreve.length}/{TEXTO_BREVE_MAX}</span>
          </span>
          <input
            className="input"
            maxLength={TEXTO_BREVE_MAX}
            value={textoBreve}
            onChange={(e) => setTextoBreve(e.target.value)}
          />
        </label>

        <label className="field">
          <span style={kicker}>Clase de aviso</span>
          <select className="input" value={clase} onChange={(e) => setClase(e.target.value)}>
            {CLASES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span style={kicker}>Descripción — autogenerada, editable</span>
          <textarea className="input" rows={5} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={() =>
              onSolicitar({
                textoBreve,
                clase,
                descripcion,
                modoFalla: diagnosticoForm.modoFalla,
              })
            }
          >
            Solicitar
          </button>
        </div>
      </Blueprint>
    </div>
  );
}
