// La posición puesta a mano gana sobre la calculada.
//
// El modelo: las posiciones NO son dato. El escalonado (y los otros métodos)
// las calculan en cada render desde los tipos y las áreas. Arrastrar un
// equipo no guarda un layout: deja un OVERRIDE (`eq.posicionPropia`) sobre
// ese cálculo, igual que `escalaPropia` pisa a la escala del tipo.
//
// Vive acá y no dentro de una pantalla porque lo tienen que aplicar las DOS
// —el Editor de planta y la Vista de operación— y con una copia en cada una
// se separan: pasó, y durante un tiempo lo que se arrastraba en el editor no
// se veía en operación, que es justo lo que el editor promete.
export function conPosicionPropia(piezas) {
  return (piezas || []).map((p) => {
    const pp = p.eq && p.eq.posicionPropia;
    return pp ? { ...p, x: pp.x, y: pp.y, propia: true } : p;
  });
}
