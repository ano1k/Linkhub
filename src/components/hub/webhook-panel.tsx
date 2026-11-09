'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  HeartPulse,
  Info,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Webhook,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import { DiscordIcon } from './discord-icon'
import type { AppConfigInfo, WebhookConfig } from './types'

const INTERVALS = [1, 5, 10, 15, 30, 60, 120, 240, 720, 1440]

const PLACEHOLDERS = [
  ['{site}', 'Nom du site'],
  ['{status}', 'opérationnel / indisponible'],
  ['{latency}', 'Latence du ping (ms)'],
  ['{guilds}', 'Nombre de serveurs suivis'],
  ['{errors}', "Nombre d'erreurs"],
  ['{time}', 'Horodatage ISO'],
  ['{url}', 'URL du site'],
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

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

export function WebhookPanel({
  config,
  onSaved,
}: {
  config: AppConfigInfo | null
  onSaved: () => void
}) {
  const [data, setData] = useState<WebhookConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showUrl, setShowUrl] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [webhookUrl, setWebhookUrl] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [intervalMinutes, setIntervalMinutes] = useState(5)
  const [mention, setMention] = useState('')
  const [message, setMessage] = useState('')
  const [includeStats, setIncludeStats] = useState(true)
  const [siteName, setSiteName] = useState('')

  const applyData = useCallback((d: WebhookConfig) => {
    setData(d)
    setEnabled(d.enabled)
    setIntervalMinutes(d.intervalMinutes)
    setMention(d.mention ?? '')
    setMessage(d.message ?? '')
    setIncludeStats(d.includeStats)
    setSiteName(d.siteName ?? '')
    setWebhookUrl('')
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config/webhook')
      const payload = await readJson<WebhookConfig & { error?: string }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      applyData(payload)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setLoading(false)
    }
  }, [applyData])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/config/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(webhookUrl.trim() ? { webhookUrl: webhookUrl.trim() } : {}),
          enabled,
          intervalMinutes,
          mention,
          message,
          includeStats,
          siteName,
        }),
      })
      const payload = await readJson<WebhookConfig & { error?: string }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      applyData(payload)
      setWebhookUrl('')
      toast({
        title: 'Heartbeat enregistré',
        description: enabled
          ? `Le site pingera Discord toutes les ${intervalMinutes} min.`
          : 'La surveillance est en pause. Tu peux l’activer à tout moment.',
      })
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(msg)
      toast({ title: 'Enregistrement impossible', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setError(null)
    try {
      const res = await fetch('/api/config/webhook/test', { method: 'POST' })
      const payload = await readJson<{ error?: string; config?: WebhookConfig; result?: { latencyMs?: number; siteLatencyMs?: number } }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      if (payload.config) applyData(payload.config)
      toast({
        title: 'Ping envoyé',
        description: `Discord a répondu en ${payload.result?.latencyMs ?? '—'} ms. Vérifie ton salon.`,
      })
      onSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Envoi impossible'
      setError(msg)
      toast({ title: 'Ping impossible', description: msg, variant: 'destructive' })
      void load()
    } finally {
      setTesting(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/config/webhook', { method: 'DELETE' })
      const payload = await readJson<WebhookConfig & { error?: string }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      applyData(payload)
      setConfirmDelete(false)
      toast({ title: 'Webhook supprimé', description: 'La surveillance Discord est désactivée.' })
      onSaved()
    } catch (e) {
      toast({ title: 'Suppression impossible', description: e instanceof Error ? e.message : 'Erreur', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const status = data?.status ?? 'never'
  const statusTone =
    status === 'ok'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
      : status === 'error'
        ? 'border-rose-400/30 bg-rose-500/10 text-rose-300'
        : 'border-white/10 bg-white/[0.03] text-muted-foreground'

  const previewMessage =
    message ||
    '🟢 **{site}** est en ligne — statut {status}, latence {latency} ms. {guilds} serveur(s) suivi(s), {errors} erreur(s).'
  const renderedPreview = previewMessage
    .replaceAll('{site}', siteName || 'LinkHub')
    .replaceAll('{status}', 'opérationnel')
    .replaceAll('{latency}', '42')
    .replaceAll('{guilds}', '3')
    .replaceAll('{errors}', '0')
    .replaceAll('{time}', new Date().toISOString())
    .replaceAll('{url}', data?.siteUrl || 'https://linkhub.app')

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 rounded-xl bg-card/60 animate-pulse" />
        <div className="h-64 rounded-xl bg-card/60 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Status card */}
      <div className={cn('rounded-xl border p-4 sm:p-5', statusTone)}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">
                {status === 'ok'
                  ? 'Heartbeat opérationnel'
                  : status === 'error'
                    ? 'Le dernier envoi a échoué'
                    : data?.configured
                      ? 'En attente du premier envoi'
                      : 'Aucun webhook configuré'}
              </p>
              <Badge variant="outline" className="text-[10px] border-white/15 gap-1">
                <span className={cn('h-1.5 w-1.5 rounded-full', status === 'ok' ? 'bg-emerald-400' : status === 'error' ? 'bg-rose-400' : 'bg-white/30')} />
                {status === 'ok' ? 'Succès' : status === 'error' ? 'Erreur' : 'Inactif'}
              </Badge>
              {data?.enabled && (
                <Badge variant="outline" className="text-[10px] border-white/15 gap-1">
                  <Clock className="h-3 w-3" /> Toutes les {data.intervalMinutes} min
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs opacity-80 leading-relaxed">
              {data?.configured
                ? `Dernier envoi ${timeAgo(data.lastSentAt)} · latence ${data.lastLatencyMs ?? '—'} ms · ${data.successCount} succès / ${data.failureCount} échecs`
                : "Colle l'URL d'un webhook Discord ci-dessous pour recevoir le statut du site dans ton salon."}
            </p>
            {data?.lastError && (
              <p className="mt-2 text-[11px] rounded-md bg-black/20 px-2 py-1.5 font-mono break-words">{data.lastError}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" className="gap-1.5 border-white/15 bg-white/5" onClick={test} disabled={testing || !data?.configured}>
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
              Pinger maintenant
            </Button>
            {data?.configured && (
              <Button size="sm" variant="ghost" className="gap-1.5 text-rose-300 hover:bg-rose-500/10" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-start gap-2">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Configuration */}
      <Card className="bg-card/60 border-white/8">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-semibold">Configuration du heartbeat</h3>
            <Badge variant="outline" className="ml-auto text-[10px] border-emerald-400/25 text-emerald-300 gap-1">
              <ShieldCheck className="h-3 w-3" /> URL chiffrée
            </Badge>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="webhook-url">URL du webhook Discord</Label>
            <div className="relative">
              <Input
                id="webhook-url"
                type={showUrl ? 'text' : 'password'}
                placeholder={data?.configured ? 'URL enregistrée — colle une nouvelle URL pour la remplacer' : 'https://discord.com/api/webhooks/...'}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="font-mono text-xs pr-10"
                dir="ltr"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowUrl((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8"
                aria-label={showUrl ? 'Masquer l’URL' : 'Afficher l’URL'}
              >
                {showUrl ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {data?.configured ? (
                <>URL enregistrée : <code className="font-mono text-foreground/80 break-all">{data.maskedUrl}</code></>
              ) : (
                <>Discord &gt; Paramètres du salon &gt; Intégrations &gt; Webhooks &gt; Nouveau webhook &gt; Copier l’URL.</>
              )}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="webhook-interval">Intervalle d’envoi</Label>
              <select
                id="webhook-interval"
                value={intervalMinutes}
                onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-input bg-white/[0.03] px-3 text-sm outline-none focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/20"
              >
                {INTERVALS.map((v) => (
                  <option key={v} value={v} className="bg-card">
                    Toutes les {v} min{v === 5 ? ' (recommandé)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">Le site se ping lui-même avant chaque envoi.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="webhook-mention">Mention (optionnel)</Label>
              <Input
                id="webhook-mention"
                placeholder="ID du rôle ou @everyone"
                value={mention}
                onChange={(e) => setMention(e.target.value)}
                className="font-mono text-xs"
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground">ID du rôle (17-20 chiffres) ou @everyone.</p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="webhook-message">Message personnalisé</Label>
            <Textarea
              id="webhook-message"
              placeholder="🟢 **{site}** est en ligne — statut {status}, latence {latency} ms."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              className="text-xs leading-relaxed"
            />
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map(([token, label]) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => setMessage((m) => `${m}${m && !m.endsWith(' ') ? ' ' : ''}${token}`)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-violet-400/30 transition"
                  title={label}
                >
                  {token}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="site-name">Nom du site (branding)</Label>
              <Input
                id="site-name"
                placeholder="LinkHub"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                maxLength={40}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2.5">
              <div>
                <p className="text-xs font-medium">Statistiques dans le message</p>
                <p className="text-[10px] text-muted-foreground">Serveurs suivis et erreurs</p>
              </div>
              <Switch checked={includeStats} onCheckedChange={setIncludeStats} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2.5">
            <div>
              <p className="text-xs font-medium">Activer la surveillance</p>
              <p className="text-[10px] text-muted-foreground">Envoi automatique à l’intervalle choisi</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <Button onClick={save} disabled={saving || (enabled && !data?.configured && !webhookUrl.trim())} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer
            </Button>
            <Button variant="outline" onClick={test} disabled={testing || !data?.configured} className="gap-2 border-white/10 bg-white/[0.03]">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Tester le webhook
            </Button>
            <span className="text-[10px] text-muted-foreground sm:ml-auto flex items-center gap-1.5">
              <Info className="h-3 w-3" /> L’URL n’est jamais renvoyée en clair par l’API.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Preview + history */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="bg-card/60 border-white/8">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-cyan-300" />
              <h3 className="text-sm font-semibold">Aperçu du message</h3>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#313338] p-3.5">
              <div className="flex gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center shrink-0">
                  <DiscordIcon className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#f2f3f5]">{siteName || 'LinkHub'}</span>
                    <span className="rounded bg-[#5865f2] px-1 py-0.5 text-[8px] font-semibold text-white">APP</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#dbdee1] break-words">
                    {mention && <span className="text-[#c9cdfb]">{mention} </span>}
                    {renderedPreview}
                  </p>
                  <div className="mt-2 rounded border-l-[3px] border-[#23a55a] bg-[#2b2d31] p-2.5">
                    <p className="text-[11px] font-semibold text-[#f2f3f5]">🟢 {siteName || 'LinkHub'} est en ligne</p>
                    <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                      {[['Statut', 'En ligne'], ['Latence', '42 ms'], ['Serveurs', '3']].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[9px] font-semibold text-[#f2f3f5]">{k}</p>
                          <p className="text-[9px] text-[#b5bac1]">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-white/8">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-4 w-4 text-violet-300" />
              <h3 className="text-sm font-semibold">Derniers envois</h3>
              <Badge variant="outline" className="ml-auto text-[10px] border-white/10 text-muted-foreground">
                {data?.deliveries.length ?? 0} / 10
              </Badge>
            </div>
            {data && data.deliveries.length > 0 ? (
              <div className="space-y-1.5">
                {data.deliveries.slice(0, 6).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-2.5 py-2">
                    {d.status === 'ok' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium capitalize">
                        {d.trigger ?? 'heartbeat'} · {d.latencyMs ?? '—'} ms
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {formatDate(d.createdAt)} {d.error ? `· ${d.error}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('text-[9px] border-white/10', d.status === 'ok' ? 'text-emerald-300' : 'text-rose-300')}>
                      {d.httpStatus ?? '—'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Clock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Aucun envoi pour le moment.</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Enregistre puis clique sur « Tester le webhook ».</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* How to */}
      <Card className="bg-card/40 border-white/8">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-semibold">Créer le webhook Discord (2 min)</h3>
          </div>
          <ol className="grid sm:grid-cols-3 gap-3 text-[11px] text-muted-foreground">
            {[
              ['1', 'Dans Discord, ouvre les paramètres du salon qui doit recevoir les alertes.', 'Paramètres du salon'],
              ['2', 'Onglet Intégrations → Webhooks → Nouveau webhook, puis Copier l’URL.', 'Intégrations'],
              ['3', 'Colle l’URL ici, choisis l’intervalle (5 min), active et enregistre.', 'Réglages LinkHub'],
            ].map(([n, text, label]) => (
              <li key={n} className="rounded-lg border border-white/6 bg-white/[0.02] p-3">
                <span className="inline-flex h-5 w-5 rounded-full bg-violet-500/20 text-violet-200 text-[10px] font-bold items-center justify-center mb-2">{n}</span>
                <p className="leading-relaxed">{text}</p>
                <p className="mt-1.5 text-[10px] font-medium text-foreground/70">{label}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le webhook Discord ?</AlertDialogTitle>
            <AlertDialogDescription>
              La surveillance sera désactivée et l’URL chiffrée supprimée. Les envois automatiques
              cesseront immédiatement. Tu pourras reconfigurer un webhook à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); void remove() }} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
