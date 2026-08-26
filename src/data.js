export const SEED_LEVELS = [
  { id: 'nivel1', name: 'Nivel 1 - Recepción' },
  { id: 'nivel2', name: 'Nivel 2 - Proceso' },
  { id: 'nivel3', name: 'Nivel 3 - Almacenamiento' },
];

export const SEED_EQUIPMENT = [
  {
    id: 'eq1',
    tipo: 'bomba',
    levelId: 'nivel1',
    label: 'Bomba 101',
    position: { x: 100, y: 120 },
    status: 'operativo',
    fichaTecnica: {
      marca: 'Grundfos',
      modelo: 'CR15',
      numeroSerie: 'SN-101',
      fechaInstalacion: '2022-03-10',
      ubicacion: 'Sala de bombas A',
    },
    historial: [
      {
        id: 'h1',
        fecha: '2026-08-01T10:00:00.000Z',
        autor: 'J. Pérez',
        estado: 'operativo',
        observaciones: 'Revisión de rutina sin novedades.',
      },
    ],
  },
  {
    id: 'eq2',
    tipo: 'tanque',
    levelId: 'nivel1',
    label: 'Tanque 102',
    position: { x: 300, y: 100 },
    status: 'alerta',
    fichaTecnica: {
      marca: 'Bindar',
      modelo: 'TK-5000',
      numeroSerie: 'SN-102',
      fechaInstalacion: '2021-11-02',
      ubicacion: 'Sala de bombas A',
    },
    historial: [
      {
        id: 'h2',
        fecha: '2026-08-20T09:30:00.000Z',
        autor: 'M. Soto',
        estado: 'alerta',
        observaciones: 'Nivel de vibración levemente sobre lo normal.',
      },
    ],
  },
  {
    id: 'eq3',
    tipo: 'compresor',
    levelId: 'nivel2',
    label: 'Compresor 201',
    position: { x: 150, y: 150 },
    status: 'falla',
    fichaTecnica: {
      marca: 'Atlas Copco',
      modelo: 'GA30',
      numeroSerie: 'SN-201',
      fechaInstalacion: '2020-06-15',
      ubicacion: 'Sala de compresores',
    },
    historial: [
      {
        id: 'h3',
        fecha: '2026-08-24T14:10:00.000Z',
        autor: 'M. Soto',
        estado: 'falla',
        observaciones: 'Sobrecalentamiento, requiere mantenimiento urgente.',
      },
    ],
  },
  {
    id: 'eq4',
    tipo: 'agitador',
    levelId: 'nivel3',
    label: 'Agitador 301',
    position: { x: 200, y: 130 },
    status: 'operativo',
    fichaTecnica: {
      marca: 'Ekato',
      modelo: 'RE-2',
      numeroSerie: 'SN-301',
      fechaInstalacion: '2023-01-20',
      ubicacion: 'Nave de almacenamiento',
    },
    historial: [],
  },
];
