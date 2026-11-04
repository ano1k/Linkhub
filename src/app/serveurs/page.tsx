import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleAlert, Hash, Users, Wifi } from 'lucide-react'
import { db } from '@/lib/db'
import { isMockMode } from '@/lib/config'
import { guildIconUrl } from '@/lib/discord'
import { DiscordIcon } from '@/components/hub/discord-icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

// Chaque appel recharge la liste depuis la base : compteurs toujours a jour.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Annuaire des serveurs — LinkHub',
  description:
    'Tous les serveurs Discord partages sur la plateforme, avec une invitation verifiee et reparee automatiquement toutes les 5 minutes.',
}

type DirectoryGuild = {
  discordId: string
  name: string
  icon: string | null
  memberCount: number | null
  onlineCount: number | null
}

async function loadDirectory(): Promise<DirectoryGuild[]> {
  const rows = await db.guild
    .findMany({
      where: { invite: { isNot: null } },
      orderBy: [{ memberCount: 'desc' }, { name: 'asc' }],
    })
    .catch(() => [])
  // Un meme serveur peut etre partage par plusieurs utilisateurs : une seule carte par serveur.
  const seen = new Set<string>()
  const out: DirectoryGuild[] = []
  for (const row of rows) {
    if (seen.has(row.discordId)) continue
    seen.add(row.discordId)
    out.push({
      discordId: row.discordId,
      name: row.name,
      icon: row.icon,
      memberCount: row.memberCount,
      onlineCount: row.onlineCount,
    })
  }
  return out
}

const joinButtonClass =
  'inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90'
const detailsButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm text-muted-foreground transition hover:bg-card hover:text-foreground'

export default async function DirectoryPage() {
  const guilds = await loadDirectory()
  const demo = isMockMode()

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="LinkHub — accueil">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <DiscordIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">LinkHub</span>
          </Link>
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition">
            Partager mon serveur
          </a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="text-center space-y-3 mb-10">
          <h1 className="text-3xl font-bold">Annuaire des serveurs</h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Tous les serveurs Discord partages sur la plateforme par ses utilisateurs. Chaque
            invitation est verifiee et reparee automatiquement toutes les 5 minutes : le bouton
            Rejoindre fonctionne toujours.
          </p>
          {guilds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {guilds.length} serveur{guilds.length > 1 ? 's' : ''} disponible
              {guilds.length > 1 ? 's' : ''}
            </p>
          )}
        </div>

        {demo && (
          <div className="mb-6 max-w-xl mx-auto rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-300 flex items-center gap-2">
            <CircleAlert className="h-4 w-4 shrink-0" />
            Mode demo : les serveurs listes ci-dessous sont des serveurs de test fictifs.
          </div>
        )}

        {guilds.length === 0 ? (
          <div className="max-w-md mx-auto rounded-2xl border border-dashed border-border p-8 text-center space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Aucun serveur partage pour le moment. Sois le premier : connecte-toi, choisis un
              salon, et ton serveur apparaitra ici avec une invitation toujours valide.
            </p>
            <a href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition">
              <DiscordIcon className="h-4 w-4" />
              Partager mon serveur
            </a>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guilds.map((g) => {
              const iconUrl = guildIconUrl(g.discordId, g.icon)
              return (
                <div
                  key={g.discordId}
                  className="rounded-2xl border border-border bg-card/70 p-5 flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 rounded-xl border border-border">
                      {iconUrl ? (
                        <AvatarImage src={iconUrl} alt={`Icône de ${g.name}`} />
                      ) : (
                        <AvatarFallback className="rounded-xl bg-primary/20 text-primary font-semibold">
                          {g.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold truncate">{g.name}</h2>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <DiscordIcon className="h-3 w-3" /> Serveur Discord
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5" title="Membres approximatifs">
                      <Users className="h-4 w-4" /> {g.memberCount ?? '—'}
                      <span className="text-xs">membres</span>
                    </span>
                    <span className="flex items-center gap-1.5" title="En ligne approximatif">
                      <Wifi className="h-4 w-4 text-green-500/80" /> {g.onlineCount ?? '—'}
                      <span className="text-xs">en ligne</span>
                    </span>
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    <a href={`/api/join/${g.discordId}`} className={joinButtonClass}>
                      Rejoindre
                    </a>
                    <a href={`/s/${g.discordId}`} className={detailsButtonClass}>
                      <Hash className="h-3.5 w-3.5" />
                      Détails
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 bg-card/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground">
          Propulsé par{' '}
          <a href="/" className="text-primary hover:underline">
            LinkHub
          </a>{' '}
          — partage ton serveur Discord avec une invitation qui ne meurt jamais.
        </div>
      </footer>
    </div>
  )
}
