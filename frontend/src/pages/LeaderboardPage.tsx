import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Trophy, Medal, Star, Target, Zap,
  Crown, Flame, Award, ChevronRight,
  TrendingUp, Users, Search, RefreshCw, MapPin
} from 'lucide-react'
import { gamificationApi } from '@/lib/api'
import { clsx } from 'clsx'

export function LeaderboardPage() {
  const [activeRole, setActiveRole] = useState('travel_designer')

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboard', activeRole],
    queryFn: () => gamificationApi.getLeaderboard(activeRole).then(r => r.data)
  })

  // Mock data if empty for demo
  const displayData = leaderboard.length > 0 ? leaderboard : [
    { name: 'Youssef Alami', points: 12450, level: 12, won: 45, rev: '2.4M', avatar: null, badges: ['top_seller', 'marrakech_expert'] },
    { name: 'Sarah Mansouri', points: 10200, level: 10, won: 38, rev: '1.8M', avatar: null, badges: ['fast_closer'] },
    { name: 'Karim Bennani', points: 9800, level: 9, won: 34, rev: '1.5M', avatar: null, badges: ['desert_specialist'] },
    { name: 'Meryem Idrissi', points: 8500, level: 8, won: 29, rev: '1.2M', avatar: null, badges: [] },
    { name: 'Ahmed Zaki', points: 7200, level: 7, won: 22, rev: '950k', avatar: null, badges: [] },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 px-8 py-10">
        <div className="max-w-5xl mx-auto">
           <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 rounded-[28px] bg-amber-400 flex items-center justify-center text-slate-900 shadow-2xl shadow-amber-400/20">
                    <Trophy size={32} />
                 </div>
                 <div>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-cream tracking-tighter italic">Champions Arena</h1>
                    <p className="text-slate-400 text-[11px] mt-1 uppercase tracking-[0.3em] font-black">Performance & Gamification S'TOURS</p>
                 </div>
              </div>

              <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                 {['travel_designer', 'guide', 'driver'].map(role => (
                   <button 
                     key={role}
                     onClick={() => setActiveRole(role)}
                     className={clsx(
                       "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                       activeRole === role ? "bg-slate-950 dark:bg-white text-white dark:text-slate-950 shadow-xl" : "text-slate-400 hover:text-slate-600"
                     )}
                   >
                     {role.replace('_', ' ')}
                   </button>
                 ))}
              </div>
           </div>

           {/* Top 3 Podium */}
           <div className="grid grid-cols-3 gap-8 items-end mb-16">
              {/* Silver - #2 */}
              <PodiumCard rank={2} user={displayData[1]} color="bg-slate-300" icon={<Medal className="text-slate-500" />} />
              {/* Gold - #1 */}
              <PodiumCard rank={1} user={displayData[0]} color="bg-amber-400" icon={<Crown className="text-amber-600" />} featured />
              {/* Bronze - #3 */}
              <PodiumCard rank={3} user={displayData[2]} color="bg-orange-300" icon={<Award className="text-orange-600" />} />
           </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 -mt-8">
         <div className="bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
            <div className="px-10 py-6 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
               <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Classement Général</h3>
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full">
                     <Flame size={12} /> +12% ce mois
                  </div>
               </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/5">
               {displayData.slice(3).map((user: any, i: number) => (
                 <div key={i} className="px-10 py-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-8">
                       <span className="text-sm font-black text-slate-300 group-hover:text-rihla transition-colors">#{i + 4}</span>
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center font-black text-slate-400 group-hover:scale-110 transition-transform">
                             {user.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                             <p className="text-sm font-black text-slate-900 dark:text-cream">{user.name}</p>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Level {user.level} · {user.won} Confirmations</p>
                          </div>
                       </div>
                    </div>

                    <div className="flex items-center gap-12">
                       <div className="text-right">
                          <p className="text-sm font-black text-slate-900 dark:text-cream">{user.points.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Points</p>
                       </div>
                       <div className="text-right w-24">
                          <p className="text-sm font-black text-amber-500">{user.rev}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Revenue</p>
                       </div>
                       <ChevronRight className="text-slate-200 group-hover:text-rihla transition-colors" size={20} />
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Badges Showcase */}
         <div className="mt-16 text-center">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-10">Badges & Distinctions</h3>
            <div className="flex flex-wrap justify-center gap-8">
               {[
                 { id: 'top_seller', label: 'Top Seller Q2', icon: Crown, color: 'text-amber-500' },
                 { id: 'fast_closer', label: 'Fast Closer', icon: Zap, color: 'text-blue-500' },
                 { id: 'marrakech_expert', label: 'Marrakech Master', icon: MapPin, color: 'text-rihla' },
                 { id: 'customer_star', label: 'Client Favorite', icon: Star, color: 'text-emerald-500' },
                 { id: 'desert_king', label: 'Desert King', icon: Flame, color: 'text-orange-500' },
               ].map(badge => (
                 <div key={badge.id} className="group relative">
                    <div className={clsx(
                      "w-16 h-16 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm group-hover:shadow-2xl group-hover:-translate-y-2 transition-all duration-500",
                      badge.color
                    )}>
                       <badge.icon size={28} />
                    </div>
                    <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                       <span className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg whitespace-nowrap">
                          {badge.label}
                       </span>
                    </div>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  )
}

function PodiumCard({ rank, user, color, icon, featured }: { rank: number, user: any, color: string, icon: any, featured?: boolean }) {
  return (
    <div className={clsx(
      "relative bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-white/10 shadow-xl transition-all duration-700 group",
      featured ? "p-10 scale-110 z-10 border-amber-400/30" : "p-8 z-0"
    )}>
       <div className={clsx(
         "absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl",
         color
       )}>
          <span className="text-white font-black text-xl italic">{rank}</span>
       </div>

       <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-[32px] bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-6 text-2xl font-black text-slate-300 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
             {user.name.split(' ').map((n: string) => n[0]).join('')}
          </div>
          <div className="flex items-center gap-2 mb-1">
             <h4 className="text-lg font-black text-slate-900 dark:text-cream leading-tight">{user.name}</h4>
             {icon}
          </div>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Level {user.level} · {user.won} Won</p>
          
          <div className="w-full h-px bg-slate-100 dark:bg-white/5 mb-6" />
          
          <div className="grid grid-cols-2 w-full gap-4">
             <div>
                <p className="text-xl font-black text-slate-900 dark:text-cream tracking-tighter">{user.points.toLocaleString()}</p>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Points</p>
             </div>
             <div>
                <p className="text-xl font-black text-amber-500 tracking-tighter">{user.rev}</p>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Revenue</p>
             </div>
          </div>
       </div>
    </div>
  )
}
