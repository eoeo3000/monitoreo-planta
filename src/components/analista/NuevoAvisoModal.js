import React, { useState } from 'react';

const CLASES = ['PM01', 'PM02', 'PM03', 'PM04'];
const TEXTO_BREVE_MAX = 40; // provisional: largo típico de campo corto SAP, ajustable

function descripcionSugerida(equipo, form) {
  return `${equipo.tag} - ${form.modoFalla} - ${form.severidad.toUpperCase()} / Diagnóstico: ${form.diagnosticoTexto} / Recomendación: ${form.recomendacionTexto}`;
}

export default function NuevoAvisoModal({ equipo, diagnosticoForm, onCancel, onSolicitar }) {
  const [textoBreve, setTextoBreve] = useState(
    `${equipo.tag} ${diagnosticoForm.modoFalla || ''}`.slice(0, TEXTO_BREVE_MAX)
  );
  const [clase, setClase] = useState('PM02');
  const [descripcion, setDescripcion] = useState(descripcionSugerida(equipo, diagnosticoForm));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 480 }}>
        <h3 style={{ marginTop: 0 }}>Solicitud de nuevo aviso</h3>
        <p style={{ fontSize: '0.8rem', color: '#666' }}>
          Se registrará como "solicitud" (sin número SAP). El Supervisor lo convertirá en aviso formal.
        </p>

        <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 10 }}>
          Texto breve ({textoBreve.length}/{TEXTO_BREVE_MAX})
        </label>
        <input
          value={textoBreve}
          maxLength={TEXTO_BREVE_MAX}
          onChange={(e) => setTextoBreve(e.target.value)}
          style={{ width: '100%' }}
        />

        <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 10 }}>Clase de aviso</label>
        <select value={clase} onChange={(e) => setClase(e.target.value)} style={{ width: '100%' }}>
          {CLASES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label style={{ fontSize: '0.75rem', display: 'block', marginTop: 10 }}>
          Descripción (autogenerada, editable)
        </label>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={4}
          style={{ width: '100%' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel}>Cancelar</button>
          <button
            onClick={() =>
              onSolicitar({
                textoBreve,
                clase,
                descripcion,
                modoFalla: diagnosticoForm.modoFalla,
              })
            }
            style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 4 }}
          >
            Solicitar
          </button>
        </div>
      </div>
    </div>
  );
}
