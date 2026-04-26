import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { 
  Building2, Globe2, Star, TrendingUp, DollarSign, 
  Search, Filter, MoreHorizontal, Mail, Phone, ChevronRight,
  ShieldCheck, AlertCircle
} from 'lucide-react';
import { StatCard } from '@/components/ui';

// ─── MOCK DATA: B2B AGENCIES ──────────────────────────────────────────────
const AGENCIES = [
  {
    id: 'AG-001',
    name: 'Luxe Voyages International',
    country: 'France',
    tier: 'Platinum',
    contact: 'Sophie Martin',
    email: 's.martin@luxevoyages.fr',
    stats: {
      totalProjects: 45,
      wonProjects: 38,
      conversionRate: 84,
      revenue: 2450000 // MAD
    },
    preferences: ['Hôtels 5* Uniquement', 'Guides Francophones', 'Transferts VIP (Mercedes V-Class)'],
    lastActivity: 'Il y a 2 jours'
  },
  {
    id: 'AG-002',
    name: 'Atlas Tours UK',
    country: 'United Kingdom',
    tier: 'Premium',
    contact: 'James Smith',
    email: 'jsmith@atlastours.co.uk',
    stats: {
      totalProjects: 22,
      wonProjects: 12,
      conversionRate: 54,
      revenue: 850000
    },
    preferences: ['Régimes Végétariens Fréquents', 'Activités Outdoor'],
    lastActivity: 'Aujourd\'hui'
  },
  {
    id: 'AG-003',
    name: 'Iberia Travel Group',
    country: 'Spain',
    tier: 'Standard',
    contact: 'Carlos Ruiz',
    email: 'cruiz@iberiatravel.es',
    stats: {
      totalProjects: 15,
      wonProjects: 4,
      conversionRate: 26,
      revenue: 120000
    },
    preferences: ['Budget Optimisé', 'Groupes (20+ pax)'],
    lastActivity: 'Il y a 1 semaine'
  },
  {
    id: 'AG-004',
    name: 'Elite Destinations NY',
    country: 'USA',
    tier: 'Platinum',
    contact: 'Sarah Jenkins',
    email: 'sarah@elitedest.com',
    stats: {
      totalProjects: 30,
      wonProjects: 28,
      conversionRate: 93,
      revenue: 3800000
    },
    preferences: ['Paiement en USD', 'Hébergement en Riad Privatisé', 'Hélicoptère'],
    lastActivity: 'Il y a 3 heures'
  }
];

export function CrmPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);

  // Global Stats Calculation
  const totalRevenue = AGENCIES.reduce((acc, a) => acc + a.stats.revenue, 0);
  const avgConversion = Math.round(
    AGENCIES.reduce((acc, a) => acc + a.stats.conversionRate, 0) / AGENCIES.length
  );
  const platinumCount = AGENCIES.filter(a => a.tier === 'Platinum').length;

  const filteredAgencies = AGENCIES.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950 transition-colors pb-12">
      <PageHeader
        eyebrow="Intelligence Commerciale"
        title="CRM & Agences Partenaires"
        subtitle="Gérez votre réseau B2B, suivez les performances et personnalisez l'expérience client."
        actions={
          <div className="flex gap-2">
            <button className="btn btn-secondary btn-sm gap-2">
              <Filter size={14} /> Filtrer
            </button>
            <button className="btn btn-primary btn-sm gap-2">
              <Building2 size={14} /> Ajouter une Agence
            </button>
          </div>
        }
      />

      <div className="p-8 max-w-[1600px] mx-auto space-y-6">
        
        {/* ── KPI ROW ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard 
            label="Total Agences Actives" 
            value={AGENCIES.length} 
            icon={Building2} 
            variant="dark" 
            sub="Réseau B2B"
          />
          <StatCard 
            label="CA Global Généré" 
            value={`${(totalRevenue / 1000000).toFixed(1)}M MAD`} 
            icon={DollarSign} 
            variant="primary" 
            sub="Sur tous les projets"
          />
          <StatCard 
            label="Conversion Moyenne" 
            value={`${avgConversion}%`} 
            icon={TrendingUp} 
            sub="Projets Gagnés / Total"
          />
          <StatCard 
            label="Partenaires Platinum" 
            value={platinumCount} 
            icon={Star} 
            sub="Agences Top Tier"
          />
        </div>

        {/* ── MAIN CONTENT ───────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-6">
          
          {/* AGENCIES LIST (8 cols) */}
          <div className="col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            {/* Toolbar */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="relative w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Rechercher une agence, un pays..."
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-[13px] text-slate-800 dark:text-cream focus:ring-2 focus:ring-rihla focus:border-rihla transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="text-[12px] font-bold text-slate-400">
                {filteredAgencies.length} agence(s) trouvée(s)
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4 text-left">Agence & Localisation</th>
                    <th className="px-6 py-4 text-left">Tier</th>
                    <th className="px-6 py-4 text-left">Conversion</th>
                    <th className="px-6 py-4 text-right">CA Généré</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredAgencies.map((agency) => (
                    <tr 
                      key={agency.id} 
                      onClick={() => setSelectedAgency(agency.id)}
                      className={`hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${selectedAgency === agency.id ? 'bg-rihla/5 dark:bg-rihla/10' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-[10px] bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-800 dark:text-cream">
                            {agency.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 dark:text-cream">{agency.name}</p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Globe2 size={12} /> {agency.country}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <TierBadge tier={agency.tier} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-full max-w-[120px]">
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className="text-slate-800 dark:text-cream">{agency.stats.conversionRate}%</span>
                            <span className="text-slate-400">{agency.stats.wonProjects}/{agency.stats.totalProjects}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${agency.stats.conversionRate > 70 ? 'bg-emerald-500' : agency.stats.conversionRate > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${agency.stats.conversionRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-slate-800 dark:text-cream">
                          {new Intl.NumberFormat('fr-FR').format(agency.stats.revenue)} MAD
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="p-1.5 text-slate-400 hover:text-rihla hover:bg-rihla/10 rounded-lg transition-colors">
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AGENCY DETAILS PANEL (4 cols) */}
          <div className="col-span-4">
            {selectedAgency ? (() => {
              const agency = AGENCIES.find(a => a.id === selectedAgency)!;
              return (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] shadow-sm p-6 sticky top-6 animate-fade-in">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <TierBadge tier={agency.tier} className="mb-3" />
                      <h2 className="font-bold text-xl text-slate-800 dark:text-cream leading-tight">{agency.name}</h2>
                      <p className="text-[12px] text-slate-400 mt-1">{agency.id} • {agency.country}</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 mb-6 border border-slate-100 dark:border-white/5 space-y-3">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Principal</h3>
                    <div className="flex items-center gap-3 text-[13px] text-slate-800 dark:text-cream">
                      <div className="w-8 h-8 rounded-full bg-rihla/10 text-rihla flex items-center justify-center font-bold">
                        {agency.contact.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold">{agency.contact}</p>
                        <p className="text-[11px] text-slate-400">{agency.email}</p>
                      </div>
                      <div className="flex gap-1">
                        <button className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:text-rihla transition-colors"><Mail size={14} /></button>
                        <button className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:text-rihla transition-colors"><Phone size={14} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Preferences / Tags */}
                  <div className="mb-6">
                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-500" /> Préférences & Exigences VIP
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {agency.preferences.map((pref, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-bold rounded-lg border border-amber-200 dark:border-amber-500/20">
                          {pref}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="pt-6 border-t border-slate-100 dark:border-white/5 space-y-3">
                    <button className="w-full btn btn-primary flex justify-center items-center gap-2">
                      <TrendingUp size={16} /> Créer un projet pour cette agence
                    </button>
                    <button className="w-full btn btn-secondary flex justify-center items-center gap-2">
                      Voir l'historique complet <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })() : (
              <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 border-dashed dark:border-slate-800 rounded-[24px] h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-600 mb-4 shadow-sm">
                  <Building2 size={24} />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-cream text-base mb-2">Aucune agence sélectionnée</h3>
                <p className="text-[13px] text-slate-400 max-w-[250px]">
                  Sélectionnez une agence dans la liste pour afficher ses performances et ses préférences.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function TierBadge({ tier, className = '' }: { tier: string, className?: string }) {
  let colors = '';
  switch (tier) {
    case 'Platinum':
      colors = 'bg-slate-800 text-amber-400 border-slate-700'; // Dark premium look
      break;
    case 'Premium':
      colors = 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
      break;
    default:
      colors = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-[10px] font-black uppercase tracking-wider border ${colors} ${className}`}>
      {tier === 'Platinum' && <Star size={10} className="fill-current" />}
      {tier}
    </span>
  );
}
