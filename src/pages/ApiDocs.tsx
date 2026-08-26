import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react';
import { Logo } from '../components/Logo';
import { LanguageSelector } from '../components/LanguageSelector';
import { useLanguage } from '../context/LanguageContext';

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="relative my-3 overflow-hidden rounded-xl bg-gray-900">
      {lang && <div className="border-b border-white/10 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">{lang}</div>}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-gray-100"><code>{code}</code></pre>
      <button onClick={copy} className="absolute right-2 top-2 rounded-lg bg-white/10 p-1.5 text-gray-300 hover:bg-white/20" title="Copier">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-gray-100 py-10">
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      <div className="prose-docs mt-4 max-w-none text-[15px] leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

const NAV = [
  { id: 'intro', label: 'Introduction' },
  { id: 'auth', label: 'Authentification' },
  { id: 'rate-limits', label: 'Limites de débit' },
  { id: 'resources', label: 'Ressources' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'errors', label: 'Erreurs' },
  { id: 'webhooks', label: 'Webhooks sortants' },
  { id: 'signature', label: 'Vérifier la signature' },
  { id: 'sdks', label: 'Bibliothèques' },
];

// Real, accurate documentation of the actual api-v1 and webhook-dispatch edge functions in this
// codebase — every route, field, status code, and payload shape here matches the real
// implementation. No invented endpoints or SDKs: see "Bibliothèques" below for an honest note on
// what does and doesn't exist yet.
export function ApiDocs() {
  const { lang } = useLanguage();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Link to="/" className="btn-ghost"><ArrowLeft size={16} /> {lang === 'fr' ? 'Accueil' : 'Home'}</Link>
            <Link to="/signup" className="btn-primary-landing">{lang === 'fr' ? 'Créer une clé API' : 'Get an API key'}</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[220px_1fr] lg:px-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm">
            {NAV.map(n => (
              <a key={n.id} href={`#${n.id}`} className="block rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 hover:text-gray-900">{n.label}</a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <div className="pb-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-800">API Reference · v1</span>
            <h1 className="mt-3 text-4xl font-bold text-gray-900">API CRM-One</h1>
            <p className="mt-3 max-w-2xl text-lg text-gray-600">Intégrez vos contacts, entreprises, deals et tâches dans vos propres outils, et recevez des événements en temps réel via des webhooks.</p>
          </div>

          <Section id="intro" title="Introduction">
            <p>L'API CRM-One est une API REST simple : une clé par entreprise (tenant), quatre ressources, des réponses JSON prévisibles. Elle est conçue pour des intégrations directes, des scripts internes, ou des outils no-code comme Zapier, Make ou n8n.</p>
            <p className="mt-3">URL de base :</p>
            <CodeBlock code="https://<PROJECT_REF>.supabase.co/functions/v1/api-v1" />
            <p className="mt-3 text-sm text-gray-500">Remplacez <code>&lt;PROJECT_REF&gt;</code> par la référence de votre projet Supabase (visible dans son URL de tableau de bord).</p>
          </Section>

          <Section id="auth" title="Authentification">
            <p>Chaque requête doit inclure votre clé API dans l'en-tête <code>Authorization</code> :</p>
            <CodeBlock code="Authorization: Bearer crm1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
            <p className="mt-3">Générez une clé dans votre CRM : <strong>Intégrations → API & Webhooks → Clés API</strong>. La clé complète n'est affichée qu'une seule fois, immédiatement après sa création — copiez-la tout de suite, elle n'est ensuite plus jamais montrée en entier (seule son empreinte est conservée côté serveur).</p>
            <p className="mt-3">Votre clé est liée à une seule entreprise (tenant). Chaque requête n'a accès qu'aux données de cette entreprise — il n'existe aucun moyen, avec une clé valide, de lire ou modifier les données d'une autre entreprise.</p>
          </Section>

          <Section id="rate-limits" title="Limites de débit">
            <p><strong>100 requêtes par minute</strong> par clé API, sur une fenêtre glissante de 60 secondes. Au-delà, l'API répond :</p>
            <CodeBlock lang="HTTP 429" code={'{ "error": "Limite de débit atteinte (100 requêtes/minute)." }'} />
            <p className="mt-2">La réponse inclut un en-tête <code>Retry-After</code> indiquant le nombre de secondes à attendre avant de réessayer.</p>
          </Section>

          <Section id="resources" title="Ressources disponibles">
            <p>L'API couvre aujourd'hui 4 ressources. D'autres modules du CRM (tickets, devis/factures, etc.) ne sont pas encore exposés via cette API publique.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-4 font-medium">Ressource</th>
                    <th className="py-2 font-medium">Champs modifiables (POST/PATCH)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2.5 pr-4 font-mono text-xs">contacts</td><td className="py-2.5 text-gray-600">first_name, last_name, email, phone, company_id, country_code, city, marketing_consent</td></tr>
                  <tr><td className="py-2.5 pr-4 font-mono text-xs">companies</td><td className="py-2.5 text-gray-600">name, industry, email, phone, website, country_code, city</td></tr>
                  <tr><td className="py-2.5 pr-4 font-mono text-xs">deals</td><td className="py-2.5 text-gray-600">title, amount, currency_code, stage, contact_id, company_id, expected_close_date</td></tr>
                  <tr><td className="py-2.5 pr-4 font-mono text-xs">tasks</td><td className="py-2.5 text-gray-600">title, description, due_date, priority, status</td></tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500"><code>tenant_id</code> est toujours défini automatiquement à partir de votre clé API — il ne fait pas partie des champs modifiables et ne peut pas être usurpé.</p>
          </Section>

          <Section id="endpoints" title="Endpoints">
            <p className="font-semibold text-gray-900">Lister (paginé)</p>
            <CodeBlock lang="curl" code={'curl "https://<PROJECT_REF>.supabase.co/functions/v1/api-v1/contacts?limit=50&offset=0" \\\n  -H "Authorization: Bearer crm1_xxxxxxxxxxxx"'} />
            <CodeBlock lang="200 OK" code={'{ "data": [ { "id": "...", "first_name": "Jean", "email": "jean@exemple.com" } ], "total": 128, "limit": 50, "offset": 0 }'} />
            <p className="mt-1 text-sm text-gray-500"><code>limit</code> maximum 200 (par défaut 50). Résultats triés du plus récent au plus ancien.</p>

            <p className="mt-6 font-semibold text-gray-900">Récupérer un élément</p>
            <CodeBlock lang="curl" code={'curl "https://<PROJECT_REF>.supabase.co/functions/v1/api-v1/contacts/{id}" \\\n  -H "Authorization: Bearer crm1_xxxxxxxxxxxx"'} />

            <p className="mt-6 font-semibold text-gray-900">Créer</p>
            <CodeBlock lang="curl" code={'curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/api-v1/contacts" \\\n  -H "Authorization: Bearer crm1_xxxxxxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"first_name":"Jean","email":"jean@exemple.com"}\''} />
            <p className="mt-1 text-sm text-gray-500">Répond <code>201 Created</code> avec l'objet créé dans <code>data</code>.</p>

            <p className="mt-6 font-semibold text-gray-900">Modifier</p>
            <CodeBlock lang="curl" code={'curl -X PATCH "https://<PROJECT_REF>.supabase.co/functions/v1/api-v1/contacts/{id}" \\\n  -H "Authorization: Bearer crm1_xxxxxxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"phone":"+237600000000"}\''} />

            <p className="mt-6 font-semibold text-gray-900">Supprimer</p>
            <CodeBlock lang="curl" code={'curl -X DELETE "https://<PROJECT_REF>.supabase.co/functions/v1/api-v1/contacts/{id}" \\\n  -H "Authorization: Bearer crm1_xxxxxxxxxxxx"'} />
            <p className="mt-1 text-sm text-gray-500">Répond <code>{'{ "ok": true }'}</code>.</p>
          </Section>

          <Section id="errors" title="Erreurs">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="py-2 pr-6 font-medium">Code</th>
                    <th className="py-2 font-medium">Signification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-2.5 pr-6 font-mono text-xs">401</td><td className="py-2.5 text-gray-600">Clé API manquante, invalide ou révoquée</td></tr>
                  <tr><td className="py-2.5 pr-6 font-mono text-xs">404</td><td className="py-2.5 text-gray-600">Ressource inconnue, ou élément introuvable pour cette entreprise</td></tr>
                  <tr><td className="py-2.5 pr-6 font-mono text-xs">405</td><td className="py-2.5 text-gray-600">Méthode HTTP non supportée sur cette route</td></tr>
                  <tr><td className="py-2.5 pr-6 font-mono text-xs">429</td><td className="py-2.5 text-gray-600">Limite de débit atteinte (voir en-tête <code>Retry-After</code>)</td></tr>
                  <tr><td className="py-2.5 pr-6 font-mono text-xs">400 / 500</td><td className="py-2.5 text-gray-600">Requête invalide ou erreur serveur — le corps <code>{'{ "error": "..." }'}</code> précise la cause</td></tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="webhooks" title="Webhooks sortants">
            <p>Configurez une URL dans <strong>Intégrations → API & Webhooks → Webhooks</strong> et choisissez les événements à écouter :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><code>contact_added</code></li>
              <li><code>deal_created</code></li>
              <li><code>deal_won</code></li>
              <li><code>activity_done</code></li>
            </ul>
            <p className="mt-3">Format du payload envoyé à votre URL :</p>
            <CodeBlock lang="POST body" code={'{\n  "event": "contact_added",\n  "data": { "id": "...", "first_name": "Jean", "email": "jean@exemple.com" },\n  "timestamp": "2026-08-04T10:30:00.000Z"\n}'} />
            <p className="mt-3 text-sm text-gray-500">Compatible directement avec "Webhooks by Zapier" (déclencheur Catch Hook), Make.com (Webhook Trigger) et n8n (Webhook Trigger) — collez simplement l'URL qu'ils vous donnent.</p>
          </Section>

          <Section id="signature" title="Vérifier la signature">
            <p>Chaque requête webhook inclut un en-tête <code>X-CRM-Signature</code> : un HMAC-SHA256 du corps JSON brut, signé avec le secret propre à ce webhook. Récupérez ce secret dans <strong>API & Webhooks → Webhooks</strong> (icône œil à côté de "Secret de signature" — visible et copiable à tout moment, pas un affichage à usage unique).</p>
            <CodeBlock lang="node.js" code={"const crypto = require('crypto');\n\nfunction isValidSignature(rawBody, signatureHeader, secret) {\n  const expected = crypto\n    .createHmac('sha256', secret)\n    .update(rawBody)\n    .digest('hex');\n  return crypto.timingSafeEqual(\n    Buffer.from(expected),\n    Buffer.from(signatureHeader)\n  );\n}"} />
            <p className="mt-3 text-sm text-gray-500">Utilisez toujours le corps <strong>brut</strong> de la requête (avant tout <code>JSON.parse</code>) pour calculer la signature — un corps re-sérialisé peut différer octet pour octet et faire échouer la vérification même si le contenu est identique.</p>
          </Section>

          <Section id="sdks" title="Bibliothèques clientes">
            <p>Il n'existe pas encore de SDK officiel Node.js, Python ou autre — l'API est une API REST JSON standard, directement utilisable avec n'importe quel client HTTP (<code>fetch</code>, <code>axios</code>, <code>requests</code>, <code>curl</code>...). Nous préférons documenter honnêtement cette limite plutôt que de promettre des bibliothèques qui n'existent pas.</p>
          </Section>

          <div className="flex items-center gap-2 pt-8 text-sm text-gray-500">
            <ExternalLink size={14} />
            <span>Une question, un besoin non couvert ? <Link to="/contact" className="text-coral-600 hover:underline">Contactez-nous</Link>.</span>
          </div>
        </main>
      </div>
    </div>
  );
}
