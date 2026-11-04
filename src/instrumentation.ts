export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startRefresher } = await import('./lib/refresher')
    startRefresher()
  }
}
