'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  Clock,
  FileClock,
  Fingerprint,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { readJson, responseError, cn } from '@/lib/utils'
import type { AuditEventItem } from './types'

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Connexion Discord',
  'auth.logout': 'Déconnexion',
  'config.discord.save': 'Application Discord enregistrée',
  'config.bot.save': 'Bot Discord enregistré',
  'config.webhook.save': 'Heartbeat modifié',
  'config.webhook.test': 'Test du heartbeat',
  'config.webhook.delete': 'Webhook supprimé',
  'apikey.create': "Clé d'API créée",
  'apikey.delete': "Clé d'API supprimée",
  'guild.share': 'Serveur partagé',
  'guild.update': 'Serveur mis à jour',
  'guild.remove': 'Partage retiré',
  'security.blocked': 'Requête bloquée',
}

const ACTION_TONES: Record<string, string> = {
  'auth.login': 'border-emerald-400/25 text-emerald-300',
  'auth.logout': 'border-white/10 text-muted-foreground',
  'config.discord.save': 'border-violet-400/25 text-violet-300',
  'config.bot.save': 'border-violet-400/25 text-violet-300',
  'config.webhook.save': 'border-cyan-400/25 text-cyan-300',
  'config.webhook.test': 'border-cyan-400/25 text-cyan-300',
  'config.webhook.delete': 'border-rose-400/25 text-rose-300',
  'apikey.create': 'border-amber-400/25 text-amber-300',
  'apikey.delete': 'border-rose-400/25 text-rose-300',
  'guild.share': 'border-emerald-400/25 text-emerald-300',
  'guild.update': 'border-amber-400/25 text-amber-300',
  'guild.remove': 'border-rose-400/25 text-rose-300',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

const SECURITY_ITEMS = [
  {
    icon: Lock,
    title: 'Secrets chiffrés',
    text: "URL de webhook chiffrée en AES-256-GCM avec une clé dérivée d'APP_SECRET. Jamais renvoyée en clair.",
  },
  {
    icon: KeyRound,
    title: 'Clés d’API hachées',
    text: "Seule l'empreinte SHA-256 est stockée. La clé en clair est affichée une seule fois, à la création.",
  },
  {
    icon: UserCheck,
    title: 'Sessions signées',
    text: 'Cookie HttpOnly + Secure + SameSite=None en HTTPS, expiration 30 jours, nonce anti-fixation.',
  },
  {
    icon: ShieldCheck,
    title: 'CSRF & en-têtes',
    text: 'Origine vérifiée sur les mutations, CSP, HSTS, nosniff, Referrer-Policy et Permissions-Policy.',
  },
  {
    icon: Activity,
    title: 'Rate limiting',
    text: '120 req/min par clé, 300/min par IP, limites dédiées sur OAuth, réglages, partages et suppressions.',
  },
  {
    icon: FileClock,
    title: 'Journal d’audit',
    text: 'Connexions, modifications de configuration, clés et partages sont journalisés (500 derniers événements).',
  },
]

export function SecurityPanel() {
  const [events, setEvents] = useState<AuditEventItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/audit?limit=20')
      const payload = await readJson<{ events?: AuditEventItem[]; error?: string }>(res)
      if (!res.ok) throw new Error(responseError(res, payload))
      setEvents(payload.events || [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chargement impossible')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECURITY_ITEMS.map((item) => (
          <div key={item.title} className="rounded-xl border border-white/8 bg-card/50 p-4 card-hover">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center">
              <item.icon className="h-4 w-4 text-emerald-300" />
            </div>
            <p className="mt-3 text-xs font-semibold">{item.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>

      <Card className="bg-card/60 border-white/8">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-white/6">
            <FileClock className="h-4 w-4 text-violet-300" />
            <div>
              <h3 className="text-sm font-semibold">Journal d’audit</h3>
              <p className="text-[11px] text-muted-foreground">Les 20 derniers événements de sécurité.</p>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto gap-1.5 text-xs" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Actualiser
            </Button>
          </div>

          {error ? (
            <div className="p-6 text-center">
              <ShieldAlert className="h-6 w-6 mx-auto text-amber-300 mb-2" />
              <p className="text-sm text-amber-200">Journal réservé au staff</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          ) : events === null ? (
            <div className="p-6 space-y-2">
              <div className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
              <div className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
              <div className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
            </div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-400 mb-2" />
              <p className="text-sm font-medium">Aucun événement</p>
              <p className="text-xs text-muted-foreground mt-1">Les actions sensibles apparaîtront ici.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {events.map((e) => (
                <div key={e.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition">
                  <div className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/8 flex items-center justify-center shrink-0">
                    <Fingerprint className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium">{ACTION_LABELS[e.action] ?? e.action}</p>
                      <Badge variant="outline" className={cn('text-[9px]', ACTION_TONES[e.action] ?? 'border-white/10 text-muted-foreground')}>
                        {e.action}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {e.actorName ?? 'Système'}
                      {e.target ? ` · ${e.target}` : ''}
                      {e.ip ? ` · ${e.ip}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" /> {formatDate(e.createdAt)}
                    </p>
                    {e.metadata && (
                      <p className="text-[9px] text-muted-foreground/60 font-mono max-w-[180px] truncate mt-0.5" title={e.metadata}>
                        {e.metadata}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-100/80 leading-relaxed">
            <p className="font-medium text-amber-200">Bonnes pratiques</p>
            <ul className="mt-1.5 space-y-1 list-disc list-inside">
              <li>Définis une variable <code className="font-mono bg-black/30 px-1 rounded">APP_SECRET</code> longue et aléatoire en production : elle signe les sessions et chiffre le webhook.</li>
              <li>Ne partage jamais une clé d’API en clair : elle n’est affichée qu’une seule fois.</li>
              <li>Révoque immédiatement une clé compromise depuis l’onglet Clés d’API.</li>
              <li>Le staff est défini par <code className="font-mono bg-black/30 px-1 rounded">STAFF_DISCORD_IDS</code> (IDs séparés par des virgules).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
