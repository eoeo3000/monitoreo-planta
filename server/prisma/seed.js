const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MODOS_FALLA_DEFAULT = {
  bomba: ['Desalineamiento', 'Desbalance', 'Daño de rodamiento', 'Cavitación', 'Holgura mecánica'],
  motor: ['Desalineamiento', 'Desbalance', 'Daño de rodamiento', 'Falla eléctrica', 'Excentricidad'],
  caja_reductora: ['Desgaste de engranajes', 'Daño de rodamiento', 'Falla de lubricación', 'Holgura mecánica'],
  polea: ['Desalineamiento de correa', 'Desgaste de correa', 'Desbalance'],
  ventilador: ['Desbalance', 'Daño de rodamiento', 'Suciedad en álabes'],
};

async function main() {
  for (const [equipoTipo, modos] of Object.entries(MODOS_FALLA_DEFAULT)) {
    for (const modoFalla of modos) {
      await prisma.catalogoModoFalla.upsert({
        where: { equipoTipo_modoFalla: { equipoTipo, modoFalla } },
        update: {},
        create: { equipoTipo, modoFalla },
      });
    }
  }

  const planta = await prisma.planta.create({
    data: {
      nombre: 'Planta Salar',
      ubicacion: 'Planta de referencia para pruebas',
      areas: {
        create: [
          {
            nombre: 'Área de Bombeo',
            equipos: {
              create: [
                { tag: 'B-101', tipo: 'bomba', descripcion: 'Bomba de alimentación primaria' },
                { tag: 'M-101', tipo: 'motor', descripcion: 'Motor de accionamiento B-101' },
              ],
            },
          },
          {
            nombre: 'Área de Molienda',
            equipos: {
              create: [
                { tag: 'CR-201', tipo: 'caja_reductora', descripcion: 'Caja reductora molino 1' },
                { tag: 'V-201', tipo: 'ventilador', descripcion: 'Ventilador de extracción' },
              ],
            },
          },
        ],
      },
    },
    include: { areas: { include: { equipos: true } } },
  });

  const equipoB101 = planta.areas[0].equipos[0];

  const diagnostico = await prisma.diagnostico.create({
    data: {
      equipoId: equipoB101.id,
      severidad: 'alerta',
      modoFalla: 'Daño de rodamiento',
      diagnosticoTexto:
        'Se detecta incremento de energía en banda de alta frecuencia consistente con etapa temprana de daño en rodamiento lado acople.',
      recomendacionTexto: 'Planificar reemplazo de rodamiento en próxima ventana de mantenimiento.',
      usuario: 'analista.demo',
    },
  });

  await prisma.aviso.create({
    data: {
      equipoId: equipoB101.id,
      diagnosticoOrigenId: diagnostico.id,
      estado: 'solicitud',
      textoBreve: 'B-101 daño rodamiento',
      descripcion:
        'B-101 - Daño de rodamiento - ALERTA / Diagnóstico: incremento de energía en banda de alta frecuencia. / Recomendación: planificar reemplazo de rodamiento.',
      clase: 'PM02',
      modoFalla: 'Daño de rodamiento',
    },
  });

  console.log('Seed completado:', planta.nombre);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
