import React, { useState } from 'react';
import { MapPin, Hotel, Users, Clock, Star, ChevronDown, ChevronUp, Plane, Camera, Coffee, Moon, FileText, Download, Compass } from 'lucide-react';
import { XLS_DAILY, XLS_META, XLS_GRID_REFERENCE, XLS_SINGLE_SUPPLEMENT } from '@/data/ys_travel_11d';

const HOTELS: Record<string, { stars: number; description: string; highlight: string }> = {
  'MÖVENPICK':     { stars: 5, description: 'Hôtel de luxe en plein cœur de Casablanca', highlight: 'Vue sur l\'Atlantique' },
  "D'ECHAOUEN":   { stars: 4, description: 'Riad authentique dans la médina bleue', highlight: 'Terrasse panoramique' },
  'PALAIS MEDINA': { stars: 5, description: 'Resort 5★ aux portes de la médina de Fès', highlight: 'Piscines & Spa' },
  'TADDART':       { stars: 3, description: 'Auberge berbère dans les montagnes de l\'Atlas', highlight: 'Ambiance authentique' },
  'K. TOMBOUCTOU': { stars: 4, description: 'Kasbah de charme aux pieds des dunes de l\'Erg Chebbi', highlight: 'Coucher de soleil Sahara' },
  'OSCAR':         { stars: 4, description: 'Hôtel moderne face aux montagnes de l\'Atlas', highlight: 'Piscine panoramique' },
  'ADAM PARK':     { stars: 5, description: 'Resort de luxe à Marrakech', highlight: 'Jardins & Piscines' },
};

const HIGHLIGHTS = [
  { icon: Compass, label: 'Circuit Complet', desc: '8 villes · 1 866 km' },
  { icon: Moon,    label: 'Nuitées',         desc: '8 nuits en hôtels premium' },
  { icon: Coffee,  label: 'Restauration',    desc: 'Rick\'s Café · Chez Ali · Fantasia' },
  { icon: Camera,  label: 'Expériences',     desc: 'Sahara · Médinas · Atlas' },
];

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

export function CircuitModelPage() {
  const [expandDay, setExpandDay] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'programme'|'tarifs'|'inclus'>('programme');

  const activeDays = XLS_DAILY.filter(d => d.formula !== '—');

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── HERO COVER ───────────────────────────────────────── */}
      <div className="relative h-72 overflow-hidden" style={{
        background: 'linear-gradient(160deg, #1a0a00 0%, #3d1500 40%, #6b2600 100%)'
      }}>
        {/* Moroccan pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M30 0l6 18h18l-15 12 6 18-15-12-15 12 6-18L6 18h18z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }}/>
        <div className="absolute inset-0 flex flex-col justify-end p-10">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Modèle de Circuit</span>
            <span className="bg-white/10 text-white/60 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">8N / 9J</span>
            <span className="bg-white/10 text-white/60 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Novembre 2026</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Maroc Impérial & Désert du Sahara
          </h1>
          <p className="text-white/50 text-sm">
            {XLS_META.destination} · Réf. {XLS_META.reference}
          </p>
          <div className="flex gap-8 mt-6">
            {HIGHLIGHTS.map(h => (
              <div key={h.label} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <h.icon size={14} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-white text-xs font-bold">{h.label}</p>
                  <p className="text-white/40 text-[10px]">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-8 flex gap-1">
          {(['programme','tarifs','inclus'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-4 text-sm font-bold capitalize transition-all border-b-2 ${activeTab === tab ? 'border-rihla text-rihla' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {tab === 'programme' ? '📅 Programme' : tab === 'tarifs' ? '💰 Tarifs' : '✅ Inclusions'}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 py-2">
            <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white rounded-lg shadow-md hover:-translate-y-0.5 transition-all"
              style={{ background: 'linear-gradient(135deg,#e63900,#c93000)' }}>
              <Download size={13} /> Télécharger PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* ── TAB : PROGRAMME ──────────────────────────────── */}
        {activeTab === 'programme' && (
          <div className="grid grid-cols-12 gap-8">

            {/* Timeline */}
            <div className="col-span-8">
              <div className="space-y-3">
                {activeDays.map((d, idx) => {
                  const hotel = HOTELS[d.hotel] || { stars: 4, description: d.hotel, highlight: '' };
                  const isOpen = expandDay === d.day;
                  return (
                    <div key={d.day} className={`bg-white rounded-2xl border transition-all shadow-sm ${isOpen ? 'border-rihla/30 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}>
                      <button className="w-full px-6 py-5 flex items-center gap-4 text-left"
                        onClick={() => setExpandDay(isOpen ? null : d.day)}>
                        {/* Day badge */}
                        <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 font-black ${isOpen ? 'bg-rihla text-white shadow-lg shadow-rihla/30' : 'bg-slate-100 text-slate-600'}`}>
                          <span className="text-[9px] font-bold opacity-70 uppercase">Jour</span>
                          <span className="text-lg leading-none">{d.day}</span>
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-slate-800">{d.cities.replace(/›/g, '→')}</p>
                            {d.formula !== '—' && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${d.formula === 'HB' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{d.formula}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">{d.date} · {d.hotel !== '—' ? d.hotel : 'Retour'}</p>
                        </div>
                        {/* Hotel stars */}
                        {d.hotel !== '—' && (
                          <div className="flex items-center gap-1 mr-4">
                            {Array(hotel.stars).fill(0).map((_, i) => (
                              <Star key={i} size={10} className="text-amber-400 fill-amber-400" />
                            ))}
                          </div>
                        )}
                        {/* Price */}
                        {d.halfDbl > 0 && (
                          <div className="text-right mr-4">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">Chambre/pax</p>
                            <p className="font-black text-slate-700">{fmt(d.halfDbl)} MAD</p>
                          </div>
                        )}
                        {isOpen ? <ChevronUp size={16} className="text-slate-300" /> : <ChevronDown size={16} className="text-slate-300" />}
                      </button>

                      {isOpen && (
                        <div className="px-6 pb-6 border-t border-slate-50">
                          <div className="grid grid-cols-3 gap-4 mt-4">
                            {/* Hotel card */}
                            <div className="col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-100">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                                  <Hotel size={16} className="text-rihla" />
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800 text-sm">{d.hotel}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{hotel.description}</p>
                                  <p className="text-xs font-bold text-amber-600 mt-1">✦ {hotel.highlight}</p>
                                </div>
                              </div>
                              {d.rest !== '—' && (
                                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 text-xs text-slate-500">
                                  <Coffee size={12} className="text-amber-500" />
                                  <span><strong>Dîner :</strong> {d.rest}</span>
                                  <span className="ml-auto font-bold text-rihla">{d.restPrice} MAD/pax</span>
                                </div>
                              )}
                            </div>

                            {/* Costs card */}
                            <div className="bg-rihla/5 rounded-xl p-4 border border-rihla/10">
                              <p className="text-[10px] uppercase font-bold text-rihla mb-3">Coûts / Pax</p>
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Chambre DBL</span>
                                  <span className="font-bold">{d.halfDbl} MAD</span>
                                </div>
                                {d.taxe > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">Taxe séjour</span>
                                    <span className="font-bold">{d.taxe} MAD</span>
                                  </div>
                                )}
                                {d.monuPrice > 0 && (
                                  <div className="flex justify-between">
                                    <span className="text-slate-500">{d.monument}</span>
                                    <span className="font-bold">{d.monuPrice} MAD</span>
                                  </div>
                                )}
                                <div className="pt-2 border-t border-rihla/10 flex justify-between font-bold text-rihla">
                                  <span>Total Jour</span>
                                  <span>{d.halfDbl + d.taxe + d.monuPrice + d.restPrice} MAD</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar summary */}
            <div className="col-span-4 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sticky top-20">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <MapPin size={14} className="text-rihla" />
                  Étapes du Circuit
                </h3>
                <div className="space-y-2">
                  {activeDays.map((d, i) => (
                    <div key={d.day} className="flex items-center gap-3 text-sm">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-blue-500' : i === activeDays.length - 1 ? 'bg-rihla' : 'bg-slate-300'}`} />
                      <span className="text-slate-500 font-mono text-[10px] w-12 flex-shrink-0">{d.date}</span>
                      <span className="text-slate-700 font-medium text-xs truncate">{d.cities.split('›')[d.cities.split('›').length - 1].trim()}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">Km total</span>
                    <span className="font-bold">{XLS_META.km_total} km</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Tarif Bus (MAD/km)</span>
                    <span className="font-bold">{XLS_META.bus_rate_km}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB : TARIFS ─────────────────────────────────── */}
        {activeTab === 'tarifs' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-900">
                <h3 className="text-white font-bold">Grille Tarifaire — Prix de Vente par Taille de Groupe</h3>
                <p className="text-slate-400 text-xs mt-0.5">Source : Cotation YS Travel / Giant Tour · Marge 8%</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                    <th className="px-6 py-3 text-left">Groupe</th>
                    <th className="px-6 py-3 text-right">Coût Revient</th>
                    <th className="px-6 py-3 text-right">Marge (8%)</th>
                    <th className="px-6 py-3 text-right text-rihla">Prix Vente MAD</th>
                    <th className="px-6 py-3 text-right text-emerald-600">USD/pax</th>
                    <th className="px-6 py-3 text-right text-amber-600">Supp. Single</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(XLS_GRID_REFERENCE).map(([pax, vals], i) => {
                    const p = Number(pax);
                    const isRef = p === 20;
                    return (
                      <tr key={pax} className={`border-b border-slate-50 ${isRef ? 'bg-rihla/5' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${isRef ? 'bg-rihla text-white' : 'bg-slate-100 text-slate-600'}`}>{pax}</div>
                            <div>
                              <p className="text-sm font-bold text-slate-700">{pax} Pax</p>
                              {isRef && <p className="text-[9px] text-rihla font-bold">BASE DE RÉFÉRENCE</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-500">{fmt(vals.cost)} MAD</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-500">+{fmt(vals.sell - vals.cost)} MAD</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-xl font-black ${isRef ? 'text-rihla' : 'text-slate-700'}`}>{fmt(vals.sell)}</span>
                          <span className="text-[10px] text-slate-400 ml-1">MAD</span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">${fmt(vals.sell / 10.1)}</td>
                        <td className="px-6 py-4 text-right font-bold text-amber-600">{fmt(XLS_SINGLE_SUPPLEMENT)} MAD</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-6 py-4 bg-amber-50 border-t border-amber-100 text-xs text-amber-700">
                <strong>Note :</strong> Les prix de vente affichés sont ceux du concurrent (YS Travel / Giant Tour). Le Supplément Single de <strong>{fmt(XLS_SINGLE_SUPPLEMENT)} MAD</strong> s'ajoute au tarif par personne.
              </div>
            </div>
          </div>
        )}

        {/* ── TAB : INCLUSIONS ─────────────────────────────── */}
        {activeTab === 'inclus' && (
          <div className="grid grid-cols-2 gap-6">
            {[
              { title: '✅ Inclus dans le Prix', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', items: [
                'Transport en autocar climatisé premium (8,5 MAD/km)',
                'Hébergement en chambre double (8 nuits)',
                'Petit-déjeuner tous les jours (BB)',
                'Demi-pension (HB) sur 6 nuits',
                'Guide national professionnel anglophone (11 jours)',
                'Entrées : Médersa Bou Inania, Studios Atlas, Palais Badi',
                'Soirée Fantasia — Chez Ali (Marrakech)',
                'Dîner de gala — Rick\'s Café (Casablanca)',
                'Taxes de séjour hôtelières',
                'Eau minérale en autocar',
                'Transfer aéroport arrivée/départ',
              ]},
              { title: '❌ Non Inclus', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100', items: [
                'Billets d\'avion internationaux',
                'Assurance voyage',
                'Visa (si applicable)',
                'Pourboires guide & chauffeur',
                'Dépenses personnelles',
                'Boissons aux repas',
                'Excursions optionnelles',
                'Supplément chambre single : ' + fmt(XLS_SINGLE_SUPPLEMENT) + ' MAD',
              ]},
            ].map(section => (
              <div key={section.title} className={`${section.bg} rounded-2xl border ${section.border} p-6`}>
                <h3 className={`font-bold ${section.color} mb-4`}>{section.title}</h3>
                <ul className="space-y-2">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-0.5 flex-shrink-0">{section.title.includes('✅') ? '•' : '•'}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
