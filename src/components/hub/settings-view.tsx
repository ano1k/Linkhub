'use client'

import { useEffect, useState, type ComponentType } from 'react'
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Code2,
  ExternalLink,
  FlaskConical,
  HeartPulse,
  Info,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Webhook,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { CodeBlock } from './code-block'
import { WebhookPanel } from './webhook-panel'
import { SecurityPanel } from './security-panel'
import { DiscordIcon } from './discord-icon'
import { cn } from '@/lib/utils'
import type { AppConfigInfo } from './types'

type Section = 'app' | 'bot' | 'heartbeat' | 'security' | 'guide'

const SECTIONS: Array<{ id: Section; label: string; icon: ComponentType<{ className?: string }>; hint: string }> = [
  { id: 'app', label: 'Application Discord', icon: DiscordIcon, hint: 'OAuth2' },
  { id: 'bot', label: 'Bot Discord', icon: Bot, hint: 'Invitations' },
  { id: 'heartbeat', label: 'Heartbeat', icon: HeartPulse, hint: 'Webhook' },
  { id: 'security', label: 'Sécurité', icon: ShieldCheck, hint: 'Audit' },
  { id: 'guide', label: 'Guide', icon: Code2, hint: 'Configuration' },
]

export function SettingsView({
  config,
  onSaved,
}: {
  config: AppConfigInfo | null
  onSaved: () => void
}) {
  const [section, setSection] = useState<Section>('app')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [botToken, setBotToken] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingBot, setSavingBot] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (config?.clientId) setClientId(config.clientId)
  }, [config?.clientId])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret,
          ...(botToken.trim() ? { botToken: botToken.trim() } : {}),
          ...(setupToken.trim() ? { setupToken: setupToken.trim() } : {}),
        }),
      })
      const raw = await res.text()
      let payload: { error?: string } = {}
      try {
        payload = raw ? JSON.parse(raw) : {}
      } catch {
        payload = {}
      }
      if (!res.ok) {
        throw new Error(
          payload.error ||
            `Erreur serveur HTTP ${res.status}${raw ? ` : ${raw.slice(0, 200)}` : ' (réponse vide)'} — regarde /api/health et les logs du serveur.`,
        )
      }
      setSaved(true)
      setBotToken('')
      toast({
        title: 'Configuration enregistrée',
        description: 'La connexion Discord est maintenant active.',
      })
      onSaved()
    } catch (e) {
      toast({
        title: 'Échec',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const saveBot = async () => {
    const token = botToken.trim()
    if (!token) return
    setSavingBot(true)
    try {
      const res = await fetch('/api/config/bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: token }),
      })
      const raw = await res.text()
      let payload: { error?: string } = {}
      try {
        payload = raw ? JSON.parse(raw) : {}
      } catch {
        payload = {}
      }
      if (!res.ok) {
        throw new Error(
          payload.error ||
            `Erreur serveur HTTP ${res.status}${raw ? ` : ${raw.slice(0, 200)}` : ' (réponse vide)'}.`,
        )
      }
      setBotToken('')
      toast({
        title: 'Bot enregistré',
        description: 'Le bot peut maintenant lister les salons et créer les invitations.',
      })
      onSaved()
    } catch (e) {
      toast({
        title: 'Échec',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setSavingBot(false)
    }
  }

  const redirectUri = config?.redirectUri ?? ''

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Réglages de la plateforme</h2>
            <Badge variant="outline" className="border-violet-400/30 text-violet-300 text-[10px] gap-1">
              <Lock className="h-3 w-3" /> Staff
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Application Discord, bot, heartbeat et sécurité. Ces réglages sont réservés aux
            membres du staff (<code className="font-mono text-xs bg-white/5 px-1 rounded">STAFF_DISCORD_IDS</code>).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('gap-1.5', config?.discordConfigured ? 'border-emerald-400/25 text-emerald-300' : 'border-amber-400/25 text-amber-300')}>
            {config?.discordConfigured ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
            {config?.discordConfigured ? 'Discord configuré' : 'Configuration requise'}
          </Badge>
          {config?.mockMode && (
            <Badge variant="outline" className="border-sky-500/30 text-sky-300 gap-1">
              <FlaskConical className="h-3 w-3" /> Démo
            </Badge>
          )}
        </div>
      </div>

      {/* Section nav */}
      <div className="flex gap-1 overflow-x-auto scroll-slim pb-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={cn(
              'shrink-0 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition',
              section === s.id
                ? 'border-violet-400/30 bg-violet-500/15 text-foreground'
                : 'border-white/8 bg-white/[0.02] text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
            )}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
            <span className="hidden sm:inline text-[10px] opacity-60">{s.hint}</span>
          </button>
        ))}
      </div>

      {config?.mockMode && (
        <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3.5 text-xs text-sky-200 flex items-start gap-2.5">
          <FlaskConical className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-sky-100">Mode démo actif — Discord simulé.</strong> La connexion, les serveurs, les invitations et le heartbeat fonctionnent avec un Discord de test intégré. Pour le vrai Discord, supprime{' '}
            <code className="font-mono bg-black/30 px-1 rounded">DISCORD_API_BASE</code> et redémarre.
          </p>
        </div>
      )}

      {section === 'app' && (
        <div className="space-y-4">
          <div className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm', config?.discordConfigured ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300' : 'border-amber-500/25 bg-amber-500/[0.07] text-amber-300')}>
            {config?.discordConfigured ? <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" /> : <Info className="h-5 w-5 shrink-0 mt-0.5" />}
            <div>
              <p className="font-medium">{config?.discordConfigured ? 'Application Discord configurée' : 'Configuration requise'}</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {config?.discordConfigured
                  ? 'La connexion et le suivi des invitations sont opérationnels. Tu peux remplacer le Client Secret à tout moment.'
                  : "Suis les 4 étapes ci-dessous puis renseigne tes identifiants pour activer la connexion Discord."}
              </p>
            </div>
          </div>

          <Card className="bg-card/60 border-white/8">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2">
                <DiscordIcon className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold">Identifiants OAuth2</h3>
                <Badge variant="outline" className="ml-auto text-[10px] border-white/10 text-muted-foreground">Chiffré en base</Badge>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-id">Client ID de ton application Discord</Label>
                <Input
                  id="client-id"
                  placeholder="1234567890123456789"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="font-mono text-xs"
                  dir="ltr"
                />
                <p className="text-[11px] text-muted-foreground">
                  Portail développeur Discord &gt; ton application &gt; OAuth2 &gt; Client ID.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input
                  id="client-secret"
                  type="password"
                  placeholder={config?.discordConfigured ? 'Déjà configuré — colle un nouveau secret pour le remplacer' : 'Colle ton Client Secret ici'}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="font-mono text-xs"
                  dir="ltr"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Même onglet OAuth2 &gt; Client Secret. L’identité est vérifiée auprès de Discord avant l’enregistrement.
                </p>
              </div>
              {config?.setupTokenRequired && !config?.discordConfigured && (
                <div className="grid gap-2">
                  <Label htmlFor="setup-token">Jeton d’installation</Label>
                  <Input
                    id="setup-token"
                    type="password"
                    placeholder="Valeur de la variable SETUP_TOKEN"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    className="font-mono text-xs"
                    dir="ltr"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Cette instance exige le jeton défini dans <code>SETUP_TOKEN</code> pour autoriser la
                    première configuration.
                  </p>
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={save} disabled={saving || !clientId || !clientSecret} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer
                </Button>
                {config?.addBotUrl && (
                  <a href={config.addBotUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03] w-full sm:w-auto">
                      <ExternalLink className="h-4 w-4" /> Ajouter le bot
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/8">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Code2 className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold">URL de redirection à autoriser</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">
                Ajoute exactement cette URL dans OAuth2 &gt; Redirects, puis sauvegarde.
              </p>
              {redirectUri && <CodeBlock code={redirectUri} lang="redirect uri" />}
            </CardContent>
          </Card>
        </div>
      )}

      {section === 'bot' && (
        <div className="space-y-4">
          <div className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm', config?.botConfigured ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300' : 'border-amber-500/25 bg-amber-500/[0.07] text-amber-300')}>
            {config?.botConfigured ? <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" /> : <Info className="h-5 w-5 shrink-0 mt-0.5" />}
            <div>
              <p className="font-medium">{config?.botConfigured ? 'Bot configuré' : 'Bot non configuré'}</p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {config?.botConfigured
                  ? "Sur chaque serveur à partager, clique « Ajouter le bot » dans la liste des salons."
                  : "Discord refuse les invitations créées avec un simple compte : il faut un bot membre du serveur. Ajoute le token ci-dessous."}
              </p>
            </div>
          </div>

          <Card className="bg-card/60 border-white/8">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold">Token du bot</h3>
                <Badge variant="outline" className="ml-auto text-[10px] border-white/10 text-muted-foreground">Jamais renvoyé</Badge>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bot-token">Bot Token</Label>
                <Input
                  id="bot-token"
                  type="password"
                  placeholder={config?.botConfigured ? 'Déjà configuré — colle un nouveau token pour le remplacer' : 'Colle ton Bot Token ici'}
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="font-mono text-xs"
                  dir="ltr"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">
                  Portail développeur &gt; Application &gt; Bot &gt; Reset Token. Le token sert uniquement à lister les salons et créer les invitations.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={saveBot} disabled={savingBot || !botToken.trim()} className="gap-2">
                  {savingBot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Enregistrer le bot
                </Button>
                {config?.addBotUrl && (
                  <a href={config.addBotUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="gap-2 border-white/10 bg-white/[0.03] w-full sm:w-auto">
                      <ExternalLink className="h-4 w-4" /> Ajouter le bot à un serveur
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/8">
           <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">Comment ajouter le bot</h3>
              <ol className="space-y-2.5 text-xs text-muted-foreground">
                {[
                  "Portail développeur Discord → ton application → onglet Bot → Reset Token, puis colle le token ci-dessus.",
                  "Clique « Ajouter le bot à un serveur » : Discord te propose tes serveurs, choisis celui à partager et valide.",
                  "Dans l'onglet Serveurs, clique « Partager » : le bot liste les salons et crée l'invitation permanente.",
                ].map((text, i) => (
                  <li key={text} className="flex gap-2.5">
                    <span className="shrink-0 h-5 w-5 rounded-full bg-violet-500/20 text-violet-200 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="leading-relaxed">{text}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] p-3 flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Permissions demandées : <strong className="text-foreground">Voir les salons</strong> + <strong className="text-foreground">Créer une invitation</strong> (1025). Le bot n’envoie jamais de messages et ne lit aucun contenu.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {section === 'heartbeat' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/[0.06] p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-violet-500/15 border border-violet-400/25 flex items-center justify-center shrink-0">
              <Webhook className="h-4 w-4 text-violet-200" />
            </div>
            <div>
              <p className="text-sm font-semibold">Surveillance Discord du site</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Toutes les 5 minutes (réglable), LinkHub ping son endpoint <code className="font-mono">/api/health</code> puis envoie un embed dans ton salon Discord. Idéal pour être alerté avant tes utilisateurs.
              </p>
            </div>
          </div>
          <WebhookPanel config={config} onSaved={onSaved} />
        </div>
      )}

      {section === 'security' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
            </div>
            <div>
              <p className="text-sm font-semibold">Sécurité & conformité</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Vue d’ensemble des protections actives et journal des actions sensibles. Les secrets ne sont jamais exposés par l’API.
              </p>
            </div>
          </div>
          <SecurityPanel />
        </div>
      )}

      {section === 'guide' && (
        <div className="space-y-4">
          <Card className="bg-card/60 border-white/8">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold">Créer ton application Discord (4 étapes)</h3>
              </div>
              <ol className="space-y-3 text-xs text-muted-foreground">
                {[
                  ["Ouvre le portail développeur Discord", "puis clique sur New Application : donne-lui un nom (ex : LinkHub) et valide."],
                  ["Onglet OAuth2", "copie le Client ID, puis clique sur Reset Secret et copie le Client Secret."],
                  ["Toujours dans OAuth2, section Redirects", "ajoute exactement l'URL de redirection affichée dans l'onglet Application, puis sauvegarde."],
                  ["Colle le Client ID et le Client Secret", "dans l'onglet Application et enregistre. La connexion Discord apparaît sur la page d'accueil."],
                ].map(([title, text], i) => (
                  <li key={title} className="flex gap-2.5">
                    <span className="shrink-0 h-5 w-5 rounded-full bg-violet-500/20 text-violet-200 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="leading-relaxed"><strong className="text-foreground">{title}</strong> {text}</span>
                  </li>
                ))}
              </ol>
              {redirectUri && <div className="mt-4"><CodeBlock code={redirectUri} lang="redirect uri" /></div>}
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/8">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-2">Ce que le site demande à Discord</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {[
                  ['Profil public', "identifiant, pseudo, avatar : pour ta session et l'affichage du tableau de bord."],
                  ['Liste de tes serveurs', "pour ne montrer que ceux où tu es administrateur ou autorisé à créer une invitation."],
                  ['Bot sur les serveurs partagés', "pour lister les salons et créer l'invitation permanente, uniquement là où tu l'as ajouté."],
                ].map(([title, text]) => (
                  <li key={title} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong className="text-foreground">{title}</strong> : {text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground/70">
                Le site n'envoie jamais de messages, ne modifie rien et ne lit aucun contenu de tes serveurs.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/8">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-2">Variables d'environnement utiles</h3>
              <div className="space-y-2 text-xs">
                {[
                  ['APP_SECRET', 'Chaîne aléatoire : signe les sessions et chiffre le webhook.'],
                  ['STAFF_DISCORD_IDS', 'IDs Discord du staff, séparés par des virgules.'],
                  ['PUBLIC_BASE_URL', 'URL publique du site (sans slash final).'],
                  ['TURSO_DATABASE_URL / TURSO_AUTH_TOKEN', 'Base de données Turso.'],
                  ['DISCORD_API_BASE', 'Mode démo uniquement : ne pas définir en production.'],
                ].map(([key, text]) => (
                  <div key={key} className="flex flex-col sm:flex-row gap-1 sm:gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
                    <code className="font-mono text-[11px] text-violet-200 shrink-0">{key}</code>
                    <span className="text-muted-foreground leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {saved && (
        <p className="text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> Configuration enregistrée. Tu peux te connecter depuis la page d'accueil.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/6 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><Settings className="h-3 w-3" /> Les réglages sont réservés au staff.</span>
        <a href="/api/health" className="inline-flex items-center gap-1 hover:text-foreground">
          État de la plateforme <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
