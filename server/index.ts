// Process entry: restore state, start timers, listen. All routes live in app.ts.
import { app } from "./app";
import { store } from "./state";

const PORT = Number(process.env.PORT || 8080);

process.on("unhandledRejection", (e) => console.error("[culture] unhandled rejection (ignored):", (e as Error)?.message ?? e));
process.on("uncaughtException", (e) => console.error("[culture] uncaught exception (ignored):", e?.message ?? e));
await store.load();
setInterval(() => store.tick(), 300);
setInterval(() => store.heartbeat(), 15_000);
setInterval(() => void store.saveIfDirty(), 3_000);
const server = app.listen(PORT, () => console.log(`[culture] listening on :${PORT} (event ${store.e.eventId})`));
server.keepAliveTimeout = 65_000;
for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, async () => { await store.saveIfDirty(); process.exit(0); });
