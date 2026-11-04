'use client'

import { Code2, Globe, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CodeBlock } from './code-block'
import type { ApiKeyItem, SharedGuild } from './types'

export function DocsView({
  baseUrl,
  keys,
  guilds,
}: {
  baseUrl: string
  keys: ApiKeyItem[]
  guilds: SharedGuild[]
}) {
  const sampleKey = keys[0]?.key ?? 'TA_CLE_API'
  const sampleGuild = guilds.find((g) => g.inviteUrl)?.discordId ?? 'ID_DU_SERVEUR'

  const curlExample = `curl -H "X-API-Key: ${sampleKey}" \\
  ${baseUrl}/api/v1/guilds`

  const jsonExample = `{
  "ok": true,
  "count": 1,
  "guilds": [
    {
      "id": "${sampleGuild}",
      "name": "Mon Super Serveur",
      "icon": "https://cdn.discordapp.com/icons/...png",
      "invite_url": "https://discord.gg/aBcD1234",
      "invite_url_direct": "${baseUrl}/api/v1/go/${sampleGuild}?key=${sampleKey}",
      "members": 1234,
      "online": 87,
      "last_check": "2026-01-01T12:00:00.000Z"
    }
  ]
}`

  const htmlButton = `<!-- Bouton "Rejoindre le Discord" en HTML pur : redirection automatique -->
<a href="${baseUrl}/api/v1/go/${sampleGuild}?key=${sampleKey}">
  Rejoindre notre Discord
</a>`

  const jsExample = `<!-- Récupérer le lien à jour en JavaScript -->
<button id="join-discord">Rejoindre notre Discord</button>

<script>
  document.getElementById('join-discord').addEventListener('click', async () => {
    const res = await fetch('${baseUrl}/api/v1/guilds', {
      headers: { 'X-API-Key': '${sampleKey}' }
    });
    const data = await res.json();
    if (data.ok && data.count > 0) {
      window.open(data.guilds[0].invite_url, '_blank');
    }
  });
</script>`

  const phpExample = `<?php
// Rediriger directement vers le lien d'invitation a jour
$context = stream_context_create([
  'http' => ['header' => "X-API-Key: ${sampleKey}\\r\\n"]
]);
$response = file_get_contents('${baseUrl}/api/v1/guilds', false, $context);
$data = json_decode($response, true);

if (!empty($data['ok']) && $data['count'] > 0) {
  header('Location: ' . $data['guilds'][0]['invite_url']);
  exit;
}
http_response_code(503);
echo 'Invitation indisponible, reessaie plus tard.';`

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Documentation de l&apos;API</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          L&apos;API publique renvoie toujours l&apos;invitation <strong>actuelle</strong> de tes serveurs
          partages (celle que le verificateur maintient toutes les 5 minutes). Toutes les reponses sont
          en JSON, en <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">GET</code>,
          et acceptent la cle via le header{' '}
          <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">X-API-Key</code> ou le
          parametre <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">?key=</code>.
        </p>
      </div>

      {/* Infos generales */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-card/60 border-border/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> URL de base
            </p>
            <code className="text-sm font-mono break-all">{baseUrl}</code>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> Authentification
            </p>
            <code className="text-sm font-mono break-all">X-API-Key: {sampleKey.slice(0, 12)}...</code>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-border/70">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> Limite de debit
            </p>
            <p className="text-sm">120 requetes / minute / cle</p>
          </CardContent>
        </Card>
      </div>

      {/* Endpoints */}
      <section className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">GET</Badge>
          <code className="font-mono text-sm sm:text-base">/api/v1/guilds</code>
        </h3>
        <p className="text-sm text-muted-foreground">
          Liste tous tes serveurs partages avec leur invitation a jour. Les snippets ci-dessous sont
          deja pre-remplis avec ta premiere cle et ton premier serveur partage.
        </p>
        <CodeBlock code={curlExample} lang="curl" />
        <p className="text-sm text-muted-foreground">Reponse :</p>
        <CodeBlock code={jsonExample} lang="json" />
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">GET</Badge>
          <code className="font-mono text-sm sm:text-base">/api/v1/guilds/{"{discordId}"}</code>
        </h3>
        <p className="text-sm text-muted-foreground">
          Les informations d&apos;un seul serveur. Renvoie 404 si le serveur n&apos;est pas partage par
          le proprietaire de la cle.
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">GET</Badge>
          <code className="font-mono text-sm sm:text-base">/api/v1/go/{"{discordId}"}</code>
        </h3>
        <p className="text-sm text-muted-foreground">
          Redirection 302 directe vers l&apos;invitation Discord actuelle. C&apos;est le point
          d&apos;entree ideal pour un simple bouton HTML, sans aucun code.
        </p>
        <CodeBlock code={htmlButton} lang="html" />
      </section>

      {/* Page de partage publique */}
      <section className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">PAGE</Badge>
          <code className="font-mono text-sm sm:text-base">/s/{"{discordId}"}</code>
        </h3>
        <p className="text-sm text-muted-foreground">
          Chaque serveur partage possede aussi une page publique sur ce site : icone, nom, compteurs
          de membres et gros bouton &laquo; Rejoindre le serveur &raquo;. Aucune cle, aucun code :
          parfait a coller dans une bio, un post ou un partenariat. Le lien est affiche dans
          l&apos;onglet Serveurs (bloc &laquo; Page publique &raquo; de chaque carte). Le bouton de
          la page passe par <code className="font-mono">/api/join/{"{discordId}"}</code>, une
          redirection 302 qui sert toujours l&apos;invitation valide du moment.
        </p>
      </section>

      {/* Integrations */}
      <section className="space-y-4">
        <h3 className="font-semibold text-lg">Integrations completes</h3>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Recuperer le lien a jour en JavaScript (utile pour afficher le nombre de membres, filtrer
            plusieurs serveurs, etc.) :
          </p>
          <CodeBlock code={jsExample} lang="html + javascript" />
          <p className="text-sm text-muted-foreground">
            Version PHP (redirection serveur, aucun JavaScript requis) :
          </p>
          <CodeBlock code={phpExample} lang="php" />
        </div>
      </section>

      {/* Erreurs */}
      <section className="space-y-3">
        <h3 className="font-semibold text-lg">Codes d&apos;erreur</h3>
        <div className="grid gap-2 text-sm">
          {[
            ['401', 'missing_api_key / invalid_api_key', 'Cle absente ou inconnue'],
            ['404', 'guild_not_found', "Serveur non partage par ce proprietaire"],
            ['429', 'rate_limited', 'Plus de 120 requetes dans la minute'],
          ].map(([status, code, text]) => (
            <div
              key={code}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2"
            >
              <code className="font-mono text-xs bg-black/30 px-2 py-0.5 rounded w-fit">{status}</code>
              <code className="font-mono text-xs text-primary w-fit">{code}</code>
              <span className="text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          CORS est active sur toute l&apos;API publique : tes sites peuvent appeler ces endpoints
          directement depuis le navigateur de tes visiteurs.
        </p>
      </section>
    </div>
  )
}
