/**
 * mcp-compteparticulier — Serveur MCP (Model Context Protocol) EN LECTURE SEULE
 * exposant le catalogue de guides de compteparticulier.com aux agents IA.
 *
 * Stack   : Cloudflare Workers + Durable Objects + SDK MCP officiel + Zod.
 * Source  : compteparticulier.com est un site STATIQUE (Astro / Cloudflare Pages)
 *           et n'expose aucune API. On lit donc deux ressources publiques,
 *           toutes deux générées au build :
 *             • /search-index.json → index plein texte (titre, slug, marque,
 *               description, CORPS et questions-réponses). Le même filtre de date
 *               que les pages y est appliqué : ni brouillon, ni article programmé.
 *             • /llms.txt          → catalogue lisible (ressource « about »).
 *           Aucun secret, aucune authentification, aucune donnée personnelle.
 * Endpoints : /sse (SSE) et /mcp (Streamable HTTP).
 * Rate-limit : 100 req / 60 s par IP (binding natif Workers).
 *
 * Outils    : search_articles (recherche mots-clés), get_article (contenu complet).
 * Ressource : compteparticulier://about (proxy du llms.txt).
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const SITE = "https://compteparticulier.com";
const CACHE_TTL = 3600; // 1 h de cache edge Cloudflare

interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  // Binding natif de rate-limiting (optionnel : le Worker fonctionne même sans).
  RATE_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> };
}

interface Article {
  slug: string;
  title: string;
  brand: string | null;
  category: string;
  url: string;
  description: string;
  publishedAt: string;
  text: string;
}

/**
 * Minuscules sans diacritiques.
 *
 * Indispensable ici : les marques et catégories françaises sont accentuées
 * (« Énergie », « Réglo Mobile », « Caisse d'Épargne ») alors qu'un agent — ou
 * l'utilisateur qu'il relaie — écrit rarement les accents dans une requête.
 */
function normaliser(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Récupère une ressource du site avec cache edge (1 h). */
async function siteFetch(path: string): Promise<Response> {
  return fetch(`${SITE}${path}`, { cf: { cacheTtl: CACHE_TTL, cacheEverything: true } });
}

/** Charge l'index de recherche (déjà filtré : ni brouillon, ni article programmé). */
async function loadIndex(): Promise<Article[]> {
  const res = await siteFetch("/search-index.json");
  if (!res.ok) throw new Error(`/search-index.json → HTTP ${res.status}`);
  return (await res.json()) as Article[];
}

/**
 * Durable Object MCP. La classe McpAgent (SDK Cloudflare « agents ») gère le
 * cycle de vie de la session MCP ; on déclare ici les outils et la ressource.
 */
export class CompteParticulierMCP extends McpAgent<Env> {
  server = new McpServer({ name: "mcp-compteparticulier", version: "1.0.0" });

  async init() {
    // --- Outil 1 : recherche par mots-clés ---
    this.server.tool(
      "search_articles",
      "Recherche des guides de connexion « mon compte / espace client » sur " +
        "compteparticulier.com par mots-clés (marques et administrations françaises : " +
        "banques, assurances, mutuelles, énergie, télécom, streaming, services publics, " +
        "commerce). Retourne une liste (titre, slug, URL, description). " +
        "Utiliser le slug avec get_article pour obtenir le contenu complet.",
      {
        query: z
          .string()
          .min(2)
          .describe("Mots-clés de recherche (ex. « se connecter EDF », « mot de passe oublié mutuelle »)."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Nombre de résultats (1-20, défaut 10)."),
      },
      async ({ query, limit }) => {
        const n = limit ?? 10;
        const index = await loadIndex();
        const requete = normaliser(query);
        const terms = requete.split(/\s+/).filter((t) => t.length > 1);
        if (terms.length === 0) {
          return { content: [{ type: "text", text: "Requête trop courte." }] };
        }
        const scored = index
          .map((a) => {
            const title = normaliser(a.title);
            const brand = normaliser(a.brand ?? "");
            const desc = normaliser(a.description);
            const body = normaliser(a.text);
            const meta = `${title} ${brand} ${desc}`;
            // Un terme est « présent » s'il figure dans les métadonnées OU le corps.
            const present = terms.filter((t) => meta.includes(t) || body.includes(t)).length;
            // Score pondéré : marque et titre priment, le corps ne fait qu'appoint.
            // Une requête est presque toujours un nom de marque — la faire remonter
            // sur une simple occurrence dans le corps d'un autre guide serait trompeur.
            let score = 0;
            for (const t of terms) {
              if (title.includes(t)) score += 5;
              if (brand.includes(t)) score += 4;
              if (desc.includes(t)) score += 2;
              if (body.includes(t)) score += 1;
              // Mot entier de la marque : « edf » vaut pour EDF, pas pour « edfxyz ».
              if (brand.split(/\s+/).includes(t)) score += 3;
            }
            // La marque exactement demandée passe devant ses déclinaisons. Sans cela,
            // « EDF » remontait EDF ENR aussi haut qu'EDF : les deux contiennent le
            // terme dans le titre et la marque, et l'ordre de l'index tranchait.
            if (brand === requete) score += 20;
            return { a, present, score };
          })
          .filter((s) => s.present === terms.length) // tous les termes présents quelque part
          .sort((x, y) => y.score - x.score)
          .slice(0, n)
          .map((s) => s.a);

        if (scored.length === 0) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Aucun guide trouvé pour « ${query} ». ` +
                  `Essayez avec le seul nom de la marque, l'orthographe exacte comptant ` +
                  `(ex. « BoursoBank » plutôt que « Boursorama »).`,
              },
            ],
          };
        }
        const lines = scored.map(
          (a) => `• ${a.title}\n  slug : ${a.slug}\n  url  : ${a.url}\n  ${a.description}`,
        );
        return {
          content: [
            { type: "text", text: `${scored.length} résultat(s) pour « ${query} » :\n\n${lines.join("\n\n")}` },
          ],
        };
      },
    );

    // --- Outil 2 : contenu complet d'un guide ---
    this.server.tool(
      "get_article",
      "Retourne le contenu complet d'un guide de compteparticulier.com à partir de son " +
        "slug (obtenu via search_articles).",
      {
        slug: z.string().min(1).describe("Slug du guide (ex. « mon-compte-edf »)."),
      },
      async ({ slug }) => {
        const clean = slug.replace(/^\/|\/$/g, "");
        const index = await loadIndex();
        const a = index.find((x) => x.slug === clean);
        if (!a) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Aucun guide publié avec le slug « ${clean} ». ` +
                  `Il peut ne pas exister, être un brouillon, ou être daté dans le futur ` +
                  `(programmé, donc pas encore en ligne). Utilisez search_articles pour ` +
                  `retrouver le slug exact.`,
              },
            ],
            isError: true,
          };
        }
        const head =
          `# ${a.title}\n${a.url}\n` +
          `Marque : ${a.brand ?? "—"}\nCatégorie : ${a.category}\nPublié : ${a.publishedAt}\n\n`;
        return { content: [{ type: "text", text: head + a.text }] };
      },
    );

    // --- Ressource : proxy du llms.txt ---
    this.server.resource(
      "about",
      "compteparticulier://about",
      {
        mimeType: "text/plain",
        description: "À propos de compteparticulier.com (proxy du llms.txt : catalogue des guides).",
      },
      async (uri) => {
        const res = await siteFetch("/llms.txt");
        const text = res.ok ? await res.text() : "llms.txt momentanément indisponible.";
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text }] };
      },
    );
  }
}

/** IP cliente, pour la clé de rate-limit. */
function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "anonymous"
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Rate-limit natif : 100 req / 60 s par IP (dégradé proprement si binding absent).
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: clientIp(request) });
      if (!success) {
        return new Response("Trop de requêtes. Réessayez dans une minute.", {
          status: 429,
          headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "60" },
        });
      }
    }

    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return CompteParticulierMCP.serveSSE("/sse").fetch(request, env, ctx);
    }
    if (url.pathname === "/mcp") {
      return CompteParticulierMCP.serve("/mcp").fetch(request, env, ctx);
    }
    if (url.pathname === "/") {
      return new Response(
        "mcp-compteparticulier — serveur MCP (lecture seule) du catalogue compteparticulier.com.\n\n" +
          "Guides de connexion aux espaces clients de marques et administrations françaises.\n\n" +
          "Endpoints :\n  /sse  — Server-Sent Events\n  /mcp  — Streamable HTTP\n\n" +
          "Outils : search_articles, get_article.\nRessource : compteparticulier://about.\n\n" +
          "Site : https://compteparticulier.com\n",
        { headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    return new Response("Not found", { status: 404 });
  },
};
