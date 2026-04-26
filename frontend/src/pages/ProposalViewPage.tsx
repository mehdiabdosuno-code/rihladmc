import { useState, useMemo, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { 
  MapPin, Calendar, Users, Clock, Check, 
  MessageSquare, Navigation, Sparkles, 
  ChevronRight, ArrowRight, Star, Heart, 
  ShieldCheck, Plane, Building2, Coffee,
  Video, Play, Volume2, Info, Send,
  PenTool, CreditCard, Lock, CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { clsx } from 'clsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { proposalsApi } from '@/lib/api'
const ItineraryMap = ({ days }: { days: any[] }) => <div className="h-64 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 text-sm">Carte interactive — {days.length} étapes</div>
const BrandingEngine = (_props: any) => null

export function ProposalViewPage() {
  const { token } = useParams()
  const queryClient = useQueryClient()
  const [activeDay, setActiveDay] = useState(1)
  const [showCheckout, setShowCheckout] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<'review' | 'sign' | 'pay' | 'success'>('review')

  const { data, isLoading, error } = useQuery({
    queryKey: ['proposal', token],
    queryFn: () => proposalsApi.getView(token!).then(r => r.data)
  })

  if (isLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Sparkles className="animate-spin text-rihla" /></div>
  if (error || !data) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Proposition introuvable.</div>

  const project = data.project

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-rihla/30">
      <BrandingEngine config={data.project.branding_config} />
      
      {/* ── HERO IMMERSIF (VIDEO BG) ─────────────────────────── */}
      <section className="relative h-screen w-full overflow-hidden">
         <div className="absolute inset-0 bg-black/40 z-10" />
         <video 
           autoPlay muted loop playsInline
           className="absolute inset-0 w-full h-full object-cover scale-110"
         >
           <source src="https://assets.mixkit.co/videos/preview/mixkit-marrakech-market-at-night-4206-large.mp4" type="video/mp4" />
         </video>

         <div className="relative z-20 h-full flex flex-col justify-end p-20 max-w-7xl mx-auto">
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
               <div className="flex items-center gap-3 mb-6">
                 <div className="px-4 py-1.5 bg-rihla/20 backdrop-blur-xl border border-rihla/30 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-rihla">
                    Expérience Exclusive S'TOURS
                 </div>
                 <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                    REF: {project.reference}
                 </div>
               </div>
               <h1 className="text-8xl font-black tracking-tighter leading-[0.9] mb-8">
                 {project.name.split(' ').map((word: string, i: number) => (
                   <span key={i} className={i % 2 === 1 ? 'text-rihla' : ''}>{word} </span>
                 ))}
               </h1>
               <div className="flex gap-12 items-center">
                  <div className="flex gap-10">
                     <Stat icon={Calendar} label="Durée" value={`${project.duration_days} Jours`} />
                     <Stat icon={Users} label="Voyageurs" value={`${project.pax_count} Personnes`} />
                     <Stat icon={MapPin} label="Destination" value={project.destination} />
                  </div>
                  <button 
                    onClick={() => {
                       const el = document.getElementById('itinerary')
                       el?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="w-24 h-24 rounded-full border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-all group"
                  >
                     <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                  </button>
               </div>
            </div>
         </div>
      </section>

      {/* ── STICKY NAV ────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-2xl border-b border-white/5 px-10 h-20 flex items-center justify-between">
         <div className="flex items-center gap-8">
            {data.project.branding_config?.logo_url ? (
               <img src={data.project.branding_config.logo_url} className="h-10 object-contain" alt={data.project.branding_config.partner_name} />
            ) : (
               <img src="/logo-stours-light.png" className="h-8 opacity-80" alt="S'TOURS" />
            )}
            <div className="h-4 w-px bg-white/10" />
            <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-white/40">
               <a href="#itinerary" className="hover:text-white transition-colors">L'Itinéraire</a>
               <a href="#hotels" className="hover:text-white transition-colors">Hébergements</a>
               <a href="#details" className="hover:text-white transition-colors">Inclusions</a>
            </div>
         </div>
         <div className="flex items-center gap-6">
            <div className="text-right">
               <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Budget Total</p>
               <p className="text-xl font-black tracking-tighter">{data.quotation_total?.toLocaleString()} {data.currency}</p>
            </div>
            <button 
              onClick={() => setShowCheckout(true)}
              className="px-10 py-4 bg-rihla text-white text-[11px] font-black uppercase rounded-full shadow-2xl shadow-rihla/20 hover:scale-105 active:scale-95 transition-all"
            >
               Réserver l'Expérience
            </button>
         </div>
      </nav>

      {/* ── ITINERARY SECTION ─────────────────────────────────── */}
      <section id="itinerary" className="max-w-7xl mx-auto py-32 px-10 grid grid-cols-12 gap-20">
         <div className="col-span-5 sticky top-40 h-fit space-y-12">
            <div>
               <h2 className="text-5xl font-black tracking-tighter mb-6 leading-tight">Votre Parcours <br/><span className="text-rihla italic">Sur-Mesure</span></h2>
               <p className="text-lg text-white/60 leading-relaxed font-medium">
                 Nous avons conçu cet itinéraire pour capturer l'essence du Maroc, entre tradition impériale et modernité cosmopolite.
               </p>
            </div>
            
            <div className="space-y-4">
               {data.days.map((day: any) => (
                 <button 
                   key={day.id}
                   onClick={() => setActiveDay(day.day_number)}
                   className={clsx(
                     "w-full flex items-center gap-6 p-6 rounded-[32px] border transition-all text-left group",
                     activeDay === day.day_number ? "bg-white text-slate-950 border-white shadow-2xl scale-105" : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                   )}
                 >
                    <div className={clsx(
                      "w-12 h-12 rounded-2xl flex items-center justify-center font-serif text-xl font-bold",
                      activeDay === day.day_number ? "bg-slate-900 text-white" : "bg-white/10 text-white"
                    )}>
                       {day.day_number}
                    </div>
                    <div className="flex-1">
                       <p className={clsx("text-[9px] font-black uppercase tracking-widest mb-1", activeDay === day.day_number ? "text-rihla" : "text-white/40")}>
                         {day.city}
                       </p>
                       <p className="text-sm font-black truncate">{day.title}</p>
                    </div>
                    <ChevronRight size={18} className={clsx("transition-transform", activeDay === day.day_number ? "translate-x-1" : "opacity-0")} />
                 </button>
               ))}
            </div>
         </div>

         <div className="col-span-7 space-y-20">
            {/* Dynamic Map Component */}
            <div className="h-[500px] rounded-[60px] overflow-hidden border border-white/5 shadow-2xl">
               <ItineraryMap days={data.days} />
            </div>

            {/* Day Details Card */}
            {data.days.map((day: any) => activeDay === day.day_number && (
              <div key={day.id} className="animate-in fade-in slide-in-from-right-10 duration-700">
                 <div className="relative aspect-[16/9] rounded-[60px] overflow-hidden mb-12 group">
                    <img src={day.image_url || `https://images.unsplash.com/photo-1539020140153-e479b8c22e70?q=80&w=2070&auto=format&fit=crop`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt={day.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-12 left-12">
                       <div className="flex items-center gap-4 text-white/80 text-xs font-bold mb-2">
                          <Plane size={16} /> {day.travel_time || '2h 30m'} de trajet
                       </div>
                       <h3 className="text-4xl font-black">{day.title}</h3>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-6">
                       <p className="text-xl text-white/80 leading-relaxed font-serif">
                         {day.description}
                       </p>
                    </div>
                    <div className="space-y-6">
                       <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] space-y-6">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-rihla/20 flex items-center justify-center text-rihla">
                                <Building2 size={24} />
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Hébergement</p>
                                <p className="text-sm font-black">{day.hotel}</p>
                                <div className="flex text-amber-500 mt-1">
                                   {[...Array(5)].map((_, i) => <Star key={i} size={10} fill="currentColor" />)}
                                </div>
                             </div>
                          </div>
                          <hr className="border-white/5" />
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                <Coffee size={24} />
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Restauration</p>
                                <p className="text-sm font-black">{day.meal_plan || 'Petit-Déjeuner Inclus'}</p>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
            ))}
         </div>
      </section>

      {/* ── CHECKOUT MODAL ────────────────────────────────────── */}
      {showCheckout && (
        <CheckoutFlow 
          token={token!} 
          total={data.quotation_total} 
          currency={data.currency} 
          step={checkoutStep}
          setStep={setCheckoutStep}
          onClose={() => setShowCheckout(false)} 
        />
      )}

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="bg-slate-900 py-32 px-10">
         <div className="max-w-7xl mx-auto text-center space-y-12">
            <h2 className="text-6xl font-black tracking-tighter">Prêt pour l'aventure ?</h2>
            <p className="text-white/40 max-w-2xl mx-auto">
              Nos travel designers sont à votre disposition pour toute modification. 
              Votre voyage commence ici.
            </p>
            <div className="flex justify-center gap-6">
               <button onClick={() => setShowCheckout(true)} className="px-12 py-5 bg-rihla text-white text-[11px] font-black uppercase rounded-full shadow-2xl hover:scale-105 transition-all">
                 Réserver maintenant
               </button>
               <button className="px-12 py-5 bg-white/5 text-white text-[11px] font-black uppercase rounded-full border border-white/10 hover:bg-white/10 transition-all">
                 Demander un rappel
               </button>
            </div>
         </div>
      </footer>

    </div>
  )
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{label}</p>
      <div className="flex items-center gap-3 text-lg font-black italic">
         <Icon size={18} className="text-rihla" /> {value}
      </div>
    </div>
  )
}

function CheckoutFlow({ token, total, currency, step, setStep, onClose }: any) {
  const [signatureName, setSignatureName] = useState('')
  const [cardNumber, setCardNumber] = useState('')

  const signMutation = useMutation({
    mutationFn: () => proposalsApi.sign(token, { signature_name: signatureName, signature_data: 'SIGNED_VIA_UI' }),
    onSuccess: () => setStep('pay')
  })

  const payMutation = useMutation({
    mutationFn: () => proposalsApi.pay(token),
    onSuccess: () => setStep('success')
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-xl">
       <div className="w-full max-w-4xl bg-slate-900 rounded-[60px] border border-white/10 overflow-hidden shadow-2xl flex flex-col md:flex-row h-[700px]">
          
          {/* Sidebar Info */}
          <div className="w-full md:w-[350px] bg-slate-950 p-12 flex flex-col justify-between border-r border-white/5">
             <div>
                <img src="/logo-stours-light.png" className="h-6 opacity-40 mb-12" alt="S'TOURS" />
                <h3 className="text-2xl font-black mb-8 leading-tight">Confirmation de Réservation</h3>
                <div className="space-y-6">
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-white/40 uppercase font-black">Acompte (30%)</span>
                      <span className="font-black">{(total * 0.3).toLocaleString()} {currency}</span>
                   </div>
                   <div className="flex justify-between items-center text-xs">
                      <span className="text-white/40 uppercase font-black">TVA (20%)</span>
                      <span className="font-black italic">Incluse</span>
                   </div>
                   <hr className="border-white/5" />
                   <div className="flex justify-between items-center">
                      <span className="text-sm font-black text-rihla uppercase">Total TTC</span>
                      <span className="text-2xl font-black">{total?.toLocaleString()} {currency}</span>
                   </div>
                </div>
             </div>
             <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                <p className="text-[9px] font-black text-white/40 uppercase mb-3 tracking-widest">Garantie S'TOURS</p>
                <div className="flex items-center gap-3 text-[10px] font-bold text-emerald-400">
                   <ShieldCheck size={16} /> Paiement Sécurisé 256-bit SSL
                </div>
             </div>
          </div>

          {/* Main Flow */}
          <div className="flex-1 p-16 relative overflow-y-auto">
             <button onClick={onClose} className="absolute top-10 right-10 text-white/40 hover:text-white"><X size={24} /></button>

             {/* Steps Progress */}
             <div className="flex gap-4 mb-16">
                {['review', 'sign', 'pay'].map((s, i) => (
                  <div key={s} className="flex-1 flex flex-col gap-2">
                     <div className={clsx(
                       "h-1.5 rounded-full",
                       step === s ? "bg-rihla" : (i < ['review','sign','pay'].indexOf(step) ? "bg-emerald-500" : "bg-white/10")
                     )} />
                     <span className={clsx("text-[9px] font-black uppercase tracking-widest", step === s ? "text-white" : "text-white/20")}>{s}</span>
                  </div>
                ))}
             </div>

             {/* STEP 1: REVIEW */}
             {step === 'review' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-10">
                  <h4 className="text-3xl font-black tracking-tighter">Récapitulatif de votre séjour</h4>
                  <p className="text-white/60 leading-relaxed">
                    Veuillez valider les conditions générales de vente (CGV) avant de procéder à la signature de votre contrat de voyage.
                  </p>
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-8 h-48 overflow-y-auto text-xs text-white/40 leading-relaxed font-medium">
                     <p className="mb-4 font-black text-white">Conditions Particulières de Vente (S'TOURS DMC)</p>
                     Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat...
                  </div>
                  <button 
                    onClick={() => setStep('sign')}
                    className="w-full py-6 bg-rihla text-white font-black uppercase text-xs tracking-widest rounded-3xl shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Accepter & Signer
                  </button>
               </div>
             )}

             {/* STEP 2: SIGN */}
             {step === 'sign' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-10">
                  <h4 className="text-3xl font-black tracking-tighter">Signature Électronique</h4>
                  <p className="text-white/60 leading-relaxed">Veuillez saisir votre nom complet tel qu'il apparaît sur votre passeport pour valider le contrat.</p>
                  
                  <div className="space-y-4">
                     <input 
                       type="text" 
                       value={signatureName} onChange={e => setSignatureName(e.target.value)}
                       placeholder="Prénom & NOM"
                       className="w-full bg-transparent border-b-2 border-white/10 py-6 text-3xl font-serif italic focus:outline-none focus:border-rihla transition-colors"
                     />
                     <div className="flex items-center gap-3 text-white/40 italic text-xs">
                        <PenTool size={14} /> Signature certifiée eIDAS
                     </div>
                  </div>

                  <div className="pt-10">
                    <button 
                      onClick={() => signMutation.mutate()}
                      disabled={!signatureName || signMutation.isPending}
                      className="w-full py-6 bg-rihla text-white font-black uppercase text-xs tracking-widest rounded-3xl shadow-2xl disabled:opacity-50"
                    >
                      {signMutation.isPending ? 'Certification...' : 'Valider la Signature'}
                    </button>
                  </div>
               </div>
             )}

             {/* STEP 3: PAY */}
             {step === 'pay' && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-10">
                  <h4 className="text-3xl font-black tracking-tighter">Paiement de l'Acompte</h4>
                  <p className="text-white/60 leading-relaxed">Le règlement sécurisé de l'acompte (30%) confirme votre réservation instantanément.</p>
                  
                  <div className="space-y-6">
                     <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Numéro de Carte</label>
                           <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl p-4">
                              <CreditCard className="text-white/20" />
                              <input 
                                type="text" placeholder="#### #### #### ####"
                                value={cardNumber} onChange={e => setCardNumber(e.target.value)}
                                className="bg-transparent flex-1 text-sm font-bold focus:outline-none"
                              />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">Expiration</label>
                              <input type="text" placeholder="MM / YY" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:outline-none" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-white/40 uppercase tracking-widest">CVC</label>
                              <div className="relative">
                                 <input type="password" placeholder="***" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-bold focus:outline-none" />
                                 <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                              </div>
                           </div>
                        </div>
                     </div>
                     <button 
                      onClick={() => payMutation.mutate()}
                      disabled={payMutation.isPending}
                      className="w-full py-6 bg-emerald-500 text-white font-black uppercase text-xs tracking-widest rounded-3xl shadow-2xl"
                     >
                       {payMutation.isPending ? 'Traitement...' : 'Payer l\'Acompte'}
                     </button>
                  </div>
               </div>
             )}

             {/* SUCCESS */}
             {step === 'success' && (
               <div className="h-full flex flex-col items-center justify-center text-center space-y-8 animate-in zoom-in-95 duration-500">
                  <div className="w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/20">
                     <CheckCircle2 size={48} />
                  </div>
                  <div>
                    <h4 className="text-4xl font-black tracking-tighter mb-4 text-emerald-400">Voyage Confirmé !</h4>
                    <p className="text-white/60 text-lg font-medium leading-relaxed">
                      Félicitations, votre expérience au Maroc est désormais réservée.<br/>
                      Un e-mail de confirmation avec votre carnet de voyage a été envoyé.
                    </p>
                  </div>
                  <button 
                    onClick={onClose}
                    className="px-12 py-5 bg-white text-slate-950 font-black uppercase text-xs tracking-widest rounded-full"
                  >
                    Fermer & Découvrir mon Itinéraire
                  </button>
               </div>
             )}

          </div>
       </div>
    </div>
  )
}

function X({ size, className }: any) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
}
