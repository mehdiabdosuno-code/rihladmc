/**
 * B2C Passenger Application — Mobile-first live tracking for travelers.
 * Shows the bus location, guide details, weather, and daily program.
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { 
  MapPin, Navigation, Info, Users, Clock, 
  Sun, CloudRain, Wind, MessageSquare, 
  Calendar, Phone, ShieldCheck, Map as MapIcon,
  ChevronRight, ArrowLeft, Camera, Heart, Share2, Sparkles, Star, ShoppingBag, Zap, CreditCard,
  Smile, Meh, Frown
} from 'lucide-react'
import { clsx } from 'clsx'

export function PassengerAppPage() {
  const { token } = useParams<{ token: string }>()
  const [activeTab, setActiveTab] = useState<'live' | 'program' | 'info' | 'memories' | 'plus'>('live')
  const [mood, setMood] = useState<'happy' | 'neutral' | 'sad' | null>(null)
  
  // Mock live data (simulate bus moving)
  const [busLocation, setBusLocation] = useState({ x: 45, y: 35 })
  
  useEffect(() => {
    const timer = setInterval(() => {
      setBusLocation(prev => ({
        x: prev.x + (Math.random() - 0.5) * 0.1,
        y: prev.y + (Math.random() - 0.5) * 0.1
      }))
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans overflow-hidden flex flex-col">
      
      {/* ── TOP NAV (Branding) ─────────────────────────────────── */}
      <header className="px-6 py-5 flex items-center justify-between shrink-0 bg-slate-900/50 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-rihla flex items-center justify-center font-black text-xs">S</div>
          <div>
            <h1 className="text-sm font-black tracking-tight uppercase">S'TOURS Live</h1>
            <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Voyage en cours · ST-9921</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">En Direct</span>
        </div>
      </header>

      {/* ── MAIN SCROLLABLE CONTENT ───────────────────────────── */}
      <main className="flex-1 overflow-y-auto pb-32">
        
        {activeTab === 'live' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Live Map Preview */}
            <div className="h-72 bg-slate-900 relative overflow-hidden">
               {/* Abstract Map Background */}
               <div className="absolute inset-0 opacity-20">
                 <svg viewBox="0 0 100 100" className="w-full h-full object-cover">
                   <path d="M 10 20 L 40 10 L 80 20 L 90 40 L 80 80 L 50 95 L 20 85 L 5 50 Z" className="fill-slate-800 stroke-white/10 stroke-[0.2]" />
                   <path d="M 25 35 L 45 30 L 65 55 L 45 65 L 30 60" fill="none" stroke="white/10" strokeWidth="0.5" strokeDasharray="1 1" />
                 </svg>
               </div>
               
               {/* Bus Marker */}
               <div 
                 className="absolute w-12 h-12 -ml-6 -mt-6 transition-all duration-1000 ease-linear"
                 style={{ left: `${busLocation.x}%`, top: `${busLocation.y}%` }}
               >
                 <div className="w-12 h-12 bg-rihla rounded-full flex items-center justify-center shadow-2xl shadow-rihla/50 relative">
                    <Navigation size={20} className="text-white rotate-45" />
                    <div className="absolute -inset-4 bg-rihla/20 rounded-full animate-ping" />
                 </div>
               </div>

               <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                 <MapPin size={12} className="text-rihla" />
                 <span className="text-[10px] font-bold uppercase tracking-widest">Aéroport de Fès-Saïss (12 min)</span>
               </div>
            </div>

            {/* Daily Mood Check-in */}
            <div className="p-6">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-[32px] space-y-4">
              <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center">Votre journée à Marrakech</h4>
              <p className="text-sm font-bold text-center">Comment s'est passée votre journée ?</p>
              <div className="flex justify-center gap-6 py-2">
                 <button onClick={() => setMood('sad')} className={clsx("p-4 rounded-3xl transition-all", mood === 'sad' ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/20" : "bg-white/5 text-white/20")}>
                    <Frown size={24} />
                 </button>
                 <button onClick={() => setMood('neutral')} className={clsx("p-4 rounded-3xl transition-all", mood === 'neutral' ? "bg-amber-500 text-white scale-110 shadow-lg shadow-amber-500/20" : "bg-white/5 text-white/20")}>
                    <Meh size={24} />
                 </button>
                 <button onClick={() => setMood('happy')} className={clsx("p-4 rounded-3xl transition-all", mood === 'happy' ? "bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/20" : "bg-white/5 text-white/20")}>
                    <Smile size={24} />
                 </button>
              </div>
              {mood && (
                <div className="text-center animate-in fade-in zoom-in duration-300">
                   <p className="text-[10px] text-rihla font-black uppercase tracking-widest">
                      {mood === 'happy' ? "Nous sommes ravis ! Profitez bien de votre soirée." : "Merci. Notre équipe a été informée et veillera à améliorer votre confort."}
                   </p>
                </div>
              )}
           </div>
           </div>

            {/* Quick Stats */}
            <div className="p-6 grid grid-cols-2 gap-4">
               <div className="bg-slate-900/50 border border-white/5 p-5 rounded-[28px]">
                 <div className="flex items-center gap-3 mb-2">
                   <Sun size={16} className="text-amber-400" />
                   <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Météo Fès</span>
                 </div>
                 <p className="text-xl font-black">28°C <span className="text-xs text-white/40 font-medium">Ensoleillé</span></p>
               </div>
               <div className="bg-slate-900/50 border border-white/5 p-5 rounded-[28px]">
                 <div className="flex items-center gap-3 mb-2">
                   <Clock size={16} className="text-blue-400" />
                   <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Prochaine étape</span>
                 </div>
                 <p className="text-xl font-black">12:30 <span className="text-xs text-white/40 font-medium">Déjeuner</span></p>
               </div>
            </div>

            {/* Team Card */}
            <div className="px-6">
               <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 p-6 rounded-[32px]">
                 <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Votre Équipe S'TOURS</h3>
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-2xl bg-rihla flex items-center justify-center font-black text-lg">YE</div>
                     <div>
                       <p className="text-sm font-black">Yassine E.</p>
                       <p className="text-[10px] text-rihla font-bold uppercase tracking-widest mt-1">Guide Officiel</p>
                     </div>
                   </div>
                   <div className="flex gap-2">
                     <button className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-rihla border border-white/5">
                        <Phone size={20} />
                     </button>
                     <button className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-rihla border border-white/5">
                        <MessageSquare size={20} />
                     </button>
                   </div>
                 </div>
               </div>
            </div>

            {/* Next Activity Section */}
            <div className="px-6 mt-6">
               <div className="relative group">
                 <img 
                   src="https://images.unsplash.com/photo-1539020140153-e479b8b06990?w=800&q=80" 
                   className="w-full h-56 object-cover rounded-[32px] opacity-60" 
                   alt="Fes"
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent rounded-[32px]" />
                 <div className="absolute bottom-6 left-6 right-6">
                   <span className="text-[10px] font-black text-rihla uppercase tracking-[0.2em] mb-2 block">Détail du Moment</span>
                   <h4 className="text-xl font-black mb-2">Déjeuner au Palais Faraj</h4>
                   <p className="text-xs text-white/60 font-medium leading-relaxed">
                     Un cadre somptueux surplombant la médina de Fès. Menu gastronomique traditionnel.
                   </p>
                 </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'program' && (
          <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <h2 className="text-2xl font-black tracking-tight">Mon Programme</h2>
             {[
               { day: 'Jour 1', title: 'Bienvenue à Casablanca', status: 'completed' },
               { day: 'Jour 2', title: 'Capitale Rabat & Fès', status: 'active' },
               { day: 'Jour 3', title: 'Les Mystères de Fès', status: 'pending' },
               { day: 'Jour 4', title: 'Direction le Désert', status: 'pending' },
             ].map((d, i) => (
               <div key={i} className={clsx(
                 "p-6 rounded-[28px] border transition-all flex items-center justify-between",
                 d.status === 'active' ? "bg-rihla/10 border-rihla/50" : "bg-slate-900/50 border-white/5 opacity-60"
               )}>
                 <div className="flex items-center gap-4">
                    <div className={clsx(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs",
                      d.status === 'active' ? "bg-rihla text-white" : "bg-white/5 text-white/40"
                    )}>{i+1}</div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">{d.day}</p>
                      <h4 className="text-sm font-black">{d.title}</h4>
                    </div>
                 </div>
                 {d.status === 'active' && <ChevronRight size={18} className="text-rihla" />}
               </div>
             ))}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <h2 className="text-2xl font-black tracking-tight">Informations Utiles</h2>
             
             <div className="bg-slate-900/50 border border-white/5 p-8 rounded-[32px] text-center">
                <ShieldCheck size={48} className="text-emerald-500 mx-auto mb-4" />
                <h4 className="text-lg font-black mb-2">Assistance 24/7</h4>
                <p className="text-xs text-white/60 mb-6 leading-relaxed">Un problème ? Notre conciergerie est disponible à tout moment.</p>
                <button className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20">
                   Appeler le Support
                </button>
             </div>

             <div className="space-y-4">
               <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                 <span className="text-xs font-bold text-white/60">WiFi du Bus</span>
                 <span className="text-xs font-black text-rihla">STOURS_LUX_99</span>
               </div>
               <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                 <span className="text-xs font-bold text-white/60">Urgence Maroc</span>
                 <span className="text-xs font-black text-rihla">190</span>
               </div>
             </div>
          </div>
        )}

        {activeTab === 'memories' && (
           <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-black tracking-tight">Memory Box</h2>
                 <div className="px-4 py-1.5 bg-rihla/20 text-rihla rounded-full text-[10px] font-black uppercase tracking-widest border border-rihla/20">
                    S'TOURS Signature
                 </div>
              </div>

              {/* Guide Personal Message */}
              <div className="bg-gradient-to-r from-rihla to-rihla-dark p-8 rounded-[32px] shadow-2xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                    <Heart size={120} fill="white" />
                 </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                       <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center font-black">
                          YE
                       </div>
                       <div>
                          <p className="text-xs font-black text-white">Un mot de Yassine,</p>
                          <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Votre Guide</p>
                       </div>
                    </div>
                    <p className="text-sm font-medium italic text-white/90 leading-relaxed">
                      "Ce fut un immense plaisir de vous faire découvrir les trésors du Maroc. J'espère que ces souvenirs resteront gravés dans vos cœurs autant que dans le mien. À bientôt chez S'TOURS !"
                    </p>
                 </div>
              </div>

              {/* Trip Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                 <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl text-center">
                    <p className="text-lg font-black">4</p>
                    <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">Villes</p>
                 </div>
                 <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl text-center">
                    <p className="text-lg font-black">1.2k</p>
                    <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">KM</p>
                 </div>
                 <div className="bg-slate-900/50 border border-white/5 p-4 rounded-2xl text-center">
                    <p className="text-lg font-black">12</p>
                    <p className="text-[9px] text-white/40 font-black uppercase tracking-widest">Photos</p>
                 </div>
              </div>

              {/* Photo Wall (Simulated) */}
              <div className="grid grid-cols-2 gap-4">
                 {[
                   "https://images.unsplash.com/photo-1548013146-72479768bada?w=400&q=80",
                   "https://images.unsplash.com/photo-1553508978-3147cc41701a?w=400&q=80",
                   "https://images.unsplash.com/photo-1590059378730-8488e040994a?w=400&q=80",
                   "https://images.unsplash.com/photo-1528150177508-7cc0c36cda5c?w=400&q=80",
                 ].map((img, i) => (
                   <div key={i} className="aspect-square rounded-[24px] overflow-hidden border border-white/10 group cursor-pointer">
                      <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Souvenir" />
                   </div>
                 ))}
              </div>

              {/* Share & Feedback */}
              <div className="space-y-4">
                 <button className="w-full py-4 bg-white text-slate-950 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                    <Share2 size={16} /> Partager l'album
                 </button>
                 <div className="p-8 bg-slate-900/80 border border-rihla/30 rounded-[32px] text-center border-dashed">
                    <Star size={32} className="text-rihla mx-auto mb-4" />
                    <h4 className="text-sm font-black mb-2">Comment était votre voyage ?</h4>
                    <p className="text-[10px] text-white/40 mb-6 uppercase tracking-widest font-bold">Votre avis nous est précieux</p>
                    <div className="flex justify-center gap-4">
                       {[1,2,3,4,5].map(s => (
                         <button key={s} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-rihla hover:text-white transition-all">
                            {s}
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        )}

         {activeTab === 'plus' && (
           <div className="p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                 <h2 className="text-2xl font-black tracking-tight">Conciergerie VIP</h2>
                 <div className="px-4 py-1.5 bg-amber-500/20 text-amber-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/20 flex items-center gap-2">
                    <Zap size={12} fill="currentColor" /> Service Instantané
                 </div>
              </div>

              <p className="text-xs text-white/40 font-medium leading-relaxed">
                 Sublimez votre séjour avec nos expériences exclusives et services de conciergerie disponibles en un clic.
              </p>

              {/* Extras Grid */}
              <div className="space-y-6">
                 {[
                   { 
                     title: "Soin Signature au Spa", 
                     desc: "Massage traditionnel aux huiles d'Argan (60 min)", 
                     price: "850 MAD", 
                     img: "https://images.unsplash.com/photo-1544161515-4ae6ce6fe858?w=600&q=80",
                     tag: "Détente"
                   },
                   { 
                     title: "Surclassement Suite Royale", 
                     desc: "Vue imprenable sur les jardins (sous réserve de dispo)", 
                     price: "1 200 MAD", 
                     img: "https://images.unsplash.com/photo-1578683010236-d716f9a3f28d?w=600&q=80",
                     tag: "Upgrade"
                   },
                   { 
                     title: "Dîner Privé aux Chandelles", 
                     desc: "Sur une terrasse panoramique, menu dégustation", 
                     price: "1 800 MAD", 
                     img: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600&q=80",
                     tag: "Romantique"
                   },
                 ].map((item, i) => (
                   <div key={i} className="bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden group">
                      <div className="h-40 relative">
                         <img src={item.img} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={item.title} />
                         <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest text-white border border-white/10">
                            {item.tag}
                         </div>
                      </div>
                      <div className="p-6">
                         <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-black">{item.title}</h4>
                            <span className="text-sm font-black text-rihla">{item.price}</span>
                         </div>
                         <p className="text-[11px] text-white/40 leading-relaxed mb-6">
                            {item.desc}
                         </p>
                         <button className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                            Réserver maintenant
                         </button>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 p-8 rounded-[40px] text-center">
                 <ShoppingBag size={40} className="text-white/20 mx-auto mb-4" />
                 <h4 className="text-sm font-black mb-2">Besoin d'autre chose ?</h4>
                 <p className="text-[10px] text-white/40 mb-6 uppercase tracking-widest font-bold">Notre conciergerie s'occupe de tout</p>
                 <button className="w-full py-4 bg-rihla text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rihla/20">
                    Contacter mon Concierge
                 </button>
              </div>
           </div>
         )}
      </main>

      {/* ── BOTTOM NAVIGATION (Tabs) ───────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 p-6 z-50">
         <div className="bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[32px] p-2 flex items-center justify-between shadow-2xl">
            <button 
              onClick={() => setActiveTab('live')}
              className={clsx(
                "flex-1 flex flex-col items-center gap-1 py-3 rounded-[24px] transition-all",
                activeTab === 'live' ? "bg-rihla text-white shadow-xl" : "text-white/40"
              )}
            >
              <Navigation size={18} />
              <span className="text-[9px] font-black uppercase tracking-tighter">Live</span>
            </button>
            <button 
              onClick={() => setActiveTab('program')}
              className={clsx(
                "flex-1 flex flex-col items-center gap-1 py-3 rounded-[24px] transition-all",
                activeTab === 'program' ? "bg-rihla text-white shadow-xl" : "text-white/40"
              )}
            >
              <Calendar size={18} />
              <span className="text-[9px] font-black uppercase tracking-tighter">Programme</span>
            </button>
            <button 
              onClick={() => setActiveTab('info')}
              className={clsx(
                "flex-1 flex flex-col items-center gap-1 py-3 rounded-[24px] transition-all",
                activeTab === 'info' ? "bg-rihla text-white shadow-xl" : "text-white/40"
              )}
            >
              <Info size={18} />
              <span className="text-[9px] font-black uppercase tracking-tighter">Infos</span>
            </button>
            <button 
              onClick={() => setActiveTab('memories')}
              className={clsx(
                "flex-1 flex flex-col items-center gap-1 py-3 rounded-[24px] transition-all",
                activeTab === 'memories' ? "bg-rihla text-white shadow-xl" : "text-white/40"
              )}
            >
              <Camera size={18} />
              <span className="text-[9px] font-black uppercase tracking-tighter">Souvenirs</span>
            </button>
            <button 
              onClick={() => setActiveTab('plus')}
              className={clsx(
                "flex-1 flex flex-col items-center gap-1 py-3 rounded-[24px] transition-all",
                activeTab === 'plus' ? "bg-amber-500 text-white shadow-xl" : "text-white/40"
              )}
            >
              <Zap size={18} />
              <span className="text-[9px] font-black uppercase tracking-tighter">VIP Plus</span>
            </button>
         </div>
      </nav>

    </div>
  )
}
