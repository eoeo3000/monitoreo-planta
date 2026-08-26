// Sistema de severidad fijo (sección 3 del documento fuente). No editable por configuración.
export const SEVERIDAD = {
  normal: { label: 'Normal', color: '#2e7d32' },
  observacion: { label: 'Observación', color: '#1565c0' },
  alerta: { label: 'Alerta', color: '#f9a825' },
  alarma: { label: 'Alarma', color: '#c62828' },
};

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
