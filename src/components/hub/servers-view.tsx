'use client'

import { useState } from 'react'
import {
  BadgeCheck,
  Check,
  CircleAlert,
  Clock,
  Copy,
  ExternalLink,
  Hash,
  Loader2,
  MousePointerClick,
  Plus,
  RefreshCw,
  Server,
  Shield,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'
import { ChannelPickerDialog } from './channel-picker'
import { readJson, responseError, cn } from '@/lib/utils'
import type { AvailableGuild, ChannelItem, DashboardGuildsResponse, SharedGuild } from './types'

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return new Intl.NumberFormat('fr-FR').format(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'jamais'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "a l'instant"
  if (min === 1) return 'il y a 1 min'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h === 1) return 'il y a 1 h'
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'il y a 1 jour' : `il y a ${d} jours`
}

/**
 * Mini histogramme des clics sur 7 jours (aucune librairie de graphiques).
 * Masque si aucun clic : pas de bruit visuel sur un serveur qui ne convertit pas.
 */
function ClickSparkline({ series }: { series?: number[] }) {
  if (!series || series.length === 0) return null
  const max = Math.max(...series)
  if (max <= 0) return null
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
      {series.map((value, index) => (
        <span
          key={index}
          className="w-1 rounded-sm bg-violet-400/70"
          style={{ height: `${Math.max(12, Math.round((value / max) * 100))}%` }}
        />
      ))}
    </span>
  )
}

function StatusBadge({ status, msg, at }: { status: string | null; msg: string | null; at: string | null }) {
  if (status === 'error') {
    return (
      <div className="flex items-start gap-1.5 text-xs text-destructive" title={msg || ''}>
        <CircleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span className="line-clamp-2">{msg || 'Erreur inconnue'}</span>
      </div>
    )
  }
  const refreshed = status === 'refreshed'
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {refreshed ? (
        <RefreshCw className="h-3.5 w-3.5 text-amber-400 shrink-0" />
      ) : (
        <BadgeCheck className="h-3.5 w-3.5 text-green-500 shrink-0" />
      )}
      <span>
        {refreshed ? 'Invite regeneree' : 'Invite valide'} · verifie {timeAgo(at)}
      </span>
    </div>
  )
}

export function ServersView({
  data,
  onChanged,
}: {
  data: DashboardGuildsResponse
  onChanged: () => void
}) {
  const [shareTarget, setShareTarget] = useState<AvailableGuild | null>(null)
  const [rechannelTarget, setRechannelTarget] = useState<SharedGuild | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SharedGuild | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : ''

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Lien copie', description: url })
    } catch {
      toast({ title: 'Copie impossible', description: 'Selectionne le lien manuellement.', variant: 'destructive' })
    }
  }

  const shareServer = async (channel: ChannelItem) => {
    if (!shareTarget) return
    setBusyId(shareTarget.discordId)
    try {
      const res = await fetch('/api/dashboard/guilds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: shareTarget.discordId,
          channelId: channel.id,
          channelName: channel.name,
        }),
      })
      const payload = await readJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      toast({
        title: 'Serveur partage !',
        description: `Invitation permanente creee sur #${channel.name}. Le suivi toutes les 5 minutes est actif.`,
      })
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  const setChannel = async (channel: ChannelItem) => {
    if (!rechannelTarget) return
    setBusyId(rechannelTarget.discordId)
    try {
      const res = await fetch(`/api/dashboard/guilds/${rechannelTarget.discordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setChannel', channelId: channel.id, channelName: channel.name }),
      })
      const payload = await readJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      toast({ title: 'Salon mis a jour', description: `Nouvelle invitation creee sur #${channel.name}.` })
      onChanged()
    } finally {
      setBusyId(null)
    }
  }

  const regenerate = async (guild: SharedGuild) => {
    if (!guild.channelId) {
      setRechannelTarget(guild)
      return
    }
    setBusyId(guild.discordId)
    try {
      const res = await fetch(`/api/dashboard/guilds/${guild.discordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate' }),
      })
      const payload = await readJson<{ error?: string }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      toast({ title: 'Invitation regeneree', description: 'Une nouvelle invitation permanente a ete creee.' })
      onChanged()
    } catch (e) {
      toast({
        title: 'Echec de la regeneration',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const removeServer = async (guild: SharedGuild) => {
    setBusyId(guild.discordId)
    try {
      const res = await fetch(`/api/dashboard/guilds/${guild.discordId}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = await readJson<{ error?: string }>(res)
        throw new Error(responseError(res, payload))
      }
      toast({ title: 'Partage retire', description: `Le serveur ${guild.name} n'est plus partage.` })
      onChanged()
    } catch (e) {
      toast({
        title: 'Echec',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const { guilds, available, botConfigured, missingBot, botError } = data

  return (
    <div className="space-y-10">
      {/* Bot requis : sans lui, Discord refuse de lister les salons / creer les invitations */}
      {!botConfigured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400 flex items-start gap-3">
          <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Le bot Discord n&apos;est pas encore configure : le partage de serveur est bloque.
            Un staff doit ajouter le Bot Token dans l&apos;onglet Reglages.
          </span>
        </div>
      )}

      {botError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 flex items-start gap-3">
          <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {botError === 'invalid_token'
              ? "Le token du bot est invalide ou a expiré. Vérifie-le dans les Réglages → Bot."
              : botError === 'bot_not_configured'
                ? "Le bot n'est pas configuré. Ajoute le Bot Token dans les Réglages → Bot."
                : "Impossible de vérifier la présence du bot pour le moment. Réessaie dans un instant."}
          </span>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Serveurs partagés', value: String(guilds.length), icon: Server },
          { label: 'Membres cumulés', value: formatNumber(guilds.reduce((s, g) => s + (g.memberCount ?? 0), 0)), icon: Users },
          { label: 'En ligne', value: formatNumber(guilds.reduce((s, g) => s + (g.onlineCount ?? 0), 0)), icon: Wifi },
          { label: 'Erreurs', value: String(guilds.filter((g) => g.lastCheckStatus === 'error').length), icon: CircleAlert },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/8 bg-card/50 p-3 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-violet-500/12 border border-violet-400/20 flex items-center justify-center shrink-0">
              <stat.icon className="h-4 w-4 text-violet-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tabular-nums leading-tight">{stat.value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Serveurs partages */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Serveurs partages</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Invitations surveillees et reparees automatiquement toutes les 5 minutes.
            </p>
          </div>
          {guilds.length > 0 && (
            <Badge variant="outline" className="border-primary/30 text-muted-foreground">
              {guilds.length} serveur{guilds.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {guilds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/12 bg-card/30 p-10 text-center">
            <div className="mx-auto h-11 w-11 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center mb-3">
              <Server className="h-5 w-5 text-violet-300" />
            </div>
            <p className="text-sm font-medium">Aucun serveur partagé pour le moment</p>
            <p className="text-xs text-muted-foreground mt-1">Choisis un serveur ci-dessous pour commencer.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {guilds.map((g) => (
              <Card key={g.discordId} className="bg-card/60 border-white/8 card-hover overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 rounded-lg border border-border">
                      {g.iconUrl ? (
                        <AvatarImage src={g.iconUrl} alt={`Icône de ${g.name}`} />
                      ) : (
                        <AvatarFallback className="rounded-lg bg-primary/20 text-primary font-semibold">
                          {g.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{g.name}</h3>
                        {g.isAdmin === true && (
                          <Badge className="bg-primary/20 text-primary-foreground border border-primary/30 gap-1">
                            <Shield className="h-3 w-3" /> Admin
                          </Badge>
                        )}
                        {!g.accessible && (
                          <Badge variant="outline" className="text-amber-400 border-amber-400/40 gap-1">
                            <CircleAlert className="h-3 w-3" /> Acces perdu
                          </Badge>
                        )}
                      </div>
                      {g.channelName ? (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Hash className="h-3 w-3" /> {g.channelName}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">Salon non configure</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="rounded-lg bg-black/30 border border-border/60 px-3 py-2 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 w-24">
                        Invitation
                      </span>
                      <code className="text-xs font-mono text-foreground/80 truncate flex-1" dir="ltr">
                        {g.inviteUrl || 'Aucune invitation'}
                      </code>
                      {g.inviteUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 shrink-0"
                          onClick={() => copyLink(g.inviteUrl!)}
                          aria-label="Copier le lien d'invitation"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="rounded-lg bg-black/30 border border-border/60 px-3 py-2 flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0 w-24">
                        Page publique
                      </span>
                      <code className="text-xs font-mono text-foreground/80 truncate flex-1" dir="ltr">
                        {siteOrigin}/s/{g.discordId}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 shrink-0"
                        onClick={() => copyLink(`${siteOrigin}/s/${g.discordId}`)}
                        aria-label="Copier le lien de la page publique"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <a
                        href={`/s/${g.discordId}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Ouvrir la page publique dans un nouvel onglet"
                      >
                        <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </a>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5" title="Membres approximatifs">
                      <Users className="h-3.5 w-3.5" /> {g.memberCount ?? '—'}
                    </span>
                    <span className="flex items-center gap-1.5" title="En ligne approximatif">
                      <Wifi className="h-3.5 w-3.5 text-green-500/80" /> {g.onlineCount ?? '—'}
                    </span>
                    <span className="flex items-center gap-1.5" title="Utilisations de l'invitation">
                      <ExternalLink className="h-3.5 w-3.5" /> {g.uses} entrees
                    </span>
                    <span
                      className="flex items-center gap-1.5"
                      title={`Clics sur le lien : ${g.clicks?.today ?? 0} aujourd'hui · ${g.clicks?.last7Days ?? 0} sur 7 jours · ${g.clicks?.last30Days ?? 0} sur 30 jours`}
                    >
                      <MousePointerClick className="h-3.5 w-3.5 text-violet-400/80" />{' '}
                      {g.clicks?.last7Days ?? 0} clics
                    </span>
                    <ClickSparkline series={g.clicks?.series} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={g.lastCheckStatus} msg={g.lastCheckMsg} at={g.lastCheckAt} />
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {g.lastCheckLatencyMs ? `${g.lastCheckLatencyMs} ms` : ''}
                      {g.failureCount ? ` · ${g.failureCount} échec${g.failureCount > 1 ? 's' : ''}` : ''}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      disabled={busyId === g.discordId}
                      onClick={() => regenerate(g)}
                    >
                      {busyId === g.discordId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Regenerer
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      onClick={() => setRechannelTarget(g)}
                    >
                      <Hash className="h-3.5 w-3.5" />
                      Salon
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(g)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Retirer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Serveurs disponibles */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Serveurs ou tu as les droits</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Serveurs ou tu es administrateur (ou autorise a creer des invitations). Clique sur
            &laquo; Partager &raquo; pour l&apos;ajouter a la plateforme.
          </p>
        </div>
        {available.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
            Tous tes serveurs elegibles sont deja partages. Reviens apres avoir rejoint un nouveau serveur.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((g) => (
              <div
                key={g.discordId}
                className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/50 p-4"
              >
                <Avatar className="h-10 w-10 rounded-lg border border-border">
                  {g.iconUrl ? (
                    <AvatarImage src={g.iconUrl} alt={`Icône de ${g.name}`} />
                  ) : (
                    <AvatarFallback className="rounded-lg bg-muted font-semibold text-xs">
                      {g.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    {g.isAdmin ? (
                      <>
                        <Shield className="h-3 w-3 text-primary" /> Administrateur
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" /> Droit d&apos;invitation
                      </>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={busyId === g.discordId}
                  onClick={() => setShareTarget(g)}
                >
                  {busyId === g.discordId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Partager
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Serveurs sans le bot : on ne les affiche pas dans la liste principale */}
      {missingBot.length > 0 && (
        <section>
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Serveurs sans le bot</h2>
              <Badge variant="outline" className="border-amber-400/30 text-amber-300 text-[10px]">
                {missingBot.length}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Le bot doit être membre du serveur pour lister les salons et créer l'invitation.
              Ajoute-le en un clic : il n'envoie jamais de messages.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missingBot.map((g) => (
              <div key={g.discordId} className="rounded-xl border border-amber-400/20 bg-amber-500/[0.04] p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 rounded-lg border border-white/10">
                    {g.iconUrl ? (
                      <AvatarImage src={g.iconUrl} alt={`Icône de ${g.name}`} />
                    ) : (
                      <AvatarFallback className="rounded-lg bg-amber-500/15 text-amber-200 text-xs font-semibold">
                        {g.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="border-amber-400/30 text-amber-300 text-[9px] gap-1">
                        <CircleAlert className="h-3 w-3" /> Bot manquant
                      </Badge>
                      {g.shared && (
                        <Badge variant="outline" className="border-white/10 text-muted-foreground text-[9px]">
                          Partagé
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <a href={g.inviteUrl} target="_blank" rel="noreferrer" className="block">
                  <Button size="sm" className="w-full gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Ajouter le bot
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dialogs */}
      {shareTarget && (
        <ChannelPickerDialog
          open
          onOpenChange={(o) => !o && setShareTarget(null)}
          guildId={shareTarget.discordId}
          guildName={shareTarget.name}
          title="Partager ce serveur"
          description="Choisis le salon qui recevra l'invitation permanente surveillee toutes les 5 minutes."
          confirmLabel="Partager le serveur"
          onConfirm={shareServer}
        />
      )}
      {rechannelTarget && (
        <ChannelPickerDialog
          open
          onOpenChange={(o) => !o && setRechannelTarget(null)}
          guildId={rechannelTarget.discordId}
          guildName={rechannelTarget.name}
          title="Changer de salon"
          description="Une nouvelle invitation permanente sera creee sur le salon choisi, et l'API la servira immediatement."
          confirmLabel="Mettre a jour"
          onConfirm={setChannel}
        />
      )}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer le partage de &laquo; {deleteTarget?.name} &raquo; ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le serveur ne sera plus accessible via l&apos;API et son lien d&apos;invitation sera
              supprime. Les boutons deja installes sur tes sites ne fonctionneront plus. L&apos;invitation
              Discord existante n&apos;est pas revoquee : pense a la supprimer manuellement si besoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) removeServer(deleteTarget)
                setDeleteTarget(null)
              }}
            >
              Retirer le partage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
