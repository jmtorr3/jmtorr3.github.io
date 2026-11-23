// Slumpy (the computer from jmtorr3.sh) sits by my name at the top, and peeks up from the bottom edge once
// you reach the end of the page.
// Clicking him switches this page off like an old CRT TV (it squashes to a bright line, then a dot) and then
// goes to jmtorr3.sh, which starts by turning on in its 3D room. Without JavaScript he's a plain link.
(() => {
  document.documentElement.classList.add('js')

  // The CRT switch-off sound, synthesized (no audio file): the same one jmtorr3.sh uses (slumpfolio's
  // playCrtOff), timed to the animation below: a switch click and a falling zap as the picture squeezes
  // down (0-0.29s), a dropping tone as the line pulls in (to 0.51s), a last crackle as the dot goes.
  function crtOffSound() {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const c = new Ctx() // created on the click, so the browser lets it play
    const t = c.currentTime + 0.01
    const env = (at, peak, attack, decay) => {
      const g = c.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(peak, at + attack)
      g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
      g.connect(c.destination)
      return g
    }
    const tone = (at, dur, type, from, to, out) => {
      const o = c.createOscillator()
      o.type = type
      o.frequency.setValueAtTime(from, at)
      o.frequency.exponentialRampToValueAtTime(to, at + dur)
      o.connect(out)
      o.start(at)
      o.stop(at + dur)
    }
    const noise = (at, dur, type, freq, out) => {
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const src = c.createBufferSource()
      src.buffer = buf
      const f = c.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      src.connect(f).connect(out)
      src.start(at)
      src.stop(at + dur)
    }
    noise(t, 0.05, 'highpass', 2200, env(t, 0.2, 0.001, 0.045))
    tone(t, 0.28, 'square', 1500, 300, env(t, 0.06, 0.005, 0.27))
    tone(t + 0.29, 0.22, 'sine', 900, 60, env(t + 0.29, 0.2, 0.005, 0.21))
    noise(t + 0.5, 0.12, 'bandpass', 5000, env(t + 0.5, 0.05, 0.01, 0.1))
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  addEventListener('DOMContentLoaded', () => {
    // the one at the bottom peeks up when the footer comes into view (and ducks back down when you scroll up)
    const bottom = document.querySelector('.slumpy-bottom')
    const footer = document.querySelector('footer')
    if (bottom && footer)
      new IntersectionObserver(([e]) => bottom.classList.toggle('peek', e.isIntersecting), { threshold: 0.2 }).observe(footer)

    // either one (top of the page or bottom): switch off, then go
    for (const slumpy of document.querySelectorAll('.slumpy')) slumpy.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return // new tab etc.: let the link do it
      e.preventDefault()
      const go = () => (location.href = slumpy.href)
      if (reduced) return go()
      try { crtOffSound() } catch { /* no sound, still goes */ }
      document.querySelectorAll('.slumpy').forEach((s) => s.classList.remove('peek'))
      const crt = document.createElement('div')
      crt.className = 'crt'
      document.body.append(crt)
      setTimeout(go, 750)
    })

    // coming back with the Back button (page restored from cache): turn the page back on
    addEventListener('pageshow', (e) => {
      if (e.persisted) document.querySelectorAll('.crt').forEach((el) => el.remove())
    })
  })
})()
