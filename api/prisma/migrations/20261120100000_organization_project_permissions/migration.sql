BEGIN;

-- AlterTable
ALTER TABLE "features" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "organization_relationships" ADD COLUMN     "is_organization_admin" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "features_id_project_id_key" ON "features"("id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_relationships_organization_id_user_id_key" ON "organization_relationships"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_feature_id_project_id_fkey" FOREIGN KEY ("feature_id", "project_id") REFERENCES "features"("id", "project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
