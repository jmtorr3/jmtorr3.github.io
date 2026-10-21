// The Recycle Bin's slumpy_v0.png: an early sketch of Slumpy, drawn on the fly
// (a wonky monitor, mismatched eyes, a worried squiggle, crossed out). "we
// don't talk about it."

export function earlySketch(): string {
  const c = document.createElement('canvas')
  // drawn on a 160×120 page at twice the pixels, so it isn't tiny in the viewer
  c.width = 320
  c.height = 240
  const g = c.getContext('2d')
  if (!g) return ''
  g.scale(2, 2)
  // lined notebook paper
  g.fillStyle = '#f4efdc'
  g.fillRect(0, 0, 160, 120)
  g.fillStyle = '#b8cbe6'
  for (let y = 14; y < 120; y += 12) g.fillRect(0, y, 160, 1)
  g.fillStyle = '#e8a0a0'
  g.fillRect(18, 0, 1, 120)

  g.strokeStyle = '#3a3a6a'
  g.lineWidth = 2
  g.lineCap = 'round'
  const line = (pts: number[]) => {
    g.beginPath()
    g.moveTo(pts[0], pts[1])
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    g.stroke()
  }
  // a lopsided monitor on a stand that's too small
  line([42, 22, 122, 26, 118, 84, 46, 80, 42, 22])
  line([74, 82, 72, 94, 92, 95, 90, 83])
  // one round eye, one square one
  g.beginPath()
  g.arc(66, 46, 7, 0, Math.PI * 2)
  g.stroke()
  line([90, 40, 102, 41, 101, 52, 90, 51, 90, 40])
  // a worried squiggle of a mouth
  line([64, 66, 70, 62, 76, 67, 82, 62, 88, 67, 94, 63])
  // "v0" and a big no
  g.fillStyle = '#3a3a6a'
  g.font = 'bold 13px monospace'
  g.fillText('slumpy v0??', 34, 112)
  g.strokeStyle = '#d23a3a'
  g.lineWidth = 3
  line([36, 18, 128, 90])
  line([128, 18, 36, 90])
  return c.toDataURL('image/png')
}
