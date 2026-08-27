import { CATALOGO_MODO_FALLA } from './mockData';
import { descargarCsv } from './exportarCsv';

const COLUMNAS_EXPORT = [
  { titulo: 'TAG', valor: (f) => f.eq.tag },
  { titulo: 'Planta', valor: (f) => f.planta?.nombre || '' },
  { titulo: 'Área', valor: (f) => f.area?.nombre || '' },
  { titulo: 'Tipo', valor: (f) => f.eq.tipo },
  { titulo: 'Descripción', valor: (f) => f.eq.descripcion || '' },
  { titulo: 'Conecta a', valor: (f) => f.conectaA },
];

export function descargarDisposicionPlanta(data) {
  const filas = data.equipos.map((eq) => {
    const area = data.areas.find((a) => a.id === eq.areaId);
    const planta = data.plantas.find((p) => p.id === area?.plantaId);
    const conectaA = data.conexiones
      .filter((c) => c.deId === eq.id)
      .map((c) => data.equipos.find((e) => e.id === c.aId)?.tag)
      .filter(Boolean)
      .join('; ');
    return { eq, area, planta, conectaA };
  });
  descargarCsv(`disposicion-planta-${new Date().toISOString().slice(0, 10)}.csv`, COLUMNAS_EXPORT, filas);
}

// Parser CSV básico (no una librería completa): soporta campos entre comillas con
// comas/saltos de línea y comillas escapadas ("") — suficiente para lo que exporta
// descargarCsv y para lo que produce Excel al guardar como CSV.
export function parsearCsv(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ',') {
      fila.push(campo);
      campo = '';
    } else if (c === '\r') {
      // ignorar, el \n que sigue cierra la fila
    } else if (c === '\n') {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => !(f.length === 1 && f[0].trim() === ''));
}

function normalizarEncabezado(h) {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, ''); // quita acentos: "área" -> "area"
}

// Crea (o reutiliza) plantas/áreas/equipos a partir de un CSV con columnas
// TAG, Planta, Área, Tipo, Descripción, Conecta a — mismo formato que exporta
// descargarDisposicionPlanta, para poder editarlo y volver a subirlo.
export function importarDisposicionPlanta(texto, { data, crearPlanta, crearArea, crearEquipo, crearConexion }) {
  const filas = parsearCsv(texto);
  if (filas.length === 0) return { creados: 0, conexiones: 0, errores: ['El archivo está vacío.'] };

  const encabezados = filas[0].map(normalizarEncabezado);
  const idx = {
    tag: encabezados.indexOf('tag'),
    planta: encabezados.indexOf('planta'),
    area: encabezados.findIndex((h) => h === 'area'),
    tipo: encabezados.indexOf('tipo'),
    descripcion: encabezados.findIndex((h) => h.startsWith('descripcion')),
    conectaA: encabezados.findIndex((h) => h.startsWith('conecta')),
  };
  if ([idx.tag, idx.planta, idx.area, idx.tipo].some((i) => i === -1)) {
    return { creados: 0, conexiones: 0, errores: ['Faltan columnas obligatorias: TAG, Planta, Área, Tipo.'] };
  }

  const tiposValidos = Object.keys(CATALOGO_MODO_FALLA);
  const errores = [];
  let creados = 0;

  const idPorTag = new Map(data.equipos.map((eq) => [eq.tag.toLowerCase(), eq.id]));
  const plantaIdPorNombre = new Map(data.plantas.map((p) => [p.nombre.toLowerCase(), p.id]));
  const areaIdPorClave = new Map(data.areas.map((a) => [`${a.plantaId}::${a.nombre.toLowerCase()}`, a.id]));
  const pendientesConexion = [];

  for (let i = 1; i < filas.length; i++) {
    const fila = filas[i];
    if (fila.every((c) => !c.trim())) continue;

    const tag = (fila[idx.tag] || '').trim();
    const nombrePlanta = (fila[idx.planta] || '').trim();
    const nombreArea = (fila[idx.area] || '').trim();
    const tipoCrudo = (fila[idx.tipo] || '').trim();
    const descripcion = idx.descripcion >= 0 ? (fila[idx.descripcion] || '').trim() : '';
    const conectaA = idx.conectaA >= 0 ? (fila[idx.conectaA] || '').trim() : '';

    if (!tag || !nombrePlanta || !nombreArea || !tipoCrudo) {
      errores.push(`Fila ${i + 1}: faltan datos obligatorios (TAG/Planta/Área/Tipo), se omitió.`);
      continue;
    }
    if (idPorTag.has(tag.toLowerCase())) {
      errores.push(`Fila ${i + 1}: ya existe un equipo con TAG "${tag}", se omitió.`);
      continue;
    }
    const tipo = tiposValidos.find((t) => t.toLowerCase() === tipoCrudo.toLowerCase());
    if (!tipo) {
      errores.push(`Fila ${i + 1}: tipo "${tipoCrudo}" no reconocido (válidos: ${tiposValidos.join(', ')}).`);
      continue;
    }

    let plantaId = plantaIdPorNombre.get(nombrePlanta.toLowerCase());
    if (!plantaId) {
      plantaId = crearPlanta(nombrePlanta);
      plantaIdPorNombre.set(nombrePlanta.toLowerCase(), plantaId);
    }
    const claveArea = `${plantaId}::${nombreArea.toLowerCase()}`;
    let areaId = areaIdPorClave.get(claveArea);
    if (!areaId) {
      areaId = crearArea(plantaId, nombreArea);
      areaIdPorClave.set(claveArea, areaId);
    }

    const equipoId = crearEquipo(areaId, { tag, tipo, descripcion });
    idPorTag.set(tag.toLowerCase(), equipoId);
    creados += 1;

    if (conectaA) {
      // "Conecta a" puede traer varios TAG separados por ";" (mismo formato que exporta la descarga).
      conectaA
        .split(';')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((haciaTag) => pendientesConexion.push({ desdeTag: tag, haciaTag, plantaId, fila: i + 1 }));
    }
  }

  let conexiones = 0;
  pendientesConexion.forEach(({ desdeTag, haciaTag, plantaId, fila }) => {
    const desdeId = idPorTag.get(desdeTag.toLowerCase());
    const haciaId = idPorTag.get(haciaTag.toLowerCase());
    if (!haciaId) {
      errores.push(`Fila ${fila}: "Conecta a" referencia el TAG "${haciaTag}", que no existe.`);
      return;
    }
    crearConexion(plantaId, desdeId, haciaId);
    conexiones += 1;
  });

  return { creados, conexiones, errores };
}
