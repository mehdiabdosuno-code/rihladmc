import { useState } from 'react'
import { 
  Hotel, Star, MapPin, Search, Plus, Filter, 
  TrendingUp, Calendar, ChevronRight, Bed, 
  DollarSign, Info, MoreVertical, Edit2,
  RefreshCw, CheckCircle2, AlertCircle, Zap
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery, useMutation } from '@tanstack/react-query'
import { hotelsApi } from '@/lib/api'

export function HotelInventoryPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const { data: hotels = [], isLoading } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => hotelsApi.list().then(r => r.data)
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <RefreshCw className="animate-spin text-rihla" size={40} />
        <p className="text-xs font-black uppercase tracking-widest animate-pulse">Chargement du parc hôtelier...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-white/5 px-8 py-5">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-[22px] font-semibold text-slate-900 dark:text-cream tracking-tight">Inventaire Hôtelier</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Gestion des contrats · live sync · yield management</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Rechercher hôtel, ville..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-lg text-[13px] w-72 focus:ring-2 focus:ring-rihla/30 focus:border-rihla outline-none transition-all"
              />
            </div>
            <button className="btn-primary">
              <Plus size={14} /> Nouvel hôtel
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-10">
        
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Hôtels actifs', value: hotels.length, icon: Hotel, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Live sync', value: '100%', icon: RefreshCw, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Prix moyen SGL', value: '1 450 MAD', icon: DollarSign, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { label: 'Yield moyen', value: '+12.4%', icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          ].map((kpi, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200/80 dark:border-white/5 hover:border-slate-300 transition-colors">
               <div className="flex items-start justify-between mb-3">
                 <p className="text-[12px] text-slate-500 dark:text-slate-400">{kpi.label}</p>
                 <div className={clsx("w-7 h-7 rounded-md flex items-center justify-center", kpi.bg, kpi.color)}>
                   <kpi.icon size={13} />
                 </div>
               </div>
               <p className="text-[22px] font-semibold text-slate-900 dark:text-cream tracking-tight">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Hotel Grid */}
        <div className="grid grid-cols-3 gap-10">
          {hotels.filter((h: any) => h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.city.toLowerCase().includes(searchTerm.toLowerCase())).map((hotel: any) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}

          {/* Add New Card */}
          <button className="h-full min-h-[500px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[48px] flex flex-col items-center justify-center gap-6 hover:bg-white dark:hover:bg-white/5 transition-all group">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300 group-hover:scale-110 group-hover:rotate-12 transition-all">
              <Plus size={40} />
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nouveau Partenaire</p>
          </button>
        </div>
      </div>
    </div>
  )
}

function HotelCard({ hotel }: { hotel: any }) {
  const [availability, setAvailability] = useState<any>(null)

  const availMutation = useMutation({
    mutationFn: () => hotelsApi.checkAvailability(hotel.id).then(r => r.data),
    onSuccess: (data) => setAvailability(data)
  })

  return (
    <div className="group bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-700">
      {/* Image Header */}
      <div className="relative h-64">
        <img 
          src={hotel.image_url || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=600'} 
          alt={hotel.name} 
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />
        
        <div className="absolute top-6 left-6 flex gap-2">
          <span className="bg-white/20 backdrop-blur-md text-white text-[9px] font-black px-4 py-1.5 rounded-full border border-white/20 uppercase tracking-[0.2em]">
            {hotel.category}
          </span>
        </div>

        <div className="absolute bottom-6 left-8 right-8">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <MapPin size={14} />
            <span className="text-[10px] font-black uppercase tracking-[0.15em]">{hotel.city}</span>
          </div>
          <h3 className="text-white font-black text-2xl tracking-tight leading-tight">{hotel.name}</h3>
        </div>

        {/* Live Status Overlay */}
        {availability && (
           <div className={clsx(
             "absolute top-6 right-6 px-4 py-2 rounded-2xl flex items-center gap-2 animate-in slide-in-from-top-4 duration-500 shadow-2xl backdrop-blur-xl border",
             availability.status === 'available' ? "bg-emerald-500/90 border-emerald-400 text-white" : "bg-red-500/90 border-red-400 text-white"
           )}>
             {availability.status === 'available' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
             <span className="text-[10px] font-black uppercase tracking-widest">
               {availability.status === 'available' ? 'Disponible' : 'Complet'}
             </span>
           </div>
        )}
      </div>

      {/* Rates & Sync Info */}
      <div className="p-8">
        <div className="flex justify-between items-end mb-8">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarif de base / Nuit</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-cream tracking-tighter">{hotel.base_rate.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">MAD</span>
            </div>
          </div>
          <div className={clsx(
            "px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest",
            hotel.season === 'High' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600'
          )}>
            Saison {hotel.season}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8 pt-8 border-t border-slate-100 dark:border-white/5">
           <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Double / Twin</p>
              <p className="text-sm font-black italic">Inclus</p>
           </div>
           <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Suppl. Single</p>
              <p className="text-sm font-black italic">+{hotel.single_supplement} MAD</p>
           </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={() => availMutation.mutate()}
            disabled={availMutation.isPending}
            className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-50"
          >
            {availMutation.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} className="text-amber-400" />}
            {availMutation.isPending ? 'Sync...' : 'Check Availability'}
          </button>
          <button className="w-14 h-14 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rihla transition-all">
            <Edit2 size={20} />
          </button>
        </div>

        {availability?.status === 'available' && (
          <div className="mt-6 space-y-2 animate-in fade-in duration-500">
             <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
               <CheckCircle2 size={10} /> Options disponibles :
             </p>
             <div className="flex flex-wrap gap-2">
                {availability.rooms.map((r: any) => (
                  <span key={r.type} className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-lg text-[9px] font-bold text-slate-500">
                    {r.type} (+{r.price_diff})
                  </span>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  )
}
