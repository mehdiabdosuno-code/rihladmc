import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Utensils, Search, Plus, MapPin, 
  Users, Phone, Star, Filter, 
  ChevronRight, Building2, ExternalLink,
  ChefHat, Coffee, Wine, Info, CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { clsx } from 'clsx'
import { menusApi } from '@/lib/api'
import { Spinner } from '@/components/ui'

export function RestaurantInventoryPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCity, setActiveCity] = useState('Tout')

  // ── Data Fetching ───────────────────────────────────────────────
  const { data: menus, isLoading, isError } = useQuery({
    queryKey: ['menus', activeCity, searchTerm],
    queryFn: () => menusApi.list({ 
      city: activeCity === 'Tout' ? undefined : activeCity,
      limit: 100 
    }).then(r => r.data)
  })

  // Filter local results if search term is active
  const filteredData = menus?.filter((m: any) => 
    m.restaurant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.label?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || []

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 shadow-inner">
              <Utensils size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-cream tracking-tight">Gastronomie & Expériences</h1>
              <p className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-[0.2em] font-black italic">S'TOURS Premium Selection</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher un restaurant..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs w-80 focus:ring-4 focus:ring-orange-500/5 outline-none transition-all font-medium"
              />
            </div>
            <button className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-orange-600/20 hover:scale-105 transition-all">
              <Plus size={18} /> Ajouter une Table
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8">
        
        {/* Advanced Filters */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex gap-2">
            {['Tout', 'Marrakech', 'Casablanca', 'Fès', 'Rabat', 'Tanger'].map((f) => (
              <button 
                key={f} 
                onClick={() => setActiveCity(f)}
                className={clsx(
                  "px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all border",
                  activeCity === f 
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                    : "bg-white dark:bg-white/5 text-slate-400 border-slate-200 dark:border-white/5 hover:border-orange-500"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                <ChefHat size={14} className="text-orange-500" /> {filteredData.length} Restaurants Actifs
             </div>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spinner size={32} className="text-orange-500" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Chargement de la base culinaire...</p>
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-100 p-12 rounded-[32px] text-center">
            <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-black text-slate-800 mb-2">Erreur de connexion</h3>
            <p className="text-sm text-slate-500">Impossible de récupérer l'inventaire des restaurants.</p>
          </div>
        )}

        {/* Restaurant Grid */}
        {!isLoading && !isError && (
          <div className="grid grid-cols-2 gap-8">
            {filteredData.length === 0 ? (
              <div className="col-span-2 py-20 text-center bg-white dark:bg-slate-900 rounded-[32px] border border-dashed border-slate-300">
                <Search size={40} className="mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Aucun restaurant trouvé</p>
              </div>
            ) : (
              filteredData.map((res: any) => (
                <div key={res.id} className="group bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl transition-all flex h-64 relative">
                  
                  {/* Image Section */}
                  <div className="w-2/5 relative overflow-hidden bg-slate-100 flex items-center justify-center">
                    {res.img_url ? (
                      <img 
                        src={res.img_url} 
                        alt={res.restaurant_name} 
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                      />
                    ) : (
                      <Utensils size={48} className="text-slate-300 opacity-20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60 group-hover:opacity-20 transition-opacity" />
                    <div className="absolute top-4 left-4 px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 rounded-lg text-[9px] font-black text-white uppercase tracking-widest">
                      {res.city}
                    </div>
                  </div>

                  {/* Info Section */}
                  <div className="w-3/5 p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-[0.2em] italic">
                          {res.category || 'STANDARD'}
                        </span>
                        <div className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                          <Star size={12} fill="currentColor" />
                          <span className="text-[10px] font-black">4.5</span>
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-black text-slate-900 dark:text-cream tracking-tight mb-2 truncate group-hover:text-orange-600 transition-colors">
                        {res.restaurant_name}
                      </h3>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200/50">
                          {res.meal_type}
                        </span>
                        {res.has_halal && (
                          <span className="text-[9px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200/50">
                            Halal
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-slate-50 dark:border-white/5 pt-4">
                        <div className="flex items-center gap-2">
                           <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600">
                             <Users size={14} />
                           </div>
                           <div className="min-w-0">
                             <p className="text-[9px] font-black text-slate-400 uppercase leading-none">Min Pax</p>
                             <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{res.min_pax || 1} Pax</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-600">
                             <MapPin size={14} />
                           </div>
                           <div className="min-w-0">
                             <p className="text-[9px] font-black text-slate-400 uppercase leading-none">Localisation</p>
                             <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{res.city}</p>
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 flex items-center justify-between">
                       <div>
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Tarif B2B / Pax</p>
                         <p className="text-xl font-black text-slate-900 dark:text-cream mt-1 tracking-tighter">
                           {res.unit_cost} {res.currency}
                         </p>
                       </div>
                       <button className="px-6 py-3 bg-slate-900 dark:bg-orange-600 text-white text-[10px] font-black uppercase rounded-2xl hover:scale-105 transition-all shadow-xl shadow-orange-600/10">
                         Voir Détails
                       </button>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        )}

        {/* Global Summary & Intelligence */}
        <div className="mt-12 bg-gradient-to-br from-orange-600 to-orange-800 rounded-[48px] p-12 text-white relative overflow-hidden shadow-2xl shadow-orange-600/20">
          <div className="absolute top-0 right-0 p-24 opacity-10 rotate-12">
            <Utensils size={180} />
          </div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="max-w-2xl">
              <h4 className="text-3xl font-black mb-4">La Gastronomie S'TOURS Experience.</h4>
              <p className="text-orange-50 text-lg font-medium opacity-80 leading-relaxed mb-8">
                Chaque table est auditée par nos soins. Nous garantissons non seulement la qualité culinaire, mais aussi la logistique de groupe (accès bus, rapidité du service, sanitaires).
              </p>
              <div className="flex gap-8">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white"><Wine size={20} /></div>
                    <span className="text-xs font-black uppercase tracking-widest">Dégustations Vins</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white"><ChefHat size={20} /></div>
                    <span className="text-xs font-black uppercase tracking-widest">Chef Tables VIP</span>
                 </div>
              </div>
            </div>
            <div className="text-right">
               <div className="p-8 rounded-[32px] bg-white/10 backdrop-blur-xl border border-white/20">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-orange-200">Volume Annuel Groupes</p>
                  <p className="text-4xl font-black mb-1 tracking-tighter">48,200 PAX</p>
                  <p className="text-xs font-bold text-orange-100 italic">+15% vs 2025</p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

