/**
 * Specification OpenAPI 3.1 de l'API publique v1.
 *
 * Le document est construit a la demande (l'URL de base depend de l'hote de la
 * requete), sans dependance externe : il peut etre importe dans Postman,
 * Insomnia ou tout generateur de client.
 */

export type OpenApiDocument = Record<string, unknown>

const GUILD_SCHEMA = {
  type: 'object',
  required: ['id', 'name', 'invite_url', 'invite_url_direct'],
  properties: {
    id: { type: 'string', description: 'Identifiant Discord (snowflake) du serveur.' },
    name: { type: 'string' },
    icon: { type: ['string', 'null'], description: "URL de l'icone, ou null." },
    invite_url: { type: 'string', description: "Lien d'invitation Discord (discord.gg)." },
    invite_url_direct: { type: 'string', description: 'Lien de redirection LinkHub, toujours a jour.' },
    members: { type: ['integer', 'null'], description: 'Membres approximatifs.' },
    online: { type: ['integer', 'null'], description: 'Membres en ligne approximatifs.' },
    uses: { type: 'integer', description: "Utilisations de l'invitation." },
    last_check: { type: ['string', 'null'], format: 'date-time' },
    last_check_latency_ms: { type: ['integer', 'null'] },
    last_check_status: { type: ['string', 'null'], enum: ['ok', 'refreshed', 'error', null] },
  },
} as const

const META_SCHEMA = {
  type: 'object',
  properties: {
    request_id: { type: 'string' },
    limit: { type: 'integer', description: 'Taille de page appliquee.' },
    has_more: { type: 'boolean', description: 'D autres serveurs sont disponibles.' },
    next_cursor: {
      type: ['string', 'null'],
      description: 'A passer en `?cursor=` pour obtenir la page suivante.',
    },
    rate_limit: { type: 'integer' },
    rate_remaining: { type: 'integer' },
    rate_reset: { type: 'integer', description: 'Horodatage Unix de reinitialisation.' },
  },
} as const

const ERROR_SCHEMA = {
  type: 'object',
  required: ['ok', 'error'],
  properties: {
    ok: { type: 'boolean', enum: [false] },
    error: { type: 'string' },
    message: { type: 'string' },
  },
} as const

function errorResponse(description: string) {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  }
}

/** Construit le document OpenAPI pour une URL de base donnee. */
export function buildOpenApiDocument(baseUrl: string): OpenApiDocument {
  const base = baseUrl.replace(/\/$/, '')

  return {
    openapi: '3.1.0',
    info: {
      title: 'LinkHub API',
      version: '1.0.0',
      description: [
        "API publique de LinkHub : liens d'invitation Discord toujours valides.",
        '',
        "Authentification par cle d'API (`X-API-Key` ou `?key=`), creee dans le",
        'tableau de bord. Les listes sont paginees par curseur.',
      ].join('\n'),
      license: { name: 'MIT' },
    },
    servers: [{ url: base, description: 'Instance LinkHub' }],
    tags: [
      { name: 'Serveurs', description: 'Liste des serveurs partages.' },
      { name: 'Redirection', description: 'Redirections vers le lien courant.' },
      { name: 'Badge', description: 'Badge SVG public.' },
    ],
    paths: {
      '/api/v1/guilds': {
        get: {
          tags: ['Serveurs'],
          summary: 'Lister les serveurs partages',
          description: 'Renvoie les serveurs du proprietaire de la cle, page par page.',
          security: [{ ApiKey: [] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
              description: 'Nombre de serveurs par page (50 par defaut, 200 au maximum).',
            },
            {
              name: 'cursor',
              in: 'query',
              schema: { type: 'string' },
              description: '`next_cursor` renvoye par la page precedente.',
            },
          ],
          responses: {
            '200': {
              description: 'Page de serveurs.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', enum: [true] },
                      count: { type: 'integer', description: 'Serveurs dans cette page.' },
                      total: { type: 'integer', description: 'Serveurs au total.' },
                      guilds: { type: 'array', items: { $ref: '#/components/schemas/Guild' } },
                      meta: { $ref: '#/components/schemas/Meta' },
                    },
                  },
                },
              },
              headers: {
                ETag: { schema: { type: 'string' }, description: 'A renvoyer via `If-None-Match`.' },
              },
            },
            '304': { description: 'Rien n a change depuis la version en cache.' },
            '401': errorResponse("Cle d'API absente ou invalide."),
            '429': errorResponse('Limite de debit atteinte.'),
          },
        },
      },
      '/api/v1/go/{discordId}': {
        get: {
          tags: ['Redirection'],
          summary: "Rediriger vers l'invitation courante",
          description:
            "Redirige (302) vers l'invitation courante du serveur, en la rafraichissant si besoin. Chaque appel alimente le compteur de clics (aucune donnee personnelle conservee).",
          parameters: [
            {
              name: 'discordId',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^[0-9]{17,20}$' },
            },
            {
              name: 'ref',
              in: 'query',
              schema: { type: 'string' },
              description: 'Jeton public (boutons HTML) au lieu de la cle secrete.',
            },
          ],
          responses: {
            '302': { description: 'Redirection vers `https://discord.gg/<code>`.', headers: {} },
            '401': errorResponse('Cle ou jeton public invalide.'),
            '404': errorResponse('Serveur inconnu ou non partage.'),
          },
        },
      },
      '/api/badge/{discordId}.svg': {
        get: {
          tags: ['Badge'],
          summary: 'Badge SVG « invitation verifiee »',
          description: 'Image publique, sans authentification, cacheable par un CDN.',
          parameters: [
            {
              name: 'discordId',
              in: 'path',
              required: true,
              schema: { type: 'string', pattern: '^[0-9]{17,20}\\.svg$' },
            },
          ],
          responses: {
            '200': {
              description: 'Badge SVG (etat de la verification et clics sur 7 jours).',
              content: { 'image/svg+xml': { schema: { type: 'string' } } },
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Cle d\'API LinkHub (peut aussi etre passee en `?key=`).',
        },
      },
      schemas: {
        Guild: GUILD_SCHEMA,
        Meta: META_SCHEMA,
        Error: ERROR_SCHEMA,
      },
    },
  }
}
