# Fiche de soumission — mcp-compteparticulier

À coller dans les annuaires MCP (registre officiel, Glama, mcp.so, Smithery, PulseMCP, Cline…).

> ⚠️ **Toujours renseigner le champ « Site web » / « Website » de l'annuaire avec
> `https://compteparticulier.com`.** Leçon tirée de la soumission de `mcp-moncompte` : les
> fiches déjà en ligne (registre officiel, Glama, PulseMCP) ne portaient **aucun lien** vers
> moncompte.org — uniquement vers le dépôt GitHub — parce que ni `server.json` ni le champ
> *homepage* du dépôt ne déclaraient l'URL du site. Une fiche sans ce champ ne rapporte rien
> au domaine. Ici, `server.json` déclare bien `websiteUrl` dès la première version, et le
> champ *homepage* du dépôt GitHub doit être renseigné à la création.

## Identité

| Champ | Valeur |
|-------|--------|
| **Nom** | mcp-compteparticulier |
| **Nom qualifié (registre)** | `io.github.waddou/mcp-compteparticulier` |
| **Version** | 1.0.0 |
| **Site web** | https://compteparticulier.com |
| **Repo** | https://github.com/waddou/mcp-compteparticulier |
| **Licence** | MIT |
| **Auteur** | waddou |
| **Catégories / tags** | france, banque, assurance, mutuelle, energie, telecom, administration, espace-client, connexion, support, web, read-only |

## Descriptions

**Courte (≤ 100 car.)**
> Guides de connexion aux espaces clients français de compteparticulier.com (MCP, lecture seule).

**Longue**
> Serveur MCP en lecture seule qui expose le catalogue de compteparticulier.com — des guides
> pas-à-pas pour se connecter aux espaces clients de marques et administrations françaises :
> banques, assurances, mutuelles, énergie, télécom, streaming, services publics, commerce.
> Les agents IA peuvent rechercher un guide par mots-clés, sur le titre, la marque, la
> description et le corps de l'article, puis en récupérer le contenu complet. La recherche
> est insensible aux accents et privilégie la marque exactement demandée. Aucune
> authentification, aucune donnée personnelle : la source est le site public
> (`/search-index.json` et `/llms.txt`), qui n'expose que des articles réellement publiés.

## Endpoints (serveur distant, sans authentification)

| Transport | URL |
|-----------|-----|
| Streamable HTTP | `https://mcp-compteparticulier.ads-particulier-tn.workers.dev/mcp` |
| SSE | `https://mcp-compteparticulier.ads-particulier-tn.workers.dev/sse` |

## Outils exposés

### `search_articles`
Recherche les guides par mots-clés (titre, marque, description **et corps**). Renvoie titre, slug, URL, description.
- `query` (string, requis) — mots-clés, ex. « se connecter EDF »
- `limit` (number, optionnel, 1-20, défaut 10) — nombre de résultats

### `get_article`
Renvoie le contenu complet d'un guide à partir de son slug (obtenu via `search_articles`).
- `slug` (string, requis) — ex. « mon-compte-edf »

## Ressource exposée

- `compteparticulier://about` — le fichier `llms.txt` de compteparticulier.com (présentation + catalogue).

## Exemples d'utilisation (prompts)

- « Comment me connecter à mon compte EDF ? » → `search_articles("EDF")` puis `get_article("mon-compte-edf")`
- « J'ai oublié le mot de passe de ma mutuelle, que faire ? »
- « Quel est le numéro du service client de la RATP ? »
- « Mon fournisseur d'énergie a été racheté, où se trouve mon espace client maintenant ? »

## Notes techniques

- Stack : Cloudflare Workers + Durable Objects + SDK MCP officiel + Zod.
- Lecture seule ; cache edge 1 h ; rate-limit 100 req/60 s par IP.
- N'expose que des articles **publiés** : l'index applique le même filtre de date que les pages
  du site, un guide programmé n'y figure donc pas et son slug est explicitement refusé.
- Recherche insensible aux accents, classement privilégiant la marque exactement demandée.

## Snippet de connexion (clients via mcp-remote)

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
