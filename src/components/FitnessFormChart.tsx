import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  Info, 
  BatteryCharging, 
  Flame 
} from 'lucide-react';
import type { FitnessSummary } from '../lib/physiology';

interface FitnessFormChartProps {
  summary: FitnessSummary;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const ctl = payload.find(p => p.dataKey === 'ctl')?.value ?? 0;
  const atl = payload.find(p => p.dataKey === 'atl')?.value ?? 0;
  const tsb = payload.find(p => p.dataKey === 'tsb')?.value ?? 0;
  const dailyTss = payload.find(p => p.dataKey === 'dailyTss')?.value ?? 0;

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '0.625rem',
      padding: '0.75rem 1rem',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
      color: 'var(--color-text-main)',
      fontSize: '0.8rem',
      minWidth: '11rem'
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--color-text-main)', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#06b6d4', display: 'inline-block' }} />
            Fitness (CTL):
          </span>
          <strong style={{ fontWeight: 700 }}>{ctl}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#ec4899', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ec4899', display: 'inline-block' }} />
            Vermoeidheid (ATL):
          </span>
          <strong style={{ fontWeight: 700 }}>{atl}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: tsb >= 0 ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: tsb >= 0 ? '#10b981' : '#f59e0b', display: 'inline-block' }} />
            Vorm (TSB):
          </span>
          <strong style={{ fontWeight: 700, color: tsb >= 0 ? '#10b981' : '#f59e0b' }}>
            {tsb > 0 ? `+${tsb}` : tsb}
          </strong>
        </div>
        {dailyTss > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', paddingTop: '0.25rem', borderTop: '1px dashed var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Dagelijkse TSS:</span>
            <strong style={{ color: 'var(--color-primary)' }}>{dailyTss}</strong>
          </div>
        )}
      </div>
    </div>
  );
};

export default function FitnessFormChart({ summary }: FitnessFormChartProps) {
  const [timeframe, setTimeframe] = useState<30 | 60 | 90>(90);
  const [showInfo, setShowInfo] = useState<boolean>(false);

  const filteredSeries = useMemo(() => {
    if (!summary?.series) return [];
    return summary.series.slice(-timeframe);
  }, [summary, timeframe]);

  const { currentCtl, currentAtl, currentTsb, formStatusLabel, formStatusDescription } = summary;

  // Status color badge
  const getTsbColor = (val: number) => {
    if (val > 20) return '#3b82f6'; // Very fresh
    if (val >= 5) return '#10b981'; // Peaked / Top form
    if (val >= -10) return '#06b6d4'; // Maintenance / Neutral
    if (val >= -30) return 'var(--color-primary)'; // Productive optimal
    return '#ef4444'; // Overreached / High fatigue
  };

  const statusColor = getTsbColor(currentTsb);

  return (
    <div style={{
      backgroundColor: 'var(--color-surface)',
      borderRadius: '1rem',
      border: '1px solid var(--color-border)',
      padding: '1.25rem',
      boxShadow: 'var(--shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem'
    }}>
      {/* Top Banner: Metrics & Status */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--color-border)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              Fitness & Vorm (CTL / ATL / TSB)
            </h3>
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              aria-label="Uitleg fysiologie"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.2rem'
              }}
            >
              <Info size={16} />
            </button>
          </div>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            Dr. Coggan EWMA trainingsmodel over 90 dagen rithistorie
          </p>
        </div>

        {/* Timeframe selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-surface-hover)', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid var(--color-border)' }}>
          {[
            { days: 30, label: '30D' },
            { days: 60, label: '60D' },
            { days: 90, label: '90D' }
          ].map(t => (
            <button
              key={t.days}
              type="button"
              onClick={() => setTimeframe(t.days as 30 | 60 | 90)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: timeframe === t.days ? 'var(--color-primary)' : 'transparent',
                color: timeframe === t.days ? '#ffffff' : 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
        {/* Fitness CTL */}
        <div style={{
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: '0.75rem',
          padding: '0.875rem',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Conditie (CTL)
            </span>
            <Activity size={14} style={{ color: '#06b6d4' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#06b6d4' }}>
            {currentCtl}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            42-dagen gewogen belasting
          </span>
        </div>

        {/* Fatigue ATL */}
        <div style={{
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: '0.75rem',
          padding: '0.875rem',
          border: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Vermoeidheid (ATL)
            </span>
            <Flame size={14} style={{ color: '#ec4899' }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ec4899' }}>
            {currentAtl}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            7-dagen acute vermoeidheid
          </span>
        </div>

        {/* Form TSB */}
        <div style={{
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: '0.75rem',
          padding: '0.875rem',
          border: `1px solid ${statusColor}44`,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Vorm / Frisheid (TSB)
            </span>
            <BatteryCharging size={14} style={{ color: statusColor }} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: statusColor }}>
            {currentTsb > 0 ? `+${currentTsb}` : currentTsb}
          </div>
          <span 
            title={formStatusDescription}
            style={{ fontSize: '0.7rem', fontWeight: 600, color: statusColor, cursor: 'help' }}
          >
            {formStatusLabel}
          </span>
        </div>
      </div>

      {/* Educational Banner (collapsible) */}
      {showInfo && (
        <div style={{
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: '0.625rem',
          padding: '0.875rem 1rem',
          border: '1px solid var(--color-border)',
          fontSize: '0.78rem',
          lineHeight: 1.45,
          color: 'var(--color-text-main)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
            Hoe werkt het Coggan Impulse-Response Trainingsmodel?
          </div>
          <div>
            <strong>CTL (Chronic Training Load):</strong> Je opgebouwde conditie en aerobe basis over 42 dagen. Stijgt langzaam door consistente trainingsweken.
          </div>
          <div>
            <strong>ATL (Acute Training Load):</strong> Je recente vermoeidheid over 7 dagen. Stijgt snel na zware of intensieve trainingen en zakt na een paar rustdagen.
          </div>
          <div>
            <strong>TSB (Training Stress Balance):</strong> CTL (gisteren) − ATL (gisteren). Geeft aan hoe fris je bent:
            <ul style={{ margin: '0.3rem 0 0 1rem', padding: 0 }}>
              <li><strong>+5 tot +20:</strong> Topvorm voor wedstrijd of recordpoging.</li>
              <li><strong>-10 tot -30:</strong> Optimaal trainingsbereik voor adaptatie en opbouw.</li>
              <li><strong>&lt; -30:</strong> Te veel acute vermoeidheid, kans op overtraining.</li>
            </ul>
          </div>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', fontStyle: 'italic', marginTop: '0.2rem' }}>
            * Let op: TSB is een wiskundige indicatie van trainingsbalans op basis van geregistreerde vermogens- en hartslagbelasting, geen klinische herstelmeting.
          </div>
        </div>
      )}

      {/* Recharts Chart Area */}
      <div style={{ width: '100%', height: '260px', marginTop: '0.25rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={filteredSeries}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="tsbGradientPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="tsbGradientNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.0} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.25} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: '10px', fontSize: '11px', color: 'var(--color-text-muted)' }}
            />

            {/* Zero balance reference line */}
            <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />

            {/* TSB Area */}
            <Area
              type="monotone"
              dataKey="tsb"
              name="Vorm (TSB)"
              stroke="#10b981"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#tsbGradientPositive)"
            />

            {/* ATL Line (Fatigue) */}
            <Line
              type="monotone"
              dataKey="atl"
              name="Vermoeidheid (ATL)"
              stroke="#ec4899"
              strokeWidth={2}
              dot={false}
            />

            {/* CTL Line (Fitness) */}
            <Line
              type="monotone"
              dataKey="ctl"
              name="Conditie (CTL)"
              stroke="#06b6d4"
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
