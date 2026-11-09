'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Hash,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DiscordIcon } from './discord-icon'
import { guildIconUrl } from '@/lib/discord'
import { cn } from '@/lib/utils'

export type DirectoryGuild = {
  discordId: string
  name: string
  icon: string | null
  memberCount: number | null
  onlineCount: number | null
  lastCheckAt: string | null
  lastCheckStatus: string | null
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(n)
}

export function DirectoryView({ guilds, demo }: { guilds: DirectoryGuild[]; demo: boolean }) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'members' | 'online' | 'name'>('members')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? guilds.filter((g) => g.name.toLowerCase().includes(q)) : [...guilds]
    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr')
      if (sort === 'online') return (b.onlineCount ?? 0) - (a.onlineCount ?? 0)
      return (b.memberCount ?? 0) - (a.memberCount ?? 0)
    })
    return list
  }, [guilds, search, sort])

  const totalMembers = guilds.reduce((sum, g) => sum + (g.memberCount ?? 0), 0)
  const totalOnline = guilds.reduce((sum, g) => sum + (g.onlineCount ?? 0), 0)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-white/6 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <DiscordIcon className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg">LinkHub</span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden sm:flex border-emerald-400/25 text-emerald-300 gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Invitations vérifiées
            </Badge>
            <Link href="/">
              <Button size="sm" className="gap-2">
                <DiscordIcon className="h-4 w-4" /> Partager mon serveur
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-white/6">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute inset-0 bg-aurora opacity-70" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
            <Badge variant="outline" className="border-violet-400/30 bg-violet-500/10 text-violet-200 gap-1.5 mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Annuaire public
            </Badge>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
              Trouve ta prochaine <span className="text-gradient">communauté</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Tous les serveurs Discord partagés sur LinkHub. Chaque invitation est vérifiée et
              réparée automatiquement toutes les 5 minutes : le bouton Rejoindre fonctionne toujours.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2">
                <Server className="h-4 w-4 text-violet-300" />
                <span className="text-sm font-semibold tabular-nums">{guilds.length}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">serveurs</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2">
                <Users className="h-4 w-4 text-cyan-300" />
                <span className="text-sm font-semibold tabular-nums">{formatNumber(totalMembers)}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">membres</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3.5 py-2">
                <Wifi className="h-4 w-4 text-emerald-300" />
                <span className="text-sm font-semibold tabular-nums">{formatNumber(totalOnline)}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">en ligne</span>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {demo && (
            <div className="mb-5 rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 text-xs text-sky-200 flex items-center gap-2">
              <CircleAlert className="h-4 w-4 shrink-0" />
              Mode démo : les serveurs listés sont des serveurs de test fictifs.
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un serveur..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-white/[0.03] border-white/10"
              />
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-1">
              {[
                ['members', 'Membres'],
                ['online', 'En ligne'],
                ['name', 'A-Z'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSort(value as typeof sort)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-[11px] transition',
                    sort === value ? 'bg-violet-500/20 text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/12 bg-card/30 p-12 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center mb-3">
                <Server className="h-5 w-5 text-violet-300" />
              </div>
              <p className="text-sm font-medium">{search ? 'Aucun serveur ne correspond' : 'Aucun serveur partagé pour le moment'}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {search ? 'Essaie un autre nom.' : 'Sois le premier : connecte-toi, choisis un salon et partage ton serveur.'}
              </p>
              {!search && (
                <Link href="/" className="inline-block mt-4">
                  <Button size="sm" className="gap-2">
                    <DiscordIcon className="h-3.5 w-3.5" /> Partager mon serveur
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((g) => {
                const iconUrl = guildIconUrl(g.discordId, g.icon)
                return (
                  <div key={g.discordId} className="group rounded-2xl border border-white/8 bg-card/50 p-5 flex flex-col gap-4 card-hover">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 rounded-xl border border-white/10">
                        {iconUrl ? (
                          <AvatarImage src={iconUrl} alt={`Icône de ${g.name}`} />
                        ) : (
                          <AvatarFallback className="rounded-xl bg-violet-500/15 text-violet-200 font-semibold">
                            {g.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-semibold truncate">{g.name}</h2>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <DiscordIcon className="h-3 w-3" /> Serveur Discord
                        </p>
                      </div>
                      <Badge variant="outline" className="border-emerald-400/25 text-emerald-300 text-[9px] gap-1 shrink-0">
                        <BadgeCheck className="h-3 w-3" /> Vérifié
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5" title="Membres approximatifs">
                        <Users className="h-3.5 w-3.5" /> {formatNumber(g.memberCount)}
                        <span className="text-[10px]">membres</span>
                      </span>
                      <span className="flex items-center gap-1.5" title="En ligne approximatif">
                        <Wifi className="h-3.5 w-3.5 text-emerald-400/80" /> {formatNumber(g.onlineCount)}
                        <span className="text-[10px]">en ligne</span>
                      </span>
                    </div>

                    <div className="mt-auto flex items-center gap-2">
                      <a
                        href={`/api/join/${g.discordId}`}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 px-4 text-xs font-semibold text-white shadow-lg shadow-violet-500/20 hover:from-violet-400 hover:to-indigo-400 transition"
                      >
                        Rejoindre <ArrowRight className="h-3.5 w-3.5" />
                      </a>
                      <a
                        href={`/s/${g.discordId}`}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition"
                      >
                        <Hash className="h-3.5 w-3.5" /> Détails
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/6 bg-card/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-2">
            <DiscordIcon className="h-3.5 w-3.5" /> Propulsé par LinkHub — partage ton serveur avec une invitation qui ne meurt jamais.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground">Accueil</Link>
            <a href="/api/health" className="hover:text-foreground inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Statut</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
