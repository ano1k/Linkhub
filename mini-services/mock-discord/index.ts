/**
 * Serveur mock Discord (TESTS UNIQUEMENT) simulant les endpoints utilises par LinkHub.
 * - POST /oauth2/token
 * - GET  /users/@me, /users/@me/guilds
 * - GET  /guilds/:id/channels
 * - POST /channels/:id/invites, GET /channels/:id/invites, GET /guilds/:id/invites
 * - GET  /invites/:code?with_counts=true
 * - GET  /oauth2/authorize -> redirige vers le callback de LinkHub avec un code d'autorisation
 * - POST /mock/revoke/:code -> simule la suppression manuelle d'une invitation (pour tester le rafraichissement)
 */

const PORT = 3030

type MockInvite = {
  code: string
  guild_id: string
  channel_id: string
  uses: number
  max_age: number
  inviter: string
}

const GUILDS = [
  { id: '900000000000000001', name: 'Serveur Test Admin', icon: null, owner: false, permissions: '8' },
  { id: '900000000000000002', name: 'Serveur Test Invite', icon: null, owner: false, permissions: '1' },
  { id: '900000000000000003', name: 'Serveur Sans Droits', icon: null, owner: false, permissions: '0' },
]

const CHANNELS: Record<string, Array<{ id: string; name: string; type: number; position: number }>> = {
  '900000000000000001': [
    { id: '810000000000000001', name: 'general', type: 0, position: 0 },
    { id: '810000000000000002', name: 'annonces', type: 5, position: 1 },
    { id: '810000000000000003', name: 'bot-commands', type: 0, position: 2 },
  ],
  '900000000000000002': [{ id: '820000000000000001', name: 'accueil', type: 0, position: 0 }],
}

const channelById = new Map<string, { id: string; name: string; type: number; position: number } & { guildId: string }>()
for (const [guildId, chans] of Object.entries(CHANNELS)) {
  for (const c of chans) channelById.set(c.id, { ...c, guildId })
}

const invites = new Map<string, MockInvite>()
let inviteCounter = 1000
let tokenCounter = 0
let authCodeCounter = 0

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method

  // Autorisation OAuth : renvoie directement le code vers le callback
  if (path === '/oauth2/authorize') {
    const redirectUri = url.searchParams.get('redirect_uri') || ''
    const state = url.searchParams.get('state') || ''
    const code = `mockAuthCode${++authCodeCounter}`
    const sep = redirectUri.includes('?') ? '&' : '?'
    return new Response(null, {
      status: 302,
      headers: { Location: `${redirectUri}${sep}code=${code}&state=${encodeURIComponent(state)}` },
    })
  }

  // Echange / rafraichissement de tokens
  if (path === '/oauth2/token' && method === 'POST') {
    return json({
      access_token: `at_${++tokenCounter}`,
      refresh_token: `rt_${tokenCounter}`,
      expires_in: 604800,
      scope: 'identify guilds guilds.invites_create',
    })
  }

  if (path === '/users/@me') {
    return json({
      id: '100000000000000001',
      username: 'testeur',
      global_name: 'Testeur',
      avatar: null,
      email: null,
    })
  }

  if (path === '/users/@me/guilds') {
    return json(GUILDS)
  }

  const channelsMatch = path.match(/^\/guilds\/(\d+)\/channels$/)
  if (channelsMatch) {
    return json(CHANNELS[channelsMatch[1]] || [])
  }

  const channelInvitesMatch = path.match(/^\/channels\/(\d+)\/invites$/)
  if (channelInvitesMatch && method === 'GET') {
    const list = [...invites.values()].filter((i) => i.channel_id === channelInvitesMatch[1])
    return json(
      list.map((i) => ({
        code: i.code,
        uses: i.uses,
        max_uses: 0,
        max_age: i.max_age,
        inviter: { id: i.inviter },
        channel: { id: i.channel_id, name: channelById.get(i.channel_id)?.name ?? 'inconnu' },
      })),
    )
  }

  const guildInvitesMatch = path.match(/^\/guilds\/(\d+)\/invites$/)
  if (guildInvitesMatch) {
    const list = [...invites.values()].filter((i) => i.guild_id === guildInvitesMatch[1])
    return json(
      list.map((i) => ({
        code: i.code,
        uses: i.uses,
        max_uses: 0,
        max_age: i.max_age,
        inviter: { id: i.inviter },
        channel: { id: i.channel_id, name: channelById.get(i.channel_id)?.name ?? 'inconnu' },
      })),
    )
  }

  // Creation d'invitation
  const createInviteMatch = path.match(/^\/channels\/(\d+)\/invites$/)
  if (createInviteMatch && method === 'POST') {
    const channelId = createInviteMatch[1]
    const channel = channelById.get(channelId)
    if (!channel) return json({ message: 'Unknown Channel' }, 404)
    const code = `mockInvite${++inviteCounter}`
    invites.set(code, {
      code,
      guild_id: channel.guildId,
      channel_id: channelId,
      uses: 0,
      max_age: 0,
      inviter: '100000000000000001',
    })
    return json({
      code,
      uses: 0,
      max_uses: 0,
      max_age: 0,
      inviter: { id: '100000000000000001' },
      channel: { id: channelId, name: channel.name },
    })
  }

  const inviteMetaMatch = path.match(/^\/invites\/([a-zA-Z0-9]+)$/)
  if (inviteMetaMatch) {
    const invite = invites.get(inviteMetaMatch[1])
    if (!invite) return json({ message: 'Unknown Invite' }, 404)
    return json({
      code: invite.code,
      approximate_member_count: 1234,
      approximate_presence_count: 56,
      expires_at: null,
    })
  }

  // Outil de test : supprimer une invitation (simule un modo qui la supprime)
  const revokeMatch = path.match(/^\/mock\/revoke\/([a-zA-Z0-9]+)$/)
  if (revokeMatch && method === 'POST') {
    const deleted = invites.delete(revokeMatch[1])
    return json({ ok: deleted })
  }

  // Outil de test : simuler l'utilisation de l'invitation
  const useMatch = path.match(/^\/mock\/use\/([a-zA-Z0-9]+)$/)
  if (useMatch && method === 'POST') {
    const invite = invites.get(useMatch[1])
    if (!invite) return json({ ok: false }, 404)
    invite.uses += 1
    return json({ ok: true, uses: invite.uses })
  }

  return json({ message: `Mock Discord : route inconnue ${method} ${path}` }, 404)
}

Bun.serve({ port: PORT, fetch: handler })
console.log(`[mock-discord] serveur de test sur http://localhost:${PORT}`)
