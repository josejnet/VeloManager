-- Drop the old UserRole-based role column from ClubMembership
DROP INDEX IF EXISTS "ClubMembership_clubId_role_idx";
ALTER TABLE "ClubMembership" DROP COLUMN IF EXISTS "role";

-- Update ClubInvitation.assignedRole from UserRole to ClubRole (rename-in-place via temp column)
ALTER TABLE "ClubInvitation" ADD COLUMN "assignedRoleNew" "ClubRole" NOT NULL DEFAULT 'MEMBER';
UPDATE "ClubInvitation" SET "assignedRoleNew" = 'ADMIN' WHERE "assignedRole" = 'CLUB_ADMIN';
UPDATE "ClubInvitation" SET "assignedRoleNew" = 'MEMBER' WHERE "assignedRole" != 'CLUB_ADMIN';
ALTER TABLE "ClubInvitation" DROP COLUMN "assignedRole";
ALTER TABLE "ClubInvitation" RENAME COLUMN "assignedRoleNew" TO "assignedRole";

-- Update ClubMessage.targetRole from UserRole? to ClubRole?
ALTER TABLE "ClubMessage" ADD COLUMN "targetRoleNew" "ClubRole";
UPDATE "ClubMessage" SET "targetRoleNew" = 'ADMIN' WHERE "targetRole" = 'CLUB_ADMIN';
UPDATE "ClubMessage" SET "targetRoleNew" = 'MEMBER' WHERE "targetRole" = 'SOCIO';
-- SUPER_ADMIN targetRole → NULL (not a club role)
ALTER TABLE "ClubMessage" DROP COLUMN "targetRole";
ALTER TABLE "ClubMessage" RENAME COLUMN "targetRoleNew" TO "targetRole";

-- Update PlatformBanner.targetRoles from UserRole[] to ClubRole[]
ALTER TABLE "PlatformBanner" ADD COLUMN "targetRolesNew" "ClubRole"[] NOT NULL DEFAULT '{}';
UPDATE "PlatformBanner"
SET "targetRolesNew" = ARRAY(
  SELECT CASE v
    WHEN 'CLUB_ADMIN' THEN 'ADMIN'::"ClubRole"
    WHEN 'SOCIO' THEN 'MEMBER'::"ClubRole"
    ELSE NULL
  END
  FROM unnest("targetRoles") AS v
  WHERE v IN ('CLUB_ADMIN', 'SOCIO')
)
WHERE array_length("targetRoles", 1) > 0;
ALTER TABLE "PlatformBanner" DROP COLUMN "targetRoles";
ALTER TABLE "PlatformBanner" RENAME COLUMN "targetRolesNew" TO "targetRoles";

-- Add new index on ClubMembership by clubRole
CREATE INDEX IF NOT EXISTS "ClubMembership_clubId_clubRole_idx" ON "ClubMembership" ("clubId", "clubRole");

-- Drop UserRole enum (only after all columns using it are removed)
DROP TYPE IF EXISTS "UserRole";
