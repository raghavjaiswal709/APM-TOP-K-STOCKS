interface Bar { close: number }

interface Props {
  bars: Bar[]
  width?: number
  height?: number
}

export default function SparkLine({ bars, width = 220, height = 36 }: Props) {
  if (bars.length < 2) {
    return (
      <span className="text-zinc-600 text-[10px]">No intraday data</span>
    )
  }

  const closes = bars.map(b => Number(b.close))
  const min    = Math.min(...closes)
  const max    = Math.max(...closes)
  const range  = max - min || 1

  const pts = closes.map((c, i) => {
    const x = (i / (closes.length - 1)) * width
    const y = height - ((c - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const isUp   = closes[closes.length - 1] >= closes[0]
  const stroke = isUp ? '#34d399' : '#f87171'
  const fill   = isUp ? '#34d39912' : '#f8717112'

  const firstY = height - ((closes[0]       - min) / range) * (height - 4) - 2
  const lastY  = height - ((closes[closes.length - 1] - min) / range) * (height - 4) - 2
  const area   = `0,${height} ${pts} ${width},${height}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ maxHeight: height }}
    >
      <line x1="0" y1={firstY.toFixed(1)} x2={width} y2={firstY.toFixed(1)}
            stroke="#52525b" strokeWidth="0.5" strokeDasharray="3,3" />
      <polygon points={area} fill={fill} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={width} cy={lastY.toFixed(1)} r="2" fill={stroke} />
    </svg>
  )
}
