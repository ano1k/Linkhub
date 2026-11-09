'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  Lock,
  KeyRound,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
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
import { readJson, responseError, cn } from '@/lib/utils'
import type { ApiKeyItem, CreatedApiKey } from './types'

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
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const copy = async (value: string, label = 'Copié') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setTimeout(() => setCopied(null), 1600)
      toast({ title: label })
    } catch {
      toast({ title: 'Copie impossible', description: 'Sélectionne le texte manuellement.', variant: 'destructive' })
    }
  }

  const createKey = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/dashboard/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      })
      const payload = await readJson<{ error?: string; key?: CreatedApiKey }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      if (!payload.key) throw new Error('Réponse serveur invalide.')
      setCreateOpen(false)
      setNewName('')
      setCreatedKey(payload.key)
      onChanged()
    } catch (e) {
      toast({
        title: 'Échec de la création',
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
        const payload = await readJson<{ error?: string }>(res)
        throw new Error(responseError(res, payload))
      }
      toast({ title: 'Clé supprimée', description: `${key.name} ne peut plus être utilisée.` })
      onChanged()
    } catch (e) {
      toast({
        title: 'Échec',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Clés d’API</h2>
            <Badge variant="outline" className="border-emerald-400/25 text-emerald-300 text-[10px] gap-1">
              <ShieldCheck className="h-3 w-3" /> Hachées
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Chaque clé donne accès aux serveurs que <strong className="text-foreground">toi</strong> tu partages.
            Limite : 120 requêtes/minute par clé. La clé en clair n’est affichée qu’une seule fois.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nouvelle clé
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-card/30 p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-violet-500/10 border border-violet-400/20 flex items-center justify-center mb-3">
            <KeyRound className="h-5 w-5 text-violet-300" />
          </div>
          <p className="text-sm font-medium">Aucune clé pour le moment</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Crée ta première clé pour connecter tes sites et récupérer l’invitation à jour en une requête.
          </p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Créer une clé
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {keys.map((k) => (
            <Card key={k.id} className="bg-card/60 border-white/8 card-hover">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-500/12 border border-violet-400/20 flex items-center justify-center shrink-0">
                    <KeyRound className="h-4 w-4 text-violet-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{k.name}</p>
                      <Badge variant="outline" className="text-[10px] border-white/10 text-muted-foreground">
                        {k.requestCount} requête{k.requestCount > 1 ? 's' : ''}
                      </Badge>
                      {k.lastUsedAt && (
                        <Badge variant="outline" className="text-[10px] border-emerald-400/20 text-emerald-300/80">
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Dernière utilisation : {formatDate(k.lastUsedAt)} · créée le {formatDate(k.createdAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 self-start sm:self-center"
                    onClick={() => setDeleteTarget(k)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Révoquer
                  </Button>
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-2">
                  <div className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Clé API (masquée)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono text-foreground/80 truncate flex-1">
                        {k.keyPrefix}{'•'.repeat(18)}
                      </code>
                      <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                    </div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">La clé complète n’est plus récupérable.</p>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">Jeton public (boutons)</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono text-foreground/80 truncate flex-1">
                        {k.publicId ? `${k.publicId.slice(0, 10)}…${k.publicId.slice(-4)}` : '—'}
                      </code>
                      {k.publicId && (
                        <button
                          onClick={() => copy(k.publicId!, 'Jeton public copié')}
                          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8"
                          aria-label="Copier le jeton public"
                        >
                          {copied === 'Jeton public copié' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">Non secret · pour /api/v1/go.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex items-start gap-2.5">
        <ShieldAlert className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Sécurité :</strong> seule une empreinte SHA-256 de la clé est stockée.
          Si tu perds la clé en clair, révoque-la et crées-en une nouvelle. Les anciennes clés restent compatibles
          mais ne sont plus affichées en clair.
        </p>
      </div>

      {/* Dialog création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle clé d’API</DialogTitle>
            <DialogDescription>
              Donne un nom qui t’aidera à retrouver à quel site sert cette clé.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="key-name">Nom de la clé</Label>
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
              Créer la clé
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog clé créée (une seule fois) */}
      <Dialog open={!!createdKey} onOpenChange={(o) => !o && setCreatedKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Clé créée
            </DialogTitle>
            <DialogDescription>
              Copie cette clé maintenant : elle ne sera plus jamais affichée en entier.
            </DialogDescription>
          </DialogHeader>
          {createdKey && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-100/90 leading-relaxed">
                  Toute personne possédant cette clé peut accéder à tes serveurs partagés. Ne la
                  publie jamais côté client ni dans un dépôt public.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label>Clé API</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs font-mono break-all">
                    {createdKey.key}
                  </code>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5 border-white/10 bg-white/[0.03]" onClick={() => copy(createdKey.key, 'Clé copiée')}>
                    {copied === 'Clé copiée' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Jeton public pour les boutons</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-xs font-mono break-all">
                    {createdKey.publicId}
                  </code>
                  <Button size="sm" variant="outline" className="shrink-0 gap-1.5 border-white/10 bg-white/[0.03]" onClick={() => copy(createdKey.publicId, 'Jeton copié')}>
                    {copied === 'Jeton copié' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Exemple de bouton</p>
                <code className="text-[10px] font-mono text-foreground/70 break-all">
                  {createdKey.directUrlTemplate.replace('{discordId}', 'ID_DU_SERVEUR')}
                </code>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>J’ai copié ma clé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la clé « {deleteTarget?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col gap-2">
              <span>Toute intégration utilisant cette clé cessera immédiatement de fonctionner.</span>
              <span className="flex items-start gap-2 text-amber-400">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                Pense à mettre à jour tes sites avant de supprimer une clé encore utilisée.
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
