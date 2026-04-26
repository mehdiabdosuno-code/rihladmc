import { useState, useMemo } from 'react'
import {
  MapPin, Hotel, Utensils, Bus, Calculator, Users,
  ChevronDown, ChevronUp, Eye, Landmark, Droplets,
  GripVertical, DollarSign, ArrowRight, Compass, Mountain,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  XLS_DAILY, XLS_FIXED, XLS_VARIABLE, XLS_SINGLE_SUPPLEMENT,
  XLS_MARGIN_PCT, XLS_GRID_REFERENCE, XLS_META, XLS_EXCHANGE_RATE,
} from '@/data/ys_travel_11d'
import { TravelDesignerMap } from '@/components/maps/TravelDesignerMap'

// ── Types ────────────────────────────────────────────────────────
interface DayRow {
  day: number; date: string; km: number; cities: string
  hotel: string; formula: string; halfDbl: number; ss: number
  taxe: number; water: number; rest: string; restPrice: number
  monument: string; monuPrice: number; lg: number
}

// ── Helpers ──────────────────────────────────────────────────────
const fmt = (v: number, cur = 'MAD') =>
  `${new Intl.NumberFormat('fr-FR').format(Math.round(v))} ${cur}`

const CATEGORY_COLORS: Record<string, string> = {
  hotel: 'bg-blue-50 text-blue-700 border-blue-200',
  restaurant: 'bg-amber-50 text-amber-700 border-amber-200',
  monument: 'bg-purple-50 text-purple-700 border-purple-200',
  transport: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  guide: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  tax: 'bg-slate-50 text-slate-600 border-slate-200',
  water: 'bg-sky-50 text-sky-700 border-sky-200',
  misc: 'bg-rose-50 text-rose-700 border-rose-200',
}

const CITY_COORDS: Record<string, [number, number]> = {
  'CASABLANCA': [28, 32], 'RABAT': [33, 24], 'CHEFCHAOUEN': [46, 12],
  'FES': [48, 28], 'FÈS': [48, 28], 'MIDELT': [55, 40],
  'MERZOUGA': [68, 55], 'OUARZAZATE': [38, 60], 'MARRAKECH': [25, 55],
  'ESSAOUIRA': [10, 55],
}

// ── Circuit Map ──────────────────────────────────────────────────
function CircuitMap({ days }: { days: DayRow[] }) {
  const cities = days
    .map(d => d.cities.split(/[›→—]/)[0].trim().toUpperCase())
    .filter((c, i, a) => a.indexOf(c) === i && CITY_COORDS[c])

  const points = cities.map(c => CITY_COORDS[c] || [50, 50])

  return (
    <div className="relative w-full aspect-[5/4] bg-slate-900 rounded-2xl overflow-hidden">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />
      <svg viewBox="0 0 100 80" className="absolute inset-0 w-full h-full p-6">
        <path d="M30 5 L60 8 L75 30 L72 65 L55 75 L20 70 L8 55 L12 25 Z"
              className="fill-white/5 stroke-white/10" strokeWidth="0.3" />
        {points.length > 1 && (
          <path
            d={`M ${points.map(p => `${p[0]} ${p[1]}`).join(' L ')}`}
            className="fill-none stroke-amber-400" strokeWidth="0.8"
            strokeDasharray="2 1"
          />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r="1.8" className="fill-amber-400" />
            <text x={p[0] + 3} y={p[1] + 1}
                  className="fill-white/50 font-bold" style={{ fontSize: '3px' }}>
              {cities[i]}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
        <div>
          <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Circuit Map</p>
          <p className="text-xs font-bold text-amber-200">{XLS_META.destination}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/30 uppercase">Total</p>
          <p className="text-sm font-black text-white">{XLS_META.km_total} km</p>
        </div>
      </div>
    </div>
  )
}

// ── Day Card ─────────────────────────────────────────────────────
function DayCard({ d, isExpanded, onToggle }: { d: DayRow; isExpanded: boolean; onToggle: () => void }) {
  const dayCost = d.halfDbl + d.restPrice + d.monuPrice + d.taxe + d.water + d.lg

  return (
    <div className={clsx(
      'card overflow-hidden transition-all border-l-4',
      isExpanded ? 'shadow-float border-l-amber-500' : 'border-l-transparent hover:border-l-amber-200'
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-warm/40 transition-colors"
           onClick={onToggle}>
        <div className="text-slate-300 p-0.5"><GripVertical size={14} /></div>
        <div className="w-7 h-7 rounded-full bg-slate-900 text-cream flex items-center justify-center text-[10px] font-black flex-shrink-0">
          {d.day}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[13px] text-slate-800 truncate">{d.cities}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {d.hotel !== 'DEPART' && d.hotel !== 'DÉPART' && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Hotel size={9} /> {d.hotel}
              </span>
            )}
            {d.km > 0 && (
              <span className="text-[10px] text-slate-400">{d.km} km</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {d.formula && d.formula !== '—' && (
            <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-black uppercase">{d.formula}</span>
          )}
          <span className="text-[11px] font-bold text-slate-600 tabular-nums">{fmt(dayCost)}</span>
          {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <div className="px-5 py-4 bg-white border-t border-slate-100 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {d.halfDbl > 0 && (
              <CostChip icon={<Hotel size={12} />} label="Hotel (1/2 Dbl)" value={d.halfDbl} cat="hotel" />
            )}
            {d.ss > 0 && (
              <CostChip icon={<Hotel size={12} />} label="Single Suppl." value={d.ss} cat="hotel" />
            )}
            {d.restPrice > 0 && (
              <CostChip icon={<Utensils size={12} />} label={d.rest} value={d.restPrice} cat="restaurant" />
            )}
            {d.monuPrice > 0 && (
              <CostChip icon={<Landmark size={12} />} label={d.monument} value={d.monuPrice} cat="monument" />
            )}
            {d.taxe > 0 && (
              <CostChip icon={<DollarSign size={12} />} label="City Tax" value={d.taxe} cat="tax" />
            )}
            {d.water > 0 && (
              <CostChip icon={<Droplets size={12} />} label="Water" value={d.water} cat="water" />
            )}
            {d.lg > 0 && (
              <CostChip icon={<Compass size={12} />} label="Local Guide" value={d.lg} cat="guide" />
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase">{d.date}</span>
            <span className="text-sm font-black text-slate-700">
              Total jour: {fmt(dayCost)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function CostChip({ icon, label, value, cat }: { icon: React.ReactNode; label: string; value: number; cat: string }) {
  return (
    <div className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px]', CATEGORY_COLORS[cat] || CATEGORY_COLORS.misc)}>
      {icon}
      <div className="min-w-0 flex-1">
        <p className="font-bold truncate">{label}</p>
      </div>
      <span className="font-black tabular-nums whitespace-nowrap">{fmt(value)}</span>
    </div>
  )
}

// ── Pricing Grid ─────────────────────────────────────────────────
function PricingGrid() {
  const paxBases = Object.keys(XLS_GRID_REFERENCE).map(Number)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-2 px-3 text-[10px] font-black uppercase text-slate-400">PAX</th>
            <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">Cost/PAX</th>
            <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">Sell/PAX</th>
            <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">Margin</th>
            <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">Group Total</th>
          </tr>
        </thead>
        <tbody>
          {paxBases.map(pax => {
            const ref = XLS_GRID_REFERENCE[pax]
            const margin = ref.sell - ref.cost
            return (
              <tr key={pax} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="py-2.5 px-3 font-black text-slate-800">
                  <div className="flex items-center gap-2">
                    <Users size={12} className="text-amber-500" />
                    {pax} PAX
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{fmt(ref.cost)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-800">{fmt(ref.sell)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 font-bold">{fmt(margin)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums font-black text-slate-800">{fmt(ref.sell * pax)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Cost Breakdown Chart ─────────────────────────────────────────
function CostBreakdown() {
  const items = [
    { label: 'Hotels', value: XLS_FIXED.hotels, color: 'bg-blue-500' },
    { label: 'Restaurants', value: XLS_FIXED.restaurants, color: 'bg-amber-500' },
    { label: 'Monuments', value: XLS_FIXED.monuments, color: 'bg-purple-500' },
    { label: 'City Taxes', value: XLS_FIXED.taxes, color: 'bg-slate-400' },
    { label: 'Water', value: XLS_FIXED.water, color: 'bg-sky-400' },
    { label: 'Local Guides', value: XLS_FIXED.local_guides, color: 'bg-cyan-500' },
    { label: 'Extras', value: XLS_FIXED.extras, color: 'bg-rose-400' },
  ]
  const total = items.reduce((s, i) => s + i.value, 0)

  return (
    <div className="space-y-2">
      <div className="flex rounded-full h-3 overflow-hidden">
        {items.map(i => (
          <div key={i.label} className={clsx(i.color, 'transition-all')}
               style={{ width: `${(i.value / total) * 100}%` }}
               title={`${i.label}: ${fmt(i.value)}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map(i => (
          <div key={i.label} className="flex items-center gap-2 text-[10px]">
            <div className={clsx('w-2 h-2 rounded-full', i.color)} />
            <span className="text-slate-500">{i.label}</span>
            <span className="font-bold text-slate-700 ml-auto tabular-nums">{fmt(i.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Variable Costs ───────────────────────────────────────────────
function VariableCosts() {
  const items = [
    { label: 'Autocar 48 PAX', sub: `${XLS_META.bus_rate_km} MAD/km x ${XLS_META.km_total} km`, value: XLS_VARIABLE.bus, icon: <Bus size={14} /> },
    { label: 'Guide National', sub: '1,000 MAD/day x 9 days', value: XLS_VARIABLE.guide, icon: <Compass size={14} /> },
    { label: 'Taxis Chefchaouen', sub: 'Pedestrian medina', value: XLS_VARIABLE.taxi_chef, icon: <Bus size={14} /> },
    { label: '4x4 Merzouga', sub: 'Sahara desert excursion', value: XLS_VARIABLE.merzouga_4x4, icon: <Mountain size={14} /> },
    { label: 'Vehicle Upgrade', sub: 'Premium coach', value: XLS_VARIABLE.upgrade, icon: <Bus size={14} /> },
  ]
  const total = Object.values(XLS_VARIABLE).reduce((s, v) => s + v, 0)

  return (
    <div className="space-y-2">
      {items.map(i => (
        <div key={i.label} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
          <div className="text-emerald-500">{i.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-700">{i.label}</p>
            <p className="text-[9px] text-slate-400">{i.sub}</p>
          </div>
          <span className="text-[12px] font-black text-slate-700 tabular-nums">{fmt(i.value)}</span>
        </div>
      ))}
      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Variable</span>
        <span className="text-sm font-black text-slate-800">{fmt(total)}</span>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────
type Tab = 'circuit' | 'costs' | 'grid' | 'compare'

export function TravelDesignerPage() {
  const [tab, setTab] = useState<Tab>('circuit')
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]))
  const [paxForCalc, setPaxForCalc] = useState(20)

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  const days = XLS_DAILY as DayRow[]
  const fixedPerPax = Object.values(XLS_FIXED).reduce((s, v) => s + v, 0)
  const variableTotal = Object.values(XLS_VARIABLE).reduce((s, v) => s + v, 0)
  const variablePerPax = variableTotal / paxForCalc
  const costPerPax = fixedPerPax + variablePerPax
  const sellPerPax = Math.round(costPerPax * (1 + XLS_MARGIN_PCT / 100))

  const TABS: { id: Tab; label: string; icon: typeof MapPin }[] = [
    { id: 'circuit', label: 'Circuit Designer', icon: MapPin },
    { id: 'costs', label: 'Cost Breakdown', icon: Calculator },
    { id: 'grid', label: 'PAX Grid', icon: Users },
    { id: 'compare', label: 'XLS Parity', icon: Eye },
  ]

  return (
    <div className="min-h-full bg-slate-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-lg">
              <Compass size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Travel Designer</h1>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                {XLS_META.reference} — {XLS_META.client} vs {XLS_META.competitor}
              </p>
            </div>
          </div>

          {/* KPI Bar */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
            {[
              { label: 'Duration', value: XLS_META.duration },
              { label: 'Distance', value: `${XLS_META.km_total} km` },
              { label: 'Fixed/PAX', value: fmt(fixedPerPax) },
              { label: 'Variable', value: fmt(variableTotal) },
              { label: `Sell @${paxForCalc}`, value: fmt(sellPerPax) },
              { label: 'SS Total', value: fmt(XLS_SINGLE_SUPPLEMENT) },
            ].map(k => (
              <div key={k.label} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{k.label}</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums">{k.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="flex items-center gap-1 mb-6">
          {TABS.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all rounded-lg',
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                )}>
                <Icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        {tab === 'circuit' && (
          <div className="space-y-6">
            {/* Interactive Travel Designer Map (3 views: global / day / timeline) */}
            <TravelDesignerMap
              days={days}
              destinationLabel={XLS_META.destination}
              paxCount={paxForCalc}
            />
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 space-y-2">
              {days.map(d => (
                <DayCard key={d.day} d={d}
                  isExpanded={expandedDays.has(d.day)}
                  onToggle={() => toggleDay(d.day)} />
              ))}
            </div>
            <div className="col-span-12 lg:col-span-4 space-y-4">
              <div className="card p-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Circuit Summary</h3>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between"><span className="text-slate-500">Nights</span><span className="font-bold">8</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Hotels</span><span className="font-bold">{days.filter(d => d.hotel !== 'DÉPART').length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Restaurants</span><span className="font-bold">{days.filter(d => d.restPrice > 0).length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Monuments</span><span className="font-bold">{days.filter(d => d.monuPrice > 0).length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Local Guides</span><span className="font-bold">{days.filter(d => d.lg > 0).length} days</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total KM</span><span className="font-bold">{days.reduce((s, d) => s + d.km, 0)}</span></div>
                </div>
              </div>
              <div className="card p-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quick Calc</h3>
                <label className="text-[10px] font-bold text-slate-500 uppercase">PAX Count</label>
                <input type="number" min={1} max={100} value={paxForCalc}
                  onChange={e => setPaxForCalc(Number(e.target.value) || 1)}
                  className="input-base mt-1 mb-3" />
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between"><span className="text-slate-500">Cost/PAX</span><span className="font-bold">{fmt(costPerPax)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sell/PAX ({XLS_MARGIN_PCT}%)</span><span className="font-black text-emerald-600">{fmt(sellPerPax)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Group Total</span><span className="font-black">{fmt(sellPerPax * paxForCalc)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">SS</span><span className="font-bold">{fmt(XLS_SINGLE_SUPPLEMENT)}</span></div>
                  <div className="flex justify-between border-t border-slate-100 pt-2">
                    <span className="text-slate-500">USD equiv.</span>
                    <span className="font-bold">${Math.round(sellPerPax / XLS_EXCHANGE_RATE)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

        {tab === 'costs' && (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7">
              <div className="card p-5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Fixed Costs per PAX (constant regardless of group size)
                </h3>
                <CostBreakdown />
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200">
                  <span className="text-xs font-bold text-slate-500 uppercase">Total Fixed / PAX</span>
                  <span className="text-lg font-black text-slate-800">{fmt(fixedPerPax)}</span>
                </div>
              </div>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <div className="card p-5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Variable Costs (divided by PAX)
                </h3>
                <VariableCosts />
              </div>
              <div className="card p-5 mt-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Per-PAX Extras</h3>
                <div className="space-y-2 text-[11px]">
                  {[
                    ['Tips (luggage)', 70], ['Tips (restaurants)', 75],
                    ['Horse carriage', 100], ['4WD Merzouga', 280],
                    ['Camel ride', 100],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between px-3 py-1.5 bg-slate-50 rounded">
                      <span className="text-slate-600">{label}</span>
                      <span className="font-bold">{fmt(val as number)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-500 uppercase text-[10px]">Total extras/PAX</span>
                    <span className="font-black">{fmt(625)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'grid' && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                PAX Scaling Grid — {XLS_META.reference}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-bold">
                  Margin: {XLS_MARGIN_PCT}%
                </span>
                <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-bold">
                  FOC: 1 (Tour Leader)
                </span>
                <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-bold">
                  SS: {fmt(XLS_SINGLE_SUPPLEMENT)}
                </span>
              </div>
            </div>
            <PricingGrid />
            <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400 space-y-1">
              <p>All prices in MAD (Moroccan Dirhams). Rate: 1 USD = {XLS_EXCHANGE_RATE} MAD</p>
              <p>FOC: 1 tour leader in twin share (no extra room charge)</p>
              <p>Single Supplement: {fmt(XLS_SINGLE_SUPPLEMENT)} per single room request</p>
            </div>
          </div>
        )}

        {tab === 'compare' && (
          <XlsParityCheck paxForCalc={paxForCalc} />
        )}
      </div>
    </div>
  )
}

// ── XLS Parity Check ─────────────────────────────────────────────
function XlsParityCheck({ paxForCalc }: { paxForCalc: number }) {
  const fixedPerPax = Object.values(XLS_FIXED).reduce((s, v) => s + v, 0)
  const variableTotal = Object.values(XLS_VARIABLE).reduce((s, v) => s + v, 0)
  const extras = 625

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
          Verification: RIHLA Computation vs XLS Reference
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 px-3 text-[10px] font-black uppercase text-slate-400">PAX</th>
                <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">XLS Cost</th>
                <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">RIHLA Cost</th>
                <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">Delta</th>
                <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">XLS Sell</th>
                <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">RIHLA Sell</th>
                <th className="text-right py-2 px-3 text-[10px] font-black uppercase text-slate-400">Delta</th>
                <th className="text-center py-2 px-3 text-[10px] font-black uppercase text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(XLS_GRID_REFERENCE).map(([paxStr, ref]) => {
                const pax = Number(paxStr)
                const rihlaCost = Math.round(fixedPerPax + variableTotal / pax + extras)
                const rihlaSell = Math.round(rihlaCost * (1 + XLS_MARGIN_PCT / 100))
                const deltaCost = rihlaCost - ref.cost
                const deltaSell = rihlaSell - ref.sell
                const isClose = Math.abs(deltaSell) < 200

                return (
                  <tr key={pax} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-black">{pax} PAX</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmt(ref.cost)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmt(rihlaCost)}</td>
                    <td className={clsx('py-2.5 px-3 text-right tabular-nums font-bold',
                      deltaCost === 0 ? 'text-emerald-600' : Math.abs(deltaCost) < 100 ? 'text-amber-600' : 'text-red-500'
                    )}>
                      {deltaCost >= 0 ? '+' : ''}{deltaCost}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmt(ref.sell)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{fmt(rihlaSell)}</td>
                    <td className={clsx('py-2.5 px-3 text-right tabular-nums font-bold',
                      deltaSell === 0 ? 'text-emerald-600' : Math.abs(deltaSell) < 100 ? 'text-amber-600' : 'text-red-500'
                    )}>
                      {deltaSell >= 0 ? '+' : ''}{deltaSell}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={clsx(
                        'text-[9px] font-black uppercase px-2 py-0.5 rounded-full',
                        isClose ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      )}>
                        {isClose ? 'MATCH' : 'DELTA'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
          Computation Method
        </h3>
        <div className="text-[11px] text-slate-600 space-y-2">
          <p><strong>Fixed/PAX</strong> = Hotels ({fmt(XLS_FIXED.hotels)}) + Restaurants ({fmt(XLS_FIXED.restaurants)}) + Monuments ({fmt(XLS_FIXED.monuments)}) + Taxes ({fmt(XLS_FIXED.taxes)}) + Water ({fmt(XLS_FIXED.water)}) + Local Guides ({fmt(XLS_FIXED.local_guides)}) + Extras ({fmt(XLS_FIXED.extras)})</p>
          <p><strong>Variable/PAX</strong> = (Bus + Guide + Taxi + 4x4 + Upgrade) / PAX count</p>
          <p><strong>Extras/PAX</strong> = Tips luggage (70) + Tips rest (75) + Horse (100) + 4WD (280) + Camel (100) = 625 MAD</p>
          <p><strong>Cost/PAX</strong> = Fixed + Variable/PAX + Extras</p>
          <p><strong>Sell/PAX</strong> = Cost x (1 + {XLS_MARGIN_PCT}%)</p>
          <p className="text-[10px] text-slate-400 italic mt-2">Note: Small deltas are expected due to rounding differences between Excel and RIHLA engine.</p>
        </div>
      </div>
    </div>
  )
}
