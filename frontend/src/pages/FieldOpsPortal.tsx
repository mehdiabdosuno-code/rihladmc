import {
  Bus, Users, MapPin, Navigation,
  CheckCircle2, ChevronRight,
  Calendar, Briefcase, MessageSquare, Menu, X,
  Wifi, WifiOff, Map, ShieldAlert, QrCode, Download, CloudOff,
} from 'lucide-react'
import { clsx } from 'clsx'
import { QRCodeSVG } from 'qrcode.react'
import { useAuthStore } from '@/stores/authStore'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fieldOpsApi } from '@/lib/api'
import { useOfflineQueue, cacheTasks, readCachedTasks } from '@/hooks/useOfflineQueue'
import { usePWAInstall } from '@/hooks/usePWAInstall'

// ── TYPES ─────────────────────────────────────────────────────────
interface Task {
  id: string
  title: string
  description?: string
  task_type: string
  status: 'pending' | 'active' | 'completed' | 'delayed'
  time: string
  location: string
  pax_count?: number
  vehicle?: string
  project_id: string
}

export function FieldOpsPortal() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [reportingTaskId, setReportingTaskId] = useState<string | null>(null)
  const [voucherTaskId, setVoucherTaskId] = useState<string | null>(null)

  // Offline-first: cached tasks displayed immediately, refreshed in background
  const cachedRaw = readCachedTasks<Task[]>()
  const { isOnline, queueSize, enqueueOrApply } = useOfflineQueue(() => {
    queryClient.invalidateQueries({ queryKey: ['field-tasks'] })
  })
  const { canInstall, install } = usePWAInstall()

  const { data: tasks = (cachedRaw?.tasks ?? []), isLoading } = useQuery<Task[]>({
    queryKey: ['field-tasks'],
    queryFn: async () => {
      const r = await fieldOpsApi.getTasks()
      cacheTasks(r.data)
      return r.data
    },
    refetchInterval: 10000,
    initialData: cachedRaw?.tasks,
    networkMode: 'offlineFirst',
  })

  const activeTask = tasks.find(t => t.status === 'active') || tasks.find(t => t.status === 'pending')
  const roleVal = typeof user?.role === 'string' ? user.role : (user?.role as any)?.name
  const isDriver = roleVal === 'driver'
  const roleTitle = isDriver ? 'CHAUFFEUR VIP' : 'GUIDE ACCOMPAGNATEUR'

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-black">CHARGEMENT...</div>

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-rihla/30">
      
      {/* ── MOBILE HEADER ─────────────────────────────────────── */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10 px-5 py-4 sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-rihla flex items-center justify-center shadow-lg shadow-rihla/20">
              {isDriver ? <Bus size={20} className="text-white" /> : <Users size={20} className="text-white" />}
            </div>
            <div className={clsx(
              "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 flex items-center justify-center",
              isOnline ? "bg-emerald-500" : "bg-red-500"
            )}>
              {isOnline ? <Wifi size={8} className="text-white" /> : <WifiOff size={8} className="text-white" />}
            </div>
          </div>
          <div>
            <h1 className="text-[14px] font-black tracking-tight">{user?.full_name || 'Hassan E.'}</h1>
            <p className="text-[10px] font-bold text-rihla uppercase tracking-[0.2em]">{roleTitle}</p>
          </div>
        </div>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center active:scale-90 transition-transform"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* ── MENU OVERLAY ──────────────────────────────────────── */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-md p-8 animate-in slide-in-from-top-full duration-300">
          <nav className="space-y-6 mt-12 text-center">
            <button className="w-full flex items-center justify-center gap-4 text-3xl font-black"><Calendar className="text-rihla" /> Planning</button>
            <button className="w-full flex items-center justify-center gap-4 text-3xl font-black"><Briefcase className="text-rihla" /> Missions</button>
            <button className="w-full flex items-center justify-center gap-4 text-3xl font-black"><MessageSquare className="text-rihla" /> Chat</button>
            <hr className="border-white/10" />
            <button onClick={() => setIsMenuOpen(false)} className="text-slate-400 font-black uppercase text-sm">Fermer</button>
          </nav>
        </div>
      )}

      {!isOnline && (
        <div className="bg-amber-500/15 border-b border-amber-500/20 text-amber-200 px-5 py-2.5 text-[11px] font-bold flex items-center gap-2">
          <CloudOff size={14} />
          Mode hors ligne — {queueSize > 0 ? `${queueSize} action(s) en attente de sync` : 'données en cache'}
        </div>
      )}
      {canInstall && (
        <div className="bg-rihla/15 border-b border-rihla/20 px-5 py-2.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-rihla-light flex items-center gap-2">
            <Download size={14} /> Installer l'app sur l'écran d'accueil
          </span>
          <button
            onClick={install}
            className="px-3 py-1 rounded-md bg-rihla text-white text-[10px] font-black uppercase tracking-widest active:scale-95"
          >
            Installer
          </button>
        </div>
      )}

      <main className="p-5 pb-24 space-y-8">
        
        {/* ── ACTIVE TASK ─────────────────────────────────────── */}
        {activeTask ? (
          <section>
            <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] mb-3 ml-1">Mission en cours</h2>
            <div className="bg-gradient-to-br from-rihla to-rihla-dark rounded-[32px] p-6 shadow-2xl relative overflow-hidden">
               <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {activeTask.status}
                    </span>
                    <div className="text-right text-white">
                       <p className="text-2xl font-black">{activeTask.time}</p>
                    </div>
                  </div>

                  <h3 className="text-2xl font-black mb-6 leading-tight">{activeTask.title}</h3>

                  <div className="space-y-3 mb-8">
                     <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl">
                        <MapPin size={20} className="text-white/60" />
                        <div>
                          <p className="text-[9px] font-black text-white/40 uppercase">Localisation</p>
                          <p className="text-sm font-bold">{activeTask.location}</p>
                        </div>
                        <button className="ml-auto w-10 h-10 bg-white text-rihla rounded-xl flex items-center justify-center shadow-xl">
                           <Navigation size={18} />
                        </button>
                     </div>
                     <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl">
                        <Users size={20} className="text-white/60" />
                        <div>
                          <p className="text-[9px] font-black text-white/40 uppercase">Logistique</p>
                          <p className="text-sm font-bold">{activeTask.pax_count} PAX · {activeTask.vehicle}</p>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={async () => {
                        await enqueueOrApply(activeTask.id, 'completed')
                        queryClient.invalidateQueries({ queryKey: ['field-tasks'] })
                      }}
                      className="py-4 bg-white text-rihla font-black uppercase text-[10px] rounded-2xl shadow-xl active:scale-95 transition-all"
                    >
                      Terminer ✓
                    </button>
                    <button
                      onClick={() => setVoucherTaskId(activeTask.id)}
                      className="py-4 bg-slate-900/40 text-white font-black uppercase text-[10px] border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-1"
                    >
                      <QrCode size={16} />
                      Voucher
                    </button>
                    <button
                      onClick={() => setReportingTaskId(activeTask.id)}
                      className="py-4 bg-red-500/15 text-red-200 font-black uppercase text-[10px] border border-red-400/20 rounded-2xl"
                    >
                      Incident
                    </button>
                  </div>
               </div>
            </div>
          </section>
        ) : (
          <div className="text-center py-12 bg-white/5 rounded-[40px] border border-dashed border-white/10">
             <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-500" />
             <p className="text-sm font-bold text-slate-400">Aucune mission active pour le moment.</p>
          </div>
        )}

        {/* ── UPCOMING ────────────────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-black text-white/40 uppercase tracking-[0.25em] mb-4 ml-1">Suite du Planning</h2>
          <div className="space-y-3">
             {tasks.filter(t => t.id !== activeTask?.id).map(task => (
               <div key={task.id} className={clsx(
                 "p-5 rounded-3xl border flex items-center gap-4 transition-all",
                 task.status === 'completed' ? "bg-white/[0.02] border-white/5 opacity-50" : "bg-white/5 border-white/10"
               )}>
                 <div className="w-14 h-14 bg-slate-800 rounded-2xl flex flex-col items-center justify-center shrink-0">
                    <span className="text-lg font-black">{task.time}</span>
                 </div>
                 <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold truncate">{task.title}</h4>
                    <p className="text-[10px] text-slate-400 font-medium truncate flex items-center gap-1">
                       <MapPin size={10} /> {task.location}
                    </p>
                 </div>
                 <ChevronRight size={18} className="text-white/20" />
               </div>
             ))}
          </div>
        </section>

      </main>

      {/* ── INCIDENT MODAL ────────────────────────────────────── */}
      {reportingTaskId && (
        <IncidentModal taskId={reportingTaskId} onClose={() => setReportingTaskId(null)} />
      )}

      {/* ── VOUCHER QR MODAL ──────────────────────────────────── */}
      {voucherTaskId && (
        <VoucherModal taskId={voucherTaskId} onClose={() => setVoucherTaskId(null)} />
      )}

      {/* ── TAB BAR ───────────────────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-2xl border-t border-white/5 h-20 px-10 flex items-center justify-between z-50">
         <button className="text-rihla"><Calendar size={24} /></button>
         <button className="text-white/40"><Briefcase size={24} /></button>
         <button className="text-white/40"><MessageSquare size={24} /></button>
         <button className="text-white/40"><Map size={24} /></button>
      </nav>

    </div>
  )
}

function IncidentModal({ taskId, onClose }: { taskId: string, onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState('medium')
  
  const mutation = useMutation({
    mutationFn: () => fieldOpsApi.reportIncident(message, severity, taskId),
    onSuccess: onClose
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-sm">
       <div className="w-full bg-slate-900 rounded-[40px] border border-white/10 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-4 mb-6">
             <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center">
                <ShieldAlert size={24} />
             </div>
             <h3 className="text-xl font-black">Signaler un Problème</h3>
          </div>

          <p className="text-xs text-slate-400 mb-6 font-medium leading-relaxed">
            Expliquez brièvement la situation. Le bureau central S'TOURS sera alerté immédiatement par notification push.
          </p>

          <div className="space-y-4 mb-8">
             <div className="flex gap-2">
                {['low', 'medium', 'high'].map(s => (
                  <button 
                    key={s}
                    onClick={() => setSeverity(s)}
                    className={clsx(
                      "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                      severity === s ? "bg-white text-slate-900 border-white" : "bg-transparent text-slate-400 border-white/10"
                    )}
                  >
                    {s}
                  </button>
                ))}
             </div>
             <textarea 
               value={message} onChange={e => setMessage(e.target.value)}
               placeholder="Ex: Retard du bus, panne de clim, vol annulé..."
               className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-rihla h-32 resize-none"
             />
          </div>

          <div className="flex gap-3">
             <button onClick={onClose} className="flex-1 py-4 text-[11px] font-black uppercase text-slate-400">Annuler</button>
             <button 
              onClick={() => mutation.mutate()}
              disabled={!message || mutation.isPending}
              className="flex-1 py-4 bg-red-500 text-white rounded-2xl text-[11px] font-black uppercase shadow-xl shadow-red-500/20 disabled:opacity-50"
             >
                {mutation.isPending ? 'Envoi...' : 'Envoyer Alerte'}
             </button>
          </div>
       </div>
    </div>
  )
}

function VoucherModal({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['voucher', taskId],
    queryFn: () => fieldOpsApi.getVoucher(taskId).then(r => r.data),
  })

  const verifyUrl = data
    ? `${window.location.origin}/api/field-ops/vouchers/verify?token=${data.voucher_token}`
    : ''

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-[32px] p-7 shadow-2xl animate-in zoom-in-95 duration-200 !text-slate-900" onClick={(e) => e.stopPropagation()} style={{ color: '#0f172a' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-rihla mb-1">Voucher QR</p>
            <h3 className="text-lg font-black">Mission</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>

        {isLoading || !data ? (
          <div className="h-72 flex items-center justify-center text-slate-400 font-bold">Génération du QR…</div>
        ) : (
          <>
            <div className="bg-white border-2 border-slate-100 rounded-2xl p-4 flex items-center justify-center mb-4">
              <QRCodeSVG value={verifyUrl} size={220} level="M" includeMargin />
            </div>

            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Mission</span><span className="font-bold text-slate-900 text-right">{data.title}</span></div>
              {data.location && <div className="flex justify-between gap-3"><span className="text-slate-500">Lieu</span><span className="font-bold text-slate-900 text-right">{data.location}</span></div>}
              {data.time && <div className="flex justify-between gap-3"><span className="text-slate-500">Heure</span><span className="font-bold text-slate-900 text-right">{data.time}</span></div>}
              {data.pax_count != null && <div className="flex justify-between gap-3"><span className="text-slate-500">PAX</span><span className="font-bold text-slate-900 text-right">{data.pax_count}</span></div>}
              {data.vehicle && <div className="flex justify-between gap-3"><span className="text-slate-500">Véhicule</span><span className="font-bold text-slate-900 text-right">{data.vehicle}</span></div>}
              <div className="flex justify-between gap-3 pt-2 border-t border-slate-100"><span className="text-slate-500">Validité</span><span className="font-bold text-slate-900 text-right">{data.expires_in_days} jours</span></div>
            </div>

            <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
              Présentez ce QR à la réception hôtel/restaurant. Ils peuvent le scanner pour valider la prestation sans appel téléphonique.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
