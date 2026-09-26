import * as React from 'react'
import { Skeleton } from './Skeleton'

const RevenueChart = React.lazy(() =>
  import('./Charts').then((m) => ({ default: m.RevenueAreaChart })),
)
const DonutChart = React.lazy(() => import('./Charts').then((m) => ({ default: m.PlanDonutChart })))
const BarsChart = React.lazy(() => import('./Charts').then((m) => ({ default: m.MiniBarChart })))
const CompareChart = React.lazy(() =>
  import('./Charts').then((m) => ({ default: m.RevenueComparisonChart })),
)
const BreakdownChart = React.lazy(() =>
  import('./Charts').then((m) => ({ default: m.BreakdownBarChart })),
)

function ChartFallback({ height: _height = 230 }: { height?: number }) {
  return <Skeleton className="h-[180px] w-full rounded-lg" />
}

export function LazyRevenueChart({
  data,
  height,
}: {
  data: { day: string; revenue: number }[]
  height?: number
}) {
  return (
    <React.Suspense fallback={<ChartFallback height={height} />}>
      <RevenueChart data={data} height={height} />
    </React.Suspense>
  )
}

export function LazyDonutChart({
  data,
  height,
}: {
  data: { name: string; value: number }[]
  height?: number
}) {
  return (
    <React.Suspense fallback={<ChartFallback height={height} />}>
      <DonutChart data={data} height={height} />
    </React.Suspense>
  )
}

export function LazyBarChart({
  data,
  height,
}: {
  data: { day: string; revenue: number }[]
  height?: number
}) {
  return (
    <React.Suspense fallback={<ChartFallback height={height} />}>
      <BarsChart data={data} height={height} />
    </React.Suspense>
  )
}

export function LazyComparisonChart({
  data,
  height,
}: {
  data: { label: string; current: number; previous: number }[]
  height?: number
}) {
  return (
    <React.Suspense fallback={<ChartFallback height={height} />}>
      <CompareChart data={data} height={height} />
    </React.Suspense>
  )
}

export function LazyBreakdownChart({
  data,
  height,
}: {
  data: { name: string; total: number }[]
  height?: number
}) {
  return (
    <React.Suspense fallback={<ChartFallback height={height} />}>
      <BreakdownChart data={data} height={height} />
    </React.Suspense>
  )
}
