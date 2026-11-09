'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Landing } from '@/components/hub/landing'
import { SettingsView } from '@/components/hub/settings-view'
import { readJson } from '@/lib/utils'
import type { AppConfigInfo, SessionUser } from '@/components/hub/types'

type PublicView = 'landing' | 'setup'

export default function Home() {
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
      // le serveur n'est peut-être pas encore prêt : nouvel essai à la prochaine action
    }
  }, [])

  useEffect(() => {
    void loadAll()
    try {
      setInIframe(window.self !== window.top)
    } catch {
      setInIframe(true)
    }
    const params = new URLSearchParams(window.location.search)
    const err = params.get('auth_error')
    if (err) {
      setAuthError(err)
      window.history.replaceState({}, '', '/')
    }
  }, [loadAll])

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {inIframe && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1 min-w-48">
              Tu visualises le site dans un aperçu intégré. Pour une expérience complète, ouvre le
              site en plein écran.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5"
              onClick={() => window.open(window.location.origin, '_blank')}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Ouvrir en plein écran
            </Button>
          </div>
        </div>
      )}

      {publicView === 'setup' && !config?.discordConfigured ? (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <Button
            variant="ghost"
            className="mb-4 gap-1.5 -ml-2"
            onClick={() => setPublicView('landing')}
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l&apos;accueil
          </Button>
          <SettingsView config={config} onSaved={loadAll} />
        </main>
      ) : (
        <Landing
          config={config}
          user={user}
          authError={authError}
          onOpenSetup={() => setPublicView('setup')}
        />
      )}
    </div>
  )
}
