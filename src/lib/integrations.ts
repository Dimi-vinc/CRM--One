// Integrations marketplace catalog. Each entry drives a card in Integrations.tsx.
//
// `logoSlug` refers to the Simple Icons brand-icon set (https://simpleicons.org, MIT-licensed,
// widely used across the industry specifically for "integrates with X" pages), served via
// https://cdn.simpleicons.org/{slug} — resolved in the END USER's browser at render time, not
// bundled into this repo. If a slug is wrong or a brand isn't in the set, the <img> fails to
// load and the UI falls back to a colored initials badge (see IntegrationLogo in
// Integrations.tsx) rather than a broken image icon.
//
// `authType: 'oauth'` entries need the platform operator to register an app with that provider
// (client ID/secret, set as Supabase secrets) before "Connect" goes live — same honest pattern
// already used for Stripe/PayUnit elsewhere in this codebase (shows "not configured" rather than
// faking a connection). `authType: 'api_key'` entries are fully functional today: the user pastes
// their own key, it's saved via the generic save-integration-key edge function.

export type IntegrationCategory =
  | 'ai' | 'accounting' | 'email' | 'payments' | 'communication' | 'messaging' | 'video'
  | 'scheduling' | 'crm_sync' | 'marketing' | 'sms_voice' | 'ecommerce' | 'automation'
  | 'support' | 'storage' | 'project';

export type PaymentSubcategory = 'card' | 'mobile_money' | 'bank_transfer';

export interface IntegrationDef {
  id: string;
  name: string;
  category: IntegrationCategory;
  authType: 'api_key' | 'oauth';
  docsUrl: string;
  logoSlug?: string;
  logoColor?: string; // hex without '#', overrides the brand default on cdn.simpleicons.org
  paymentSubcategories?: PaymentSubcategory[];
  description: string;
}

export const INTEGRATION_CATEGORIES: { id: IntegrationCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'ai', label: 'IA' },
  { id: 'accounting', label: 'Comptabilité' },
  { id: 'email', label: 'Email' },
  { id: 'payments', label: 'Paiements' },
  { id: 'communication', label: 'Communication' },
  { id: 'messaging', label: 'Messaging' },
  { id: 'video', label: 'Vidéo' },
  { id: 'scheduling', label: 'Scheduling' },
  { id: 'crm_sync', label: 'CRM sync' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'sms_voice', label: 'SMS/Voice' },
  { id: 'ecommerce', label: 'E-commerce' },
  { id: 'automation', label: 'Automatisation' },
  { id: 'support', label: 'Support client' },
  { id: 'storage', label: 'Stockage' },
  { id: 'project', label: 'Gestion de projet' },
];

export const PAYMENT_SUBCATEGORIES: { id: PaymentSubcategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'card', label: 'Cartes bancaires' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'bank_transfer', label: 'Virements' },
];

export const INTEGRATIONS: IntegrationDef[] = [
  // ---- IA ----
  { id: 'openai', name: 'OpenAI', category: 'ai', authType: 'api_key', docsUrl: 'https://platform.openai.com/docs', logoSlug: 'openai', description: 'GPT pour la génération de texte et l\'analyse.' },
  { id: 'anthropic', name: 'Anthropic (Claude)', category: 'ai', authType: 'api_key', docsUrl: 'https://docs.anthropic.com', logoSlug: 'anthropic', description: 'Modèles Claude pour vos automatisations IA.' },
  { id: 'google-gemini', name: 'Google Gemini', category: 'ai', authType: 'api_key', docsUrl: 'https://ai.google.dev/docs', logoSlug: 'googlegemini', description: 'Modèles Gemini de Google AI.' },

  // ---- LiAfrik (produits internes) ----
  { id: 'libooks', name: 'Libooks', category: 'accounting', authType: 'api_key', docsUrl: 'https://libooks.liafrik.com', logoColor: '0070E0', description: 'Comptabilité et facturation Libooks (LiAfrik).' },
  { id: 'sellia', name: 'Sellia', category: 'ecommerce', authType: 'api_key', docsUrl: 'https://sellia.liafrik.com', logoColor: 'E85C33', description: 'Boutique en ligne Sellia (LiAfrik).' },

  // ---- Email ----
  { id: 'gmail', name: 'Gmail', category: 'email', authType: 'oauth', docsUrl: 'https://developers.google.com/gmail/api', logoSlug: 'gmail', description: 'Envoyez et recevez des emails depuis votre compte Gmail.' },
  { id: 'outlook', name: 'Outlook', category: 'email', authType: 'oauth', docsUrl: 'https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview', logoSlug: 'microsoftoutlook', description: 'Envoyez et recevez des emails depuis Outlook / Microsoft 365.' },

  // ---- Paiements ----
  { id: 'stripe', name: 'Stripe', category: 'payments', authType: 'api_key', docsUrl: 'https://docs.stripe.com', logoSlug: 'stripe', paymentSubcategories: ['card'], description: 'Cartes bancaires internationales, Apple Pay, Google Pay.' },
  { id: 'flutterwave', name: 'Flutterwave', category: 'payments', authType: 'api_key', docsUrl: 'https://developer.flutterwave.com/docs', logoColor: 'F5A623', paymentSubcategories: ['card', 'mobile_money'], description: 'Cartes et Mobile Money pour l\'Afrique.' },
  { id: 'payunit', name: 'PayUnit', category: 'payments', authType: 'api_key', docsUrl: 'https://developer.payunit.net', logoColor: '0F172A', paymentSubcategories: ['card', 'mobile_money'], description: 'Orange Money, MTN MoMo et cartes — Afrique centrale.' },
  { id: 'paypal', name: 'PayPal', category: 'payments', authType: 'oauth', docsUrl: 'https://developer.paypal.com/docs', logoSlug: 'paypal', paymentSubcategories: ['card', 'bank_transfer'], description: 'Paiements PayPal internationaux.' },
  { id: 'adyen', name: 'Adyen', category: 'payments', authType: 'api_key', docsUrl: 'https://docs.adyen.com', logoSlug: 'adyen', paymentSubcategories: ['card'], description: 'Plateforme de paiement globale pour entreprises.' },
  { id: 'mollie', name: 'Mollie', category: 'payments', authType: 'api_key', docsUrl: 'https://docs.mollie.com', logoSlug: 'mollie', paymentSubcategories: ['card', 'bank_transfer'], description: 'Paiements simplifiés pour l\'Europe.' },
  { id: 'checkoutcom', name: 'Checkout.com', category: 'payments', authType: 'api_key', docsUrl: 'https://www.checkout.com/docs', logoSlug: 'checkoutcom', paymentSubcategories: ['card'], description: 'Paiements par carte pour entreprises internationales.' },
  { id: 'worldline', name: 'Worldline', category: 'payments', authType: 'api_key', docsUrl: 'https://worldline.com', paymentSubcategories: ['card'], description: 'Solutions de paiement européennes.' },
  { id: 'nexi', name: 'Nexi', category: 'payments', authType: 'api_key', docsUrl: 'https://www.nexi.it', paymentSubcategories: ['card'], description: 'Paiements par carte — Italie et Europe.' },
  { id: 'gocardless', name: 'GoCardless', category: 'payments', authType: 'oauth', docsUrl: 'https://developer.gocardless.com', logoSlug: 'gocardless', paymentSubcategories: ['bank_transfer'], description: 'Prélèvements bancaires automatiques récurrents.' },
  { id: 'vivawallet', name: 'Viva Wallet', category: 'payments', authType: 'api_key', docsUrl: 'https://developer.vivawallet.com', paymentSubcategories: ['card'], description: 'Paiements par carte — Europe.' },
  { id: 'revolut-business', name: 'Revolut Business', category: 'payments', authType: 'oauth', docsUrl: 'https://developer.revolut.com/docs/business', logoSlug: 'revolut', paymentSubcategories: ['bank_transfer', 'card'], description: 'Comptes et paiements professionnels Revolut.' },
  { id: 'paystack', name: 'Paystack', category: 'payments', authType: 'api_key', docsUrl: 'https://paystack.com/docs', paymentSubcategories: ['card', 'mobile_money'], description: 'Paiements en ligne — Nigeria, Ghana, Afrique du Sud.' },
  { id: 'mpesa', name: 'M-Pesa', category: 'payments', authType: 'api_key', docsUrl: 'https://developer.safaricom.co.ke', paymentSubcategories: ['mobile_money'], description: 'Mobile Money — Kenya et Afrique de l\'Est.' },
  { id: 'interswitch', name: 'Interswitch', category: 'payments', authType: 'api_key', docsUrl: 'https://docs.interswitchgroup.com', paymentSubcategories: ['card'], description: 'Paiements par carte — Nigeria et Afrique de l\'Ouest.' },
  { id: 'dpo-group', name: 'DPO Group', category: 'payments', authType: 'api_key', docsUrl: 'https://dpogroup.com', paymentSubcategories: ['card', 'mobile_money'], description: 'Paiements panafricains, cartes et Mobile Money.' },
  { id: 'cellulant', name: 'Cellulant', category: 'payments', authType: 'api_key', docsUrl: 'https://cellulant.io', paymentSubcategories: ['mobile_money'], description: 'Agrégateur Mobile Money panafricain.' },
  { id: 'fawry', name: 'Fawry', category: 'payments', authType: 'api_key', docsUrl: 'https://developer.fawrystaging.com', paymentSubcategories: ['card'], description: 'Paiements en ligne — Égypte.' },
  { id: 'payfast', name: 'PayFast', category: 'payments', authType: 'api_key', docsUrl: 'https://developers.payfast.co.za', paymentSubcategories: ['card'], description: 'Paiements en ligne — Afrique du Sud.' },
  { id: 'peach-payments', name: 'Peach Payments', category: 'payments', authType: 'api_key', docsUrl: 'https://developer.peachpayments.com', paymentSubcategories: ['card'], description: 'Paiements par carte — Afrique du Sud, Kenya.' },
  { id: 'campay', name: 'CamPay', category: 'payments', authType: 'api_key', docsUrl: 'https://campay.net', paymentSubcategories: ['mobile_money'], description: 'Mobile Money — Cameroun.' },
  { id: 'cinetpay', name: 'CinetPay', category: 'payments', authType: 'api_key', docsUrl: 'https://cinetpay.com', paymentSubcategories: ['card', 'mobile_money'], description: 'Paiements et Mobile Money — Afrique de l\'Ouest/Centrale.' },
  { id: 'kkiapay', name: 'Kkiapay', category: 'payments', authType: 'api_key', docsUrl: 'https://kkiapay.me', paymentSubcategories: ['card', 'mobile_money'], description: 'Paiements et Mobile Money — Bénin et zone UEMOA.' },
  { id: 'wave', name: 'Wave', category: 'payments', authType: 'api_key', docsUrl: 'https://docs.wave.com', paymentSubcategories: ['mobile_money'], description: 'Mobile Money — Sénégal, Côte d\'Ivoire.' },
  { id: 'orange-money', name: 'Orange Money API', category: 'payments', authType: 'api_key', docsUrl: 'https://developer.orange.com', logoSlug: 'orange', paymentSubcategories: ['mobile_money'], description: 'Mobile Money Orange — Afrique francophone.' },
  { id: 'mtn-momo', name: 'MTN MoMo API', category: 'payments', authType: 'api_key', docsUrl: 'https://momodeveloper.mtn.com', paymentSubcategories: ['mobile_money'], description: 'Mobile Money MTN — Afrique.' },
  { id: 'chapa', name: 'Chapa', category: 'payments', authType: 'api_key', docsUrl: 'https://developer.chapa.co', paymentSubcategories: ['card', 'mobile_money'], description: 'Paiements en ligne — Éthiopie.' },
  { id: 'semoa', name: 'Semoa', category: 'payments', authType: 'api_key', docsUrl: 'https://semoa.net', paymentSubcategories: ['mobile_money'], description: 'Agrégateur de paiement mobile — Afrique.' },
  { id: 'maxicash', name: 'MaxiCash', category: 'payments', authType: 'api_key', docsUrl: 'https://maxicashapp.com', paymentSubcategories: ['mobile_money'], description: 'Mobile Money — République Démocratique du Congo.' },

  // ---- Communication / Messaging ----
  { id: 'slack', name: 'Slack', category: 'communication', authType: 'oauth', docsUrl: 'https://api.slack.com', logoSlug: 'slack', description: 'Notifications et alertes CRM dans vos canaux Slack.' },
  { id: 'whatsapp', name: 'WhatsApp', category: 'messaging', authType: 'api_key', docsUrl: 'https://developers.facebook.com/docs/whatsapp', logoSlug: 'whatsapp', description: 'Messages WhatsApp Business vers vos contacts.' },
  { id: 'telegram', name: 'Telegram', category: 'messaging', authType: 'api_key', docsUrl: 'https://core.telegram.org/bots', logoSlug: 'telegram', description: 'Notifications et bots Telegram.' },
  { id: 'messenger', name: 'Facebook Messenger', category: 'messaging', authType: 'oauth', docsUrl: 'https://developers.facebook.com/docs/messenger-platform', logoSlug: 'messenger', description: 'Messagerie clients via Facebook Messenger.' },
  { id: 'instagram-dm', name: 'Instagram DM', category: 'messaging', authType: 'oauth', docsUrl: 'https://developers.facebook.com/docs/messenger-platform/instagram', logoSlug: 'instagram', description: 'Messages privés Instagram vers vos contacts.' },

  // ---- Vidéo ----
  { id: 'zoom', name: 'Zoom', category: 'video', authType: 'api_key', docsUrl: 'https://developers.zoom.us/docs', logoSlug: 'zoom', description: 'Créez et suivez vos réunions Zoom depuis le CRM.' },
  { id: 'google-meet', name: 'Google Meet', category: 'video', authType: 'oauth', docsUrl: 'https://developers.google.com/meet', logoSlug: 'googlemeet', description: 'Visioconférences Google Meet liées à vos rendez-vous.' },
  { id: 'microsoft-teams', name: 'Microsoft Teams', category: 'video', authType: 'oauth', docsUrl: 'https://learn.microsoft.com/en-us/graph/teams-concept-overview', logoSlug: 'microsoftteams', description: 'Réunions et notifications Microsoft Teams.' },

  // ---- Scheduling ----
  { id: 'calendly', name: 'Calendly', category: 'scheduling', authType: 'api_key', docsUrl: 'https://developer.calendly.com', logoSlug: 'calendly', description: 'Synchronisez vos prises de rendez-vous Calendly.' },
  { id: 'google-calendar', name: 'Google Calendar', category: 'scheduling', authType: 'oauth', docsUrl: 'https://developers.google.com/calendar', logoSlug: 'googlecalendar', description: 'Synchronisez vos tâches et rendez-vous CRM avec Google Agenda.' },

  // ---- SMS/Voice ----
  { id: 'twilio', name: 'Twilio', category: 'sms_voice', authType: 'api_key', docsUrl: 'https://www.twilio.com/docs', logoSlug: 'twilio', description: 'SMS et appels vocaux automatisés.' },
  { id: 'aircall', name: 'Aircall', category: 'sms_voice', authType: 'api_key', docsUrl: 'https://developer.aircall.io', logoSlug: 'aircall', description: 'Téléphonie cloud pour équipes commerciales.' },

  // ---- E-commerce ----
  { id: 'shopify', name: 'Shopify', category: 'ecommerce', authType: 'oauth', docsUrl: 'https://shopify.dev/docs', logoSlug: 'shopify', description: 'Synchronisez vos commandes et clients Shopify.' },
  { id: 'woocommerce', name: 'WooCommerce', category: 'ecommerce', authType: 'api_key', docsUrl: 'https://woocommerce.github.io/woocommerce-rest-api-docs', logoSlug: 'woocommerce', description: 'Synchronisez vos commandes WooCommerce (WordPress).' },
  { id: 'prestashop', name: 'PrestaShop', category: 'ecommerce', authType: 'api_key', docsUrl: 'https://devdocs.prestashop-project.org', logoSlug: 'prestashop', description: 'Synchronisez vos commandes PrestaShop.' },
  { id: 'bigcommerce', name: 'BigCommerce', category: 'ecommerce', authType: 'api_key', docsUrl: 'https://developer.bigcommerce.com/docs', logoSlug: 'bigcommerce', description: 'Synchronisez vos commandes et clients BigCommerce.' },

  // ---- Comptabilité ----
  { id: 'quickbooks', name: 'QuickBooks', category: 'accounting', authType: 'oauth', docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started', logoSlug: 'quickbooks', description: 'Synchronisez factures et paiements avec QuickBooks.' },
  { id: 'xero', name: 'Xero', category: 'accounting', authType: 'oauth', docsUrl: 'https://developer.xero.com/documentation', logoSlug: 'xero', description: 'Synchronisez votre comptabilité avec Xero.' },
  { id: 'sage', name: 'Sage', category: 'accounting', authType: 'api_key', docsUrl: 'https://developer.sage.com', logoSlug: 'sage', description: 'Synchronisez votre comptabilité avec Sage.' },

  // ---- Support client ----
  { id: 'zendesk', name: 'Zendesk', category: 'support', authType: 'oauth', docsUrl: 'https://developer.zendesk.com/documentation', logoSlug: 'zendesk', description: 'Synchronisez vos tickets support avec Zendesk.' },
  { id: 'intercom', name: 'Intercom', category: 'support', authType: 'oauth', docsUrl: 'https://developers.intercom.com', logoSlug: 'intercom', description: 'Synchronisez conversations et contacts Intercom.' },
  { id: 'freshdesk', name: 'Freshdesk', category: 'support', authType: 'api_key', docsUrl: 'https://developers.freshdesk.com', logoSlug: 'freshdesk', description: 'Synchronisez vos tickets support Freshdesk.' },

  // ---- Marketing ----
  { id: 'mailchimp', name: 'Mailchimp', category: 'marketing', authType: 'api_key', docsUrl: 'https://mailchimp.com/developer', logoSlug: 'mailchimp', description: 'Synchronisez vos listes et campagnes Mailchimp.' },
  { id: 'meta-ads', name: 'Meta Ads', category: 'marketing', authType: 'oauth', docsUrl: 'https://developers.facebook.com/docs/marketing-apis', logoSlug: 'meta', description: 'Suivez vos leads publicitaires Facebook/Instagram.' },
  { id: 'google-ads', name: 'Google Ads', category: 'marketing', authType: 'oauth', docsUrl: 'https://developers.google.com/google-ads/api/docs/start', logoSlug: 'googleads', description: 'Suivez vos leads publicitaires Google Ads.' },
  { id: 'linkedin-ads', name: 'LinkedIn Ads', category: 'marketing', authType: 'oauth', docsUrl: 'https://learn.microsoft.com/en-us/linkedin/marketing', logoSlug: 'linkedin', description: 'Suivez vos leads publicitaires LinkedIn.' },

  // ---- Automatisation ----
  { id: 'zapier', name: 'Zapier', category: 'automation', authType: 'api_key', docsUrl: 'https://zapier.com/developer', logoSlug: 'zapier', description: 'Connectez CRM-One à des milliers d\'apps via Zapier.' },
  { id: 'make', name: 'Make (Integromat)', category: 'automation', authType: 'api_key', docsUrl: 'https://developers.make.com', logoSlug: 'make', description: 'Automatisations visuelles avec Make.' },
  { id: 'n8n', name: 'n8n', category: 'automation', authType: 'api_key', docsUrl: 'https://docs.n8n.io', logoSlug: 'n8n', description: 'Automatisations open-source auto-hébergeables.' },
  { id: 'pipedream', name: 'Pipedream', category: 'automation', authType: 'api_key', docsUrl: 'https://pipedream.com/docs', logoSlug: 'pipedream', description: 'Workflows et automatisations pour développeurs.' },

  // ---- Stockage / Documents ----
  { id: 'google-drive', name: 'Google Drive', category: 'storage', authType: 'oauth', docsUrl: 'https://developers.google.com/drive', logoSlug: 'googledrive', description: 'Attachez et synchronisez vos fichiers Google Drive.' },
  { id: 'dropbox', name: 'Dropbox', category: 'storage', authType: 'oauth', docsUrl: 'https://www.dropbox.com/developers/documentation', logoSlug: 'dropbox', description: 'Attachez et synchronisez vos fichiers Dropbox.' },
  { id: 'docusign', name: 'DocuSign', category: 'storage', authType: 'oauth', docsUrl: 'https://developers.docusign.com', logoSlug: 'docusign', description: 'Envoyez vos devis/contrats en signature électronique.' },

  // ---- Gestion de projet ----
  { id: 'notion', name: 'Notion', category: 'project', authType: 'oauth', docsUrl: 'https://developers.notion.com', logoSlug: 'notion', description: 'Synchronisez notes et bases de données Notion.' },
  { id: 'asana', name: 'Asana', category: 'project', authType: 'oauth', docsUrl: 'https://developers.asana.com/docs', logoSlug: 'asana', description: 'Synchronisez tâches et projets Asana.' },
  { id: 'trello', name: 'Trello', category: 'project', authType: 'oauth', docsUrl: 'https://developer.atlassian.com/cloud/trello', logoSlug: 'trello', description: 'Synchronisez cartes et tableaux Trello.' },
];
