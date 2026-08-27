// Sistema de severidad fijo (sección 3 del documento fuente). No editable por configuración.
export const SEVERIDAD = {
  normal: { label: 'Normal', color: '#2e7d32' },
  observacion: { label: 'Observación', color: '#1565c0' },
  alerta: { label: 'Alerta', color: '#f9a825' },
  alarma: { label: 'Alarma', color: '#c62828' },
};

// Paleta monocroma en acero (handoff §2) — para severidadEnColor:false.
export const SEVERIDAD_MONO = {
  normal: 'var(--color-neutral-400)',
  observacion: 'var(--color-accent-300)',
  alerta: 'var(--color-accent-500)',
  alarma: 'var(--color-accent-900)',
};

export function colorDeSeveridad(severidad, severidadEnColor = true) {
  return severidadEnColor ? SEVERIDAD[severidad].color : SEVERIDAD_MONO[severidad];
}

export const SEVERIDAD_ORDEN = ['normal', 'observacion', 'alerta', 'alarma'];

export const RECOMENDACION_DEFAULT =
  'Se mantendrá en observación según ruta de inspección programada.';

// Obligatoriedad de campos por severidad (tabla de la sección 3).
export function reglasPorSeveridad(severidad) {
  return {
    modoFallaRequerido: severidad !== 'normal',
    recomendacionRequerida: severidad === 'alerta' || severidad === 'alarma',
    avisoRequerido: severidad === 'alerta' || severidad === 'alarma',
  };
}
