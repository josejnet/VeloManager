-- Phase 2: Role system separation
-- Adds PlatformRole enum (platform-level) and ClubRole enum (club-scoped) as parallel columns.
-- Existing 'role' columns are kept and will be dropped in Phase 4 after full migration.

-- Create enums
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'USER');
CREATE TYPE "ClubRole" AS ENUM ('ADMIN', 'MEMBER');

-- Add platformRole to User (derives from existing role column)
ALTER TABLE "User" ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';
UPDATE "User" SET "platformRole" = 'SUPER_ADMIN' WHERE role = 'SUPER_ADMIN';

-- Add clubRole to ClubMembership (derives from existing role column)
ALTER TABLE "ClubMembership" ADD COLUMN "clubRole" "ClubRole" NOT NULL DEFAULT 'MEMBER';
UPDATE "ClubMembership" SET "clubRole" = 'ADMIN' WHERE role = 'CLUB_ADMIN';
