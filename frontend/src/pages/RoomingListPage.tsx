import { useState } from 'react'
import { 
  Users, Bed, Download, Plus, Trash2, 
  UserPlus, CheckCircle2, AlertCircle, 
  FileSpreadsheet, Mail, ChevronRight, User
} from 'lucide-react'
import { clsx } from 'clsx'

interface Participant {
  id: string
  name: string
  roomType: 'SGL' | 'DBL' | 'TWIN' | 'TRPL'
  roomNumber?: string
  notes?: string
}

export function RoomingListPage() {
  const [participants, setParticipants] = useState<Participant[]>([
    { id: '1', name: 'Mr. John Smith', roomType: 'SGL', roomNumber: '101' },
    { id: '2', name: 'Mrs. Jane Doe', roomType: 'DBL', roomNumber: '102' },
    { id: '3', name: 'Mr. Robert Doe', roomType: 'DBL', roomNumber: '102' },
    { id: '4', name: 'Ms. Alice Johnson', roomType: 'TWIN', roomNumber: '105' },
    { id: '5', name: 'Mr. Michael Brown', roomType: 'TWIN', roomNumber: '105' },
  ])

  const stats = {
    total: participants.length,
    sgl: participants.filter(p => p.roomType === 'SGL').length,
    dbl: participants.filter(p => p.roomType === 'DBL' || p.roomType === 'TWIN').length / 2,
    assigned: participants.filter(p => p.roomNumber).length
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 transition-colors">
      
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto flex justify-between items-end mb-10">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Opérations <ChevronRight size={10} /> Rooming List
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter flex items-center gap-4">
            <Users className="text-rihla" size={36} />
            Rooming List Manager
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-medium italic">
            Projet : <span className="text-rihla font-bold">Légendes Impériales — Groupe Henderson</span>
          </p>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm">
            <Download size={16} /> Export PDF Hôtel
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-rihla text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-rihla/20 hover:-translate-y-0.5 transition-all">
            <UserPlus size={16} /> Ajouter Participant
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-8">
        
        {/* ── LEFT: STATS & TOOLS ───────────────────────────────── */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-200 dark:border-white/10 shadow-sm">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Résumé Occupation</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Total PAX</span>
                <span className="text-lg font-black">{stats.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Chambres SGL</span>
                <span className="text-lg font-black text-blue-500">{stats.sgl}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Chambres DBL/TWN</span>
                <span className="text-lg font-black text-emerald-500">{Math.ceil(stats.dbl)}</span>
              </div>
              <hr className="border-slate-100 dark:border-white/5" />
              <div className="pt-2">
                <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                  <span>Assignation</span>
                  <span className="text-rihla">{Math.round((stats.assigned / stats.total) * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-rihla" style={{ width: `${(stats.assigned / stats.total) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl shadow-slate-900/20">
            <CheckCircle2 size={24} className="text-emerald-400 mb-4" />
            <h4 className="text-sm font-black mb-2 uppercase tracking-tight">Prêt pour l'envoi ?</h4>
            <p className="text-[11px] text-white/50 leading-relaxed mb-6">
              Tous les participants sont assignés. Vous pouvez envoyer la liste directement à la réception de l'hôtel.
            </p>
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
              <Mail size={14} /> Envoyer à l'Hôtel
            </button>
          </div>
        </div>

        {/* ── RIGHT: PARTICIPANTS TABLE ─────────────────────────── */}
        <div className="col-span-12 lg:col-span-9">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Participant</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Type Chambre</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">N° Chambre</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes Spéciales</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {participants.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                          <User size={14} />
                        </div>
                        <span className="text-sm font-bold text-slate-800 dark:text-cream">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={clsx(
                        "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border",
                        p.roomType === 'SGL' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : 
                        p.roomType === 'DBL' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        "bg-purple-500/10 text-purple-500 border-purple-500/20"
                      )}>
                        {p.roomType}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <input 
                        type="text" 
                        defaultValue={p.roomNumber}
                        className="w-16 bg-transparent border-b border-dashed border-slate-200 dark:border-white/10 text-center text-sm font-mono font-bold focus:border-rihla outline-none"
                      />
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-[11px] text-slate-400 italic font-medium">{p.notes || "Aucune restriction"}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="p-6 bg-slate-50/50 dark:bg-white/[0.01] border-t border-slate-100 dark:border-white/5 flex justify-center">
              <button className="flex items-center gap-2 text-[11px] font-black text-rihla uppercase tracking-[0.2em] hover:opacity-80 transition-opacity">
                <Plus size={14} /> Ajouter une ligne d'occupation
              </button>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
