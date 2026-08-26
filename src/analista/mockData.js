// Datos de prueba para la pantalla del Analista. Reemplazar por llamadas a la API real
// (ver server/) cuando el backend esté conectado. La forma de los datos espeja el
// modelo Prisma en server/prisma/schema.prisma.

// Catálogo de modos de falla por tipo de equipo — provisional/configurable
// (sección 10 del documento fuente: la taxonomía definitiva no está cerrada).
export const CATALOGO_MODO_FALLA = {
  bomba: ['Desalineamiento', 'Desbalance', 'Daño de rodamiento', 'Cavitación', 'Holgura mecánica'],
  tanque: ['Corrosión', 'Fuga', 'Fisura estructural'],
  agitador: ['Desalineamiento', 'Desbalance', 'Daño de rodamiento', 'Falla de acople'],
  compresor: ['Desgaste de válvulas', 'Daño de rodamiento', 'Fuga de gas', 'Sobrecalentamiento'],
};

export const SEED_PLANTAS = [{ id: 'planta1', nombre: 'Planta Salar' }];

export const SEED_AREAS = [
  { id: 'area1', plantaId: 'planta1', nombre: 'Área de Bombeo' },
  { id: 'area2', plantaId: 'planta1', nombre: 'Área de Molienda' },
];

export const SEED_EQUIPOS = [
  { id: 'eq1', areaId: 'area1', tag: 'B-101', tipo: 'bomba', descripcion: 'Bomba de alimentación primaria' },
  { id: 'eq2', areaId: 'area1', tag: 'TQ-102', tipo: 'tanque', descripcion: 'Tanque de proceso' },
  { id: 'eq3', areaId: 'area2', tag: 'AG-201', tipo: 'agitador', descripcion: 'Agitador línea 1' },
  { id: 'eq4', areaId: 'area2', tag: 'CP-202', tipo: 'compresor', descripcion: 'Compresor de aire de instrumentos' },
];

export const SEED_DIAGNOSTICOS = [
  {
    id: 'diag1',
    equipoId: 'eq1',
    severidad: 'alerta',
    modoFalla: 'Daño de rodamiento',
    diagnosticoTexto:
      'Se detecta incremento de energía en banda de alta frecuencia consistente con etapa temprana de daño en rodamiento lado acople.',
    recomendacionTexto: 'Planificar reemplazo de rodamiento en próxima ventana de mantenimiento.',
    fechaHora: '2026-08-20T10:00:00.000Z',
    usuario: 'analista.demo',
  },
  {
    id: 'diag2',
    equipoId: 'eq3',
    severidad: 'normal',
    modoFalla: null,
    diagnosticoTexto: 'Niveles vibratorios estables, sin anomalías respecto a línea base.',
    recomendacionTexto: 'Se mantendrá en observación según ruta de inspección programada.',
    fechaHora: '2026-08-22T09:00:00.000Z',
    usuario: 'analista.demo',
  },
];

export const SEED_AVISOS = [
  {
    id: 'aviso1',
    equipoId: 'eq1',
    diagnosticoOrigenId: 'diag1',
    numeroSap: null,
    estado: 'solicitud',
    textoBreve: 'B-101 daño rodamiento',
    descripcion:
      'B-101 - Daño de rodamiento - ALERTA / Diagnóstico: incremento de energía en banda de alta frecuencia. / Recomendación: planificar reemplazo de rodamiento.',
    clase: 'PM02',
    modoFalla: 'Daño de rodamiento',
  },
];
