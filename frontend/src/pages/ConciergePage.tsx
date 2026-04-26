import { useState } from 'react'
import { 
  GlassWater, Utensils, Star, MapPin, Clock, 
  Plus, Search, Filter, Phone, CheckCircle2, 
  Calendar, CreditCard, ChevronRight, Info,
  Gem, Heart, Coffee
} from 'lucide-react'

// ── Mock Experiences ──────────────────────────────────────────────
const EXPERIENCES = [
  { id: 'E01', name: 'Dîner Privé - Désert d’Agafay', category: 'Gastronomie', city: 'Marrakech', price: 1200, rating: 5.0, status: 'Top Seller', img: 'https://images.unsplash.com/photo-1533619239233-6280475a633a?auto=format&fit=crop&q=80&w=400' },
  { id: 'E02', name: 'Montgolfière au lever du soleil', category: 'Aventure', city: 'Marrakech', price: 2500, rating: 4.9, status: 'Premium', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400' },
  { id: 'E03', name: 'Atelier Artisanat Fès', category: 'Culture', city: 'Fes', price: 450, rating: 4.8, status: 'Authentique', img: 'https://images.unsplash.com/photo-1590603740183-980e7f6920eb?auto=format&fit=crop&q=80&w=400' },
  { id: 'E04', name: 'Transfert Hélicoptère - Merzouga', category: 'Transport VIP', city: 'Maroc', price: 15000, rating: 5.0, status: 'Luxury', img: 'https://images.unsplash.com/photo-1583162855813-bc7692290f05?auto=format&fit=crop&q=80&w=400' },
]

export function ConciergePage() {
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-100 dark:bg-pink-500/10 flex items-center justify-center text-pink-600 shadow-inner">
              <Gem size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-cream">Conciergerie & Expériences</h1>
              <p className="text-slate-400 text-xs mt-0.5 uppercase tracking-widest font-bold">Services A la Carte & Lifestyle</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Rechercher une expérience..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs w-64 focus:ring-2 focus:ring-pink-500 outline-none transition-all"
              />
            </div>
            <button className="flex items-center gap-2 px-6 py-2.5 bg-pink-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-pink-200 dark:shadow-none hover:-translate-y-0.5 transition-all">
              <Plus size={16} /> Créer un Service
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Réservations du jour', value: '14', icon: Calendar, color: 'text-blue-500' },
            { label: 'Taux de satisfaction', value: '4.9/5', icon: Heart, color: 'text-pink-500' },
            { label: 'Panier Moyen / Pax', value: '1,850 MAD', icon: CreditCard, color: 'text-emerald-500' },
            { label: 'Prestataires Actifs', value: '48', icon: Utensils, color: 'text-amber-500' },
          ].map((kpi, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className={`w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center ${kpi.color} mb-4`}>
                <kpi.icon size={20} />
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-cream">{kpi.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Experience Grid */}
        <div className="grid grid-cols-2 gap-8">
          {EXPERIENCES.map(exp => (
            <div key={exp.id} className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-all flex h-64">
              {/* Image Left */}
              <div className="w-1/2 relative overflow-hidden">
                <img src={exp.img} alt={exp.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                <div className="absolute top-4 left-4">
                  <span className="bg-white/10 backdrop-blur-md text-white text-[9px] font-black px-3 py-1 rounded-full border border-white/20 uppercase">
                    {exp.category}
                  </span>
                </div>
              </div>

              {/* Content Right */}
              <div className="w-1/2 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star size={12} fill="currentColor" />
                      <span className="text-[10px] font-black">{exp.rating}</span>
                    </div>
                    <span className="text-[9px] font-black text-pink-600 dark:text-pink-400 uppercase tracking-widest">{exp.status}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-cream text-lg leading-tight mb-2">{exp.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin size={12} /> {exp.city}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Prix suggéré (HT)</p>
                      <p className="text-xl font-black text-slate-800 dark:text-cream">{exp.price.toLocaleString()} MAD</p>
                    </div>
                    <button className="w-10 h-10 bg-slate-900 dark:bg-pink-600 rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {/* Add New Placeholder */}
          <button className="h-64 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-4 hover:bg-white dark:hover:bg-white/5 transition-all group">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <p className="text-sm font-bold text-slate-400">Nouveau service Conciergerie</p>
          </button>
        </div>

        {/* Support Banner */}
        <div className="mt-12 bg-slate-900 rounded-[40px] p-10 text-white flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5">
            <GlassWater size={120} />
          </div>
          <div className="max-w-xl">
            <h3 className="text-2xl font-black mb-2 flex items-center gap-3">
              <Coffee size={24} className="text-pink-400" /> Gestion des Prestataires
            </h3>
            <p className="text-slate-400 text-base leading-relaxed">
              Consultez les contrats exclusifs S'TOURS avec les meilleurs restaurants et lieux de prestige du Royaume.
            </p>
          </div>
          <button className="px-8 py-4 bg-white text-slate-900 font-black rounded-2xl shadow-xl hover:scale-105 transition-all">
            VOIR LE RÉPERTOIRE
          </button>
        </div>
      </div>
    </div>
  )
}
