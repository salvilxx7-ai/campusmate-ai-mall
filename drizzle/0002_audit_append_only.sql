-- TiDB in the managed runtime does not support CREATE TRIGGER.
-- Audit immutability is enforced by the application policy: only insert paths
-- exist in server/db.ts and no audit update/delete tRPC procedure is exposed.
SELECT 1;
