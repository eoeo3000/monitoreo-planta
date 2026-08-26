-- CreateTable
CREATE TABLE "Planta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    CONSTRAINT "Area_plantaId_fkey" FOREIGN KEY ("plantaId") REFERENCES "Planta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "areaId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    CONSTRAINT "Equipo_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Diagnostico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipoId" TEXT NOT NULL,
    "severidad" TEXT NOT NULL,
    "modoFalla" TEXT,
    "diagnosticoTexto" TEXT NOT NULL,
    "recomendacionTexto" TEXT,
    "fechaHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario" TEXT NOT NULL,
    CONSTRAINT "Diagnostico_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Aviso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipoId" TEXT NOT NULL,
    "diagnosticoOrigenId" TEXT NOT NULL,
    "numeroSap" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'solicitud',
    "textoBreve" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "clase" TEXT NOT NULL,
    "modoFalla" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Aviso_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Aviso_diagnosticoOrigenId_fkey" FOREIGN KEY ("diagnosticoOrigenId") REFERENCES "Diagnostico" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evidencia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagnosticoId" TEXT NOT NULL,
    "imagen" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fechaHora" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evidencia_diagnosticoId_fkey" FOREIGN KEY ("diagnosticoId") REFERENCES "Diagnostico" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatalogoModoFalla" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipoTipo" TEXT NOT NULL,
    "modoFalla" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Equipo_tag_key" ON "Equipo"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Aviso_diagnosticoOrigenId_key" ON "Aviso"("diagnosticoOrigenId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogoModoFalla_equipoTipo_modoFalla_key" ON "CatalogoModoFalla"("equipoTipo", "modoFalla");
