import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  Users, UserCheck, Languages, MapPin, 
  Star, Phone, Mail, Calendar, Search, 
  Plus, MoreVertical, Shield, Award, Compass,
  MessageCircle, BadgeCheck, Globe, Clock, Sparkles
} from 'lucide-react'
import { clsx } from 'clsx'
import { guidesApi } from '@/lib/api'

export function GuideManagementPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCity, setSelectedCity] = useState('Tous')

  const { data: guidesData, isLoading } = useQuery({
    queryKey: ['guides', selectedCity],
    queryFn: () => guidesApi.list(selectedCity === 'Tous' ? undefined : selectedCity).then(res => res.data)
  })

  // Fallback to mock data if API fails or returns empty (for demo purposes)
  const GUIDES = guidesData?.length ? guidesData : [
    { id: 'G01', name: 'Ahmed El Mansouri', city: 'Marrakech', languages: ['Français', 'Anglais'], specialty: 'Culture & Médina', rating: 4.9, status: 'Disponible', phone: '+212 661 22 33 44', daily_rate: 80, seniority: '12 ans', image_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100', is_certified: true },
    { id: 'G02', name: 'Fatima Zahra', city: 'Fes', languages: ['Français', 'Espagnol', 'Arabe'], specialty: 'Histoire & Artisanat', rating: 5.0, status: 'En Circuit', phone: '+212 661 55 66 77', daily_rate: 95, seniority: '8 ans', image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100', is_certified: true },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-8 py-6 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rihla/10 flex items-center justify-center text-rihla shadow-inner">
              <Compass size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-cream tracking-tight">Guide Network B2B</h1>
              <p className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-[0.2em] font-black italic">S'TOURS Certified Experts</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-rihla transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Langue, Spécialité, Ville..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-12 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs w-80 focus:ring-4 focus:ring-rihla/5 outline-none transition-all font-medium"
              />
            </div>
            <button className="flex items-center gap-2 px-6 py-3 bg-rihla text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-rihla/20 hover:scale-105 transition-all">
              <Plus size={18} /> Inscrire un Expert
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8">
        
        {/* Advanced Filters */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex gap-2">
            {['Tous', 'Marrakech', 'Fès', 'Atlas & Désert', 'Tanger'].map((f) => (
              <button 
                key={f} 
                onClick={() => setSelectedCity(f)}
                className={clsx(
                "px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all",
                selectedCity === f ? "bg-slate-900 text-white shadow-lg" : "bg-white dark:bg-white/5 text-slate-400 border border-slate-200 dark:border-white/5 hover:border-rihla"
              )}>{f}</button>
            ))}
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Disponible</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> En Mission</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-300" /> Indisponible</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {GUIDES.map((guide: any) => (
            <div key={guide.id} className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden">
              
              {/* Glass Background Decor */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-rihla/5 blur-[80px] -mr-32 -mt-32 pointer-events-none" />

              <div className="flex items-center gap-10 relative z-10">
                
                {/* Avatar Section */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 rounded-[32px] overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl">
                    <img src={guide.image_url} alt={guide.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className={clsx(
                    "absolute -bottom-2 -right-2 w-8 h-8 rounded-2xl border-4 border-white dark:border-slate-900 flex items-center justify-center shadow-lg",
                    guide.status === 'Disponible' ? "bg-emerald-500" : guide.status === 'En Circuit' ? "bg-blue-500" : "bg-slate-300"
                  )}>
                    <UserCheck size={14} className="text-white" />
                  </div>
                </div>

                {/* Identity & Expertise */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-black text-slate-900 dark:text-cream tracking-tight truncate">{guide.name}</h3>
                    {guide.is_certified && (
                      <div className="flex items-center gap-1 bg-rihla/10 text-rihla px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter">
                        <BadgeCheck size={10} /> Certifié S'TOURS
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-6 mt-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Localisation</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 italic">
                        <MapPin size={12} className="text-rihla" /> {guide.city}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Spécialité</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 italic">
                        <Shield size={12} className="text-rihla" /> {guide.specialty}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expérience</p>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 italic">
                        <Clock size={12} className="text-rihla" /> {guide.seniority}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Languages Hub */}
                <div className="w-48 px-8 border-x border-slate-100 dark:border-white/5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Compétences Linguistiques</p>
                  <div className="flex flex-wrap gap-2">
                    {guide.languages.map((lang: string) => (
                      <span key={lang} className="px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-xl text-[10px] font-black text-slate-600 dark:text-slate-400 border border-slate-200/50">
                        {lang}
                      </span>
                    ))}
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <Globe size={12} />
                    </div>
                  </div>
                </div>

                {/* B2B Pricing */}
                <div className="w-40 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarif Journalier B2B</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-cream tracking-tighter">{guide.daily_rate} MAD</p>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase mt-1">Accord Cadre 2026</p>
                </div>

                {/* Action Hub */}
                <div className="flex gap-3">
                  <button className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10">
                    <MessageCircle size={20} />
                  </button>
                  <button className="px-8 py-4 bg-slate-900 dark:bg-rihla text-white text-[11px] font-black uppercase rounded-2xl hover:scale-105 transition-all shadow-xl shadow-rihla/20">
                    Gérer Mission
                  </button>
                </div>

              </div>
            </div>
          ))}
        </div>

        {/* Intelligence Card */}
        <div className="mt-12 bg-gradient-to-br from-slate-900 to-ink rounded-[48px] p-16 text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-32 opacity-10 rotate-12">
            <Award size={200} />
          </div>
          <div className="relative z-10 grid grid-cols-2 gap-20 items-center">
            <div>
              <span className="px-4 py-1.5 bg-rihla/20 border border-rihla/30 text-rihla-light rounded-full text-[10px] font-black uppercase tracking-widest mb-6 inline-block">S'TOURS Genius Insight</span>
              <h2 className="text-4xl font-black mb-6 leading-tight">Le matching parfait pour vos VIP.</h2>
              <p className="text-slate-400 text-lg leading-relaxed mb-10 font-medium">
                Notre algorithme ne se contente pas de vérifier la disponibilité. Il analyse l'historique des notes clients pour vous recommander le guide dont le tempérament correspond le mieux à votre groupe.
              </p>
              <div className="flex gap-8">
                <div>
                  <p className="text-4xl font-black text-rihla">98%</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-2">Satisfaction Client</p>
                </div>
                <div className="w-px h-16 bg-white/10" />
                <div>
                  <p className="text-4xl font-black text-cream">45</p>
                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest mt-2">Experts Référencés</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center">
               <div className="w-full h-64 rounded-3xl border border-white/5 bg-white/5 backdrop-blur-md p-8 flex items-center justify-center text-center">
                  <div>
                    <div className="w-16 h-16 rounded-full bg-rihla/20 flex items-center justify-center text-rihla mb-6 mx-auto">
                      <Sparkles size={32} />
                    </div>
                    <p className="text-sm font-bold text-slate-300 italic mb-4">"L'IA a réduit de 40% les conflits d'affectation cette saison."</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">— Responsable Opérations S'TOURS</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
