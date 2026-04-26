import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, HelpCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface Step {
  target: string
  title: string
  content: string
  position: 'top' | 'bottom' | 'left' | 'right'
}

const STEPS: Step[] = [
  {
    target: 'sidebar-projects',
    title: 'Vos Projets',
    content: 'C\'est ici que vous gérez tout votre portfolio de dossiers.',
    position: 'right'
  },
  {
    target: 'btn-new-project',
    title: 'Nouveau Dossier',
    content: 'Commencez par créer un projet ou utilisez l\'Assistant IA.',
    position: 'bottom'
  },
  {
    target: 'search-universal',
    title: 'Recherche Universelle',
    content: 'Appuyez sur Ctrl+K pour tout trouver instantanément.',
    position: 'bottom'
  },
]

export function GuidedTour() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('rihla_tour_seen')
    if (!hasSeenTour) {
      setTimeout(() => setIsOpen(true), 2000)
    }
  }, [])

  const finish = () => {
    localStorage.setItem('rihla_tour_seen', 'true')
    setIsOpen(false)
  }

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="fixed bottom-6 right-6 w-12 h-12 rounded-full bg-rihla text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group"
    >
      <HelpCircle size={20} />
      <span className="absolute right-14 bg-slate-900 text-white text-[10px] font-black uppercase px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Besoin d'aide ?</span>
    </button>
  )

  const step = STEPS[currentStep]

  return (
    <div className="fixed inset-0 z-[300] pointer-events-none">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] pointer-events-auto" onClick={finish} />
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-3xl border border-slate-200 dark:border-white/10 pointer-events-auto animate-in zoom-in-95 duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-rihla/10 flex items-center justify-center text-rihla">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-cream uppercase tracking-widest">{step.title}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Étape {currentStep + 1} / {STEPS.length}</p>
          </div>
          <button onClick={finish} className="ml-auto p-2 text-slate-300 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-8">
          {step.content}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={clsx("h-1 rounded-full transition-all", i === currentStep ? "w-4 bg-rihla" : "w-1 bg-slate-200")} />
            ))}
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <button onClick={() => setCurrentStep(s => s - 1)} className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all">
                <ChevronLeft size={16} />
              </button>
            )}
            <button 
              onClick={() => currentStep === STEPS.length - 1 ? finish() : setCurrentStep(s => s + 1)}
              className="flex items-center gap-2 px-6 py-3 bg-rihla text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-rihla/20"
            >
              {currentStep === STEPS.length - 1 ? 'C\'est parti !' : 'Suivant'}
              {currentStep < STEPS.length - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
