// Datos de prueba para la pantalla del Analista. Reemplazar por llamadas a la API real
// (ver server/) cuando el backend esté conectado. La forma de los datos espeja el
// modelo Prisma en server/prisma/schema.prisma.

// Catálogo de modos de falla por tipo de equipo — provisional/configurable
// (sección 10 del documento fuente: la taxonomía definitiva no está cerrada).
export const CATALOGO_MODO_FALLA = {
  motor: ['Desalineamiento', 'Daño de rodamiento', 'Falla eléctrica', 'Sobrecalentamiento', 'Falla de aislación'],
  bomba: ['Desalineamiento', 'Desbalance', 'Daño de rodamiento', 'Cavitación', 'Holgura mecánica'],
  tanque: ['Corrosión', 'Fuga', 'Fisura estructural'],
  agitador: ['Desalineamiento', 'Desbalance', 'Daño de rodamiento', 'Falla de acople'],
  compresor: ['Desgaste de válvulas', 'Daño de rodamiento', 'Fuga de gas', 'Sobrecalentamiento'],
  clarificador: ['Colmatación de rastras', 'Desgaste de mecanismo de rastrillo', 'Sobrecarga de sólidos', 'Fuga en vertedero'],
  secador: ['Desgaste de llantas de rodadura', 'Desalineamiento de tambor', 'Sobrecalentamiento', 'Obstrucción de flujo de aire'],
};

export const SEED_PLANTAS = [{ id: 'planta1', nombre: 'Planta Salar' }];

export const SEED_AREAS = [
  { id: 'area-bombeo', plantaId: 'planta1', nombre: 'Área de Bombeo' },
  { id: 'area-agitacion', plantaId: 'planta1', nombre: 'Área de Agitación' },
  { id: 'area-clarificacion', plantaId: 'planta1', nombre: 'Área de Clarificación' },
  { id: 'area-secado', plantaId: 'planta1', nombre: 'Área de Secado' },
];

export const SEED_EQUIPOS = [
  // Área de Bombeo — 6 bombas
  { id: 'eq-b101', areaId: 'area-bombeo', tag: 'B-101', tipo: 'bomba', descripcion: 'Bomba de alimentación primaria', posicion: { x: 80, y: 80 } },
  { id: 'eq-b102', areaId: 'area-bombeo', tag: 'B-102', tipo: 'bomba', descripcion: 'Bomba de alimentación secundaria', posicion: { x: 220, y: 80 } },
  { id: 'eq-b103', areaId: 'area-bombeo', tag: 'B-103', tipo: 'bomba', descripcion: 'Bomba de traspaso', posicion: { x: 360, y: 80 } },
  { id: 'eq-b104', areaId: 'area-bombeo', tag: 'B-104', tipo: 'bomba', descripcion: 'Bomba de recirculación', posicion: { x: 80, y: 200 } },
  { id: 'eq-b105', areaId: 'area-bombeo', tag: 'B-105', tipo: 'bomba', descripcion: 'Bomba de refuerzo', posicion: { x: 220, y: 200 } },
  { id: 'eq-b106', areaId: 'area-bombeo', tag: 'B-106', tipo: 'bomba', descripcion: 'Bomba de reserva', posicion: { x: 360, y: 200 } },

  // Área de Agitación — 5 agitadores
  { id: 'eq-ag201', areaId: 'area-agitacion', tag: 'AG-201', tipo: 'agitador', descripcion: 'Agitador línea 1', posicion: { x: 520, y: 80 } },
  { id: 'eq-ag202', areaId: 'area-agitacion', tag: 'AG-202', tipo: 'agitador', descripcion: 'Agitador línea 2', posicion: { x: 660, y: 80 } },
  { id: 'eq-ag203', areaId: 'area-agitacion', tag: 'AG-203', tipo: 'agitador', descripcion: 'Agitador línea 3', posicion: { x: 520, y: 200 } },
  { id: 'eq-ag204', areaId: 'area-agitacion', tag: 'AG-204', tipo: 'agitador', descripcion: 'Agitador línea 4', posicion: { x: 660, y: 200 } },
  { id: 'eq-ag205', areaId: 'area-agitacion', tag: 'AG-205', tipo: 'agitador', descripcion: 'Agitador línea 5', posicion: { x: 590, y: 320 } },

  // Área de Clarificación — 1 clarificador
  { id: 'eq-cl301', areaId: 'area-clarificacion', tag: 'CL-301', tipo: 'clarificador', descripcion: 'Clarificador primario', posicion: { x: 800, y: 80 } },

  // Área de Secado — 1 secador
  { id: 'eq-sc401', areaId: 'area-secado', tag: 'SC-401', tipo: 'secador', descripcion: 'Secador rotatorio', posicion: { x: 800, y: 200 } },
];

export const SEED_DIAGNOSTICOS = [
  {
    id: 'diag1',
    equipoId: 'eq-b101',
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
    equipoId: 'eq-ag201',
    severidad: 'normal',
    modoFalla: null,
    diagnosticoTexto: 'Niveles vibratorios estables, sin anomalías respecto a línea base.',
    recomendacionTexto: 'Se mantendrá en observación según ruta de inspección programada.',
    fechaHora: '2026-08-22T09:00:00.000Z',
    usuario: 'analista.demo',
  },
  {
    id: 'diag3',
    equipoId: 'eq-cl301',
    severidad: 'observacion',
    modoFalla: 'Desgaste de mecanismo de rastrillo',
    diagnosticoTexto: 'Se observa leve incremento de vibración en el mecanismo de accionamiento del rastrillo.',
    recomendacionTexto: 'Se mantendrá en observación según ruta de inspección programada.',
    fechaHora: '2026-08-23T11:30:00.000Z',
    usuario: 'analista.demo',
  },
  {
    id: 'diag4',
    equipoId: 'eq-sc401',
    severidad: 'alarma',
    modoFalla: 'Desalineamiento de tambor',
    diagnosticoTexto:
      'Vibración severa en dirección radial, con armónicos consistentes con desalineamiento significativo del tambor rotatorio.',
    recomendacionTexto: 'Intervención inmediata: detener y alinear tambor antes de continuar operación.',
    fechaHora: '2026-08-25T08:15:00.000Z',
    usuario: 'analista.demo',
  },
];

// Flechas de flujo de proceso para el Portal SCADA (puramente visuales).
export const SEED_CONEXIONES = [
  { id: 'con1', plantaId: 'planta1', deId: 'eq-b101', aId: 'eq-ag201' },
  { id: 'con2', plantaId: 'planta1', deId: 'eq-ag201', aId: 'eq-cl301' },
  { id: 'con3', plantaId: 'planta1', deId: 'eq-cl301', aId: 'eq-sc401' },
];

export const SEED_AVISOS = [
  {
    id: 'aviso1',
    equipoId: 'eq-b101',
    diagnosticoOrigenId: 'diag1',
    numeroSap: null,
    estado: 'solicitud',
    textoBreve: 'B-101 daño rodamiento',
    descripcion:
      'B-101 - Daño de rodamiento - ALERTA / Diagnóstico: incremento de energía en banda de alta frecuencia. / Recomendación: planificar reemplazo de rodamiento.',
    clase: 'PM02',
    modoFalla: 'Daño de rodamiento',
  },
  {
    id: 'aviso2',
    equipoId: 'eq-sc401',
    diagnosticoOrigenId: 'diag4',
    numeroSap: null,
    estado: 'solicitud',
    textoBreve: 'SC-401 desalineamiento tambor',
    descripcion:
      'SC-401 - Desalineamiento de tambor - ALARMA / Diagnóstico: vibración severa en dirección radial. / Recomendación: detener y alinear tambor.',
    clase: 'PM01',
    modoFalla: 'Desalineamiento de tambor',
  },
];
