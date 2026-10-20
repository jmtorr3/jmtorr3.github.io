import { Fragment, type ReactNode } from 'react'

// Tiny inline markup for text in src/data: **bold** and [label](https://url)
export function rich(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const bold = part.match(/^\*\*(.+)\*\*$/)
    if (bold) return <strong key={i}>{bold[1]}</strong>
    const link = part.match(/^\[(.+)\]\((.+)\)$/)
    if (link)
      return (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      )
    return <Fragment key={i}>{part}</Fragment>
  })
}

// same markup flattened for the terminal
export const plain = (text: string) =>
  text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 <$2>')
