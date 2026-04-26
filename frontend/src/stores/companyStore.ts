import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { companiesApi } from '@/lib/api'
import type { CompanyWithRole } from '@/types/company'

interface CompanyState {
  current: CompanyWithRole | null
  available: CompanyWithRole[]
  isLoading: boolean
  fetchMyCompanies: () => Promise<void>
  switchTo: (companyId: string) => Promise<void>
  reset: () => void
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set, get) => ({
      current: null,
      available: [],
      isLoading: false,

      fetchMyCompanies: async () => {
        set({ isLoading: true })
        try {
          const { data } = await companiesApi.myCompanies()
          const current = get().current
            ? data.find(c => c.id === get().current?.id) || data.find(c => c.is_default) || data[0] || null
            : data.find(c => c.is_default) || data[0] || null
          set({ available: data, current })
        } finally {
          set({ isLoading: false })
        }
      },

      switchTo: async (companyId) => {
        const { data } = await companiesApi.switch(companyId)
        // Persist the new tokens (carrying company_id) and set the current company
        localStorage.setItem('stours_token', data.access_token)
        const { useAuthStore } = await import('@/stores/authStore')
        useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
        set({ current: data.company })
        // Force a soft reload so all data gets refetched under the new tenant
        window.location.reload()
      },

      reset: () => set({ current: null, available: [] }),
    }),
    {
      name: 'stours-company',
      partialize: (s) => ({ current: s.current }),
    },
  ),
)
