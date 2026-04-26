import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { collaborationApi } from '@/lib/api'
import { Users, Eye, Edit3, Lock } from 'lucide-react'
import { clsx } from 'clsx'

export function CollaborationAvatarGroup({ projectId }: { projectId: string }) {
  const [activeUsers, setActiveUsers] = useState<any[]>([])

  // 1. Report presence every 15 seconds
  const { mutate: report } = useMutation({
    mutationFn: () => collaborationApi.reportPresence(projectId),
    onSuccess: (data) => setActiveUsers(data.data.active_users)
  })

  useEffect(() => {
    report()
    const interval = setInterval(() => report(), 15000)
    return () => clearInterval(interval)
  }, [projectId])

  if (activeUsers.length <= 1) return null

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-white/5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex -space-x-3 overflow-hidden">
        {activeUsers.map((user) => (
          <div 
            key={user.user_id}
            className="inline-block h-8 w-8 rounded-xl ring-2 ring-white dark:ring-slate-900 bg-rihla flex items-center justify-center text-[10px] font-black text-white shadow-lg"
            title={`${user.name} est en train de consulter ce projet`}
          >
            {user.name.split(' ').map((n: string) => n[0]).join('')}
          </div>
        ))}
      </div>
      <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1" />
      <div className="flex items-center gap-2">
         <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
         </span>
         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
           {activeUsers.length - 1} autre{activeUsers.length > 2 ? 's' : ''} collaborent
         </p>
      </div>
    </div>
  )
}

export function ResourceLockBadge({ resourceId, currentUserId }: { resourceId: string, currentUserId: string }) {
  const { data: lockInfo } = useQuery({
    queryKey: ['lock', resourceId],
    queryFn: () => collaborationApi.getPresence(resourceId), // Mocking lock check with presence for demo
    refetchInterval: 5000
  })

  // In a real scenario, we'd check if the resource is locked by someone else
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 text-amber-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
       <Lock size={10} /> En édition
    </div>
  )
}
