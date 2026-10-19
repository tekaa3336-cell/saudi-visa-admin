export function beep() {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)()
    const o = c.createOscillator(), g = c.createGain()
    o.connect(g); g.connect(c.destination); o.frequency.value = 880
    g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.35)
    o.start(); o.stop(c.currentTime + 0.35); setTimeout(() => c.close(), 500)
  } catch { /* audio blocked until first user interaction */ }
}
