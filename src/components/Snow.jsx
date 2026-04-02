import { useMemo } from 'react'
import './Snow.css'

// NixOS colorscheme
const COLORS = [
  '#5277c3', // nix blue
  '#7ebae4', // nix light blue
  '#4169b8', // darker nix blue
  '#9ecfee', // pale nix blue
  '#3a5aab', // deep blue
]

const SIZES = [2, 2, 4, 4, 4, 6] // pixel multiples, weighted small

export default function Snow({ count = 60 }) {
  const flakes = useMemo(() => (
    Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: SIZES[Math.floor(Math.random() * SIZES.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      duration: 10 + Math.random() * 14,
      delay: -Math.random() * 24,
      opacity: 0.25 + Math.random() * 0.45,
      drift: (Math.random() - 0.5) * 60,
    }))
  ), [count])

  return (
    <div className="snow-container" aria-hidden="true">
      {flakes.map((f) => (
        <div
          key={f.id}
          className="snow-flake"
          style={{
            left: `${f.left}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            background: f.color,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            '--drift': `${f.drift}px`,
          }}
        />
      ))}
    </div>
  )
}
