'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, FlaskConical, Info, Loader2, Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { CodeBlock } from './code-block'
import type { AppConfigInfo } from './types'

export function SettingsView({
  config,
  onSaved,
}: {
  config: AppConfigInfo | null
  onSaved: () => void
}) {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
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
        body: JSON.stringify({ clientId, clientSecret }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Erreur inconnue')
      setSaved(true)
      toast({
        title: 'Configuration enregistree',
        description: 'La connexion Discord est maintenant activee.',
      })
      onSaved()
    } catch (e) {
      toast({
        title: 'Echec',
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const redirectUri = config?.redirectUri ?? ''

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Reglages</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Le site communique avec Discord via une application que TU crees (gratuite, 2 minutes).
          Tu gardes ainsi le controle total : c&apos;est ton application, tes donnees.
        </p>
      </div>

      {/* Mode demo : Discord simule */}
      {config?.mockMode && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-300 flex items-start gap-3">
          <FlaskConical className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="font-medium text-sky-200">Mode demo actif — Discord simule</p>
            <p className="text-sky-200/80 leading-relaxed">
              La connexion, les serveurs, les invitations et le refresh des 5 minutes
              fonctionnent avec un <strong className="text-sky-100">Discord de test</strong> integre
              au site : tout est essayable sans compte reel. Les serveurs affiches
              (&laquo; Serveur Test Admin &raquo;, etc.) sont fictifs.
            </p>
            <p className="text-sky-200/60 text-xs leading-relaxed">
              Pour connecter le VRAI Discord : supprime la ligne{' '}
              <code className="font-mono bg-black/30 px-1 py-0.5 rounded">DISCORD_API_BASE</code> du
              fichier <code className="font-mono bg-black/30 px-1 py-0.5 rounded">.env</code>,
              redemarre le serveur, puis renseigne ci-dessous les identifiants de ton application
              Discord (guide juste apres).
            </p>
          </div>
        </div>
      )}

      {/* Statut */}
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${
          config?.discordConfigured
            ? 'border-green-500/30 bg-green-500/10 text-green-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        }`}
      >
        {config?.discordConfigured ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
        ) : (
          <Info className="h-5 w-5 shrink-0 mt-0.5" />
        )}
        <div>
          {config?.discordConfigured ? (
            <>
              <p className="font-medium">Application Discord configuree</p>
              <p className="text-muted-foreground mt-0.5">
                La connexion et le suivi des invitations sont operationnels.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Configuration requise</p>
              <p className="text-muted-foreground mt-0.5">
                Suis les 4 etapes ci-dessous puis renseigne tes identifiants ici pour activer la
                connexion Discord.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Formulaire */}
      <Card className="bg-card/70 border-border/70">
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="client-id">Client ID de ton application Discord</Label>
            <Input
              id="client-id"
              placeholder="1234567890123456789"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="font-mono"
              dir="ltr"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-secret">Client Secret</Label>
            <Input
              id="client-secret"
              type="password"
              placeholder="Colle ton Client Secret ici"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              className="font-mono"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              Il est stocke uniquement dans la base de donnees de ce site et sert uniquement aux
              connexions OAuth de la plateforme.
            </p>
          </div>
          <Button onClick={save} disabled={saving || !clientId || !clientSecret} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>

      {/* Guide */}
      <section className="space-y-4">
        <h3 className="font-semibold text-lg">Creer ton application Discord (4 etapes)</h3>
        <ol className="space-y-3 text-sm text-muted-foreground list-none">
          <li className="flex gap-3">
            <span className="shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
              1
            </span>
            <span>
              Ouvre le{' '}
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2 inline-flex items-center gap-1"
              >
                portail developpeur Discord
                <ExternalLink className="h-3 w-3" />
              </a>{' '}
              puis clique sur <strong className="text-foreground">New Application</strong> : donne-lui
              un nom (ex : &laquo; LinkHub &raquo;) et valide.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
              2
            </span>
            <span>
              Dans l&apos;onglet <strong className="text-foreground">OAuth2</strong> : copie le{' '}
              <strong className="text-foreground">Client ID</strong>. Puis clique sur{' '}
              <strong className="text-foreground">Reset Secret</strong> et copie le{' '}
              <strong className="text-foreground">Client Secret</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
              3
            </span>
            <span>
              Toujours dans OAuth2, section <strong className="text-foreground">Redirects</strong> : ajoute
              exactement l&apos;URL ci-dessous (elle est propre a ce site), puis sauvegarde.
            </span>
          </li>
        </ol>
        {redirectUri && <CodeBlock code={redirectUri} lang="redirect uri" />}
        <ol className="space-y-3 text-sm text-muted-foreground list-none">
          <li className="flex gap-3">
            <span className="shrink-0 h-6 w-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
              4
            </span>
            <span>
              Colle le Client ID et le Client Secret dans le formulaire ci-dessus et enregistre.
              C&apos;est tout : la connexion Discord apparaitra sur la page d&apos;accueil.
            </span>
          </li>
        </ol>
      </section>

      {/* Permissions */}
      <section className="rounded-xl border border-border/70 bg-card/50 p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4.5 w-4.5 text-primary" />
          Ce que le site demande a Discord
        </h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Profil public</strong> (identifiant, pseudo, avatar) :
              pour ta session et l&apos;affichage du tableau de bord.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Liste de tes serveurs</strong> : pour ne montrer que
              ceux ou tu es administrateur (ou ou tu as le droit de creer une invitation).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <span>
              <strong className="text-foreground">Creation d&apos;invitations</strong> : uniquement sur
              les serveurs que tu decides de partager, pour generer et maintenir l&apos;invitation
              permanente.
            </span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground/80 pt-1">
          Le site n&apos;envoie jamais de messages, ne modifie rien et ne lit aucun contenu de tes
          serveurs.
        </p>
      </section>

      {saved && (
        <p className="text-sm text-green-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Configuration enregistree. Tu peux te connecter depuis la page d&apos;accueil.
        </p>
      )}
    </div>
  )
}
