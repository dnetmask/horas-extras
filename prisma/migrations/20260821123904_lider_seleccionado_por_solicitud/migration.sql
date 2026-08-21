/*
  Warnings:

  - You are about to drop the column `lider_aprobador_id` on the `horas_extra` table. All the data in the column will be lost.
  - Added the required column `lider_id` to the `horas_extra` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "horas_extra" DROP CONSTRAINT "horas_extra_lider_aprobador_id_fkey";

-- AlterTable
ALTER TABLE "horas_extra" DROP COLUMN "lider_aprobador_id",
ADD COLUMN     "lider_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "horas_extra" ADD CONSTRAINT "horas_extra_lider_id_fkey" FOREIGN KEY ("lider_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
