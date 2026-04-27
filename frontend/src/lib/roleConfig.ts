/**
 * Configuration par rôle :
 * - homeRoute : page d'accueil après login
 * - navGroups : navigation affichée dans la sidebar
 */

export type AppRole =
  | 'super_admin'
  | 'sales_director'
  | 'travel_designer'
  | 'quotation_officer'
  | 'data_operator'
  | 'sales_agent'
  | 'guide'
  | 'client'
  | 'driver'

export function getHomeRoute(role: string): string {
  const map: Record<string, string> = {
    super_admin:      '/dashboard',
    sales_director:   '/portal/horizon',
    travel_designer:  '/projects',
    quotation_officer:'/invoices',
    data_operator:    '/inventory/hotels',
    sales_agent:      '/projects',
    guide:            '/portal/guide',
    client:           '/portal',
    driver:           '/portal/driver',
  }
  return map[role] ?? '/dashboard'
}

export interface NavItem {
  to: string
  label: string
  icon: string   // Lucide icon name
  shortcut?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

const ALL_GROUPS: NavGroup[] = [
  {
    label: 'DIRECTION & STRATÉGIE',
    items: [
      { to: '/dashboard',            icon: 'LayoutDashboard', label: 'Pilotage Général',        shortcut: '1' },
      { to: '/analytics',            icon: 'BarChart3',       label: 'Performance Insights',    shortcut: 'A' },
      { to: '/gamification/leaderboard', icon: 'Trophy',       label: 'Champions Arena',         shortcut: 'T' },
      { to: '/crm',                  icon: 'Users',           label: 'Gestion Agences B2B',     shortcut: 'V' },
    ],
  },
  {
    label: 'CŒUR DE MÉTIER DMC',
    items: [
      { to: '/projects',             icon: 'FolderKanban',    label: 'Dossiers & Projets',      shortcut: '2' },
      { to: '/travel-designer',       icon: 'Compass',         label: 'Travel Designer',         shortcut: 'T' },
      { to: '/quotations',           icon: 'Calculator',      label: 'Console de Cotation',     shortcut: '4' },
      { to: '/itineraries',          icon: 'MapPin',          label: 'Concepteur Itinéraires',  shortcut: '3' },
      { to: '/itinerary-templates',  icon: 'Copy',            label: 'Templates de Circuits' },
      { to: '/activities',            icon: 'Star',            label: 'Catalogue Activités',     shortcut: 'Y' },
      { to: '/media-library',        icon: 'ImageIcon',       label: 'Bibliothèque mutualisée' },
      { to: '/document-templates',   icon: 'FileText',        label: 'Documents Opérationnels' },
    ],
  },
  {
    label: 'STUDIO CRÉATIF (IA)',
    items: [
      { to: '/circuit-generator',    icon: 'Sparkles',        label: 'Générateur de Circuits',  shortcut: 'G' },
      { to: '/proposal-studio',      icon: 'FileText',        label: 'Proposal Designer',       shortcut: 'P' },
      { to: '/proposal-writer',      icon: 'Wand2',           label: 'Proposition IA',          shortcut: 'W' },
      { to: '/ai/content-studio',    icon: 'Type',            label: 'Content Marketing',       shortcut: 'S' },
      { to: '/ai',                   icon: 'Sparkles',        label: 'Assistant IA',            shortcut: '9' },
    ],
  },
  {
    label: 'OPÉRATIONS LIVE',
    items: [
      { to: '/operations',           icon: 'Building2',       label: 'Suivi Terrain',           shortcut: 'L' },
      { to: '/operations/calendar',  icon: 'Calendar',        label: 'Planning Global',         shortcut: 'K' },
      { to: '/operations/concierge', icon: 'Gem',             label: 'Conciergerie VIP',        shortcut: 'J' },
    ],
  },
  {
    label: 'LOGISTIQUE & RESSOURCES',
    items: [
      { to: '/portal/horizon',       icon: 'Bus',             label: 'HORIZON Transport',       shortcut: 'Z' },
      { to: '/inventory/hotels',     icon: 'Hotel',           label: 'Parc Hôtelier',           shortcut: 'H' },
      { to: '/inventory/guides',     icon: 'Compass',         label: 'Réseau Guides',           shortcut: 'G' },
      { to: '/inventory/restaurants',icon: 'Utensils',        label: 'Partenaires Resto',       shortcut: 'R' },
      { to: '/fleet-optimizer',      icon: 'Truck',           label: 'Flotte Véhicules',        shortcut: 'F' },
    ],
  },
  {
    label: 'GESTION & FINANCE',
    items: [
      { to: '/invoices',             icon: 'Receipt',         label: 'Facturation & Flux',      shortcut: '5' },
      { to: '/reports',              icon: 'BarChart2',       label: 'Reporting Avancé',        shortcut: '6' },
      { to: '/references',           icon: 'Hash',            label: 'Références',              shortcut: '7' },
      { to: '/forex',                icon: 'TrendingUp',      label: 'Forex Dashboard',         shortcut: 'X' },
      { to: '/integrations',         icon: 'Plug',            label: 'Intégrations' },
      { to: '/sustainability',       icon: 'Leaf',            label: 'Empreinte Carbone' },
      { to: '/payment-agent',        icon: 'Bot',             label: 'Agent Acompte' },
      { to: '/pricing-coach',        icon: 'Brain',           label: 'Pricing Coach' },
      { to: '/m365',                 icon: 'Cloud',           label: 'Microsoft 365' },
      { to: '/erp-integrations',     icon: 'Plug',            label: 'ERP Client (SAP)' },
      { to: '/o2c',                  icon: 'Workflow',        label: 'Order-to-Cash' },
      { to: '/p2p',                  icon: 'ShoppingCart',    label: 'Procure-to-Pay' },
      { to: '/data-hub',             icon: 'Database',        label: 'Data Hub · recherche' },
      { to: '/agent-designer',       icon: 'Bot',             label: 'Joule Agent Designer' },
      { to: '/cotation-advanced',    icon: 'Calculator',      label: 'Cotation Avancée' },
    ],
  },
  {
    label: 'MON ESPACE',
    items: [
      { to: '/portal',               icon: 'Globe',           label: 'Mon Voyage',              shortcut: 'W' },
      { to: '/portal/guide',         icon: 'Compass',         label: 'Mon Agenda Guide',        shortcut: 'G' },
      { to: '/portal/driver',        icon: 'Car',             label: 'Mes Courses',             shortcut: 'D' },
      { to: '/notifications',        icon: 'Bell',            label: 'Notifications',           shortcut: 'N' },
    ],
  },
]

// Groupes visibles par rôle
const ROLE_GROUPS: Record<string, string[]> = {
  super_admin: [
    'DIRECTION & STRATÉGIE',
    'CŒUR DE MÉTIER DMC',
    'STUDIO CRÉATIF (IA)',
    'OPÉRATIONS LIVE',
    'LOGISTIQUE & RESSOURCES',
    'GESTION & FINANCE',
  ],
  sales_director: [
    'OPÉRATIONS LIVE',
    'LOGISTIQUE & RESSOURCES',
    'GESTION & FINANCE',
  ],
  travel_designer: [
    'CŒUR DE MÉTIER DMC',
    'STUDIO CRÉATIF (IA)',
    'LOGISTIQUE & RESSOURCES',
  ],
  quotation_officer: [
    'CŒUR DE MÉTIER DMC',
    'GESTION & FINANCE',
  ],
  data_operator: [
    'LOGISTIQUE & RESSOURCES',
  ],
  sales_agent: [
    'CŒUR DE MÉTIER DMC',
  ],
  guide: [],    // Utilise AppShellMobile
  client: [],   // Utilise AppShellMobile
  driver: [],   // Utilise AppShellMobile
}

// Items spécifiques rôles simples (guide, client, driver)
const MOBILE_NAV: Record<string, NavItem[]> = {
  guide: [
    { to: '/portal/guide',     icon: 'Calendar', label: 'Mon Agenda' },
    { to: '/notifications',    icon: 'Bell',      label: 'Notifications' },
  ],
  client: [
    { to: '/portal',           icon: 'Globe',     label: 'Mon Voyage' },
    { to: '/portal',           icon: 'Star',      label: 'Mes Avis' },
    { to: '/notifications',    icon: 'Bell',      label: 'Notifications' },
  ],
  driver: [
    { to: '/portal/driver',    icon: 'Car',       label: 'Mes Courses' },
    { to: '/notifications',    icon: 'Bell',      label: 'Notifications' },
  ],
}

export function getNavGroups(role: string): NavGroup[] {
  const allowed = ROLE_GROUPS[role] ?? ROLE_GROUPS.sales_agent
  return ALL_GROUPS.filter(g => allowed.includes(g.label))
}

export function getMobileNav(role: string): NavItem[] {
  return MOBILE_NAV[role] ?? []
}

export function isMobileRole(role: string): boolean {
  return ['guide', 'client', 'driver'].includes(role)
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin:      'CEO',
  sales_director:   'Directeur Transport',
  travel_designer:  'Travel Designer',
  quotation_officer:'Directeur Financier',
  data_operator:    'Opérateur Data',
  sales_agent:      'Commercial',
  guide:            'Guide',
  client:           'Client',
  driver:           'Chauffeur',
}
