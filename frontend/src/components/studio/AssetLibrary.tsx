import { useState } from 'react'
import { Image as ImageIcon, Search, Cloud, Check, Filter, X } from 'lucide-react'
import { clsx } from 'clsx'

const SHAREPOINT_LINK = "https://stoursvoyages-my.sharepoint.com/:f:/g/personal/j_ikrousoussi_stours_ma/IgBK8raOU0ZFQppxMFniTh4uAfGHPtlknyAN4QJycnq37RY?e=iEaOyh";

const MOCK_ASSETS = [
  { id: '1', url: 'https://images.unsplash.com/photo-1597212618440-806262de496b?w=600&q=80', tags: ['Maroc', 'Medina', 'Photos Générique'], name: 'shutterstock_1108292171.jpg' },
  { id: '2', url: 'https://images.unsplash.com/photo-1548013146-72479768bbaa?w=600&q=80', tags: ['Désert', 'Agafay', 'Nature'], name: 'Agafay Luxury Camp' },
  { id: '3', url: 'https://images.unsplash.com/photo-1489749798305-4fea3ae63d43?w=600&q=80', tags: ['Maroc', 'Culture', 'Architecture'], name: 'shutterstock_616405244.jpg' },
  { id: '4', url: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=600&q=80', tags: ['Maroc', 'Villes', 'Chefchaouen'], name: 'Blue Streets' },
  { id: '5', url: 'https://images.unsplash.com/photo-1554188248-986adbb73be4?w=600&q=80', tags: ['Activités', 'Kasbah', 'Photos Générique'], name: 'shutterstock_2130637889.jpg' },
  { id: '6', url: 'https://images.unsplash.com/photo-1528150177508-7cc0c36cda5c?w=600&q=80', tags: ['Gastronomie', 'Cuisine', 'Activités'], name: 'Traditional Table' },
]

export function AssetLibrary({ onSelect }: { onSelect: (url: string) => void }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  const filtered = MOCK_ASSETS.filter(a => 
    (filter === 'All' || a.tags.includes(filter)) &&
    (a.name.toLowerCase().includes(search.toLowerCase()) || a.tags.join(' ').toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="bg-white dark:bg-slate-950 border border-line dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
       <div className="p-4 border-b border-line dark:border-white/5 bg-slate-50 dark:bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Cloud size={16} />
             </div>
             <div>
                <h3 className="text-xs font-black uppercase tracking-widest dark:text-cream">S'TOURS Media Cloud</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter italic truncate max-w-[200px]">Base SharePoint : BDD MEDIA</p>
             </div>
          </div>
          <a 
            href={SHAREPOINT_LINK} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
          >
             <Cloud size={12} /> Explorer OneDrive
          </a>
       </div>

       <div className="p-4">
          <div className="relative">
             <Search size={14} className="absolute left-3 top-3 text-slate-400" />
             <input 
               type="text" 
               placeholder="Rechercher un lieu, une activité..."
               value={search}
               onChange={(e) => setSearch(e.target.value)}
               className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-xl px-10 py-2.5 text-xs focus:ring-2 focus:ring-rihla outline-none"
             />
          </div>
       </div>

       <div className="flex-1 overflow-y-auto p-4 pt-0">
          <div className="grid grid-cols-2 gap-3">
             {filtered.map(asset => (
                <div 
                  key={asset.id} 
                  onClick={() => onSelect(asset.url)}
                  className="group relative h-28 rounded-2xl overflow-hidden cursor-pointer border border-transparent hover:border-rihla transition-all"
                >
                   <img 
                     src={asset.url} 
                     loading="lazy"
                     className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                     alt={asset.name} 
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <p className="text-[10px] text-white font-bold truncate">{asset.name}</p>
                   </div>
                   <div className="absolute top-2 right-2 w-6 h-6 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity border border-white/20">
                      <Check size={12} />
                   </div>
                </div>
             ))}
          </div>
       </div>

       <div className="p-4 bg-slate-50 dark:bg-white/5 border-t border-line dark:border-white/5">
          <p className="text-[10px] text-slate-400 italic text-center">
             L'IA suggère automatiquement des photos basées sur votre texte.
          </p>
       </div>
    </div>
  )
}
