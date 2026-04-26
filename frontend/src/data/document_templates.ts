/**
 * S'TOURS Internal Document Templates — Doc Interne Leisure
 *
 * Structured representations of S'TOURS operational documents:
 * voucher, reservation, information letter, appreciation forms,
 * tips sheet, letterhead, fiche dossier.
 *
 * Excludes: Enveloppes (per user request)
 */

export interface DocumentTemplate {
  code: string
  name: string
  name_i18n: Record<string, string>
  category: 'operational' | 'branding' | 'client_facing' | 'internal'
  language: string
  description: string
  icon: string
  fields: Record<string, unknown>
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    code: 'voucher',
    name: 'Bon de Service / Voucher',
    name_i18n: {
      fr: 'Bon de Service', en: 'Service Voucher',
      de: 'Dienstleistungsgutschein', it: 'Buono di Servizio',
      es: 'Bono de Servicio',
    },
    category: 'operational',
    language: 'fr',
    description: 'Bon de service envoyé aux prestataires confirmant les services pour un groupe.',
    icon: 'FileText',
    fields: {
      dossier_ref: 'string', voucher_number: 'string',
      supplier_name: 'string', supplier_city: 'string',
      client_group: 'string', pax_count: 'number',
      rooms: { single: 'number', double: 'number', triple: 'number', total: 'number' },
      dates: { checkin: 'date', checkout: 'date' },
      meals: { breakfast: 'boolean', lunch: 'boolean', dinner: 'boolean' },
      board_type: 'string',
      transport: { type: 'string', pickup: 'string', dropoff: 'string' },
      observations: 'string',
    },
  },
  {
    code: 'reservation',
    name: 'Demande de Réservation',
    name_i18n: {
      fr: 'Demande de Réservation', en: 'Reservation Request',
      de: 'Reservierungsanfrage', it: 'Richiesta di Prenotazione',
      es: 'Solicitud de Reserva',
    },
    category: 'operational',
    language: 'fr',
    description: 'Formulaire de réservation envoyé aux fournisseurs pour confirmer les disponibilités.',
    icon: 'Calendar',
    fields: {
      from_company: 'string', to_supplier: 'string',
      date: 'date', client_names: 'string[]',
      room_requirements: 'string', special_requests: 'string',
    },
  },
  {
    code: 'information_letter',
    name: 'Information Letter',
    name_i18n: {
      fr: "Lettre d'information client", en: 'Client Information Letter',
      de: 'Kundeninformationsschreiben', it: 'Lettera informativa',
      es: 'Carta informativa',
    },
    category: 'client_facing',
    language: 'en',
    description: "Lettre remise au client avec les détails du circuit : hôtels, contacts, restaurants, services jour par jour.",
    icon: 'Mail',
    fields: {
      tour_ref: 'string', services_provider: "S'TOURS",
      emergency_contact: 'string', accommodation_summary: 'string',
      daily_details: [{ day: 'date', city: 'string', hotel: 'string', hotel_phone: 'string', meals: 'string' }],
    },
  },
  {
    code: 'appreciation_en',
    name: 'Appreciation Form (English)',
    name_i18n: {
      fr: "Fiche d'appréciation (anglais)", en: 'Appreciation Form',
      de: 'Bewertungsbogen (Englisch)', it: 'Scheda di valutazione',
      es: 'Ficha de valoración (inglés)',
    },
    category: 'client_facing',
    language: 'en',
    description: "Formulaire de satisfaction client en anglais : guide, chauffeur, bus, hôtels par ville.",
    icon: 'Star',
    fields: {
      client_name: 'string', country: 'string', city: 'string',
      agency: 'string', phone: 'string',
      ratings: {
        tour_guide: 'rating', driver: 'rating', motorcoach: 'rating',
        hotels: [{ city: 'string', welcome: 'rating', accommodation: 'rating', food: 'rating', restaurant: 'rating' }],
      },
      general_remarks: 'string',
    },
  },
  {
    code: 'appreciation_de',
    name: 'Bewertungsbogen (Deutsch)',
    name_i18n: {
      fr: "Fiche d'appréciation (allemand)", en: 'Appreciation Form (German)',
      de: 'Bewertungsbogen', it: 'Scheda di valutazione (tedesco)',
      es: 'Ficha de valoración (alemán)',
    },
    category: 'client_facing',
    language: 'de',
    description: "Fragebogen zur Kundenzufriedenheit auf Deutsch. Bewertung Reiseleiter, Fahrer, Hotels.",
    icon: 'Star',
    fields: {
      client_name: 'string', beruf: 'string', anschrift: 'string',
      agentur: 'string', tel: 'string',
      bewertungen: {
        reiseleiter: 'rating', busfahrer: 'rating', bus: 'rating',
        hotels: [{ stadt: 'string', empfang: 'rating', unterkunft: 'rating', mahlzeiten: 'rating', restaurant: 'rating' }],
      },
      anmerkungen: 'string',
    },
  },
  {
    code: 'tips_sheet',
    name: 'Feuille des Pourboires',
    name_i18n: {
      fr: 'Feuille des pourboires', en: 'Tips Tracking Sheet',
      de: 'Trinkgeld-Übersicht', it: 'Foglio mance',
      es: 'Hoja de propinas',
    },
    category: 'internal',
    language: 'fr',
    description: 'Fiche de suivi des pourboires par jour : aéroport, hôtel, restaurant. Signée par le guide.',
    icon: 'DollarSign',
    fields: {
      group_name: 'string', dossier_ref: 'string',
      date_passage: 'date', pax_count: 'number',
      guide: 'string', chauffeur: 'string',
      daily_tips: [{ date: 'date', airport_porters: 'number', hotel_bellboy: 'number', restaurant: 'number', total: 'number' }],
    },
  },
  {
    code: 'fiche_dossier',
    name: 'Fiche Dossier',
    name_i18n: {
      fr: 'Fiche dossier', en: 'File Card',
      de: 'Aktenblatt', it: 'Scheda fascicolo',
      es: 'Ficha de expediente',
    },
    category: 'internal',
    language: 'fr',
    description: 'Fiche récapitulative du dossier : client, dates, PAX, hôtels, transport, guide.',
    icon: 'FolderOpen',
    fields: {
      dossier_ref: 'string', client: 'string', agency: 'string',
      arrival_date: 'date', departure_date: 'date', pax: 'number',
      hotels: 'string[]', transport_type: 'string',
      guide_name: 'string', special_services: 'string',
    },
  },
  {
    code: 'letterhead',
    name: "En-tête S'TOURS",
    name_i18n: {
      fr: "En-tête S'TOURS", en: "S'TOURS Letterhead",
      de: "S'TOURS Briefkopf", it: "Intestazione S'TOURS",
      es: "Membrete S'TOURS",
    },
    category: 'branding',
    language: 'fr',
    description: "En-tête officiel : logo, adresse 4 rue Turgot Casablanca, téléphone et fax.",
    icon: 'Building2',
    fields: {
      company_name: "S'TOURS",
      address: '4, rue Turgot - Quartier Racine - 20100 Casablanca',
      phone: '+212 522 36 13 04 / 522 36 07 73',
      fax: '+212 522 36 20 35',
      email: 'dmc@stoursvoyages.com',
      website: 'www.stours.co.ma',
    },
  },
]

export const CATEGORY_INFO = {
  operational:   { label: 'Opérationnel', color: 'blue' },
  branding:      { label: 'Branding', color: 'amber' },
  client_facing: { label: 'Client', color: 'emerald' },
  internal:      { label: 'Interne', color: 'slate' },
} as const
