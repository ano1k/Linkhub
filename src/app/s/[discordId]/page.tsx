import type { Metadata } from 'next'
import Link from 'next/link'
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  RefreshCw,
  Users,
  Wifi,
} from 'lucide-react'
import { db } from '@/lib/db'
import { isMockMode } from '@/lib/config'
import { guildIconUrl } from '@/lib/discord'
import { DiscordIcon } from '@/components/hub/discord-icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// Chaque appel recharge la page depuis la base : compteurs et etat d'invitation a jour.
export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ discordId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function loadGuild(discordId: string) {
  // Sans filtre sur l'invitation : un serveur partage mais dont l'invitation est
  // momentanement absente doit afficher l'etat « indisponible » (et non introuvable).
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
  const members = guild.memberCount ? `${guild.memberCount} membres` : 'Communaute Discord'
  return {
    title: `${guild.name} — Rejoins le serveur Discord`,
    description: `${members}. Invitation toujours valide : geree et regeneree automatiquement par LinkHub.`,
  }
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="LinkHub — accueil">
      <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
        <DiscordIcon className="h-5 w-5 text-primary-foreground" />
      </div>
      <span className="font-bold text-lg">LinkHub</span>
    </Link>
  )
}

const joinButtonClass =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90'

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
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Logo />
          <span className="text-xs text-muted-foreground border border-border rounded-full px-3 py-1">
            Page de partage
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {!guild ? (
          <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-8 text-center space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <CircleAlert className="h-7 w-7 text-amber-400" />
            </div>
            <h1 className="text-xl font-semibold">Serveur introuvable</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ce serveur n&apos;est pas (ou plus) partage sur LinkHub : le lien est peut-etre
              expire, ou le partage a ete retire par son proprietaire.
            </p>
            <a href="/" className={joinButtonClass}>
              <ExternalLink className="h-4 w-4" />
              Découvrir LinkHub
            </a>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-4">
            <div className="rounded-2xl border border-border bg-card/70 p-8 text-center space-y-5">
              <Avatar className="h-20 w-20 rounded-2xl border border-border mx-auto">
                {iconUrl ? (
                  <AvatarImage src={iconUrl} alt={`Icône de ${name}`} />
                ) : (
                  <AvatarFallback className="rounded-2xl bg-primary/20 text-primary font-bold text-xl">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>

              <div className="space-y-1">
                <h1 className="text-2xl font-bold truncate">{name}</h1>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                  <DiscordIcon className="h-3.5 w-3.5" /> Serveur Discord
                </p>
              </div>

              <div className="flex items-center justify-center gap-6 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="h-4 w-4" /> {members ?? '—'}
                  <span className="text-xs">membres</span>
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Wifi className="h-4 w-4 text-green-500/80" /> {online ?? '—'}
                  <span className="text-xs">en ligne</span>
                </span>
              </div>

              {justJoined ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400 flex items-start gap-2 text-left">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Mode demo : dans la version reelle, tu viendrais de rejoindre{' '}
                    <strong className="text-green-300">{name}</strong> sur Discord. Ici, tout est
                    simule pour que tu puisses essayer le parcours sans compte reel.
                  </span>
                </div>
              ) : inviteOk ? (
                <a href={demo ? `/s/${discordId}?rejoint=1` : `/api/join/${discordId}`} className={joinButtonClass}>
                  <DiscordIcon className="h-5 w-5" />
                  Rejoindre le serveur
                </a>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400 flex items-start gap-2 text-left">
                  <RefreshCw className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    L&apos;invitation est momentanement indisponible : elle est regeneree
                    automatiquement. Reessaie dans quelques instants, cette page se recharge toute
                    seule.
                  </span>
                </div>
              )}

              {inviteOk && errorState && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Un incident a ete detecte sur l&apos;invitation : elle sera reparee automatiquement
                  au prochain cycle de verification.
                </p>
              )}

              {inviteOk && !errorState && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Invitation verifiee et reparee automatiquement toutes les 5 minutes : ce lien
                  fonctionne toujours.
                </p>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Partage ton propre serveur Discord avec un lien comme celui-ci sur{' '}
              <a href="/" className="text-primary hover:underline">
                LinkHub
              </a>{' '}
              ·{' '}
              <a href="/serveurs" className="text-primary hover:underline">
                Voir tous les serveurs
              </a>
            </p>
          </div>
        )}
      </main>

      {/* Invitation indisponible : la page se recharge seule pour capter la nouvelle invitation */}
      {guild && !inviteOk && (
        <meta httpEquiv="refresh" content="60" />
      )}
      {unavailable && (
        <meta httpEquiv="refresh" content="60" />
      )}
    </div>
  )
}
