'use client'

import {
  Code2,
  Globe,
  Info,
  KeyRound,
  Lock,
  Radio,
  ShieldCheck,
  Terminal,
  Webhook,
  Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from './code-block'
import type { ApiKeyItem, SharedGuild } from './types'

const SECTIONS = [
  ['intro', 'Introduction'],
  ['endpoints', 'Endpoints'],
  ['auth', 'Authentification'],
  ['rate', 'Rate limiting'],
  ['errors', 'Erreurs'],
  ['integrations', 'Intégrations'],
  ['webhook', 'Heartbeat'],
] as const

export function DocsView({
  baseUrl,
  keys,
  guilds,
}: {
  baseUrl: string
  keys: ApiKeyItem[]
  guilds: SharedGuild[]
}) {
  const sampleKey = keys[0]?.keyPrefix ?? 'dlh_••••••••'
  const sampleRef = keys[0]?.publicId ?? 'JETON_PUBLIC'
  const sampleGuild = guilds.find((g) => g.inviteUrl)?.discordId ?? 'ID_DU_SERVEUR'

  const curlExample = `curl -s "${baseUrl}/api/v1/guilds" \\
  -H "X-API-Key: ${sampleKey}"

# Réponse (extrait)
{
  "ok": true,
  "count": 1,
  "guilds": [
    {
      "id": "${sampleGuild}",
      "name": "Mon Super Serveur",
      "invite_url": "https://discord.gg/aBcD1234",
      "invite_url_direct": "${baseUrl}/api/v1/go/${sampleGuild}?ref=${sampleRef}",
      "members": 1234,
      "online": 87
    }
  ]
}`

  const htmlButton = `<!-- Bouton "Rejoindre le Discord" : redirection automatique, sans code serveur -->
<a href="${baseUrl}/api/v1/go/${sampleGuild}?ref=${sampleRef}">
  Rejoindre notre Discord
</a>`

  const jsExample = `// Récupérer le lien à jour en JavaScript
const res = await fetch("${baseUrl}/api/v1/guilds", {
  headers: { "X-API-Key": "dlh_ta_cle_api" }
});
const data = await res.json();

if (data.ok && data.count > 0) {
  window.open(data.guilds[0].invite_url, "_blank");
}`

  const phpExample = `<?php
// Redirection serveur vers l'invitation à jour
$context = stream_context_create([
  'http' => ['header' => "X-API-Key: dlh_ta_cle_api\\r\\n"]
]);
$response = file_get_contents('${baseUrl}/api/v1/guilds', false, $context);
$data = json_decode($response, true);

if (!empty($data['ok']) && $data['count'] > 0) {
  header('Location: ' . $data['guilds'][0]['invite_url']);
  exit;
}
http_response_code(503);
echo 'Invitation indisponible, réessaie plus tard.';`

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Documentation de l’API</h2>
            <Badge variant="outline" className="border-emerald-400/25 text-emerald-300 text-[10px] gap-1">
              <Radio className="h-3 w-3" /> v1
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            L’API publique renvoie toujours l’invitation <strong className="text-foreground">actuelle</strong> de tes
            serveurs partagés (celle que le vérificateur maintient toutes les 5 minutes). Réponses JSON, en GET.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-white/10 text-muted-foreground gap-1.5">
            <Lock className="h-3 w-3" /> Clé requise
          </Badge>
          <Badge variant="outline" className="border-white/10 text-muted-foreground gap-1.5">
            <Globe className="h-3 w-3" /> CORS activé
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-[180px_1fr] gap-6">
        {/* TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Sommaire</p>
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="block rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
              >
                {label}
              </a>
            ))}
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          {/* Intro */}
          <section id="intro" className="scroll-mt-24">
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icon: Globe, label: 'URL de base', value: baseUrl || '—' },
                { icon: KeyRound, label: 'Authentification', value: 'X-API-Key' },
                { icon: Zap, label: 'Limite', value: '120 req/min/clé' },
              ].map((item) => (
                <Card key={item.label} className="bg-card/50 border-white/8">
                  <CardContent className="p-3.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                      <item.icon className="h-3 w-3" /> {item.label}
                    </p>
                    <code className="text-xs font-mono break-all text-foreground/85">{item.value}</code>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Endpoints */}
          <section id="endpoints" className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-lg">Endpoints</h3>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/8 bg-card/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] border-emerald-400/30 text-emerald-300">GET</Badge>
                  <code className="font-mono text-sm">/api/v1/guilds</code>
                  <Badge variant="outline" className="ml-auto text-[10px] border-white/10 text-muted-foreground">Liste</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Liste tous tes serveurs partagés avec leur invitation à jour. Supporte <code className="font-mono">If-None-Match</code> (304) et expose les en-têtes de rate limit.
                </p>
                <div className="mt-3"><CodeBlock code={curlExample} lang="curl" /></div>
              </div>

              <div className="rounded-xl border border-white/8 bg-card/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] border-emerald-400/30 text-emerald-300">GET</Badge>
                  <code className="font-mono text-sm">/api/v1/guilds/&#123;discordId&#125;</code>
                  <Badge variant="outline" className="ml-auto text-[10px] border-white/10 text-muted-foreground">Détail</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Les informations d’un seul serveur. Renvoie 404 si le serveur n’est pas partagé par le propriétaire de la clé.
                </p>
              </div>

              <div className="rounded-xl border border-white/8 bg-card/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] border-emerald-400/30 text-emerald-300">GET</Badge>
                  <code className="font-mono text-sm">/api/v1/go/&#123;discordId&#125;</code>
                  <Badge variant="outline" className="ml-auto text-[10px] border-white/10 text-muted-foreground">Redirection 302</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Redirige directement vers l’invitation Discord actuelle. C’est le point d’entrée idéal pour un bouton HTML.
                  Utilise <code className="font-mono">?ref=&lt;jeton_public&gt;</code> (non secret) plutôt que la clé d’API.
                </p>
                <div className="mt-3"><CodeBlock code={htmlButton} lang="html" /></div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/8 bg-card/40 p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] border-emerald-400/30 text-emerald-300">GET</Badge>
                    <code className="font-mono text-xs">/api/ping</code>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Réponse légère pour moniteurs de disponibilité.</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-card/40 p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] border-emerald-400/30 text-emerald-300">GET</Badge>
                    <code className="font-mono text-xs">/api/health</code>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Diagnostic base + heartbeat + vérificateur.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Auth */}
          <section id="auth" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-lg">Authentification</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Passe ta clé dans le header <code className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">X-API-Key</code> ou
              dans le paramètre <code className="font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">?key=</code>. La clé complète
              n’est affichée qu’une seule fois, à sa création : seule une empreinte SHA-256 est stockée.
            </p>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-100/80 leading-relaxed">
                Pour un bouton HTML public, utilise le <strong className="text-amber-200">jeton public</strong> (<code className="font-mono">?ref=</code>) :
                il ne donne accès qu’à la redirection, jamais à la liste des serveurs.
              </p>
            </div>
          </section>

          {/* Rate limiting */}
          <section id="rate" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-lg">Rate limiting</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              {[
                ['120', 'requêtes / minute / clé'],
                ['300', 'requêtes / minute / IP'],
                ['X-RateLimit-Remaining', 'quota restant'],
                ['Retry-After', 'secondes avant retry (429)'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <code className="font-mono text-[11px] text-violet-200">{k}</code>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Errors */}
          <section id="errors" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-lg">Codes d’erreur</h3>
            </div>
            <div className="grid gap-2 text-xs">
              {[
                ['400', 'invalid_discord_id', 'Identifiant de serveur invalide'],
                ['401', 'missing_api_key / invalid_api_key', 'Clé absente ou inconnue'],
                ['401', 'invalid_public_ref', 'Jeton public invalide ou révoqué'],
                ['404', 'guild_not_found', 'Serveur non partagé par ce propriétaire'],
                ['429', 'rate_limited', 'Quota de requêtes dépassé'],
              ].map(([status, code, text]) => (
                <div key={code} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 rounded-lg border border-white/8 bg-card/40 px-3 py-2">
                  <code className="font-mono text-[11px] bg-black/30 px-2 py-0.5 rounded w-fit">{status}</code>
                  <code className="font-mono text-[11px] text-violet-200 w-fit">{code}</code>
                  <span className="text-muted-foreground">{text}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Integrations */}
          <section id="integrations" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-lg">Intégrations complètes</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">JavaScript (navigateur) :</p>
                <CodeBlock code={jsExample} lang="javascript" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">PHP (redirection serveur) :</p>
                <CodeBlock code={phpExample} lang="php" />
              </div>
            </div>
          </section>

          {/* Webhook */}
          <section id="webhook" className="scroll-mt-24 space-y-3">
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-violet-300" />
              <h3 className="font-semibold text-lg">Heartbeat Discord</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Le heartbeat est configuré dans les <strong className="text-foreground">Réglages → Heartbeat</strong> (staff).
              Toutes les 5 minutes par défaut, le site appelle <code className="font-mono">/api/health</code> puis envoie un
              embed au webhook Discord configuré. L’URL est chiffrée en AES-256-GCM et jamais exposée par l’API.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              {[
                ['1', 'Crée un webhook', 'Salon → Intégrations → Webhooks'],
                ['2', 'Colle l’URL', 'Réglages → Heartbeat'],
                ['3', 'Active et teste', 'Bouton « Pinger maintenant »'],
              ].map(([n, title, text]) => (
                <div key={n} className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  <span className="inline-flex h-5 w-5 rounded-full bg-violet-500/20 text-violet-200 text-[10px] font-bold items-center justify-center mb-2">{n}</span>
                  <p className="text-xs font-medium">{title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-cyan-300 shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              CORS est activé sur toute l’API publique : tes sites peuvent appeler ces endpoints directement
              depuis le navigateur. Le heartbeat et les réglages sont, eux, réservés au staff.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
