import { useEffect, useState } from 'react'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { clsx } from 'clsx'
import { useCompanyStore } from '@/stores/companyStore'

/**
 * Multi-company switcher dropdown.
 *
 * Drop in the AppShell header next to the user menu:
 *   <CompanySwitcher />
 *
 * Auto-loads the available companies on mount; persists the selected
 * company across reloads via Zustand's `persist` middleware.
 */
export function CompanySwitcher() {
  const { current, available, fetchMyCompanies, switchTo, isLoading } =
    useCompanyStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!available.length) {
      fetchMyCompanies().catch(() => {})
    }
  }, [available.length, fetchMyCompanies])

  if (isLoading || !current) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-400">
        <Building2 className="h-4 w-4" />
        <span>…</span>
      </div>
    )
  }

  // Hide switcher if user only has one company
  if (available.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm">
        <Building2 className="h-4 w-4 text-slate-500" />
        <span className="font-medium text-slate-700">{current.name}</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
      >
        <Building2 className="h-4 w-4 text-slate-500" />
        <span className="font-medium text-slate-700">{current.name}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-md border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              Sociétés
            </div>
            <ul className="max-h-80 overflow-auto py-1">
              {available.map((c) => {
                const active = c.id === current.id
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => {
                        if (!active) switchTo(c.id)
                        setOpen(false)
                      }}
                      className={clsx(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                        active && 'bg-orange-50 text-orange-700',
                      )}
                    >
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <div className="flex-1">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-slate-400">
                          {c.code} · {c.user_role}
                        </div>
                      </div>
                      {active && <Check className="h-4 w-4 text-orange-600" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
