import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { getHomeRoute } from '@/lib/roleConfig'
import { Spinner } from '@/components/ui'
import { ArrowRight, Mail, Lock } from 'lucide-react'
import rihlaLogoLight from '@/assets/rihla_logo_light_bg.png'

export function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, password)
      const role = useAuthStore.getState().user?.role?.name ?? 'sales_agent'
      navigate(getHomeRoute(role))
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Identifiants invalides')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top header bar */}
      <header className="px-6 sm:px-8 py-5 flex items-center justify-between border-b border-slate-100">
        <img src={rihlaLogoLight} alt="RIHLA" className="h-8 w-auto" />
        <div className="text-[12px] text-slate-500">
          Besoin d'un compte ?{' '}
          <a href="mailto:a.chakir@stoursvoyages.ma" className="text-rihla font-medium hover:underline">
            Nous contacter
          </a>
        </div>
      </header>

      {/* Centered form */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[28px] font-semibold text-slate-900 tracking-tight">
            RIHLA Suite
          </h1>
          <p className="text-[12px] uppercase tracking-[0.2em] text-rihla mt-1 font-medium">
            DMC Operating System
          </p>
          <p className="text-[13px] text-slate-500 mt-3">
            O2C · P2P · Itinerary Studio · Field Ops · Joule Agents
          </p>
          <p className="text-[14px] text-slate-700 mt-6 font-medium">
            Connexion à votre espace STOURS VOYAGES.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-[13px] text-rose-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-[12px] font-medium text-slate-700 mb-1.5">
                Adresse e-mail
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@stoursvoyages.ma"
                  className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 bg-white text-[14px]
                             text-slate-900 placeholder:text-slate-400
                             focus:outline-none focus:border-rihla focus:ring-2 focus:ring-rihla/15
                             transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-[12px] font-medium text-slate-700">
                  Mot de passe
                </label>
                <a href="#" className="text-[12px] text-slate-500 hover:text-rihla">
                  Oublié&nbsp;?
                </a>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-200 bg-white text-[14px]
                             text-slate-900 placeholder:text-slate-400
                             focus:outline-none focus:border-rihla focus:ring-2 focus:ring-rihla/15
                             transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-md
                         bg-rihla text-white text-[14px] font-medium
                         hover:bg-rihla-dark active:bg-rihla-dark
                         disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {isLoading ? (
                <Spinner className="text-white" />
              ) : (
                <>
                  Se connecter
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[12px] text-slate-400">
            Accès restreint aux membres de l'équipe STOURS VOYAGES.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 sm:px-8 py-5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>© 2026 RIHLA Suite · STOURS VOYAGES Morocco</span>
        <div className="flex items-center gap-5">
          <a href="#" className="hover:text-slate-600">Statut</a>
          <a href="#" className="hover:text-slate-600">Confidentialité</a>
          <a href="#" className="hover:text-slate-600">CGU</a>
        </div>
      </footer>
    </div>
  )
}
