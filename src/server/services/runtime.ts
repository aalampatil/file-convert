import { loadJobs } from "./jobStore.ts";
import { cleanupExpired } from "./jobs.ts";
type Runtime = {
  promise?: Promise<void>;
  timer?: ReturnType<typeof setInterval>;
};
const globals = globalThis as typeof globalThis & { folioRuntime?: Runtime };
const state = (globals.folioRuntime ??= {});
export function initialize() {
  return (state.promise ??= (async () => {
    await loadJobs();
    await cleanupExpired();
    state.timer = setInterval(() => {
      cleanupExpired().catch((err) =>
        console.error("File cleanup failed", err),
      );
    }, 60_000);
    state.timer.unref();
  })().catch((err) => {
    state.promise = undefined;
    throw err;
  }));
}
export function stopCleanup() {
  if (state.timer) clearInterval(state.timer);
}
