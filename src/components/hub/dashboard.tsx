'use client'

import { useEffect, useState } from 'react'
import { BookOpen, KeyRound, LogOut, Radio, Server, Settings } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { readJson, responseError } from '@/lib/utils'
import { DiscordIcon } from './discord-icon'
import { ServersView } from './servers-view'
import { KeysView } from './keys-view'
import { DocsView } from './docs-view'
import { SettingsView } from './settings-view'
import type {
  ApiKeyItem,
  AppConfigInfo,
  AvailableGuild,
  DashboardGuildsResponse,
  SessionUser,
  SharedGuild,
} from './types'

export function Dashboard({
  user,
  config,
  onLogout,
  onConfigSaved,
}: {
  user: SessionUser
  config: AppConfigInfo | null
  onLogout: () => void
  onConfigSaved: () => void
}) {
  const [guildsData, setGuildsData] = useState<DashboardGuildsResponse | null>(null)
  const [keys, setKeys] = useState<ApiKeyItem[] | null>(null)
  const [guildsError, setGuildsError] = useState<string | null>(null)
  const [needsReauth, setNeedsReauth] = useState(false)

  const loadGuilds = async () => {
    try {
      const res = await fetch('/api/dashboard/guilds')
      const payload = await readJson<{
        error?: string
        needsReauth?: boolean
        guilds?: SharedGuild[]
        available?: AvailableGuild[]
      }>(res)
      if (res.status === 401 && payload.needsReauth) {
        setNeedsReauth(true)
        setGuildsError(payload.error ?? null)
        return
      }
      if (!res.ok) throw new Error(responseError(res, payload))
      setGuildsData({ guilds: payload.guilds || [], available: payload.available || [] })
      setGuildsError(null)
    } catch (e) {
      setGuildsError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
  }

  const loadKeys = async () => {
    try {
      const res = await fetch('/api/dashboard/keys')
      const payload = await readJson<{ error?: string; keys?: ApiKeyItem[] }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      setKeys(payload.keys || [])
    } catch {
      setKeys([])
    }
  }

  useEffect(() => {
    loadGuilds()
    loadKeys()
    // rafraichissement doux toutes les 60s pour voir les stats evoluer
    const t = setInterval(() => {
      loadGuilds()
      loadKeys()
    }, 60_000)
    return () => clearInterval(t)
  }, [])

  const displayName = user.globalName || user.username
  const sharedCount = guildsData?.guilds.length ?? 0
  // Les reglages de la plateforme (application Discord) sont reserves au staff.
  // Exception : plateforme pas encore configuree => tout le monde peut faire le reglage initial.
  const canManageSettings = user.isStaff || !config?.discordConfigured

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 mr-1">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <DiscordIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg hidden sm:block">LinkHub</span>
          </div>
          <Badge variant="outline" className="border-primary/30 text-muted-foreground gap-1.5 hidden md:flex">
            <Radio className="h-3 w-3 text-green-500" />
            Verification toutes les 5 min
          </Badge>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-tight">{displayName}</p>
              <p className="text-xs text-muted-foreground">@{user.username}</p>
            </div>
            <Avatar className="h-9 w-9 border border-border">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={`Avatar de ${displayName}`} />
              ) : (
                <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              )}
            </Avatar>
            <Button variant="ghost" size="sm" onClick={onLogout} className="gap-1.5">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Deconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {needsReauth ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-4">
            <p className="font-medium text-amber-400">Ta session Discord a expire</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {guildsError} — reconnecte-toi pour relancer le suivi des invitations.
            </p>
            <a href="/api/auth/discord" className="inline-block">
              <Button className="gap-2">
                <DiscordIcon className="h-4 w-4" />
                Se reconnecter avec Discord
              </Button>
            </a>
          </div>
        ) : (
          <Tabs defaultValue="servers" className="w-full">
            <TabsList className="mb-6 h-auto flex-wrap gap-1 bg-card/60 border border-border/60 p-1">
              <TabsTrigger value="servers" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Server className="h-4 w-4" />
                Serveurs
                {sharedCount > 0 && (
                  <span className="ml-1 text-xs opacity-70">({sharedCount})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="keys" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <KeyRound className="h-4 w-4" />
                Cles d&apos;API
                {(keys?.length ?? 0) > 0 && (
                  <span className="ml-1 text-xs opacity-70">({keys?.length})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="docs" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BookOpen className="h-4 w-4" />
                Documentation
              </TabsTrigger>
              {canManageSettings && (
                <TabsTrigger value="settings" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Settings className="h-4 w-4" />
                  Reglages
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="servers">
              {guildsError && !guildsData ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
                  {guildsError}
                </div>
              ) : guildsData ? (
                <ServersView data={guildsData} onChanged={loadGuilds} />
              ) : (
                <div className="space-y-4">
                  <div className="h-32 rounded-xl bg-card/60 animate-pulse" />
                  <div className="h-24 rounded-xl bg-card/60 animate-pulse" />
                </div>
              )}
            </TabsContent>

            <TabsContent value="keys">
              {keys ? <KeysView keys={keys} onChanged={loadKeys} /> : (
                <div className="h-48 rounded-xl bg-card/60 animate-pulse" />
              )}
            </TabsContent>

            <TabsContent value="docs">
              <DocsView
                baseUrl={config?.baseUrl ?? ''}
                keys={keys ?? []}
                guilds={guildsData?.guilds ?? []}
              />
            </TabsContent>

            {canManageSettings && (
              <TabsContent value="settings">
                <SettingsView config={config} onSaved={onConfigSaved} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </main>

      <footer className="mt-auto border-t border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <DiscordIcon className="h-3.5 w-3.5" />
            LinkHub — tes serveurs, partages proprement.
          </p>
          <p>
            {sharedCount} serveur{sharedCount > 1 ? 's' : ''} surveille{sharedCount > 1 ? 's' : ''} ·
            prochaine verification dans moins de 5 min
          </p>
        </div>
      </footer>
    </div>
  )
}
