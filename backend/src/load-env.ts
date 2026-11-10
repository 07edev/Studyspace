// Loads backend/.env for local runs (Node >= 22). Real environment variables always win,
// and a missing file is fine (production injects variables directly).
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}
