import { useState } from 'react'
import { Camera, Check, RefreshCw, X, Loader2, DollarSign } from 'lucide-react'
import { clsx } from 'clsx'

export function ExpenseCapture() {
  const [step, setStep] = useState<'idle' | 'scanning' | 'review'>('idle')
  const [ocrData, setOcrData] = useState<any>(null)

  const handleCapture = () => {
    setStep('scanning')
    // Simulate AI processing
    setTimeout(() => {
      setOcrData({
         merchant: "Restaurant Dar Es Salaam",
         amount: 450.00,
         category: "Restauration",
         date: "2026-04-24"
      })
      setStep('review')
    }, 2500)
  }

  return (
    <div className="bg-slate-900 border border-white/5 rounded-[32px] overflow-hidden">
       {step === 'idle' && (
         <div className="p-8 text-center">
            <div className="w-16 h-16 bg-rihla/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rihla">
               <Camera size={32} />
            </div>
            <h4 className="text-sm font-black mb-2">Déclarer un Frais</h4>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-6">Numérisez vos reçus en un clic</p>
            <button 
              onClick={handleCapture}
              className="w-full py-4 bg-rihla text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rihla/20"
            >
               Prendre en Photo
            </button>
         </div>
       )}

       {step === 'scanning' && (
         <div className="p-12 text-center space-y-6">
            <div className="relative w-24 h-24 mx-auto">
               <Loader2 size={96} className="text-rihla animate-spin opacity-20" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw size={32} className="text-rihla animate-reverse-spin" />
               </div>
            </div>
            <div>
               <h4 className="text-sm font-black animate-pulse">Analyse IA en cours...</h4>
               <p className="text-[9px] text-white/40 uppercase tracking-widest mt-2">Extraction des montants et taxes</p>
            </div>
         </div>
       )}

       {step === 'review' && (
         <div className="p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
               <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Résultat de l'analyse</h4>
               <button onClick={() => setStep('idle')}><X size={16} /></button>
            </div>
            
            <div className="space-y-4 mb-8">
               <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-white/40 uppercase mb-1">Marchand</p>
                  <p className="text-sm font-bold">{ocrData.merchant}</p>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[9px] font-black text-white/40 uppercase mb-1">Montant</p>
                     <p className="text-sm font-black text-rihla">{ocrData.amount} MAD</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                     <p className="text-[9px] font-black text-white/40 uppercase mb-1">Catégorie</p>
                     <p className="text-sm font-bold">{ocrData.category}</p>
                  </div>
               </div>
            </div>

            <button 
              onClick={() => setStep('idle')}
              className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
               <Check size={16} /> Valider la dépense
            </button>
         </div>
       )}
    </div>
  )
}
