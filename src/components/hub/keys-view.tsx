'use client'

import { useState } from 'react'
import { Copy, Eye, EyeOff, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { ApiKeyItem } from './types'

function formatDate(iso: string | null): string {
  if (!iso) return 'jamais'
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export function KeysView({
  keys,
  onChanged,
}: {
  keys: ApiKeyItem[]
  onChanged: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const createKey = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/dashboard/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Erreur inconnue')
      setCreateOpen(false)
      setNewName('')
      toast({ title: 'Cle creee', description: 'Copie-la maintenant : elle est visible dans la liste.' })
      onChanged()
    } catch (e) {
      toast({
        title: 'Echec de la creation',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const deleteKey = async (key: ApiKeyItem) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/dashboard/keys/${key.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = await res.json()
        throw new Error(payload.error || 'Erreur inconnue')
      }
      toast({ title: 'Cle supprimee', description: `${key.name} ne peut plus etre utilisee.` })
      onChanged()
    } catch (e) {
      toast({
        title: 'Echec',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      toast({ title: 'Cle copiee' })
    } catch {
      toast({ title: 'Copie impossible', variant: 'destructive' })
    }
  }

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Cles d&apos;API</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Chaque cle donne acces aux serveurs que TOI tu partages. Limite : 120 requetes / minute / cle.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle cle
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <KeyRound className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            Aucune cle pour le moment. Cree ta premiere cle pour connecter tes sites.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {keys.map((k) => (
            <Card key={k.id} className="bg-card/70 border-border/70">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{k.name}</p>
                    <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                      {k.requestCount} requete{k.requestCount > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Derniere utilisation : {formatDate(k.lastUsedAt)} · creee le {formatDate(k.createdAt)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-xs font-mono bg-black/30 border border-border/60 rounded px-2 py-1 flex-1 truncate">
                      {revealed.has(k.id) ? k.key : `${k.key.slice(0, 8)}${'•'.repeat(24)}`}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => toggleReveal(k.id)}
                      aria-label={revealed.has(k.id) ? 'Masquer la clé' : 'Afficher la clé'}
                    >
                      {revealed.has(k.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => copyKey(k.key)}
                      aria-label="Copier la clé"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 self-start sm:self-center"
                  onClick={() => setDeleteTarget(k)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog creation */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle cle d&apos;API</DialogTitle>
            <DialogDescription>
              Donne un nom qui t&apos;aidera a retrouver a quel site sert cette cle.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="key-name">Nom de la cle</Label>
            <Input
              id="key-name"
              placeholder="ex : Site vitrine, Forum, Partenaire..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={60}
              onKeyDown={(e) => e.key === 'Enter' && createKey()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Annuler
            </Button>
            <Button onClick={createKey} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Creer la cle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la cle &laquo; {deleteTarget?.name} &raquo; ?</AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col gap-2">
              <span>
                Toute integration utilisant cette cle cessera immediatement de fonctionner.
              </span>
              <span className="flex items-start gap-2 text-amber-400">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                Pense a mettre a jour tes sites avant de supprimer une cle encore utilisee.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (deleteTarget) deleteKey(deleteTarget)
              }}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
