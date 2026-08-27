// Exportación 100% en el navegador (sin backend): arma un CSV en memoria y dispara
// la descarga con un <a download> temporal.
function escaparCsv(valor) {
  const texto = String(valor ?? '');
  if (/[",\n]/.test(texto)) return '"' + texto.replace(/"/g, '""') + '"';
  return texto;
}

export function descargarCsv(nombreArchivo, columnas, filas) {
  const encabezado = columnas.map((c) => escaparCsv(c.titulo)).join(',');
  const lineas = filas.map((fila) => columnas.map((c) => escaparCsv(c.valor(fila))).join(','));
  const csv = [encabezado, ...lineas].join('\r\n');
  // BOM inicial: sin esto Excel interpreta los acentos como caracteres corruptos.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
