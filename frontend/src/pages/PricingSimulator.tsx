import React, { useState } from 'react';
import { Bus, MapPin, Calculator, TrendingUp, FileText, Info, RefreshCw, Sparkles, ChevronDown, ChevronUp, CheckCircle2, Wifi, WifiOff } from 'lucide-react';
import { XLS_DAILY, XLS_FIXED, XLS_VARIABLE, XLS_SINGLE_SUPPLEMENT, XLS_MARGIN_PCT, XLS_GRID_REFERENCE, XLS_EXCHANGE_RATE, XLS_META } from '@/data/ys_travel_11d';
import { useSimulation, SimulationOverrides } from '@/hooks/useSimulation';

// Mocked from our database.json
const RESTAURANTS = [
  { id: 'RES001', name: 'Dar Yacout', price: 450 },
  { id: 'RES002', name: 'Le Comptoir Darna', price: 380 },
  { id: 'RES003', name: 'La Maison Blanche', price: 420 },
  { id: 'RES004', name: 'Palais Faraj', price: 350 }
];

const HOTELS = [
  { id: 'H01', name: 'Movenpick Mansour Eddahbi', price: 1800, single_supplement: 650 },
  { id: 'H02', name: 'Le Casablanca Hotel', price: 2200, single_supplement: 800 },
  { id: 'H03', name: 'Palais Faraj', price: 2800, single_supplement: 1100 },
  { id: 'H04', name: 'Riad Fes', price: 1950, single_supplement: 750 },
  { id: 'H05', name: 'La Mamounia', price: 5500, single_supplement: 2000 }
];

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

export function PricingSimulator() {
  const [margin, setMargin] = useState(XLS_MARGIN_PCT);
  const [expandDay, setExpandDay] = useState<number | null>(null);
  const [showXLSRef, setShowXLSRef] = useState(true);
  const [selectedRestos, setSelectedRestos] = useState<Record<number, { id: string, price: number }>>({});
  const [selectedHotels, setSelectedHotels] = useState<Record<number, { id: string, price: number, single_supplement: number }>>({});

  const overrides: SimulationOverrides = {
    restaurants: selectedRestos,
    hotels: selectedHotels
  };

  // Use the hook: calls backend API with fallback to local calculation
  const sim = useSimulation(margin, overrides);
  const grid = sim.grid;
  const totalFixed = sim.totalFixed;
  const totalVarGrp = sim.totalVarGroup;

  const handleRestoChange = (day: number, restoId: string) => {
    if (!restoId) {
      const next = { ...selectedRestos };
      delete next[day];
      setSelectedRestos(next);
      return;
    }
    const r = RESTAURANTS.find(x => x.id === restoId);
    if (r) {
      setSelectedRestos({ ...selectedRestos, [day]: { id: r.name, price: r.price } });
    }
  };

  const handleHotelChange = (day: number, hotelId: string) => {
    if (!hotelId) {
      const next = { ...selectedHotels };
      delete next[day];
      setSelectedHotels(next);
      return;
    }
    const h = HOTELS.find(x => x.id === hotelId);
    if (h) {
      setSelectedHotels({ ...selectedHotels, [day]: { id: h.name, price: h.price, single_supplement: h.single_supplement } });
    }
  };

  const ref20 = grid.find(g => g.pax === 20) ?? grid[2];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#fdf7de 0%,#f5efe0 100%)' }}>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#140800 0%,#2a1200 100%)' }} className="px-8 py-5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Sparkles size={13} className="text-amber-400" />
              <span className="text-amber-400/80 text-[10px] font-bold uppercase tracking-[0.3em]">S'TOURS DMC · Outil Interne v2.1</span>
            </div>
            <h1 className="text-xl font-bold text-white">Cotation Circuit Maroc 11D</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-white/40 text-xs">Réf : {XLS_META.reference}</span>
              <span className="text-white/20">·</span>
              <span className="text-amber-500/70 text-[10px] font-bold uppercase">Source : XLS Concurrent {XLS_META.competitor}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-white/30 text-[9px] uppercase font-bold">Km Total</p>
              <p className="text-white font-mono font-bold">{XLS_META.km_total} km</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-right">
              <p className="text-white/30 text-[9px] uppercase font-bold">Bus (MAD/km)</p>
              <p className="text-white font-mono font-bold">{XLS_META.bus_rate_km}</p>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
              <TrendingUp size={14} className="text-amber-400" />
              <span className="text-white font-bold">Marge {margin}%</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold ${sim.source === 'backend' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
              {sim.source === 'backend' ? <Wifi size={12} /> : <WifiOff size={12} />}
              {sim.source === 'backend' ? 'API Engine' : 'Calcul Local'}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-6">

        {/* ── KPI ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { l: 'Prix Vente (20 Pax)', v: `${fmt(ref20.sell)} MAD`, s: `≈ $${fmt(ref20.usd)} USD`, c: '#e63900', bg: '#fff5f2', xls: `XLS réf: ${fmt(XLS_GRID_REFERENCE[20]?.sell)} MAD` },
            { l: 'Coût Revient (20 Pax)', v: `${fmt(ref20.cost)} MAD`, s: `Fixes ${fmt(totalFixed)} + Var ${fmt(totalVarGrp / 20)}`, c: '#1a0a00', bg: '#f8f5f0', xls: `XLS réf: ${fmt(XLS_GRID_REFERENCE[20]?.cost)} MAD` },
            { l: 'Marge (20 Pax)', v: `${fmt(ref20.marge)} MAD`, s: `${margin}% sur coût de revient`, c: '#059669', bg: '#f0fdf4', xls: `Concurrent: ${XLS_MARGIN_PCT}%` },
            { l: 'Supp. Single Circuit', v: `${fmt(XLS_SINGLE_SUPPLEMENT)} MAD`, s: `≈ $${fmt(XLS_SINGLE_SUPPLEMENT / XLS_EXCHANGE_RATE)} USD`, c: '#d97706', bg: '#fffbeb', xls: 'Sur 8 nuits de circuit' },
          ].map(k => (
            <div key={k.l} style={{ background: k.bg, borderLeft: `3px solid ${k.c}` }} className="rounded-xl p-4 shadow-sm border border-white">
              <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">{k.l}</p>
              <p className="text-xl font-black" style={{ color: k.c }}>{k.v}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{k.s}</p>
              <p className="text-[9px] text-slate-300 mt-1 border-t border-slate-100 pt-1 font-mono">{k.xls}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-12 gap-6">

          {/* ── ZONE 1 : Détail journalier ───────────────────── */}
          <div className="col-span-5 space-y-4">
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#1a0a00' }}>
                  <MapPin size={13} className="text-amber-400" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">Zone 1 — Programme Détaillé</h2>
                  <p className="text-[10px] text-slate-400">{XLS_META.destination} · {XLS_META.duration}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
                {XLS_DAILY.filter(d => d.halfDbl > 0).map(d => (
                  <div key={d.day}>
                    <button
                      onClick={() => setExpandDay(expandDay === d.day ? null : d.day)}
                      className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-rihla/10 flex items-center justify-center text-rihla text-[11px] font-black flex-shrink-0">{d.day}</div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {d.hotel}
                            <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded ${d.formula === 'HB' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{d.formula}</span>
                          </p>
                          <p className="text-[10px] text-slate-400">{d.date} · {d.cities}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-700">{fmt(d.halfDbl)} MAD</span>
                        {expandDay === d.day ? <ChevronUp size={13} className="text-slate-300" /> : <ChevronDown size={13} className="text-slate-300" />}
                      </div>
                    </button>
                    {expandDay === d.day && (
                      <div className="px-5 pb-4 pt-2 bg-slate-50 grid grid-cols-5 gap-2 text-[11px]">
                        <div className="bg-white rounded-lg p-2.5 border border-slate-100 flex flex-col justify-between">
                          <p className="text-[9px] font-bold text-slate-400 mb-1">🏨 Hébergement</p>
                          <select 
                            value={HOTELS.find(h => h.name === selectedHotels[d.day]?.id)?.id || ''}
                            onChange={(e) => handleHotelChange(d.day, e.target.value)}
                            className="bg-transparent border-0 p-0 text-[10px] font-bold text-slate-700 outline-none cursor-pointer focus:ring-0"
                          >
                            <option value="">{d.hotel} (Défaut)</option>
                            {HOTELS.map(h => (
                              <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                          </select>
                          <p className="text-rihla font-bold">{selectedHotels[d.day]?.price || d.halfDbl} MAD</p>
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border border-slate-100 flex flex-col justify-between">
                          <p className="text-[9px] font-bold text-slate-400 mb-1">🍽 Restaurant</p>
                          <select 
                            value={RESTAURANTS.find(r => r.name === selectedRestos[d.day]?.id)?.id || ''}
                            onChange={(e) => handleRestoChange(d.day, e.target.value)}
                            className="bg-transparent border-0 p-0 text-[10px] font-bold text-slate-700 outline-none cursor-pointer focus:ring-0"
                          >
                            <option value="">{d.rest} (Défaut)</option>
                            {RESTAURANTS.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <p className="text-rihla font-bold">{selectedRestos[d.day]?.price || d.restPrice} MAD</p>
                        </div>
                        {[
                          { l: '🏛 Monument', v: d.monument, p: d.monuPrice },
                          { l: '🏨 Taxe séjour', v: `${d.taxe} MAD`, p: null },
                          { l: '💧 Eau/Guide', v: `LG: ${d.lg}`, p: d.water },
                        ].map(r => (
                          <div key={r.l} className="bg-white rounded-lg p-2.5 border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 mb-1">{r.l}</p>
                            <p className="font-bold text-slate-700 text-[10px] leading-tight">{r.v}</p>
                            {r.p !== null && r.p !== undefined && <p className="text-rihla font-bold">{r.p} MAD</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 grid grid-cols-4 gap-2 text-center">
                {[
                  { l: 'Hôtels', v: XLS_FIXED.hotels },
                  { l: 'Restos', v: XLS_FIXED.restaurants },
                  { l: 'Monus', v: XLS_FIXED.monuments },
                  { l: 'Taxes', v: Math.round(XLS_FIXED.taxes) },
                ].map(r => (
                  <div key={r.l}>
                    <p className="text-[9px] uppercase font-bold text-slate-400">{r.l}</p>
                    <p className="text-sm font-black text-rihla">{fmt(r.v)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Zone 2 Variables */}
            <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5">
              <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Bus size={14} className="text-rihla" />
                Zone 2 — Variables Groupe
              </h3>
              <div className="space-y-2">
                {Object.entries(XLS_VARIABLE).map(([k, v]) => {
                  const labels: Record<string, string> = { bus: 'Autocar 48 places (8,5/km)', guide: 'Guide National (9 jours)', taxi_chef: 'Taxi Chefchaouen', merzouga_4x4: '4x4 Merzouga / Sahara', upgrade: 'Upgrade Véhicule' };
                  return (
                    <div key={k} className="flex justify-between text-sm items-center py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-500">{labels[k] || k}</span>
                      <span className="font-bold tabular-nums text-slate-700">{fmt(v)} MAD</span>
                    </div>
                  );
                })}
                <div className="pt-2 flex justify-between font-bold text-base">
                  <span className="text-slate-700">Total Variables</span>
                  <span className="text-rihla">{fmt(totalVarGrp)} MAD</span>
                </div>
              </div>
            </div>

            {/* Margin control */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <div className="flex justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Marge Commerciale</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Concurrent (YS/Giant): {XLS_MARGIN_PCT}%</p>
                </div>
                <span className="text-3xl font-black text-rihla">{margin}%</span>
              </div>
              <input type="range" min="0" max="25" value={margin}
                onChange={e => setMargin(+e.target.value)}
                className="w-full accent-rihla cursor-pointer" />
              <div className="flex gap-2 mt-3">
                {[8, 12, 15, 20].map(v => (
                  <button key={v} onClick={() => setMargin(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${margin === v ? 'bg-rihla text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {v}% {v === 8 ? '🔵' : v === 15 ? '⭐' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── ZONE 3 : Grille PAX ──────────────────────────── */}
          <div className="col-span-7 space-y-4">
            {/* Toggle XLS Reference */}
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                <TrendingUp size={14} className="text-rihla" />
                Zone 3 — Grille de Prix par Taille de Groupe
              </h2>
              <button onClick={() => setShowXLSRef(!showXLSRef)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${showXLSRef ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-500'}`}>
                <CheckCircle2 size={11} />
                Réf. XLS Excel
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
              <div style={{ background: 'linear-gradient(135deg,#140800,#2a1200)' }} className="px-6 py-4 flex justify-between items-center">
                <span className="text-white font-bold text-sm">Grille déterministe · Source fichier Excel</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 text-[10px] font-mono">Marge active : {margin}%</span>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400">
                    <th className="px-4 py-3 text-left">PAX</th>
                    <th className="px-4 py-3 text-right">Var/Pax</th>
                    <th className="px-4 py-3 text-right">Coût Revient</th>
                    {showXLSRef && <th className="px-4 py-3 text-right text-amber-500">XLS Réf.</th>}
                    <th className="px-4 py-3 text-right text-rihla">Prix Vente MAD</th>
                    {showXLSRef && <th className="px-4 py-3 text-right text-amber-500">XLS Vente</th>}
                    <th className="px-4 py-3 text-right text-emerald-600">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.map((t, i) => {
                    const isRef = t.pax === 20;
                    const xlsRef = XLS_GRID_REFERENCE[t.pax];
                    const delta = xlsRef ? Math.abs(t.cost - xlsRef.cost) : 0;
                    const varPerPax = totalVarGrp / t.pax;
                    return (
                      <tr key={t.pax} style={isRef ? { background: 'linear-gradient(90deg,#fff5f2,#fffaf9)' } : {}}
                        className={`border-b border-slate-50 transition-all ${!isRef && i % 2 === 0 ? 'bg-white' : !isRef ? 'bg-slate-50/30' : ''} hover:bg-slate-50`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${isRef ? 'bg-rihla text-white shadow-lg shadow-rihla/30' : 'bg-slate-100 text-slate-600'}`}>{t.pax}</div>
                            {isRef && <span className="text-[9px] font-bold text-rihla bg-rihla/10 px-1 py-0.5 rounded">BASE</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-xs font-mono text-slate-400">{fmt(varPerPax)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className={`text-sm font-bold ${isRef ? 'text-slate-700' : 'text-slate-500'}`}>{fmt(t.cost)}</span>
                          {delta > 0 && showXLSRef && <p className="text-[9px] text-slate-300 font-mono">Δ {fmt(delta)}</p>}
                        </td>
                        {showXLSRef && (
                          <td className="px-4 py-4 text-right">
                            <span className="text-sm font-mono text-amber-600">{xlsRef ? fmt(xlsRef.cost) : '—'}</span>
                          </td>
                        )}
                        <td className="px-4 py-4 text-right">
                          <span className={`text-xl font-black ${isRef ? 'text-rihla' : 'text-slate-700'}`}>{fmt(t.sell)}</span>
                        </td>
                        {showXLSRef && (
                          <td className="px-4 py-4 text-right">
                            <span className="text-sm font-mono text-amber-600">{xlsRef ? fmt(xlsRef.sell) : '—'}</span>
                          </td>
                        )}
                        <td className="px-4 py-4 text-right">
                          <span className={`font-bold ${isRef ? 'text-rihla' : 'text-emerald-600'}`}>${fmt(t.usd)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
                <Info size={13} className="text-slate-300 flex-shrink-0" />
                <p className="text-[11px] text-slate-400">
                  Coûts fixes/pax : <strong>{fmt(totalFixed)} MAD</strong> · Variables groupe : <strong>{fmt(totalVarGrp)} MAD</strong> · Supp. single : <strong>{fmt(XLS_SINGLE_SUPPLEMENT)} MAD</strong> (hors grille)
                </p>
              </div>
            </div>

            {/* Footer KPIs */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex justify-between items-center">
              <div className="flex gap-8">
                {[
                  { l: 'CA Groupe (20 Pax)', v: `${fmt(ref20.sell * 20)} MAD`, c: 'text-slate-800' },
                  { l: 'Profit Net (20 Pax)', v: `${fmt(ref20.marge * 20)} MAD`, c: 'text-emerald-600' },
                  { l: 'Taux de Change', v: `1 USD = ${XLS_EXCHANGE_RATE} MAD`, c: 'text-slate-600' },
                ].map((k, i) => (
                  <React.Fragment key={k.l}>
                    {i > 0 && <div className="w-px bg-slate-200" />}
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">{k.l}</p>
                      <p className={`text-lg font-black ${k.c}`}>{k.v}</p>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <button className="flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-all"
                style={{ background: 'linear-gradient(135deg,#e63900,#c93000)' }}>
                <FileText size={16} />
                Exporter Cotation (.xlsx)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
