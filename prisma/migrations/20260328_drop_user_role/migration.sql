-- Phase 3 migration: Drop User.role (replaced by User.platformRole)
-- Run AFTER 20260328_phase2_role_separation has been applied.

-- Drop the old role index
DROP INDEX IF EXISTS "User_role_idx";

-- Remove the legacy role column from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";

-- Add index on the new platformRole column (if not already present)
CREATE INDEX IF NOT EXISTS "User_platformRole_idx" ON "User" ("platformRole");
