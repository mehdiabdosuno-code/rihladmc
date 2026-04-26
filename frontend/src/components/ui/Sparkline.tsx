import * as React from 'react'

interface Props {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  className?: string
}

/**
 * Tiny inline sparkline (no external dependency).
 * Renders an SVG line chart given a numeric series.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  stroke = 'currentColor',
  fill = 'none',
  className,
}: Props) {
  if (!data?.length) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />
  }

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = Math.max(max - min, 1)
  const stepX = data.length > 1 ? width / (data.length - 1) : width
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * (height - 2) - 1
    return `${x},${y}`
  })

  // Build a closed polygon for area fill
  const areaPath =
    `M0,${height} ` +
    points.map((p, i) => (i === 0 ? `L${p}` : `L${p}`)).join(' ') +
    ` L${width},${height} Z`

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {fill !== 'none' && <path d={areaPath} fill={fill} />}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
