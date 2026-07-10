interface Props { value: number; className?: string }

export default function PriceArrow({ value, className = '' }: Props) {
  if (!value) return null
  return (
    <span className={className} style={{ fontSize: '0.65em', lineHeight: 1 }}>
      {value > 0 ? '▲' : '▼'}
    </span>
  )
}
