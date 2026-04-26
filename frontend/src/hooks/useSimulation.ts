/**
 * useSimulation — Hook qui appelle le backend pricing engine.
 *
 * Stratégie :
 * 1. Envoie les données du circuit à POST /api/quotations/engine/simulate-circuit
 * 2. Si le backend est indisponible, fait le calcul localement (fallback)
 * 3. Debounce de 300ms pour ne pas spammer l'API pendant le drag du slider
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  XLS_DAILY, XLS_FIXED, XLS_VARIABLE,
  XLS_SINGLE_SUPPLEMENT, XLS_EXCHANGE_RATE,
} from '@/data/ys_travel_11d';

export interface GridRow {
  pax: number;
  cost: number;
  sell: number;
  marge: number;
  usd: number;
  byCategory?: Record<string, number>;
  warnings?: string[];
}

export interface SimulationResult {
  grid: GridRow[];
  singleSupplement: number;
  totalFixed: number;
  totalVarGroup: number;
  source: 'backend' | 'fallback';
}

export interface SimulationOverrides {
  restaurants: Record<number, { id: string, price: number }>;
  hotels?: Record<number, { id: string, price: number, single_supplement?: number }>;
}

const PAX_TIERS = [10, 15, 20, 25, 30, 35];

// ── Fallback local (même logique qu'avant, en cas de backend down) ──
function calculateLocal(margin: number, overrides?: SimulationOverrides): SimulationResult {
  let totalFixed = 0;
  
  // Recalculate fixed costs based on XLS_DAILY + overrides
  XLS_DAILY.forEach(d => {
    if (d.halfDbl <= 0) return;
    
    // Apply Hotel Override
    const hotelOverride = overrides?.hotels?.[d.day];
    const hotelCost = hotelOverride ? hotelOverride.price : d.halfDbl;
    
    // Apply Restaurant Override
    const restoOverride = overrides?.restaurants[d.day];
    const restoCost = restoOverride ? restoOverride.price : (d.restPrice || 0);

    let dayCost = hotelCost + d.taxe + d.water + d.monuPrice + restoCost;
    
    totalFixed += dayCost;
  });

  const totalVarGrp = Object.values(XLS_VARIABLE).reduce((a, b) => a + b, 0);

  const grid = PAX_TIERS.map(pax => {
    const vp = totalVarGrp / pax;
    const cost = totalFixed + vp;
    const sell = cost * (1 + margin / 100);
    return {
      pax,
      cost: Math.round(cost * 100) / 100,
      sell: Math.round(sell * 100) / 100,
      marge: Math.round((sell - cost) * 100) / 100,
      usd: Math.round((sell / XLS_EXCHANGE_RATE) * 100) / 100,
    };
  });

  return {
    grid,
    singleSupplement: XLS_SINGLE_SUPPLEMENT,
    totalFixed,
    totalVarGroup: totalVarGrp,
    source: 'fallback',
  };
}

// ── API call ──
async function callBackend(margin: number, overrides?: SimulationOverrides): Promise<SimulationResult | null> {
  try {
    const body = {
      days: XLS_DAILY.map(d => {
        const restoOverride = overrides?.restaurants[d.day];
        const hotelOverride = overrides?.hotels?.[d.day];
        return {
          day: d.day,
          hotel: hotelOverride ? hotelOverride.id : d.hotel,
          formula: d.formula,
          half_dbl: hotelOverride ? hotelOverride.price : d.halfDbl,
          single_sup: hotelOverride?.single_supplement || d.ss,
          city_tax: d.taxe,
          water: d.water,
          restaurant: restoOverride ? `Override: ${restoOverride.id}` : d.rest,
          rest_price: restoOverride ? restoOverride.price : d.restPrice,
          monument: d.monument,
          monu_price: d.monuPrice,
          local_guide: d.lg,
        };
      }),
      variable_costs: Object.entries(XLS_VARIABLE).map(([key, val]) => ({
        key,
        label: key,
        total_group: val,
      })),
      margin_pct: margin,
      currency: 'MAD',
      pax_tiers: PAX_TIERS,
      exchange_rate: XLS_EXCHANGE_RATE,
    };

    const token = localStorage.getItem('stours_token')
    const res = await fetch('/api/quotations/engine/simulate-circuit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;

    const json = await res.json();
    if (!json.success) return null;

    const data = json.data;
    return {
      grid: data.grid.map((r: any) => ({
        pax: r.pax,
        cost: r.cost_per_pax,
        sell: r.selling_per_pax,
        marge: r.margin_per_pax,
        usd: r.usd_per_pax,
        byCategory: r.by_category,
        warnings: r.warnings,
      })),
      singleSupplement: data.single_supplement,
      totalFixed: data.fixed_per_pax,
      totalVarGroup: data.variable_group,
      source: 'backend',
    };
  } catch (err) {
    console.error('[useSimulation] Backend unreachable, falling back to local calculation:', err)
    return null;
  }
}

// ── Hook principal ──
export function useSimulation(margin: number, overrides?: SimulationOverrides) {
  const [result, setResult] = useState<SimulationResult>(() => calculateLocal(margin, overrides));
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const run = useCallback(async (m: number, o?: SimulationOverrides) => {
    // Try backend first
    const backendResult = await callBackend(m, o);
    if (backendResult) {
      setResult(backendResult);
    } else {
      // Fallback to local calculation
      setResult(calculateLocal(m, o));
    }
  }, []);

  useEffect(() => {
    // Debounce 300ms
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => run(margin, overrides), 300);
    return () => clearTimeout(timerRef.current);
  }, [margin, overrides, run]);

  return result;
}
