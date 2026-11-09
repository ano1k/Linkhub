import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clock,
  ExternalLink,
  Hash,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wifi,
} from 'lucide-react'
import { db } from '@/lib/db'
import { isMockMode } from '@/lib/config'
import { guildIconUrl } from '@/lib/discord'
import { DiscordIcon } from '@/components/hub/discord-icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// Chaque appel recharge la page depuis la base : compteurs et état d'invitation à jour.
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ discordId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function loadGuild(discordId: string) {
  return db.guild
    .findFirst({
      where: { discordId },
      include: { invite: true },
      orderBy: { lastCheckAt: 'desc' },
    })
    .catch(() => null)
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { discordId } = await params
  const guild = await loadGuild(discordId)
  if (!guild) return { title: 'Serveur introuvable — LinkHub' }
  const members = guild.memberCount ? `${guild.memberCount} membres` : 'Communauté Discord'
  return {
    title: `${guild.name} — Rejoins le serveur Discord`,
    description: `${members}. Invitation toujours valide : gérée et régénérée automatiquement par LinkHub.`,
    openGraph: {
      title: `${guild.name} — Rejoins le serveur Discord`,
      description: `${members}. Invitation vérifiée et réparée automatiquement toutes les 5 minutes.`,
      type: 'website',
    },
  }
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(n)
}

function timeAgo(iso: Date | null): string {
  if (!iso) return 'jamais'
  const diff = Date.now() - iso.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "à l'instant"
  if (min === 1) return 'il y a 1 min'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h === 1) return 'il y a 1 h'
  if (h < 24) return `il y a ${h} h`
  return `il y a ${Math.floor(h / 24)} j`
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/6 bg-background/80 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="LinkHub — accueil">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <DiscordIcon className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-lg">LinkHub</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:flex border-emerald-400/25 text-emerald-300 gap-1.5">
            <ShieldCheck className="h-3 w-3" /> Invitation vérifiée
          </Badge>
          <Link href="/serveurs">
            <Button size="sm" variant="outline" className="gap-1.5 border-white/10 bg-white/[0.03]">
              Annuaire
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}

export default async function PublicGuildPage({ params, searchParams }: Props) {
  const { discordId } = await params
  const query = await searchParams
  const guild = await loadGuild(discordId)
  const demo = isMockMode()
  const justJoined = demo && query.rejoint === '1'
  const unavailable = query.indisponible === '1'

  const name = guild?.name ?? 'Serveur introuvable'
  const iconUrl = guild ? guildIconUrl(guild.discordId, guild.icon) : null
  const members = guild?.memberCount ?? null
  const online = guild?.onlineCount ?? null
  const inviteOk = !!guild?.invite
  const errorState = guild?.lastCheckStatus === 'error'

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0 bg-aurora opacity-60" />
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-72 w-[600px] rounded-full bg-violet-600/20 blur-[100px]" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {!guild ? (
            <div className="max-w-md mx-auto rounded-2xl border border-white/10 bg-card/70 backdrop-blur p-8 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mb-4">
                <CircleAlert className="h-7 w-7 text-amber-300" />
              </div>
              <h1 className="text-xl font-semibold">Serveur introuvable</h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Ce serveur n’est pas (ou plus) partagé sur LinkHub : le lien est peut-être expiré,
                ou le partage a été retiré par son propriétaire.
              </p>
              <Link href="/" className="inline-block mt-5">
                <Button className="gap-2">
                  <Sparkles className="h-4 w-4" /> Découvrir LinkHub
                </Button>
              </Link>
            </div>
          ) : (
            <div className="max-w-xl mx-auto">
              {justJoined && (
                <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Connexion de démonstration réussie : tu peux maintenant partager tes serveurs.
                </div>
              )}

              <div className="rounded-3xl border border-white/10 bg-card/70 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/40">
                <div className="flex flex-col items-center text-center">
                  <div className="relative">
                    <div className="absolute -inset-3 rounded-3xl bg-violet-500/20 blur-2xl" />
                    <Avatar className="relative h-20 w-20 rounded-2xl border border-white/15 shadow-xl">
                      {iconUrl ? (
                        <AvatarImage src={iconUrl} alt={`Icône de ${name}`} />
                      ) : (
                        <AvatarFallback className="rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 text-violet-100 font-bold text-xl">
                          {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-400 border-[3px] border-card flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-emerald-950" />
                    </span>
                  </div>

                  <h1 className="mt-5 text-2xl sm:text-3xl font-bold truncate max-w-full">{name}</h1>
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                    <DiscordIcon className="h-3.5 w-3.5" /> Serveur Discord · page de partage officielle
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-2 w-full">
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <Users className="h-4 w-4 text-violet-300 mx-auto" />
                      <p className="mt-1.5 text-lg font-semibold tabular-nums leading-none">{formatNumber(members)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">membres</p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                      <Wifi className="h-4 w-4 text-emerald-300 mx-auto" />
                      <p className="mt-1.5 text-lg font-semibold tabular-nums leading-none">{formatNumber(online)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">en ligne</p>
                    </div>
                  </div>

                  <div className="mt-5 w-full">
                    {inviteOk ? (
                      <a
                        href={demo ? `/s/${discordId}?rejoint=1` : `/api/join/${discordId}`}
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 text-sm font-semibold text-white shadow-xl shadow-violet-500/25 hover:from-violet-400 hover:to-indigo-400 transition"
                      >
                        <DiscordIcon className="h-5 w-5" />
                        Rejoindre le serveur
                        <ArrowRight className="h-4 w-4" />
                      </a>
                    ) : (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300 flex items-start gap-2 text-left">
                        <RefreshCw className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          L’invitation est momentanément indisponible : elle est régénérée
                          automatiquement. Réessaie dans quelques instants, cette page se recharge seule.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <Badge variant="outline" className="border-emerald-400/25 text-emerald-300 gap-1.5">
                      <BadgeCheck className="h-3 w-3" /> Vérifiée {timeAgo(guild.lastCheckAt)}
                    </Badge>
                    {guild.channelName && (
                      <Badge variant="outline" className="border-white/10 text-muted-foreground gap-1.5">
                        <Hash className="h-3 w-3" /> {guild.channelName}
                      </Badge>
                    )}
                    {guild.failureCount > 0 && (
                      <Badge variant="outline" className="border-amber-400/25 text-amber-300 gap-1.5">
                        <CircleAlert className="h-3 w-3" /> {guild.failureCount} incident{guild.failureCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  {inviteOk && errorState && (
                    <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
                      Un incident a été détecté sur l’invitation : elle sera réparée automatiquement au prochain cycle.
                    </p>
                  )}
                  {inviteOk && !errorState && (
                    <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
                      Invitation vérifiée et réparée automatiquement toutes les 5 minutes : ce lien fonctionne toujours.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { icon: RefreshCw, title: 'Auto-réparée', text: 'Toutes les 5 min' },
                  { icon: ShieldCheck, title: 'Sécurisée', text: 'API par clé' },
                  { icon: Clock, title: 'Toujours actif', text: 'Zéro intervention' },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-white/8 bg-card/40 p-3 text-center">
                    <item.icon className="h-4 w-4 text-violet-300 mx-auto" />
                    <p className="mt-1.5 text-[11px] font-medium">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Partage ton propre serveur Discord avec un lien comme celui-ci sur{' '}
                  <Link href="/" className="text-violet-300 hover:underline">LinkHub</Link>
                </p>
                <Link href="/" className="inline-block mt-3">
                  <Button variant="outline" size="sm" className="gap-1.5 border-white/10 bg-white/[0.03]">
                    <DiscordIcon className="h-3.5 w-3.5" /> Créer mon lien
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/6 bg-card/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-2">
            <DiscordIcon className="h-3.5 w-3.5" /> Propulsé par LinkHub — tes serveurs, partagés proprement.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/serveurs" className="hover:text-foreground">Annuaire</Link>
            <a href="/api/health" className="hover:text-foreground">Statut</a>
          </div>
        </div>
      </footer>

      {guild && !inviteOk && <meta httpEquiv="refresh" content="60" />}
      {unavailable && <meta httpEquiv="refresh" content="60" />}
    </div>
  )
}
