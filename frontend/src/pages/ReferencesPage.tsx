import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, Trash2, RefreshCw, Hash, Search, Clock } from 'lucide-react'
import { referencesApi } from '@/lib/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner, SectionTitle } from '@/components/ui'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── Today as AAMMJJ ──────────────────────────────────────────────
function todayStr() {
  const d = new Date()
  const yy = String(d.getFullYear()).slice(2)
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const dd  = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

// ── Copy button ───────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className={`p-1.5 rounded-brand transition-all
        ${copied
          ? 'bg-green-50 text-green-600'
          : 'hover:bg-warm text-muted hover:text-ink'}`}
      title="Copier"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )
}

// ── Department badge ──────────────────────────────────────────────
const DEPT_COLORS: Record<string, string> = {
  ME: 'bg-bordeaux-100 text-bordeaux',
  DL: 'bg-green-50 text-green-700',
  DI: 'bg-royal-50 text-royal',
  BT: 'bg-amber-50 text-amber-700',
  MS: 'bg-purple-50 text-purple-700',
}

function DeptBadge({ code, label }: { code: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill
                      text-[10px] font-bold uppercase tracking-wide
                      ${DEPT_COLORS[code] ?? 'bg-warm text-muted'}`}>
      {code}
      <span className="font-normal normal-case tracking-normal opacity-70">
        · {label}
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export function ReferencesPage() {
  const qc = useQueryClient()

  // Form state
  const [groupName,   setGroupName]   = useState('')
  const [airportCode, setAirportCode] = useState('CMN')
  const [deptCode,    setDeptCode]    = useState('ME')
  const [dateStr,     setDateStr]     = useState(todayStr())
  const [notes,       setNotes]       = useState('')
  const [useCustomDate, setUseCustomDate] = useState(false)

  // UI state
  const [preview,     setPreview]     = useState('')
  const [previewSeq,  setPreviewSeq]  = useState(1)
  const [generated,   setGenerated]   = useState<any | null>(null)
  const [search,      setSearch]      = useState('')
  const [filterDept,  setFilterDept]  = useState('')
  const [lastCopied,  setLastCopied]  = useState(false)

  // Static data
  const { data: airports } = useQuery({
    queryKey: ['airports'],
    queryFn: () => referencesApi.airports().then(r => r.data),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => referencesApi.departments().then(r => r.data),
  })

  // History
  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ['references', filterDept, search],
    queryFn: () => referencesApi.list({
      dept_code: filterDept || undefined,
      search:    search    || undefined,
      limit: 100,
    }).then(r => r.data),
  })

  // Live preview (debounced)
  useEffect(() => {
    if (!groupName.trim() || !airportCode || !deptCode) {
      setPreview('')
      return
    }
    const timeout = setTimeout(() => {
      referencesApi.preview({
        group_name:   groupName.trim(),
        airport_code: airportCode,
        dept_code:    deptCode,
        date_str:     useCustomDate ? dateStr : undefined,
      }).then(r => {
        setPreview(r.data.preview)
        setPreviewSeq(r.data.seq_number)
      }).catch(() => setPreview(''))
    }, 300)
    return () => clearTimeout(timeout)
  }, [groupName, airportCode, deptCode, dateStr, useCustomDate])

  // Generate mutation
  const generateMut = useMutation({
    mutationFn: () => referencesApi.generate({
      group_name:   groupName.trim(),
      airport_code: airportCode,
      dept_code:    deptCode,
      date_str:     useCustomDate ? dateStr : undefined,
      notes:        notes || undefined,
    }),
    onSuccess: (res) => {
      setGenerated(res.data)
      qc.invalidateQueries({ queryKey: ['references'] })
      // reset form for next entry
      setGroupName('')
      setNotes('')
    },
  })

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: string) => referencesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['references'] }),
  })

  const currentAirport = airports?.find((a: any) => a.code === airportCode)
  const currentDept    = departments?.find((d: any) => d.code === deptCode)

  // Format date string for display
  const formatDateStr = (ds: string) => {
    if (ds.length !== 6) return ds
    return `${ds.slice(4)}.${ds.slice(2, 4)}.20${ds.slice(0, 2)}`
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Générateur de références"
        subtitle="Format : NOM GROUPE · Aéroport IATA · Département · Date · Numéro séquentiel"
      />

      <div className="p-8 grid grid-cols-[400px_1fr] gap-6 items-start">

        {/* ── LEFT: Generator form ──────────────────────────────── */}
        <div className="space-y-4">

          {/* Live preview card */}
          <div className={`rounded-card border-2 p-5 transition-all duration-300
            ${preview
              ? 'border-bordeaux bg-bordeaux/[0.03]'
              : 'border-line bg-white'}`}>
            <p className="text-label text-muted mb-3">Aperçu en temps réel</p>
            {preview ? (
              <>
                <p className="font-mono font-bold text-ink text-lg leading-tight break-all">
                  {preview}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted font-mono">N° {String(previewSeq).padStart(4, '0')}</span>
                    {currentDept && (
                      <DeptBadge code={currentDept.code} label={currentDept.label} />
                    )}
                  </div>
                  <CopyBtn text={preview} />
                </div>
              </>
            ) : (
              <p className="text-muted text-sm italic">
                Remplissez le formulaire pour voir l'aperçu…
              </p>
            )}
          </div>

          {/* Form card */}
          <div className="card p-5 space-y-4">
            <SectionTitle>Paramètres</SectionTitle>

            {/* Group name */}
            <div>
              <label className="text-label text-muted block mb-1.5">
                Nom du groupe / dossier *
              </label>
              <input
                className="input-base font-semibold"
                placeholder="ex : TECHCORP, ESO TRAVEL, INCENTIVE PARIS…"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && groupName.trim() && generateMut.mutate()}
                autoFocus
              />
              <p className="text-[11px] text-muted mt-1">
                Sera automatiquement mis en majuscules
              </p>
            </div>

            {/* Airport */}
            <div>
              <label className="text-label text-muted block mb-1.5">
                Aéroport *
              </label>
              <select
                className="input-base"
                value={airportCode}
                onChange={e => setAirportCode(e.target.value)}
              >
                {airports?.map((a: any) => (
                  <option key={a.code} value={a.code}>
                    {a.city} — {a.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="text-label text-muted block mb-1.5">
                Département *
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {departments?.map((d: any) => (
                  <button
                    key={d.code}
                    onClick={() => setDeptCode(d.code)}
                    title={d.label}
                    className={`py-2 rounded-brand text-xs font-bold transition-all
                      ${deptCode === d.code
                        ? 'bg-bordeaux text-warm ring-2 ring-bordeaux/30'
                        : 'bg-warm border border-line text-muted hover:text-ink hover:border-bordeaux/30'}`}
                  >
                    {d.code}
                  </button>
                ))}
              </div>
              {currentDept && (
                <p className="text-[11px] text-muted mt-1.5">
                  {currentDept.label}
                </p>
              )}
            </div>

            {/* Date */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-label text-muted">Date (AAMMJJ)</label>
                <button
                  onClick={() => setUseCustomDate(!useCustomDate)}
                  className="text-[11px] text-royal hover:underline"
                >
                  {useCustomDate ? 'Utiliser aujourd\'hui' : 'Changer la date'}
                </button>
              </div>
              {useCustomDate ? (
                <input
                  className="input-base font-mono"
                  placeholder="AAMMJJ ex: 260416"
                  maxLength={6}
                  pattern="\d{6}"
                  value={dateStr}
                  onChange={e => setDateStr(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              ) : (
                <div className="input-base bg-warm/60 text-muted font-mono cursor-default">
                  {todayStr()} &nbsp;·&nbsp; {formatDateStr(todayStr())}
                </div>
              )}
            </div>

            {/* Notes (optional) */}
            <div>
              <label className="text-label text-muted block mb-1.5">
                Notes <span className="font-normal normal-case">(optionnel)</span>
              </label>
              <input
                className="input-base"
                placeholder="Vol, client, remarque…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Generate button */}
            <button
              onClick={() => generateMut.mutate()}
              disabled={!groupName.trim() || generateMut.isPending}
              className="btn-primary w-full justify-center py-3 text-base mt-2"
            >
              {generateMut.isPending
                ? <><Spinner size={16} className="text-warm" /> Génération…</>
                : <><Hash size={16} /> Générer la référence</>}
            </button>
          </div>

          {/* Last generated */}
          {generated && (
            <div className="card p-4 border-green-200 bg-green-50/50 animate-fade-up">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-label text-green-600 mb-2">✓ Référence générée</p>
                  <p className="font-mono font-bold text-ink break-all">
                    {generated.full_reference}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {generated.dept_label} · {generated.airport_city} ·
                    N° {String(generated.seq_number).padStart(4, '0')}
                  </p>
                </div>
                <CopyBtn text={generated.full_reference} />
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: History ────────────────────────────────────── */}
        <div className="card overflow-hidden">
          {/* Header + filters */}
          <div className="px-5 py-4 border-b border-line">
            <div className="flex items-center justify-between mb-3">
              <SectionTitle className="mb-0">Historique</SectionTitle>
              <div className="flex items-center gap-1 text-xs text-muted">
                <Clock size={12} />
                {history?.length ?? 0} référence(s)
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="input-base pl-8 text-xs"
                  placeholder="Rechercher…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {/* Dept filter */}
              <div className="flex items-center gap-1">
                {['', 'ME', 'DL', 'DI', 'BT', 'MS'].map(d => (
                  <button
                    key={d}
                    onClick={() => setFilterDept(d)}
                    className={`px-2.5 py-1.5 rounded-brand text-[11px] font-bold transition-all
                      ${filterDept === d
                        ? 'bg-bordeaux text-warm'
                        : 'text-muted hover:text-ink hover:bg-warm border border-transparent hover:border-line'}`}
                  >
                    {d || 'Tous'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {histLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !history?.length ? (
            <div className="text-center py-12 text-muted">
              <Hash size={24} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucune référence générée pour l'instant</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    {['Référence complète', 'Département', 'Aéroport', 'Date', 'N°', 'Notes', ''].map(h => (
                      <th key={h}
                          className="text-left text-label text-muted px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((r: any) => (
                    <tr key={r.id}
                        className="border-b border-line/50 hover:bg-warm/40 transition-colors group">

                      {/* Full reference */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-ink text-xs
                                           whitespace-nowrap">
                            {r.full_reference}
                          </span>
                          <CopyBtn text={r.full_reference} />
                        </div>
                      </td>

                      {/* Dept */}
                      <td className="px-4 py-3">
                        <DeptBadge code={r.dept_code} label={r.dept_label} />
                      </td>

                      {/* Airport */}
                      <td className="px-4 py-3">
                        <span className="text-xs">
                          <span className="text-muted">{r.airport_city}</span>
                          <span className="font-mono font-semibold text-ink ml-1">
                            {r.airport_code}
                          </span>
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        {formatDateStr(r.date_str)}
                      </td>

                      {/* Seq */}
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-ink">
                        {String(r.seq_number).padStart(4, '0')}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 text-xs text-muted max-w-[160px] truncate">
                        {r.notes || '–'}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteMut.mutate(r.id)}
                          disabled={deleteMut.isPending}
                          className="p-1.5 rounded-brand opacity-0 group-hover:opacity-100
                                     hover:bg-red-50 text-muted hover:text-red-500 transition-all"
                          title="Supprimer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// helper outside component to avoid re-render issue
function formatDateStr(ds: string) {
  if (ds.length !== 6) return ds
  return `${ds.slice(4)}.${ds.slice(2, 4)}.20${ds.slice(0, 2)}`
}
