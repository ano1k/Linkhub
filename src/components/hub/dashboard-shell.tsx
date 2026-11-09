'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FlaskConical,
  Gauge,
  Globe2,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ShieldOff,
  Menu,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
  Wifi,
  X,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { readJson, responseError, cn } from '@/lib/utils'
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

type Tab = 'overview' | 'servers' | 'keys' | 'docs' | 'settings'

type HealthInfo = {
  status: string
  database: string
  version?: string
  latencyMs?: number
  refresher?: {
    lastTickAt: string | null
    lastTickDurationMs: number | null
    lastTickStatus: string
    processed: number
    refreshed: number
    errors: number
    totalChecks: number
  }
  webhook?: {
    enabled: boolean
    configured: boolean
    status: string
    lastSentAt: string | null
    lastLatencyMs: number | null
    successCount: number
    failureCount: number
  } | null
}

const NAV: Array<{ id: Tab; label: string; icon: typeof Server; description: string; href: string }> = [
  { id: 'overview', label: "Vue d'ensemble", icon: LayoutDashboard, description: 'Statut et activité', href: '/dashboard' },
  { id: 'servers', label: 'Serveurs', icon: Server, description: 'Invitations partagées', href: '/dashboard/serveurs' },
  { id: 'keys', label: "Clés d'API", icon: KeyRound, description: 'Intégrations', href: '/dashboard/cles' },
  { id: 'docs', label: 'Documentation', icon: BookOpen, description: 'API v1', href: '/dashboard/docs' },
  { id: 'settings', label: 'Réglages', icon: Settings, description: 'Plateforme', href: '/dashboard/reglages' },
]

function timeAgo(iso: string | null): string {
  if (!iso) return 'jamais'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "à l'instant"
  if (min === 1) return 'il y a 1 min'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h === 1) return 'il y a 1 h'
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(n)
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'ok' || status === 'refreshed'
      ? 'bg-emerald-400'
      : status === 'error'
        ? 'bg-rose-400'
        : 'bg-white/25'
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      {(status === 'ok' || status === 'refreshed') && (
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 ping-ring', color)} />
      )}
      <span className={cn('relative inline-flex rounded-full h-2 w-2', color)} />
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'violet',
}: {
  icon: typeof Users
  label: string
  value: string
  hint?: string
  tone?: 'violet' | 'cyan' | 'emerald' | 'amber'
}) {
  const tones = {
    violet: 'bg-violet-500/15 text-violet-300 border-violet-400/20',
    cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/20',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
  }
  return (
    <Card className="bg-card/60 border-white/8 card-hover">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={cn('h-9 w-9 rounded-lg border flex items-center justify-center', tones[tone])}>
            <Icon className="h-4 w-4" />
          </div>
          {hint && <span className="text-[10px] text-muted-foreground text-right">{hint}</span>}
        </div>
        <p className="mt-3 text-2xl font-bold tabular-nums leading-none">{value}</p>
        <p className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

export function DashboardShell({ user }: { user: SessionUser }) {
  const pathname = usePathname()
  const router = useRouter()
  const activeTab: Tab =
    pathname === '/dashboard' ? 'overview'
      : pathname.startsWith('/dashboard/serveurs') ? 'servers'
        : pathname.startsWith('/dashboard/cles') ? 'keys'
          : pathname.startsWith('/dashboard/docs') ? 'docs'
            : pathname.startsWith('/dashboard/reglages') ? 'settings'
              : 'overview'
  const [config, setConfig] = useState<AppConfigInfo | null>(null)
  const [guildsData, setGuildsData] = useState<DashboardGuildsResponse | null>(null)
  const [keys, setKeys] = useState<ApiKeyItem[] | null>(null)
  const [guildsError, setGuildsError] = useState<string | null>(null)
  const [needsReauth, setNeedsReauth] = useState(false)
  const [health, setHealth] = useState<HealthInfo | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadGuilds = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/guilds')
      const payload = await readJson<{
        error?: string
        needsReauth?: boolean
        guilds?: SharedGuild[]
        available?: AvailableGuild[]
        missingBot?: DashboardGuildsResponse['missingBot']
        botConfigured?: boolean
        botError?: string | null
      }>(res)
      if (res.status === 401 && payload.needsReauth) {
        setNeedsReauth(true)
        setGuildsError(payload.error ?? null)
        return
      }
      if (!res.ok) throw new Error(responseError(res, payload))
      setGuildsData({
        guilds: payload.guilds || [],
        available: payload.available || [],
        missingBot: payload.missingBot || [],
        botConfigured: payload.botConfigured ?? false,
        botError: payload.botError ?? null,
      })
      setGuildsError(null)
    } catch (e) {
      setGuildsError(e instanceof Error ? e.message : 'Erreur inconnue')
    }
  }, [])

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/keys')
      const payload = await readJson<{ error?: string; keys?: ApiKeyItem[] }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      setKeys(payload.keys || [])
    } catch {
      setKeys([])
    }
  }, [])

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health')
      const payload = (await res.json()) as HealthInfo
      setHealth(payload)
    } catch {
      // on garde la dernière valeur connue
    }
  }, [])

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config')
      const payload = (await res.json()) as AppConfigInfo
      setConfig(payload)
    } catch {
      // on garde la dernière configuration connue
    }
  }, [])

  useEffect(() => {
    void loadConfig()
    void loadGuilds()
    void loadKeys()
    void loadHealth()
    // Rafraichissement automatique, en pause quand l'onglet est en arriere-plan :
    // evite de solliciter l'API (et Discord) pour un dashboard que personne ne regarde.
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void loadGuilds()
      void loadKeys()
      void loadHealth()
    }, 60_000)
    return () => clearInterval(t)
  }, [loadConfig, loadGuilds, loadKeys, loadHealth])

  const refreshAll = async () => {
    setRefreshing(true)
    await Promise.all([loadConfig(), loadGuilds(), loadKeys(), loadHealth()])
    setTimeout(() => setRefreshing(false), 500)
  }

  const onConfigSaved = () => {
    void loadConfig()
  }

  const onLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  // Revoque toutes les sessions (autres navigateurs / appareils) : incremente
  // User.sessionVersion, ce qui invalide les cookies existants.
  const onLogoutEverywhere = async () => {
    if (!window.confirm('Déconnecter toutes tes sessions, y compris sur les autres appareils ?')) return
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    router.push('/')
    router.refresh()
  }

  const displayName = user.globalName || user.username
  const sharedCount = guildsData?.guilds.length ?? 0
  const availableCount = guildsData?.available.length ?? 0
  const missingCount = guildsData?.missingBot.length ?? 0
  const canManageSettings = user.isStaff || !config?.discordConfigured
  const totalMembers = (guildsData?.guilds ?? []).reduce((sum, g) => sum + (g.memberCount ?? 0), 0)
  const totalOnline = (guildsData?.guilds ?? []).reduce((sum, g) => sum + (g.onlineCount ?? 0), 0)
  const errorCount = (guildsData?.guilds ?? []).filter((g) => g.lastCheckStatus === 'error').length
  const webhookEnabled = Boolean(config?.webhook?.enabled)
  const webhookStatus = config?.webhook?.status ?? 'never'
  const lastCheck = useMemo(() => {
    const dates = (guildsData?.guilds ?? [])
      .map((g) => g.lastCheckAt)
      .filter((d): d is string => Boolean(d))
      .sort()
    return dates[dates.length - 1] ?? null
  }, [guildsData])

  const pageTitle = NAV.find((n) => n.id === activeTab)?.label ?? "Vue d'ensemble"

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-white/6">
        <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/25">
          <DiscordIcon className="h-5 w-5 text-white" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight">LinkHub</p>
          <p className="text-[10px] text-muted-foreground truncate">Espace de partage</p>
        </div>
        <Badge variant="outline" className="ml-auto border-white/10 text-[9px] text-muted-foreground px-1.5 py-0.5">
          v{config?.version ?? '2.0'}
        </Badge>
      </div>

      <nav className="flex-1 overflow-y-auto scroll-slim p-3 space-y-1">
        <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Pilotage
        </p>
        {NAV.map((item) => {
          const active = activeTab === item.id
          const count =
            item.id === 'servers' ? sharedCount : item.id === 'keys' ? (keys?.length ?? 0) : null
          const disabled = item.id === 'settings' && !canManageSettings
          return (
            <Link
              key={item.id}
              href={disabled ? '/dashboard' : item.href}
              onClick={(e) => {
                if (disabled) e.preventDefault()
                setMobileNav(false)
              }}
              aria-disabled={disabled}
              className={cn(
                'group w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition',
                active
                  ? 'bg-gradient-to-r from-violet-500/20 to-indigo-500/10 text-foreground border border-violet-400/20'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent',
                disabled && 'opacity-40 cursor-not-allowed',
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-violet-300' : 'text-muted-foreground group-hover:text-foreground')} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium leading-tight">{item.label}</span>
                <span className="block text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{item.description}</span>
              </span>
              {count !== null && count > 0 && (
                <span className="text-[10px] font-semibold rounded-full bg-white/8 px-1.5 py-0.5 tabular-nums">{count}</span>
              )}
              {item.id === 'servers' && missingCount > 0 && (
                <span className="text-[10px] font-semibold rounded-full bg-amber-500/20 text-amber-300 px-1.5 py-0.5 tabular-nums" title="Serveurs sans le bot">
                  {missingCount}
                </span>
              )}
              {active && <ChevronRight className="h-3.5 w-3.5 text-violet-300" />}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 space-y-2">
        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
          <div className="flex items-center gap-2">
            <StatusDot status={health?.status === 'ok' ? 'ok' : 'error'} />
            <p className="text-[11px] font-medium">Site {health?.status === 'ok' ? 'opérationnel' : 'indisponible'}</p>
            <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
              {health?.latencyMs ? `${health.latencyMs} ms` : '—'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Webhook className="h-3 w-3" />
            <span className="truncate">Heartbeat {webhookEnabled ? `· ${config?.webhook?.intervalMinutes ?? 5} min` : 'désactivé'}</span>
            <span className={cn('ml-auto h-1.5 w-1.5 rounded-full', webhookStatus === 'ok' ? 'bg-emerald-400' : webhookStatus === 'error' ? 'bg-rose-400' : 'bg-white/20')} />
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span className="truncate">Invitations · {timeAgo(lastCheck)}</span>
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.025] p-2.5">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 border border-white/10">
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={`Avatar de ${displayName}`} />
              ) : (
                <AvatarFallback className="bg-violet-500/20 text-violet-200 text-xs">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{displayName}</p>
              <p className="text-[10px] text-muted-foreground truncate">@{user.username}</p>
            </div>
            <button
              onClick={onLogoutEverywhere}
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-amber-300 hover:bg-amber-500/10 transition"
              aria-label="Déconnecter toutes mes sessions"
              title="Déconnecter toutes mes sessions"
            >
              <ShieldOff className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onLogout}
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-300 hover:bg-rose-500/10 transition"
              aria-label="Déconnexion"
              title="Déconnexion"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/6 bg-sidebar/60 backdrop-blur-xl sticky top-0 h-screen">
        {sidebar}
      </aside>

      {/* Sidebar mobile */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-white/10 bg-sidebar shadow-2xl">
            <button
              onClick={() => setMobileNav(false)}
              className="absolute right-3 top-4 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/8"
              aria-label="Fermer le menu"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/6 bg-background/80 backdrop-blur-xl">
          <div className="h-16 px-4 sm:px-6 flex items-center gap-3">
            <button
              onClick={() => setMobileNav(true)}
              className="lg:hidden h-9 w-9 rounded-lg border border-white/10 flex items-center justify-center"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold leading-tight truncate">{pageTitle}</h1>
              <p className="text-[11px] text-muted-foreground truncate">
                {sharedCount} serveur{sharedCount > 1 ? 's' : ''} suivi{sharedCount > 1 ? 's' : ''} · {formatNumber(totalMembers)} membres
                {missingCount > 0 ? ` · ${missingCount} sans bot` : ''}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {config?.mockMode && (
                <Badge variant="outline" className="border-sky-500/40 text-sky-300 gap-1.5 hidden sm:flex" title="Discord simulé">
                  <FlaskConical className="h-3 w-3" /> Démo
                </Badge>
              )}
              <Badge variant="outline" className="border-emerald-400/25 text-emerald-300 gap-1.5 hidden md:flex">
                <Radio className="h-3 w-3" /> Vérif. 5 min
              </Badge>
              <a href="/serveurs" target="_blank" rel="noreferrer" className="hidden sm:block">
                <Button variant="outline" size="sm" className="gap-1.5 border-white/10 bg-white/[0.03]">
                  <Globe2 className="h-3.5 w-3.5" /> Annuaire
                </Button>
              </a>
              <Button variant="outline" size="sm" onClick={refreshAll} className="gap-1.5 border-white/10 bg-white/[0.03]" disabled={refreshing}>
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                <span className="hidden sm:inline">Actualiser</span>
              </Button>
              <a href="/api/auth/discord" className="sm:hidden">
                <Button size="sm" className="gap-1.5">
                  <DiscordIcon className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {config?.mockMode && (
            <div className="mb-5 rounded-xl border border-sky-500/25 bg-sky-500/10 p-3.5 text-xs text-sky-200 flex items-start gap-2.5">
              <FlaskConical className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong className="text-sky-100">Mode démo</strong> — Discord simulé. Toutes les connexions ouvrent le même compte de test et les serveurs affichés sont fictifs. Supprime <code className="font-mono bg-black/30 px-1 rounded">DISCORD_API_BASE</code> pour connecter le vrai Discord.
              </p>
            </div>
          )}

          {needsReauth ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center space-y-4 max-w-lg mx-auto">
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <CircleAlert className="h-6 w-6 text-amber-300" />
              </div>
              <div>
                <p className="font-semibold text-amber-200">Ta session Discord a expiré</p>
                <p className="text-sm text-muted-foreground mt-1">{guildsError ?? 'Reconnecte-toi pour relancer le suivi des invitations.'}</p>
              </div>
              <a href="/api/auth/discord">
                <Button className="gap-2">
                  <DiscordIcon className="h-4 w-4" /> Se reconnecter
                </Button>
              </a>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Server} label="Serveurs suivis" value={String(sharedCount)} hint={`${availableCount} à partager${missingCount ? ` · ${missingCount} sans bot` : ''}`} />
                <StatCard icon={Users} label="Membres cumulés" value={formatNumber(totalMembers)} tone="cyan" />
                <StatCard icon={Wifi} label="En ligne" value={formatNumber(totalOnline)} tone="emerald" />
                <StatCard icon={CircleAlert} label="Erreurs" value={String(errorCount)} hint={errorCount ? 'À vérifier' : 'Aucune'} tone={errorCount ? 'amber' : 'emerald'} />
              </div>

              <div className="grid lg:grid-cols-[1.4fr_0.6fr] gap-4">
                {/* Recent servers */}
                <Card className="bg-card/60 border-white/8">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/6">
                      <div>
                        <h2 className="text-sm font-semibold flex items-center gap-2">
                          <Server className="h-4 w-4 text-violet-300" /> Serveurs partagés
                        </h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Invitations vérifiées et réparées automatiquement.</p>
                      </div>
                      <Link href="/dashboard/serveurs">
                        <Button size="sm" variant="ghost" className="gap-1 text-xs">
                          Tout voir <ArrowUpRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                    {guildsData && guildsData.guilds.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {guildsData.guilds.slice(0, 5).map((g) => (
                          <div key={g.discordId} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition">
                            <Avatar className="h-9 w-9 rounded-lg border border-white/10">
                              {g.iconUrl ? (
                                <AvatarImage src={g.iconUrl} alt={`Icône de ${g.name}`} />
                              ) : (
                                <AvatarFallback className="rounded-lg bg-violet-500/15 text-violet-200 text-xs font-semibold">
                                  {g.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{g.name}</p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-2.5">
                                <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{formatNumber(g.memberCount)}</span>
                                <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3 text-emerald-400" />{formatNumber(g.onlineCount)}</span>
                                <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3" />{timeAgo(g.lastCheckAt)}</span>
                              </p>
                            </div>
                            <Badge variant="outline" className={cn('text-[10px] gap-1', g.lastCheckStatus === 'error' ? 'border-rose-400/30 text-rose-300' : g.lastCheckStatus === 'refreshed' ? 'border-amber-400/30 text-amber-300' : 'border-emerald-400/30 text-emerald-300')}>
                              <StatusDot status={g.lastCheckStatus ?? 'never'} />
                              {g.lastCheckStatus === 'error' ? 'Erreur' : g.lastCheckStatus === 'refreshed' ? 'Réparée' : 'Valide'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <div className="mx-auto h-11 w-11 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center mb-3">
                          <Server className="h-5 w-5 text-violet-300" />
                        </div>
                        <p className="text-sm font-medium">Aucun serveur partagé</p>
                        <p className="text-xs text-muted-foreground mt-1">Choisis un serveur ci-dessous pour commencer.</p>
                        <Link href="/dashboard/serveurs">
                          <Button size="sm" className="mt-3 gap-1.5">
                            <Plus className="h-3.5 w-3.5" /> Partager un serveur
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* System status */}
                <div className="space-y-4">
                  <Card className="bg-card/60 border-white/8">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-4 w-4 text-emerald-300" />
                        <h2 className="text-sm font-semibold">État du système</h2>
                        <Badge variant="outline" className="ml-auto border-emerald-400/25 text-emerald-300 text-[10px] gap-1">
                          <StatusDot status={health?.status === 'ok' ? 'ok' : 'error'} />
                          {health?.status === 'ok' ? 'Opérationnel' : 'Injoignable'}
                        </Badge>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Base de données</span>
                          <span className={cn('font-medium', health?.database === 'ok' ? 'text-emerald-300' : 'text-rose-300')}>{health?.database === 'ok' ? 'Connectée' : 'Erreur'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Latence API</span>
                          <span className="font-medium tabular-nums">{health?.latencyMs ? `${health.latencyMs} ms` : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Dernière vérif.</span>
                          <span className="font-medium">{timeAgo(health?.refresher?.lastTickAt ?? lastCheck)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Invitations réparées</span>
                          <span className="font-medium tabular-nums">{health?.refresher?.refreshed ?? 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Erreurs vérif.</span>
                          <span className={cn('font-medium tabular-nums', (health?.refresher?.errors ?? 0) > 0 ? 'text-amber-300' : 'text-emerald-300')}>{health?.refresher?.errors ?? 0}</span>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className={cn('h-full rounded-full', health?.status === 'ok' ? 'bg-gradient-to-r from-emerald-400 to-cyan-400' : 'bg-rose-400')} style={{ width: health?.status === 'ok' ? '100%' : '35%' }} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={cn('border-white/8', webhookEnabled ? 'bg-emerald-500/[0.06]' : 'bg-card/60')}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <HeartPulse className={cn('h-4 w-4', webhookEnabled ? 'text-emerald-300' : 'text-muted-foreground')} />
                        <h2 className="text-sm font-semibold">Heartbeat Discord</h2>
                        <span className={cn('ml-auto h-1.5 w-1.5 rounded-full', webhookStatus === 'ok' ? 'bg-emerald-400' : webhookStatus === 'error' ? 'bg-rose-400' : 'bg-white/20')} />
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {webhookEnabled
                          ? `Le site se ping et notifie Discord toutes les ${config?.webhook?.intervalMinutes ?? 5} min.`
                          : "Configure un webhook Discord pour recevoir le statut du site toutes les 5 minutes."}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Dernier envoi</span>
                        <span className="font-medium">{timeAgo(config?.webhook?.lastSentAt ?? null)}</span>
                      </div>
                      {canManageSettings ? (
                        <Link href="/dashboard/reglages">
                          <Button size="sm" variant="outline" className="mt-3 w-full gap-1.5 border-white/10 bg-white/[0.03] text-xs">
                            <Settings className="h-3.5 w-3.5" /> Configurer
                          </Button>
                        </Link>
                      ) : (
                        <p className="mt-3 text-[10px] text-muted-foreground">Réservé au staff.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { icon: Server, title: 'Partager un serveur', text: 'Choisis un salon et obtiens un lien permanent.', href: '/dashboard/serveurs' },
                  { icon: KeyRound, title: "Créer une clé d'API", text: 'Connecte un site en une ligne de code.', href: '/dashboard/cles' },
                  { icon: BookOpen, title: 'Lire la documentation', text: 'Endpoints, exemples et codes d’erreur.', href: '/dashboard/docs' },
                ].map((a) => (
                  <Link key={a.title} href={a.href} className="text-left rounded-xl border border-white/8 bg-card/50 p-4 card-hover group">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-violet-500/12 border border-violet-400/20 flex items-center justify-center">
                        <a.icon className="h-4 w-4 text-violet-300" />
                      </div>
                      <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground transition" />
                    </div>
                    <p className="mt-3 text-sm font-medium">{a.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{a.text}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : activeTab === 'servers' ? (
            guildsError && !guildsData ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-300">{guildsError}</div>
            ) : guildsData ? (
              <ServersView data={guildsData} onChanged={loadGuilds} />
            ) : (
              <div className="space-y-4">
                <div className="h-32 rounded-xl bg-card/60 animate-pulse" />
                <div className="h-24 rounded-xl bg-card/60 animate-pulse" />
              </div>
            )
          ) : activeTab === 'keys' ? (
            keys ? (
              <KeysView keys={keys} onChanged={loadKeys} />
            ) : (
              <div className="h-48 rounded-xl bg-card/60 animate-pulse" />
            )
          ) : activeTab === 'docs' ? (
            <DocsView baseUrl={config?.baseUrl ?? ''} keys={keys ?? []} guilds={guildsData?.guilds ?? []} />
          ) : activeTab === 'settings' && canManageSettings ? (
            <SettingsView config={config} onSaved={onConfigSaved} />
          ) : null}
        </main>

        <footer className="border-t border-white/6 bg-card/20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-2">
              <DiscordIcon className="h-3.5 w-3.5" />
              LinkHub — tes serveurs, partagés proprement.
            </p>
            <div className="flex items-center gap-4">
              <a href="/api/health" className="hover:text-foreground inline-flex items-center gap-1">
                <Gauge className="h-3 w-3" /> Statut
              </a>
              <a href="/serveurs" className="hover:text-foreground inline-flex items-center gap-1">
                <Globe2 className="h-3 w-3" /> Annuaire
              </a>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-400" /> v{config?.version ?? '2.0'}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
