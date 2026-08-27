// Datos del diagrama de flujo "Planta Concentradora" (handoff §5, copiados de
// handoff/Planta Concentradora HMI.dc.html). Demo fija e independiente del
// modelo editable de equipos (server/prisma) — es la vista de referencia del
// documento de rediseño, no está conectada a data.equipos.
//
// Retícula compactada (pase de densidad): paso 160->132 en X, 210->176 en Y,
// lienzo 1320x810 -> 1104x690. Coordenadas de nodos y conectores recalculadas
// para la nueva retícula (conectores escalados x0.825 en X / x0.838 en Y).
export const NODOS = [
  { key: 'mina', nombre: 'Mina subterránea', tag: 'MIN-001', tipo: 'Frente de extracción', etapa: 'Extracción', sev: 'normal', de: '—', a: 'Balanza 35 t', mon: 'No aplica', nota: 'Origen del mineral. Sin instrumentación en línea; el control es por tonelaje declarado.', left: 40, top: 40,
    svg: <><path d="M4 28 L18 8 L32 28" /><path d="M14 28 A4 4 0 0 1 22 28" /><path d="M32 28 H46" /></> },
  { key: 'balanza', nombre: 'Balanza 35 t', tag: 'BAL-001', tipo: 'Pesaje de camiones', etapa: 'Extracción', sev: 'normal', de: 'Mina subterránea', a: 'Tolva de gruesos', mon: 'Celdas de carga', nota: 'Registra tonelaje de entrada a planta; base del balance metalúrgico diario.', left: 172, top: 40,
    svg: <><path d="M10 20 H38" /><path d="M24 20 V12" /><path d="M14 12 H34" /><path d="M4 28 H44" /><path d="M14 20 V28 M34 20 V28" /></> },
  { key: 'tolvaGruesos', nombre: 'Tolva de gruesos', tag: 'TQ-101', tipo: 'Tolva', etapa: 'Chancado', sev: 'normal', de: 'Balanza 35 t', a: 'Ch. prim. quijada', mon: 'Nivel radar', nota: 'Pulmón de alimentación al chancado primario.', left: 304, top: 40,
    svg: <><path d="M8 5 H40 L28 23 H20 Z" /><path d="M20 23 V29" /><path d="M28 23 V29" /></> },
  { key: 'quijada', nombre: 'Ch. primario de quijada', tag: 'CH-101', tipo: 'Chancadora', etapa: 'Chancado', sev: 'observacion', de: 'Tolva de gruesos', a: 'Ch. sec. cónica', mon: 'Vibración + corriente', nota: 'Reducción primaria. Tendencia de corriente levemente al alza en las últimas dos semanas.', left: 436, top: 40,
    svg: <><path d="M6 6 H42 V26 H6 Z" /><path d="M14 6 L22 20 L30 6" /><path d="M22 20 V26" /></> },
  { key: 'conica', nombre: 'Ch. secundario cónico', tag: 'CH-102', tipo: 'Chancadora', etapa: 'Chancado', sev: 'normal', de: 'Ch. prim. quijada', a: 'Criba vibratoria', mon: 'Vibración + corriente', nota: 'Reducción secundaria previa al clasificado.', left: 568, top: 40,
    svg: <><path d="M10 6 H38 V26 H10 Z" /><path d="M17 10 L24 22 L31 10" /><path d="M17 10 H31" /></> },
  { key: 'criba', nombre: 'Criba vibratoria', tag: 'CRV-101', tipo: 'Harnero', etapa: 'Chancado', sev: 'alerta', de: 'Ch. sec. cónica', a: 'Tolva de finos', mon: 'Vibración', nota: 'Energía en banda de alta frecuencia consistente con daño temprano de rodamiento lado acople.', left: 700, top: 40,
    svg: <><path d="M8 9 H44 L38 23 H2 Z" /><path d="M16 9 L10 23 M24 9 L18 23 M32 9 L26 23" /></> },
  { key: 'tolvaFinos', nombre: 'Tolva de finos', tag: 'TQ-102', tipo: 'Tolva', etapa: 'Chancado', sev: 'normal', de: 'Criba vibratoria', a: 'Molino de bolas', mon: 'Nivel radar', nota: 'Almacena el producto fino que alimenta la molienda.', left: 832, top: 40,
    svg: <><path d="M13 5 H35 L28 23 H20 Z" /><path d="M20 23 V29" /><path d="M28 23 V29" /></> },
  { key: 'molino', nombre: 'Molino de bolas', tag: 'MOL-201', tipo: 'Molino', etapa: 'Molienda', sev: 'observacion', de: 'Tolva de finos', a: 'Sumidero 01', mon: 'Vibración + potencia', nota: 'Equipo crítico del circuito. Monitoreo continuo de descansos y piñón corona.', left: 832, top: 216,
    svg: <><path d="M12 8 H36" /><path d="M12 24 H36" /><path d="M12 8 A5 8 0 0 0 12 24" /><path d="M36 8 A5 8 0 0 1 36 24" /><path d="M4 16 H8 M40 16 H44" /></> },
  { key: 'sumidero1', nombre: 'Sumidero 01', tag: 'SMP-201', tipo: 'Cajón de bombeo', etapa: 'Molienda', sev: 'normal', de: 'Molino de bolas', a: 'Bomba B-101', mon: 'Nivel', nota: 'Recibe la descarga del molino antes del bombeo a clasificación.', left: 700, top: 216,
    svg: <><path d="M14 5 V26 H34 V5" /><path d="M14 14 H34" /></> },
  { key: 'bomba1', nombre: 'Bomba B-101', tag: 'B-101', tipo: 'Bomba centrífuga', etapa: 'Molienda', sev: 'alerta', de: 'Sumidero 01', a: 'Hidrociclón 01', mon: 'Vibración', nota: 'Bomba de alimentación primaria. Reemplazo de rodamiento planificado para la próxima ventana.', left: 568, top: 216,
    svg: <><circle cx="24" cy="18" r="9" /><path d="M24 9 V4 H34" /><path d="M15 18 H8" /><path d="M24 18 L30 14 M24 18 L20 25" /></> },
  { key: 'hidrociclon1', nombre: 'Hidrociclón 01', tag: 'HC-201', tipo: 'Clasificador', etapa: 'Molienda', sev: 'normal', de: 'Bomba B-101', a: 'Acondicionador', mon: 'Presión de entrada', nota: 'El underflow retorna al molino; el overflow pasa a acondicionamiento.', left: 436, top: 216,
    svg: <><path d="M14 6 H34 V13 L24 27 L14 13 Z" /><path d="M24 6 V2" /><path d="M14 9 H8" /></> },
  { key: 'acondicionador', nombre: 'Acondicionador', tag: 'ACD-301', tipo: 'Tanque agitado', etapa: 'Flotación', sev: 'normal', de: 'Hidrociclón 01', a: 'F. Desbaste', mon: 'Vibración de agitador', nota: 'Dosificación de reactivos y tiempo de residencia previo a flotación.', left: 304, top: 216,
    svg: <><path d="M14 6 V27 H34 V6" /><path d="M24 2 V22" /><path d="M19 22 H29" /><path d="M14 12 H34" /></> },
  { key: 'desbaste', nombre: 'F. Desbaste', tag: 'FLT-301', tipo: 'Banco de celdas', etapa: 'Flotación', sev: 'normal', de: 'Acondicionador', a: 'F. Recuperación', mon: 'Vibración de motores', nota: 'Primera etapa de concentración; su relave alimenta el circuito de relaves.', left: 40, top: 392,
    svg: <><path d="M5 10 H43 V25 H5 Z" /><path d="M5 15 H43" /><circle cx="16" cy="20" r="2" /><circle cx="32" cy="20" r="2" /></> },
  { key: 'recuperacion', nombre: 'F. Recuperación', tag: 'FLT-302', tipo: 'Banco de celdas', etapa: 'Flotación', sev: 'normal', de: 'F. Desbaste', a: 'F. Limpieza', mon: 'Vibración de motores', nota: 'Recupera valores remanentes del desbaste.', left: 172, top: 392,
    svg: <><path d="M5 10 H43 V25 H5 Z" /><path d="M5 15 H43" /><circle cx="16" cy="20" r="2" /><circle cx="32" cy="20" r="2" /></> },
  { key: 'limpieza', nombre: 'F. Limpieza', tag: 'FLT-303', tipo: 'Banco de celdas', etapa: 'Flotación', sev: 'observacion', de: 'F. Recuperación', a: 'F. Re-limpieza', mon: 'Vibración de motores', nota: 'Sube la ley del concentrado. Leve aumento de temperatura en motor de celda 2.', left: 304, top: 392,
    svg: <><path d="M5 10 H43 V25 H5 Z" /><path d="M5 15 H43" /><circle cx="16" cy="20" r="2" /><circle cx="32" cy="20" r="2" /></> },
  { key: 'relimpieza', nombre: 'F. Re-limpieza', tag: 'FLT-304', tipo: 'Banco de celdas', etapa: 'Flotación', sev: 'normal', de: 'F. Limpieza', a: 'Espesador', mon: 'Vibración de motores', nota: 'Etapa final de concentración antes del espesado.', left: 436, top: 392,
    svg: <><path d="M5 10 H43 V25 H5 Z" /><path d="M5 15 H43" /><circle cx="16" cy="20" r="2" /><circle cx="32" cy="20" r="2" /></> },
  { key: 'espesador', nombre: 'Espesador', tag: 'ESP-401', tipo: 'Espesador', etapa: 'Filtrado', sev: 'normal', de: 'F. Re-limpieza', a: 'Filtro de discos', mon: 'Torque de rastras', nota: 'El agua clara del overflow se recicla al circuito de molienda.', left: 568, top: 392,
    svg: <><path d="M5 8 H43 L24 27 Z" /><path d="M5 13 H43" /><path d="M24 4 V8" /></> },
  { key: 'filtro', nombre: 'Filtro de discos', tag: 'FIL-401', tipo: 'Filtro', etapa: 'Filtrado', sev: 'normal', de: 'Espesador', a: 'Horno de secado', mon: 'Vibración + vacío', nota: 'Entrega concentrado húmedo de 10–15 % Hu.', left: 700, top: 392,
    svg: <><circle cx="24" cy="15" r="10" /><path d="M20 6 V24 M28 6 V24" /><path d="M14 29 H34" /></> },
  { key: 'horno', nombre: 'Horno de secado', tag: 'HRN-401', tipo: 'Horno rotatorio', etapa: 'Filtrado', sev: 'alarma', de: 'Filtro de discos', a: 'Conc. seco 6 % Hu', mon: 'Temperatura + vibración', nota: 'Temperatura de descanso sobre límite de alarma. Requiere intervención inmediata.', left: 832, top: 392,
    svg: <><path d="M8 20 H40 V10 H8 Z" /><path d="M18 10 V20 M30 10 V20" /><circle cx="16" cy="25" r="3" /><circle cx="32" cy="25" r="3" /></> },
  { key: 'concentrado', nombre: 'Conc. seco 6 % Hu', tag: 'PRD-401', tipo: 'Producto', etapa: 'Producto', sev: 'normal', de: 'Horno de secado', a: 'Despacho', mon: 'Muestreo de humedad', nota: 'Producto final a 6 % de humedad, listo para despacho.', left: 964, top: 392,
    svg: <><path d="M10 26 L24 8 L38 26 Z" /><path d="M6 29 H42" /></> },
  { key: 'sumidero2', nombre: 'Sumidero 02', tag: 'SMP-501', tipo: 'Cajón de bombeo', etapa: 'Relaves', sev: 'normal', de: 'F. Desbaste', a: 'Bomba B-201', mon: 'Nivel', nota: 'Colecta el relave de flotación desbaste.', left: 172, top: 568,
    svg: <><path d="M14 5 V26 H34 V5" /><path d="M14 14 H34" /></> },
  { key: 'bomba2', nombre: 'Bomba B-201', tag: 'B-201', tipo: 'Bomba centrífuga', etapa: 'Relaves', sev: 'normal', de: 'Sumidero 02', a: 'Hidrociclón 02', mon: 'Vibración', nota: 'Bombeo de relave a clasificación para relleno hidráulico.', left: 304, top: 568,
    svg: <><circle cx="24" cy="18" r="9" /><path d="M24 9 V4 H34" /><path d="M15 18 H8" /><path d="M24 18 L30 14 M24 18 L20 25" /></> },
  { key: 'hidrociclon2', nombre: 'Hidrociclón 02', tag: 'HC-501', tipo: 'Clasificador', etapa: 'Relaves', sev: 'normal', de: 'Bomba B-201', a: 'Relavera', mon: 'Presión de entrada', nota: 'Separa relave grueso para relleno hidráulico de labores.', left: 436, top: 568,
    svg: <><path d="M14 6 H34 V13 L24 27 L14 13 Z" /><path d="M24 6 V2" /><path d="M14 9 H8" /></> },
  { key: 'relavera', nombre: 'Relavera', tag: 'REL-501', tipo: 'Depósito', etapa: 'Relaves', sev: 'observacion', de: 'Hidrociclón 02', a: '—', mon: 'Piezómetros', nota: 'Depósito de relaves. Nivel piezométrico en seguimiento tras las últimas lluvias.', left: 568, top: 568,
    svg: <><path d="M2 25 L13 12 L24 25" /><path d="M22 25 L33 14 L44 25" /><path d="M2 28 H44" /></> },
];

export const CONECTORES = [
  'M122 77 H163', 'M254 77 H295', 'M386 77 H427', 'M518 77 H559', 'M650 77 H691', 'M782 77 H823',
  'M870 121 V208',
  'M825 253 H784', 'M693 253 H652', 'M561 253 H520', 'M429 253 H388',
  'M342 297 V344 H78 V384',
  'M122 429 H163', 'M254 429 H295', 'M386 429 H427', 'M518 429 H559', 'M650 429 H691', 'M782 429 H823', 'M914 429 H955',
  'M78 473 V520 H208 V560',
  'M254 605 H295', 'M386 605 H427', 'M518 605 H559',
  'M606 384 V350 H871 V298',
];

export const ETIQUETAS_CONECTORES = [
  { x: 125, y: 70, texto: 'FAJA Nº1' },
  { x: 653, y: 70, texto: 'FAJA Nº2' },
  { x: 875, y: 168, texto: 'FINOS' },
  { x: 521, y: 246, texto: 'OVERFLOW' },
  { x: 83, y: 515, texto: 'RELAVE DESBASTE' },
  { x: 653, y: 345, texto: 'AGUA CLARA A RECICLAJE' },
  { x: 917, y: 422, texto: 'CONCENTRADO' },
];
