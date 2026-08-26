/**
 * Disabled PM2 placeholder — used only when a target app has no real entrypoint yet.
 * Exits immediately. Does not call APIs, generate resumes, or publish.
 * Agent #116
 */
console.log(
  JSON.stringify({
    status: "DISABLED",
    reason: "Entrypoint missing or not approved for PM2 start",
    agent: "116",
    live: false,
    at: new Date().toISOString(),
  }),
);
process.exit(0);
