'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Hash, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from '@/hooks/use-toast'
import { readJson } from '@/lib/utils'
import type { ChannelItem } from './types'

type PickerError = { message: string; addBotUrl?: string | null }

/**
 * Dialog de selection d'un salon texte : utilise pour le partage initial
 * et pour le changement de salon d'un serveur deja partage.
 */
export function ChannelPickerDialog({
  open,
  onOpenChange,
  guildId,
  guildName,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  guildId: string
  guildName: string
  title: string
  description: string
  confirmLabel: string
  onConfirm: (channel: ChannelItem) => Promise<void>
}) {
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [selected, setSelected] = useState<ChannelItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<PickerError | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    setSelected(null)
    fetch(`/api/dashboard/guilds/${guildId}/channels`)
      .then(async (res) => {
        const data = await readJson<{ error?: string; channels?: ChannelItem[]; addBotUrl?: string | null }>(res)
        if (!res.ok) {
          setError({ message: data.error || `Erreur serveur (HTTP ${res.status})`, addBotUrl: data.addBotUrl })
          return
        }
        setChannels(data.channels || [])
      })
      .catch((e) => setError({ message: e instanceof Error ? e.message : 'Erreur inconnue' }))
      .finally(() => setLoading(false))
  }, [open, guildId])

  const submit = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      await onConfirm(selected)
      onOpenChange(false)
    } catch (e) {
      toast({
        title: 'Echec',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description} — serveur <span className="text-foreground font-medium">{guildName}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Chargement des salons...
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
              {error.message}
            </div>
            {error.addBotUrl && (
              <a href={error.addBotUrl} target="_blank" rel="noreferrer" className="block">
                <Button variant="secondary" className="w-full gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Ajouter le bot a ce serveur
                </Button>
              </a>
            )}
          </div>
        ) : channels.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Aucun salon texte accessible sur ce serveur.
          </p>
        ) : (
          <ScrollArea className="max-h-72 pr-2 -mr-2">
            <div className="grid gap-1">
              {channels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-left transition-colors ${
                    selected?.id === c.id
                      ? 'bg-primary/20 border border-primary/40 text-foreground'
                      : 'border border-transparent hover:bg-white/5 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Hash className="h-4 w-4 shrink-0 text-primary/70" />
                  {c.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={!selected || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
