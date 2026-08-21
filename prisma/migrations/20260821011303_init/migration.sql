-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ingeniero', 'lider', 'gerencia', 'admin');

-- CreateEnum
CREATE TYPE "EstadoHorasExtra" AS ENUM ('pendiente_lider', 'pendiente_gerencia', 'aprobada', 'rechazada');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "azure_object_id" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'ingeniero',
    "lider_id" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recargo_rule_sets" (
    "id" TEXT NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "hora_inicio_diurna" TEXT NOT NULL,
    "hora_fin_diurna" TEXT NOT NULL,
    "pct_extra_diurna" DECIMAL(5,4) NOT NULL,
    "pct_extra_nocturna" DECIMAL(5,4) NOT NULL,
    "pct_dominical_festivo" DECIMAL(5,4) NOT NULL,
    "nota" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recargo_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "festivos" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "festivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horas_extra" (
    "id" TEXT NOT NULL,
    "ingeniero_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "caso" TEXT,
    "ot" TEXT,
    "obra" TEXT,
    "estado" "EstadoHorasExtra" NOT NULL DEFAULT 'pendiente_lider',
    "lider_aprobador_id" TEXT,
    "lider_respondido_en" TIMESTAMP(3),
    "gerencia_aprobador_id" TEXT,
    "gerencia_respondido_en" TIMESTAMP(3),
    "motivo_rechazo" TEXT,
    "horas_extra_diurna_ord" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "horas_extra_nocturna_ord" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "horas_extra_diurna_domfest" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "horas_extra_nocturna_domfest" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "horas_totales" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horas_extra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compensaciones" (
    "id" TEXT NOT NULL,
    "ingeniero_id" TEXT NOT NULL,
    "horas_extra_id" TEXT,
    "horas" DECIMAL(5,2) NOT NULL,
    "fecha_compensacion" DATE NOT NULL,
    "registrado_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compensaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "tabla" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "campo" TEXT,
    "valor_antes" TEXT,
    "valor_despues" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones_enviadas" (
    "id" TEXT NOT NULL,
    "horas_extra_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "enviada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_enviadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_azure_object_id_key" ON "usuarios"("azure_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "festivos_fecha_key" ON "festivos"("fecha");

-- CreateIndex
CREATE INDEX "horas_extra_ingeniero_id_idx" ON "horas_extra"("ingeniero_id");

-- CreateIndex
CREATE INDEX "horas_extra_estado_idx" ON "horas_extra"("estado");

-- CreateIndex
CREATE INDEX "horas_extra_fecha_idx" ON "horas_extra"("fecha");

-- CreateIndex
CREATE INDEX "compensaciones_ingeniero_id_idx" ON "compensaciones"("ingeniero_id");

-- CreateIndex
CREATE INDEX "audit_log_tabla_registro_id_idx" ON "audit_log"("tabla", "registro_id");

-- CreateIndex
CREATE INDEX "notificaciones_enviadas_horas_extra_id_tipo_idx" ON "notificaciones_enviadas"("horas_extra_id", "tipo");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_lider_id_fkey" FOREIGN KEY ("lider_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horas_extra" ADD CONSTRAINT "horas_extra_ingeniero_id_fkey" FOREIGN KEY ("ingeniero_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horas_extra" ADD CONSTRAINT "horas_extra_lider_aprobador_id_fkey" FOREIGN KEY ("lider_aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horas_extra" ADD CONSTRAINT "horas_extra_gerencia_aprobador_id_fkey" FOREIGN KEY ("gerencia_aprobador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensaciones" ADD CONSTRAINT "compensaciones_ingeniero_id_fkey" FOREIGN KEY ("ingeniero_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensaciones" ADD CONSTRAINT "compensaciones_horas_extra_id_fkey" FOREIGN KEY ("horas_extra_id") REFERENCES "horas_extra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compensaciones" ADD CONSTRAINT "compensaciones_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones_enviadas" ADD CONSTRAINT "notificaciones_enviadas_horas_extra_id_fkey" FOREIGN KEY ("horas_extra_id") REFERENCES "horas_extra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
