import { useState } from 'react'
import { Star } from 'lucide-react'

interface Props {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
  size?: number
}

export function StarRating({ value, onChange, readonly = false, size = 20 }: Props) {
  const [hover, setHover] = useState(0)

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={(hover || value) >= star ? '#f59e0b' : 'none'}
          stroke={(hover || value) >= star ? '#f59e0b' : '#94a3b8'}
          style={{ cursor: readonly ? 'default' : 'pointer', transition: 'all .15s' }}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          onClick={() => !readonly && onChange?.(star)}
        />
      ))}
    </div>
  )
}
