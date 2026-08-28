# Publier mcp-compteparticulier dans les annuaires

URL du serveur : `https://mcp-compteparticulier.ads-particulier-tn.workers.dev/mcp` (+ `/sse`).
Repo : https://github.com/waddou/mcp-compteparticulier

## État au 28 août 2026

| Annuaire | État | Détail |
|---|---|---|
| Dépôt GitHub | ✅ | Public, champ *Website* renseigné, 5 topics |
| Worker Cloudflare | ✅ | Déployé, protocole MCP vérifié en production |
| Registre officiel MCP | ✅ | `io.github.waddou/mcp-compteparticulier` 1.0.0, avec `websiteUrl` |
| awesome-mcp-servers | ⏳ | PR ouverte : punkpeye/awesome-mcp-servers#13099 |
| mcp.so | ⏳ | Soumission ouverte : chatmcp/mcpso#3809 |
| Glama | 🔸 | `glama.json` en place — **reste à finaliser la revendication sur glama.ai** |
| PulseMCP | 🔸 | Indexé automatiquement — **reste à revendiquer la fiche** |
| Smithery | 🔸 | **Reste à référencer comme serveur distant** |

Les trois dernières lignes demandent une authentification dans un navigateur et ne
peuvent pas être automatisées.

> Smithery, Glama et PulseMCP **lisent le registre officiel**. La publication qui y a
> été faite améliore donc mécaniquement leurs fiches, même avant revendication. Ce que
> la revendication apporte en plus, c'est la maîtrise du titre, de la description et
> des liens — au lieu d'une fiche issue d'un crawl anonyme.

## a) Dépôt GitHub

Créer le dépôt public, puis renseigner **deux** choses souvent oubliées :

- le champ **Website** du dépôt → `https://compteparticulier.com`
- les **topics** → `mcp`, `model-context-protocol`, `cloudflare-workers`, `llms-txt`, `france`

Les topics favorisent l'auto-découverte par Glama, mcp.so et PulseMCP. Le champ *Website* est ce
qui manquait sur `mcp-moncompte` : sans lui, les fiches d'annuaire ne portent aucun lien vers le
site, seulement vers le dépôt.

```bash
gh repo create waddou/mcp-compteparticulier --public --source=. --remote=origin --push \
  --description "Serveur MCP (lecture seule) du catalogue de guides de connexion de compteparticulier.com" \
  --homepage "https://compteparticulier.com"
gh repo edit waddou/mcp-compteparticulier \
  --add-topic mcp --add-topic model-context-protocol \
  --add-topic cloudflare-workers --add-topic llms-txt --add-topic france
```

## b) Déployer le Worker

```bash
npm install
npm run typecheck
npx wrangler login     # une seule fois
npm run deploy
```

Vérifier ensuite que `https://mcp-compteparticulier.ads-particulier-tn.workers.dev/` répond, puis tester le
protocole lui-même (handshake, `tools/list`, un appel réel) — un Worker qui sert sa page d'accueil
n'a pas pour autant une session MCP fonctionnelle.

## c) Registre officiel MCP (mcp-publisher)

Le `server.json` (à la racine) décrit le serveur. Le namespace `io.github.waddou/...` exige une
auth GitHub prouvant la possession du compte `waddou`.

```bash
# 1. Installer la CLI
brew install mcp-publisher
#   ou : binaire depuis https://github.com/modelcontextprotocol/registry/releases

# 2. Depuis la racine du repo (là où se trouve server.json)
cd mcp-compteparticulier

# 3. S'authentifier (ouvre le navigateur, une seule fois)
mcp-publisher login github

# 4. Publier
mcp-publisher publish
```

> **Le tout premier `publish` doit être fait manuellement**, pour valider la propriété du
> namespace. Ensuite, le workflow `.github/workflows/publish-registry.yml` republie
> automatiquement (OIDC, sans secret) à chaque push sur `main` modifiant `server.json` :
> il suffit donc de **bumper `version` puis de pousser**. Déclenchable aussi à la main
> (onglet Actions → *Publish to MCP Registry*).

## d) Smithery

- Fichier `smithery.yaml` fourni (HTTP, sans configuration requise).
- Le serveur étant **déjà hébergé** sur Cloudflare, l'ajouter sur **smithery.ai** en tant que
  **serveur distant** en pointant l'URL `…/mcp`. Le déploiement Smithery depuis le repo n'est
  pas nécessaire.

## e) Autres annuaires

- **Glama** (`glama.ai/mcp`), **mcp.so**, **PulseMCP** : souvent indexés depuis GitHub via les
  topics ; sinon, soumettre l'URL du repo.
- Voir `FICHE-SOUMISSION.md` pour les descriptions et métadonnées prêtes à coller — et penser
  systématiquement au champ « Site web » de chaque annuaire.
