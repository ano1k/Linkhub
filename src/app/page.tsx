'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Maximize2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Landing } from '@/components/hub/landing'
import { Dashboard } from '@/components/hub/dashboard'
import { SettingsView } from '@/components/hub/settings-view'
import { DiscordIcon } from '@/components/hub/discord-icon'
import { readJson } from '@/lib/utils'
import type { AppConfigInfo, SessionUser } from '@/components/hub/types'

type PublicView = 'landing' | 'setup'

export default function Home() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [config, setConfig] = useState<AppConfigInfo | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [inIframe, setInIframe] = useState(false)
  const [publicView, setPublicView] = useState<PublicView>('landing')

  const loadAll = useCallback(async () => {
    try {
      const [cfgRes, meRes] = await Promise.all([fetch('/api/config'), fetch('/api/me')])
      const cfg = await readJson<AppConfigInfo>(cfgRes)
      const me = await readJson<{ user: SessionUser | null }>(meRes)
      setConfig(cfg)
      setUser(me.user)
    } catch {
      // le serveur n'est peut-etre pas encore pret : nouvel essai a la prochaine action
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
    try {
      setInIframe(window.self !== window.top)
    } catch {
      setInIframe(true)
    }
    // Nettoie les erreurs d'auth passées en parametre d'URL
    const params = new URLSearchParams(window.location.search)
    const err = params.get('auth_error')
    if (err) {
      setAuthError(err)
      window.history.replaceState({}, '', '/')
    }
  }, [loadAll])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setAuthError(null)
    setPublicView('landing')
  }

  if (loading) {
    return (
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {inIframe && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1 min-w-48">
              Tu visualises le site dans un apercu integre. Pour une experience complete (et la
              connexion au vrai Discord), ouvre le site en plein ecran.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5"
              onClick={() => window.open(window.location.origin, '_blank')}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Ouvrir en plein ecran
            </Button>
          </div>
        </div>
      )}

      {/* Barre de navigation publique (landing / configuration) */}
      {!user && (
        <nav className="border-b border-border/60 bg-card/40 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <button
              className="flex items-center gap-2"
              onClick={() => setPublicView('landing')}
              aria-label="Retour a l'accueil"
            >
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
                <DiscordIcon className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">LinkHub</span>
            </button>
            <div className="flex items-center gap-2">
              {(!config?.discordConfigured || publicView === 'setup') && (
                <Button
                  variant="outline"
                  className={`gap-2 ${
                    !config?.discordConfigured
                      ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                      : ''
                  }`}
                  onClick={() => setPublicView(publicView === 'setup' ? 'landing' : 'setup')}
                >
                  <Settings className="h-4 w-4" />
                  {publicView === 'setup' ? 'Retour a l\'accueil' : 'Reglages'}
                  {!config?.discordConfigured && publicView === 'landing' && (
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </Button>
              )}
              {publicView === 'landing' && (
                <a href="/api/auth/discord">
                  <Button className="gap-2">
                    <DiscordIcon className="h-4 w-4" />
                    Connexion Discord
                  </Button>
                </a>
              )}
            </div>
          </div>
        </nav>
      )}

      {user ? (
        <Dashboard user={user} config={config} onLogout={handleLogout} onConfigSaved={loadAll} />
      ) : publicView === 'setup' && !config?.discordConfigured ? (
        // Une fois la plateforme configuree, les reglages sont reserves au staff
        // (onglet Reglages du tableau de bord) : la vue publique retourne a l'accueil.
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <Button
            variant="ghost"
            className="mb-4 gap-1.5 -ml-2"
            onClick={() => setPublicView('landing')}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour a l&apos;accueil
          </Button>
          <SettingsView config={config} onSaved={loadAll} />
        </main>
      ) : (
        <Landing
          config={config}
          authError={authError}
          onOpenSetup={() => setPublicView('setup')}
        />
      )}
    </div>
  )
}
