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
  RefreshCw,
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
import { readJson, responseError } from '@/lib/utils'
import type { AvailableGuild, ChannelItem, SharedGuild } from './types'

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
  data: { guilds: SharedGuild[]; available: AvailableGuild[] }
  onChanged: () => void
}) {
  const [shareTarget, setShareTarget] = useState<AvailableGuild | null>(null)
  const [rechannelTarget, setRechannelTarget] = useState<SharedGuild | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SharedGuild | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

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

  const { guilds, available } = data

  return (
    <div className="space-y-10">
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
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
            Aucun serveur partage pour le moment. Choisis un serveur ci-dessous pour commencer.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {guilds.map((g) => (
              <Card key={g.discordId} className="bg-card/70 border-border/70">
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

                  <div className="mt-4 rounded-lg bg-black/30 border border-border/60 px-3 py-2 flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground/80 truncate flex-1" dir="ltr">
                      {g.inviteUrl || 'Aucune invitation'}
                    </code>
                    {g.inviteUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => copyLink(g.inviteUrl!)}
                        aria-label="Copier le lien d'invitation"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
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
                  </div>

                  <div className="mt-3">
                    <StatusBadge status={g.lastCheckStatus} msg={g.lastCheckMsg} at={g.lastCheckAt} />
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
