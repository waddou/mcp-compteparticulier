# Publier mcp-compteparticulier dans les annuaires

URL du serveur : `https://mcp-compteparticulier.ads-particulier-tn.workers.dev/mcp` (+ `/sse`).
Repo : https://github.com/waddou/mcp-compteparticulier

## État au 28 août 2026 (vérifié au navigateur)

| Annuaire | État | Détail |
|---|---|---|
| Dépôt GitHub | ✅ | Public, champ *Website* renseigné, 5 topics |
| Worker Cloudflare | ✅ | Déployé, protocole MCP vérifié en production et depuis Claude Code |
| Registre officiel MCP | ✅ | `io.github.waddou/mcp-compteparticulier` 1.0.0, avec `websiteUrl` |
| **Glama** | ⏳ | Indexé comme *connector* ; `/.well-known/glama.json` publié avec l'adresse du compte, confirmée. **Plus rien à faire de notre côté** : la vérification est déclenchée par le robot de Glama |
| **PulseMCP** | ✅ | **Rien à faire.** Soumissions suspendues, et leur consigne est explicite : publier au registre officiel suffit, ils reprennent automatiquement |
| awesome-mcp-servers | ⏳ | PR ouverte : punkpeye/awesome-mcp-servers#13099 |
| mcp.so | ⏳ | Soumission ouverte : chatmcp/mcpso#3809 |
| **Smithery** | ❌ | **Absent** (404). La publication exige une connexion — c'est la seule démarche qui reste réellement à faire |

### Deux mises en garde tirées de l'expérience

**Ne jamais conclure d'un code HTTP sur ces annuaires.** Smithery est une application
monopage : elle renvoie **200 pour n'importe quelle route**, y compris inexistante, le
404 n'étant affiché que côté navigateur. Un `curl` avait donc conclu à tort que la fiche
existait. À l'inverse, l'URL Glama devinée par analogie (`/mcp/servers/waddou/…`)
répondait 404 alors que la fiche existait bel et bien sous `/mcp/connectors/io.github.waddou/…`.
Vérifier ces annuaires suppose un vrai navigateur.

**L'API Glama ne sert à rien pour revendiquer.** Sa référence complète n'expose que des
lectures — `GET /v1/servers`, `GET /v1/connectors`, `GET /v1/instances` — plus un unique
`POST /v1/telemetry/usage`. Aucun endpoint de revendication, de test de santé ni de
compte : `/test`, `/verify`, `/claim` et `/refresh` répondent tous 404 sur un connecteur.
La revendication passe exclusivement par le fichier `/.well-known`, que le robot vient
lire de lui-même. Une clé d'API permet en revanche de suivre l'état exact du connecteur,
les champs utiles (`attributes`, `healthy`, `toolCount`, `lastTestedAt`) n'étant pas
servis sans authentification.

**Deux objets Glama, deux mécanismes de revendication.** Un *server*, issu d'un crawl
GitHub, se revendique par un `glama.json` à la racine du dépôt — c'est ce qui est en
place. Un *connector*, issu du registre officiel, se revendique tout autrement : en
publiant un fichier `/.well-known/glama.json` **sur le domaine du serveur**, avec le
schéma `connector.json` et l'adresse d'un compte Glama. Le Worker sert désormais cette
route ; il ne reste qu'à relancer le flux de revendication sur la fiche.

**Ce qui distingue une fiche mûre d'une fiche neuve.** La comparaison avec
`mcp-moncompte` est instructive : cette dernière affiche un statut *Healthy*, une date
de dernier test, des catégories (*Documentation Access*, *Search*), un score de qualité
des outils (A, 4.1/5) et un lien vers son *Server Listing* issu du crawl GitHub. La
nôtre affiche *Not tested / Never* et n'a pas encore de listing serveur. Rien de tout
cela ne se force : ni l'inspecteur Glama — qui se connecte pourtant sans erreur et
introspecte les 2 outils et la ressource — ni la publication au registre ne déclenchent
le contrôle de santé. C'est un balayage périodique, et le dépôt n'a que quelques heures.

**La fiche Glama ne porte aucun lien vers compteparticulier.com.** La description le
mentionne en toute lettres, mais aucun lien cliquable ne pointe vers le site — seulement
vers le dépôt GitHub. C'est exactement le défaut relevé sur `mcp-moncompte`, et il
survit malgré le `websiteUrl` présent dans `server.json`. La revendication de la fiche
(bouton *Claim*, authentification GitHub, `glama.json` déjà en place) est le seul moyen
d'y remédier. Son statut affiche par ailleurs « Not tested ».

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
