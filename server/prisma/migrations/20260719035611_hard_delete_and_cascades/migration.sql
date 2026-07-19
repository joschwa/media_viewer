/*
  Warnings:

  - You are about to drop the column `deleted_at` on the `media_items` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_media_preferences" DROP CONSTRAINT "user_media_preferences_media_id_fkey";

-- DropForeignKey
ALTER TABLE "user_media_preferences" DROP CONSTRAINT "user_media_preferences_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_media_tags" DROP CONSTRAINT "user_media_tags_media_id_fkey";

-- DropForeignKey
ALTER TABLE "user_media_tags" DROP CONSTRAINT "user_media_tags_user_id_fkey";

-- AlterTable
ALTER TABLE "media_items" DROP COLUMN "deleted_at";

-- AddForeignKey
ALTER TABLE "user_media_preferences" ADD CONSTRAINT "user_media_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_media_preferences" ADD CONSTRAINT "user_media_preferences_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_media_tags" ADD CONSTRAINT "user_media_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_media_tags" ADD CONSTRAINT "user_media_tags_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
