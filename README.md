# mcp-compteparticulier

Serveur **MCP (Model Context Protocol)** en **lecture seule** qui expose le catalogue de
[compteparticulier.com](https://compteparticulier.com) aux agents IA : des guides pas-à-pas
pour se connecter aux espaces clients de marques et administrations françaises — banques,
assurances, mutuelles, énergie, télécom, streaming, services publics, commerce.

## Endpoints

Le serveur est **déjà déployé**, sans authentification :

| Transport | URL |
|-----------|-----|
| Streamable HTTP | `https://mcp-compteparticulier.ads-particulier-tn.workers.dev/mcp` |
| SSE | `https://mcp-compteparticulier.ads-particulier-tn.workers.dev/sse` |

## Connexion depuis un client MCP

```json
{
  "mcpServers": {
    "compteparticulier": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp-compteparticulier.ads-particulier-tn.workers.dev/mcp"]
    }
  }
}
```

## Outils

### `search_articles`

Recherche les guides par mots-clés, sur le titre, la marque, la description **et le corps de
l'article**. Renvoie titre, slug, URL et description.

| Paramètre | Type | |
|---|---|---|
| `query` | string | requis — ex. « se connecter EDF » |
| `limit` | number | optionnel, 1-20, défaut 10 |

Le classement privilégie la marque exactement demandée, puis le titre, puis la description, le
corps ne servant que d'appoint. Sans cette pondération, une requête « EDF » remontait *EDF ENR*
au même rang qu'*EDF*. La recherche est insensible aux accents : « caisse epargne » trouve
« Caisse d'Épargne ».

### `get_article`

Renvoie le contenu complet d'un guide à partir de son slug, obtenu via `search_articles`.

| Paramètre | Type | |
|---|---|---|
| `slug` | string | requis — ex. « mon-compte-edf » |

## Ressource

`compteparticulier://about` — le `llms.txt` du site (présentation et catalogue).

## Fonctionnement

compteparticulier.com est un site **statique** (Astro / Cloudflare Pages) sans API. Le serveur
lit donc deux ressources publiques, toutes deux générées au build :

- `/search-index.json` — index plein texte : titre, slug, marque, catégorie, description, corps
  de l'article et questions-réponses ;
- `/llms.txt` — catalogue lisible, servi comme ressource « about ».

Ces deux fichiers appliquent le **même filtre de date que les pages du site**. Un article
programmé ou en brouillon en est absent, exactement comme sa page n'est pas générée : le serveur
ne peut donc pas exposer un contenu qui n'est pas publié, ni renvoyer une URL en 404.

Aucun secret, aucune authentification, aucune donnée personnelle n'entre en jeu.

## Développement

```bash
npm install
npm run typecheck   # tsc --noEmit
npm run dev         # wrangler dev
npm run deploy      # wrangler deploy
```

Les versions de dépendances sont **figées** et non exprimées en plages. `agents` requiert
`@cloudflare/workers-types` en version 4, tandis que les versions récentes de `wrangler` en
exigent la 5 : une plage `^` fait basculer l'installation dans ce conflit. Toute montée de
version doit donc être vérifiée sur l'ensemble de l'arbre.

## Stack

Cloudflare Workers + Durable Objects (session MCP) + SDK MCP officiel + Zod.
Cache edge d'une heure, rate-limit de 100 requêtes par minute et par IP.

## Licence

MIT
