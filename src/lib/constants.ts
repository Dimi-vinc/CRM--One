// Platform-wide constants: brand, modules, plans, African countries, currencies, mobile money.

export const PLATFORM_NAME = 'LiAfrik One';
export const PLATFORM_VENDOR = 'LIYHA GROUP';
export const PLATFORM_TAGLINE = 'Le CRM SaaS pensé pour conquérir le marché africain.';

// Super Admin email whitelist — only these emails can access the Super Admin module
export const SUPER_ADMIN_EMAILS = [
  'vincentnogue2@gmail.com',
  'vincentnogue@yahoo.com',
  'webdxb1@gmail.com',
];

export type ModuleKey =
  | 'dashboard' | 'pipeline' | 'contacts' | 'companies' | 'activities'
  | 'tasks' | 'calendar' | 'forecast' | 'reports' | 'import_export'
  | 'billing' | 'notifications' | 'security' | 'documents' | 'automations'
  | 'tickets' | 'quotes_invoices' | 'campaigns' | 'knowledge_base' | 'privacy' | 'territories'
  | 'super_admin' | 'admin';

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  icon: string; // lucide icon name
  minPlan?: 'starter' | 'pro' | 'premium' | 'entreprise';
  group: 'crm' | 'insights' | 'system' | 'admin';
}

export const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', group: 'crm' },
  { key: 'pipeline', label: 'Pipeline', icon: 'KanbanSquare', group: 'crm' },
  { key: 'contacts', label: 'Contacts', icon: 'Users', group: 'crm' },
  { key: 'companies', label: 'Companies', icon: 'Building2', group: 'crm' },
  { key: 'activities', label: 'Activités', icon: 'Activity', minPlan: 'pro', group: 'crm' },
  { key: 'tasks', label: 'Tâches', icon: 'CheckSquare', group: 'crm' },
  { key: 'calendar', label: 'Calendrier', icon: 'Calendar', group: 'crm' },
  { key: 'forecast', label: 'Forecast', icon: 'TrendingUp', minPlan: 'pro', group: 'insights' },
  { key: 'reports', label: 'Rapports', icon: 'BarChart3', minPlan: 'pro', group: 'insights' },
  { key: 'import_export', label: 'Import/Export', icon: 'ArrowDownUp', minPlan: 'premium', group: 'insights' },
  { key: 'documents', label: 'Documents', icon: 'FileText', minPlan: 'premium', group: 'crm' },
  { key: 'automations', label: 'Automatisations', icon: 'Zap', minPlan: 'pro', group: 'system' },
  { key: 'tickets', label: 'Support client', icon: 'LifeBuoy', group: 'crm' },
  { key: 'quotes_invoices', label: 'Devis & Factures', icon: 'FileText', minPlan: 'pro', group: 'crm' },
  { key: 'campaigns', label: 'Campagnes email', icon: 'Mail', minPlan: 'premium', group: 'insights' },
  { key: 'knowledge_base', label: 'Base de connaissances', icon: 'BookOpen', minPlan: 'premium', group: 'crm' },
  { key: 'territories', label: 'Territoires & Quotas', icon: 'Map', minPlan: 'pro', group: 'insights' },
  { key: 'notifications', label: 'Notifications', icon: 'Bell', group: 'system' },
  { key: 'security', label: 'Sécurité', icon: 'ShieldCheck', group: 'system' },
  { key: 'privacy', label: 'Confidentialité', icon: 'Fingerprint', group: 'system' },
  { key: 'billing', label: 'Facturation', icon: 'CreditCard', minPlan: 'premium', group: 'system' },
  { key: 'admin', label: 'Espace Admin', icon: 'Settings', group: 'admin' },
  { key: 'super_admin', label: 'Super Admin', icon: 'Crown', group: 'admin' },
];

export interface PlanDef {
  id: 'starter' | 'pro' | 'premium' | 'entreprise';
  name: string;
  price: number;
  priceAnnual: number; // annual price per month (with discount)
  currency: string;
  maxUsers: number; // 0 = unlimited
  maxDeals: number; // 0 = unlimited
  features: string[];
  modules: ModuleKey[];
  customRoles?: boolean;
  multiCurrency?: boolean;
  mobileMoney?: boolean;
  api?: boolean;
  whiteLabel?: boolean;
  webhooks?: boolean;
  prioritySupport?: boolean;
  sla?: boolean;
  trialDays: number;
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: 'starter', name: 'Starter', price: 9, priceAnnual: 7, currency: 'USD',
    maxUsers: 2, maxDeals: 100, trialDays: 7,
    features: ['Pipeline', 'Contacts', 'Companies', 'Tâches', 'Calendrier', 'Support client', 'Confidentialité RGPD', 'Sécurité'],
    modules: ['dashboard','pipeline','contacts','companies','tasks','calendar','notifications','security','privacy','admin','tickets'],
  },
  {
    id: 'pro', name: 'Pro', price: 29, priceAnnual: 24, currency: 'USD',
    maxUsers: 5, maxDeals: 0, trialDays: 7, customRoles: true,
    features: ['Tout Starter +', 'Forecast', 'Rapports avancés', 'Automatisations', 'Devis & Factures', 'Territoires & Quotas', 'Rôles personnalisés', 'Activités'],
    modules: ['dashboard','pipeline','contacts','companies','activities','tasks','calendar','forecast','reports','automations','notifications','security','privacy','admin','tickets','quotes_invoices','territories'],
  },
  {
    id: 'premium', name: 'Premium', price: 69, priceAnnual: 57, currency: 'USD',
    maxUsers: 15, maxDeals: 0, trialDays: 7, customRoles: true, multiCurrency: true, mobileMoney: true, api: true,
    features: ['Tout Pro +', 'Documents', 'Campagnes email', 'Base de connaissances', 'Multi-devise & Mobile Money', 'API', 'Import/Export', 'Facturation'],
    modules: ['dashboard','pipeline','contacts','companies','activities','tasks','calendar','forecast','reports','import_export','automations','documents','notifications','security','privacy','admin','tickets','quotes_invoices','territories','campaigns','knowledge_base','billing'],
    highlight: true,
  },
  {
    id: 'entreprise', name: 'Entreprise', price: 159, priceAnnual: 132, currency: 'USD',
    maxUsers: 0, maxDeals: 0, trialDays: 7, customRoles: true, multiCurrency: true, mobileMoney: true, api: true, whiteLabel: true, webhooks: true, prioritySupport: true, sla: true,
    features: ['Tout Premium +', 'Support prioritaire', 'Marque blanche partielle', 'Webhooks/API complète', 'SLA', 'Utilisateurs illimités'],
    modules: ['dashboard','pipeline','contacts','companies','activities','tasks','calendar','forecast','reports','import_export','automations','documents','notifications','security','privacy','admin','tickets','quotes_invoices','territories','campaigns','knowledge_base','billing'],
  },
];

export const PLAN_BY_ID: Record<string, PlanDef> = Object.fromEntries(PLANS.map(p => [p.id, p]));

export const PLAN_RANK: Record<string, number> = { starter: 1, pro: 2, premium: 3, entreprise: 4 };

export function planIncludes(planId: string, moduleKey: ModuleKey): boolean {
  const plan = PLAN_BY_ID[planId];
  if (!plan) return false;
  return plan.modules.includes(moduleKey);
}

// 54 African countries with phone code, currency, timezone, mobile money providers
export interface CountryDef {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  dial: string;
  currency: string;
  timezone: string;
  mobileMoney: string[]; // available providers
  regions: string[];
}

export const COUNTRIES: CountryDef[] = [
  { code: 'DZ', name: 'Algérie', dial: '+213', currency: 'DZD', timezone: 'Africa/Algiers', mobileMoney: ['EDAHABIA'], regions: ['Alger','Oran','Constantine','Annaba','Blida','Sétif'] },
  { code: 'AO', name: 'Angola', dial: '+244', currency: 'AOA', timezone: 'Africa/Luanda', mobileMoney: ['Unitel Money'], regions: ['Luanda','Benguela','Huambo','Cabinda'] },
  { code: 'BJ', name: 'Bénin', dial: '+229', currency: 'XOF', timezone: 'Africa/Porto-Novo', mobileMoney: ['MTN Mobile Money','Moov Money','Orange Money'], regions: ['Cotonou','Porto-Novo','Parakou','Abomey'] },
  { code: 'BW', name: 'Botswana', dial: '+267', currency: 'BWP', timezone: 'Africa/Gaborone', mobileMoney: ['Orange Money'], regions: ['Gaborone','Francistown','Maun'] },
  { code: 'BF', name: 'Burkina Faso', dial: '+226', currency: 'XOF', timezone: 'Africa/Ouagadougou', mobileMoney: ['Orange Money','Moov Money','MTN Mobile Money'], regions: ['Ouagadougou','Bobo-Dioulasso','Koudougou','Banfora'] },
  { code: 'BI', name: 'Burundi', dial: '+257', currency: 'BIF', timezone: 'Africa/Bujumbura', mobileMoney: ['Lumicash','Ecocash'], regions: ['Bujumbura','Gitega','Ngozi'] },
  { code: 'CM', name: 'Cameroun', dial: '+237', currency: 'XAF', timezone: 'Africa/Douala', mobileMoney: ['Orange Money','MTN Mobile Money'], regions: ['Centre','Littoral','Ouest','Sud-Ouest','Nord','Extrême-Nord','Adamaoua','Est','Nord-Ouest','Sud'], },
  { code: 'CV', name: 'Cap-Vert', dial: '+238', currency: 'CVE', timezone: 'Atlantic/Cape_Verde', mobileMoney: [], regions: ['Praia','Mindelo','Espargos'] },
  { code: 'CF', name: 'Centrafrique', dial: '+236', currency: 'XAF', timezone: 'Africa/Bangui', mobileMoney: ['A-Modo'], regions: ['Bangui','Bambari','Bossangoa'] },
  { code: 'TD', name: 'Tchad', dial: '+235', currency: 'XAF', timezone: 'Africa/Ndjamena', mobileMoney: ['Airtel Money'], regions: ['N\'Djamena','Moundou','Sarh','Abéché'] },
  { code: 'KM', name: 'Comores', dial: '+269', currency: 'KMF', timezone: 'Indian/Comoro', mobileMoney: [], regions: ['Moroni','Mutsamudu','Fomboni'] },
  { code: 'CG', name: 'Congo', dial: '+242', currency: 'XAF', timezone: 'Africa/Brazzaville', mobileMoney: ['Airtel Money','MTN Mobile Money'], regions: ['Brazzaville','Pointe-Noire','Dolisie'] },
  { code: 'CD', name: 'Congo (RDC)', dial: '+243', currency: 'CDF', timezone: 'Africa/Kinshasa', mobileMoney: ['M-Pesa','Orange Money','Airtel Money'], regions: ['Kinshasa','Lubumbashi','Goma','Mbuji-Mayi','Kananga'] },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', currency: 'XOF', timezone: 'Africa/Abidjan', mobileMoney: ['Orange Money','MTN Mobile Money','Moov Money','Wave'], regions: ['Abidjan','Bouaké','Yamoussoukro','San-Pédro','Korhogo'] },
  { code: 'DJ', name: 'Djibouti', dial: '+253', currency: 'DJF', timezone: 'Africa/Djibouti', mobileMoney: [], regions: ['Djibouti','Ali Sabieh','Dikhil'] },
  { code: 'EG', name: 'Égypte', dial: '+20', currency: 'EGP', timezone: 'Africa/Cairo', mobileMoney: ['Vodafone Cash','Orange Money'], regions: ['Le Caire','Alexandrie','Gizeh','Louxor','Assouan'] },
  { code: 'GQ', name: 'Guinée équatoriale', dial: '+240', currency: 'XAF', timezone: 'Africa/Malabo', mobileMoney: [], regions: ['Malabo','Bata','Ebebiyin'] },
  { code: 'ER', name: 'Érythrée', dial: '+291', currency: 'ERN', timezone: 'Africa/Asmara', mobileMoney: [], regions: ['Asmara','Keren','Assab'] },
  { code: 'SZ', name: 'Eswatini', dial: '+268', currency: 'SZL', timezone: 'Africa/Mbabane', mobileMoney: ['MTN Mobile Money'], regions: ['Mbabane','Manzini'] },
  { code: 'ET', name: 'Éthiopie', dial: '+251', currency: 'ETB', timezone: 'Africa/Addis_Ababa', mobileMoney: ['CBE Birr','Telebirr'], regions: ['Addis-Abeba','Dire Dawa','Gondar','Mekélé','Adama'] },
  { code: 'GA', name: 'Gabon', dial: '+241', currency: 'XAF', timezone: 'Africa/Libreville', mobileMoney: ['Airtel Money','MTN Mobile Money'], regions: ['Libreville','Port-Gentil','Franceville'] },
  { code: 'GM', name: 'Gambie', dial: '+220', currency: 'GMD', timezone: 'Africa/Banjul', mobileMoney: ['Qmoney'], regions: ['Banjul','Serrekunda','Brikama'] },
  { code: 'GH', name: 'Ghana', dial: '+233', currency: 'GHS', timezone: 'Africa/Accra', mobileMoney: ['MTN Mobile Money','Vodafone Cash','AirtelTigo Money'], regions: ['Grand Accra','Ashanti','Occidental','Centrale','Volta','Orientale','Nord'] },
  { code: 'GN', name: 'Guinée', dial: '+224', currency: 'GNF', timezone: 'Africa/Conakry', mobileMoney: ['Orange Money','MTN Mobile Money'], regions: ['Conakry','Kankan','Labé','Kindia'] },
  { code: 'GW', name: 'Guinée-Bissau', dial: '+245', currency: 'XOF', timezone: 'Africa/Bissau', mobileMoney: ['Orange Money'], regions: ['Bissau','Bafatá','Gabú'] },
  { code: 'KE', name: 'Kenya', dial: '+254', currency: 'KES', timezone: 'Africa/Nairobi', mobileMoney: ['M-Pesa','Airtel Money','T-Kash'], regions: ['Nairobi','Mombasa','Kisumu','Nakuru','Eldoret'] },
  { code: 'LS', name: 'Lesotho', dial: '+266', currency: 'LSL', timezone: 'Africa/Maseru', mobileMoney: ['EcoCash','M-Pesa'], regions: ['Maseru','Teyateyaneng'] },
  { code: 'LR', name: 'Liberia', dial: '+231', currency: 'LRD', timezone: 'Africa/Monrovia', mobileMoney: ['Lonestar Money'], regions: ['Monrovia','Gbarnga','Kakata'] },
  { code: 'LY', name: 'Libye', dial: '+218', currency: 'LYD', timezone: 'Africa/Tripoli', mobileMoney: ['Libyana Mobile Money'], regions: ['Tripoli','Benghazi','Misrata'] },
  { code: 'MG', name: 'Madagascar', dial: '+261', currency: 'MGA', timezone: 'Indian/Antananarivo', mobileMoney: ['Orange Money','Airtel Money','MVola'], regions: ['Antananarivo','Toamasina','Mahajanga','Fianarantsoa'] },
  { code: 'MW', name: 'Malawi', dial: '+265', currency: 'MWK', timezone: 'Africa/Blantyre', mobileMoney: ['Airtel Money','TNM Mpamba'], regions: ['Lilongwe','Blantyre','Mzuzu'] },
  { code: 'ML', name: 'Mali', dial: '+223', currency: 'XOF', timezone: 'Africa/Bamako', mobileMoney: ['Orange Money','Moov Money','Wave'], regions: ['Bamako','Sikasso','Ségou','Kayes'] },
  { code: 'MR', name: 'Mauritanie', dial: '+222', currency: 'MRU', timezone: 'Africa/Nouakchott', mobileMoney: ['Bankily'], regions: ['Nouakchott','Nouadhibou','Rosso'] },
  { code: 'MU', name: 'Maurice', dial: '+230', currency: 'MUR', timezone: 'Indian/Mauritius', mobileMoney: ['My.T Money'], regions: ['Port-Louis','Curepipe','Vacoas'] },
  { code: 'MA', name: 'Maroc', dial: '+212', currency: 'MAD', timezone: 'Africa/Casablanca', mobileMoney: ['Inwi Money'], regions: ['Casablanca','Rabat','Marrakech','Fès','Tanger','Agadir'] },
  { code: 'MZ', name: 'Mozambique', dial: '+258', currency: 'MZN', timezone: 'Africa/Maputo', mobileMoney: ['M-Pesa','e-Mola'], regions: ['Maputo','Beira','Nampula'] },
  { code: 'NA', name: 'Namibie', dial: '+264', currency: 'NAD', timezone: 'Africa/Windhoek', mobileMoney: ['MTC Mobile Money'], regions: ['Windhoek','Walvis Bay','Swakopmund'] },
  { code: 'NE', name: 'Niger', dial: '+227', currency: 'XOF', timezone: 'Africa/Niamey', mobileMoney: ['Orange Money','Moov Money','Airtel Money'], regions: ['Niamey','Zinder','Maradi','Agadez'] },
  { code: 'NG', name: 'Nigéria', dial: '+234', currency: 'NGN', timezone: 'Africa/Lagos', mobileMoney: ['Paga','OPay','PalmPay'], regions: ['Lagos','Abuja','Kano','Ibadan','Port Harcourt','Kaduna'] },
  { code: 'RW', name: 'Rwanda', dial: '+250', currency: 'RWF', timezone: 'Africa/Kigali', mobileMoney: ['MTN Mobile Money','Airtel Money'], regions: ['Kigali','Butare','Gitarama'] },
  { code: 'ST', name: 'São Tomé & Príncipe', dial: '+239', currency: 'STN', timezone: 'Africa/Sao_Tome', mobileMoney: [], regions: ['São Tomé','Trindade'] },
  { code: 'SN', name: 'Sénégal', dial: '+221', currency: 'XOF', timezone: 'Africa/Dakar', mobileMoney: ['Orange Money','Wave','Free Money'], regions: ['Dakar','Thiès','Saint-Louis','Touba','Ziguinchor'] },
  { code: 'SC', name: 'Seychelles', dial: '+248', currency: 'SCR', timezone: 'Indian/Mahe', mobileMoney: [], regions: ['Victoria','Anse Boileau'] },
  { code: 'SL', name: 'Sierra Leone', dial: '+232', currency: 'SLL', timezone: 'Africa/Freetown', mobileMoney: ['Orange Money','Africell Money'], regions: ['Freetown','Bo','Kenema','Makeni'] },
  { code: 'SO', name: 'Somalie', dial: '+252', currency: 'SOS', timezone: 'Africa/Mogadishu', mobileMoney: ['EVC Plus','Sahal'], regions: ['Mogadiscio','Hargeisa','Bosaso'] },
  { code: 'ZA', name: 'Afrique du Sud', dial: '+27', currency: 'ZAR', timezone: 'Africa/Johannesburg', mobileMoney: ['Vodacom M-Pesa'], regions: ['Johannesburg','Le Cap','Durban','Pretoria','Port Elizabeth'] },
  { code: 'SS', name: 'Soudan du Sud', dial: '+211', currency: 'SSP', timezone: 'Africa/Juba', mobileMoney: ['Geez Mobile Money'], regions: ['Juba','Wau','Malakal'] },
  { code: 'SD', name: 'Soudan', dial: '+249', currency: 'SDG', timezone: 'Africa/Khartoum', mobileMoney: ['Zain Cash'], regions: ['Khartoum','Omdurman','Port-Soudan'] },
  { code: 'TZ', name: 'Tanzanie', dial: '+255', currency: 'TZS', timezone: 'Africa/Dar_es_Salaam', mobileMoney: ['M-Pesa','Airtel Money','Tigo Pesa','Halopesa'], regions: ['Dar es Salaam','Dodoma','Mwanza','Arusha','Mbeya'] },
  { code: 'TG', name: 'Togo', dial: '+228', currency: 'XOF', timezone: 'Africa/Lome', mobileMoney: ['Orange Money','Moov Money','Wave','TMoney'], regions: ['Lomé','Sokodé','Kara','Atakpamé'] },
  { code: 'TN', name: 'Tunisie', dial: '+216', currency: 'TND', timezone: 'Africa/Tunis', mobileMoney: ['D17','Flouci'], regions: ['Tunis','Sfax','Sousse','Bizerte'] },
  { code: 'UG', name: 'Ouganda', dial: '+256', currency: 'UGX', timezone: 'Africa/Kampala', mobileMoney: ['MTN Mobile Money','Airtel Money','M-Sente'], regions: ['Kampala','Wakiso','Mukono','Jinja','Gulu'] },
  { code: 'EH', name: 'Sahara occidental', dial: '+212', currency: 'MAD', timezone: 'Africa/El_Aaiun', mobileMoney: [], regions: ['Laâyoune','Dakhla'] },
  { code: 'ZM', name: 'Zambie', dial: '+260', currency: 'ZMW', timezone: 'Africa/Lusaka', mobileMoney: ['Airtel Money','MTN Mobile Money'], regions: ['Lusaka','Kitwe','Ndola','Kabwe'] },
  { code: 'ZW', name: 'Zimbabwe', dial: '+263', currency: 'ZWL', timezone: 'Africa/Harare', mobileMoney: ['EcoCash','OneMoney'], regions: ['Harare','Bulawayo','Mutare','Gweru'] },
  // International (Dubaï / LIYHA GROUP)
  { code: 'AE', name: 'Émirats Arabes Unis', dial: '+971', currency: 'AED', timezone: 'Asia/Dubai', mobileMoney: [], regions: ['Dubaï','Abu Dhabi','Sharjah'] },
  { code: 'FR', name: 'France', dial: '+33', currency: 'EUR', timezone: 'Europe/Paris', mobileMoney: [], regions: ['Paris','Lyon','Marseille','Bordeaux'] },
  { code: 'US', name: 'États-Unis', dial: '+1', currency: 'USD', timezone: 'America/New_York', mobileMoney: [], regions: ['New York','Californie','Texas'] },
  { code: 'GB', name: 'Royaume-Uni', dial: '+44', currency: 'GBP', timezone: 'Europe/London', mobileMoney: [], regions: ['Londres','Manchester','Birmingham'] },
];

export const COUNTRY_BY_CODE: Record<string, CountryDef> = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));

export interface CurrencyDef {
  code: string;
  symbol: string;
  name: string;
  decimals: number;
  // Reference rate to USD (1 unit = rate USD)
  rateToUsd: number;
}

export const CURRENCIES: CurrencyDef[] = [
  { code: 'XOF', symbol: 'FCFA', name: 'Franc CFA (BCEAO)', decimals: 0, rateToUsd: 0.00165 },
  { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA (BEAC)', decimals: 0, rateToUsd: 0.00165 },
  { code: 'NGN', symbol: '₦', name: 'Naira', decimals: 2, rateToUsd: 0.00065 },
  { code: 'GHS', symbol: '₵', name: 'Cedi', decimals: 2, rateToUsd: 0.075 },
  { code: 'KES', symbol: 'KSh', name: 'Shilling kényan', decimals: 2, rateToUsd: 0.0072 },
  { code: 'ZAR', symbol: 'R', name: 'Rand', decimals: 2, rateToUsd: 0.053 },
  { code: 'EGP', symbol: 'E£', name: 'Livre égyptienne', decimals: 2, rateToUsd: 0.021 },
  { code: 'MAD', symbol: 'DH', name: 'Dirham marocain', decimals: 2, rateToUsd: 0.10 },
  { code: 'DZD', symbol: 'DA', name: 'Dinar algérien', decimals: 2, rateToUsd: 0.0073 },
  { code: 'ETB', symbol: 'Br', name: 'Birr', decimals: 2, rateToUsd: 0.0094 },
  { code: 'TZS', symbol: 'TSh', name: 'Shilling tanzanien', decimals: 0, rateToUsd: 0.00039 },
  { code: 'UGX', symbol: 'USh', name: 'Shilling ougandais', decimals: 0, rateToUsd: 0.00026 },
  { code: 'USD', symbol: '$', name: 'Dollar américain', decimals: 2, rateToUsd: 1 },
  { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, rateToUsd: 1.08 },
  { code: 'GBP', symbol: '£', name: 'Livre sterling', decimals: 2, rateToUsd: 1.27 },
  { code: 'AED', symbol: 'د.إ', name: 'Dirham émirati', decimals: 2, rateToUsd: 0.27 },
];

export const CURRENCY_BY_CODE: Record<string, CurrencyDef> = Object.fromEntries(CURRENCIES.map(c => [c.code, c]));

// Re-export utility helpers so callers can import everything from one place.
// Circular import is safe: values are only read inside function bodies at call time.
export { formatMoney, convertToUsd, COLOR_RAMPS, formatDate, formatDateTime, timeAgo, daysUntil, downloadCsv, initials, classNames, type ColorKey } from './utils';

export const MOBILE_MONEY_PROVIDERS = ['Orange Money','MTN Mobile Money','Wave','M-Pesa','Moov Money','Airtel Money','Vodafone Cash','Telebirr','EcoCash','OPay'];

// Deal stages
export const DEAL_STAGES = [
  { id: 'lead', label: 'Lead', color: 'blue' },
  { id: 'qualified', label: 'Qualifié', color: 'teal' },
  { id: 'proposal', label: 'Proposition', color: 'violet' },
  { id: 'negotiation', label: 'Négociation', color: 'orange' },
  { id: 'won', label: 'Gagné', color: 'green' },
  { id: 'lost', label: 'Perdu', color: 'red' },
] as const;

export const ACTIVITY_TYPES = ['call','email','meeting','task','note'] as const;
export const TASK_PRIORITIES = ['low','medium','high','urgent'] as const;
export const TASK_STATUSES = ['todo','in_progress','done'] as const;

export const FAQ_ITEMS = [
  { q: 'Puis-je changer de forfait en cours d\'abonnement ?', a: 'Oui. Depuis l\'espace Facturation, vous pouvez upgrader ou downgrader à tout moment. Le prorata est calculé automatiquement.' },
  { q: 'Quels moyens de paiement sont acceptés ?', a: 'Cartes bancaires via Stripe partout, plus Mobile Money selon le pays : Orange Money, MTN Mobile Money, Wave, M-Pesa.' },
  { q: 'Mes données sont-elles isolées des autres entreprises ?', a: 'Oui. Chaque entreprise est un tenant totalement isolé au niveau base de données (Row-Level Security). Aucune fuite possible.' },
  { q: 'L\'essai de 7 jours engage-t-il un paiement ?', a: 'Non. L\'essai est gratuit et sans carte. À la fin, sans moyen de paiement, le compte passe en lecture seule.' },
  { q: 'Puis-je créer des rôles personnalisés ?', a: 'Oui, à partir du plan Pro. L\'Admin du tenant crée des rôles (Comptable, Commercial, etc.) avec une matrice de permissions par module.' },
  { q: 'Le code commercial est-il obligatoire ?', a: 'Non, il est explicitement optionnel. Laissez vide si vous n\'en avez pas.' },
];
