export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    const { startGoogleSyncWorker } = await import('./lib/google-sync')
    startGoogleSyncWorker()
    const { scheduleDatabasePersistence } = await import('./lib/after-database-commit')
    await scheduleDatabasePersistence()
  }
}
