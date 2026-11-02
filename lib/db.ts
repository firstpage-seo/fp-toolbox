import { Pool } from "pg";

// ponytail: single connection pool, no ORM. Dev default = podman postgres:18-alpine.
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://fp:fp@localhost:5432/fp_toolbox",
});

// A pooled client that fails outside a query (DB down / server restart) emits
// an 'error' on the pool. With no listener, node-postgres re-throws it as an
// UNCAUGHT exception — which Next attributes to the in-flight RSC render and
// burns the whole page even though every query already degrades via the
// callers' try/catch. Listen and swallow; individual queries still reject and
// are handled where they're awaited.
pool.on("error", () => {
  /* ponytail: log-only; per-query rejections are handled by callers */
});
