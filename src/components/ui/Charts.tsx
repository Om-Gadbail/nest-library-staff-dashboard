import * as React from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatINR } from '@/lib/format'

const axisTick = { fontSize: 11, fill: '#a8a29e' } as const

function ChartShell({ height = 240, children }: { height?: number; children: React.ReactNode }) {
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean
  payload?: { value?: number | string }[]
  label?: string
  money?: boolean
}) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md">
      {label ? <p className="font-semibold text-ink">{label}</p> : null}
      <p className="text-ink-secondary">
        {typeof v === 'number' && money ? formatINR(v) : String(v ?? '')}
      </p>
    </div>
  )
}

export function RevenueAreaChart({
  data,
  height,
}: {
  data: { day: string; revenue: number }[]
  height?: number
}) {
  return (
    <ChartShell height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="nest-rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8a5a2b" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#8a5a2b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#efeae2" vertical={false} />
        <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
          width={52}
        />
        <Tooltip content={<ChartTooltip money />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#8a5a2b"
          strokeWidth={2}
          fill="url(#nest-rev)"
        />
      </AreaChart>
    </ChartShell>
  )
}

export function MiniBarChart({
  data,
  height,
}: {
  data: { day: string; revenue: number }[]
  height?: number
}) {
  return (
    <ChartShell height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke="#efeae2" vertical={false} />
        <XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<ChartTooltip money />} />
        <Bar dataKey="revenue" fill="#8a5a2b" radius={[5, 5, 0, 0]} maxBarSize={26} />
      </BarChart>
    </ChartShell>
  )
}

function CompareTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name?: string; value?: number | string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md">
      {label ? <p className="font-semibold text-ink">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={i} className="text-ink-secondary">
          {p.name}: {typeof p.value === 'number' ? formatINR(p.value) : String(p.value ?? '')}
        </p>
      ))}
    </div>
  )
}

/** Current period vs previous equivalent period — clearly labelled. */
export function RevenueComparisonChart({
  data,
  height,
}: {
  data: { label: string; current: number; previous: number }[]
  height?: number
}) {
  return (
    <ChartShell height={height ?? 240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="nest-cur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8a5a2b" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#8a5a2b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#efeae2" vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
          width={52}
        />
        <Tooltip content={<CompareTooltip />} />
        <Area
          type="monotone"
          dataKey="previous"
          name="Previous period"
          stroke="#a8a29e"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          fill="none"
        />
        <Area
          type="monotone"
          dataKey="current"
          name="Current period"
          stroke="#8a5a2b"
          strokeWidth={2}
          fill="url(#nest-cur)"
        />
      </AreaChart>
    </ChartShell>
  )
}

/** Named-value bars for method/plan/status breakdowns. */
export function BreakdownBarChart({
  data,
  height,
}: {
  data: { name: string; total: number }[]
  height?: number
}) {
  return (
    <ChartShell height={height ?? 220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
        <CartesianGrid stroke="#efeae2" horizontal={false} />
        <XAxis
          type="number"
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#57534e' }}
          axisLine={false}
          tickLine={false}
          width={92}
        />
        <Tooltip content={<ChartTooltip money />} />
        <Bar dataKey="total" fill="#8a5a2b" radius={[0, 5, 5, 0]} maxBarSize={22} />
      </BarChart>
    </ChartShell>
  )
}

const DONUT_COLORS = ['#8a5a2b', '#a8a29e', '#57534e', '#b45309']

export function PlanDonutChart({
  data,
  height,
}: {
  data: { name: string; value: number }[]
  height?: number
}) {
  return (
    <ChartShell height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="88%"
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
      </PieChart>
    </ChartShell>
  )
}
