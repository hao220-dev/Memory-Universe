import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchPublicMusic } from '@/api/music'

interface Voice {
  osc: OscillatorNode
  lfo: OscillatorNode
  gain: GainNode
  filter: BiquadFilterNode
}

// 播放器实例放在模块级，脱离组件生命周期，切换路由时不会被销毁。
let audio: HTMLAudioElement | null = null
let playlist: string[] = []
let trackIndex = 0
let playlistLoaded = false
let context: AudioContext | null = null
let master: GainNode | null = null
let voices: Voice[] = []
let stopTimer = 0

export const useMusicStore = defineStore('music', () => {
  const playing = ref(false)
  let loading = false

  async function loadPlaylist(): Promise<void> {
    if (playlistLoaded && playlist.length > 0) {
      return
    }
    try {
      const tracks = await fetchPublicMusic()
      playlist = tracks.map((track) => track.url).filter(Boolean)
      playlistLoaded = playlist.length > 0
    } catch {
      playlist = []
      playlistLoaded = false
    }
  }

  function playCurrent(): void {
    if (!audio) {
      return
    }
    playing.value = true
    void audio.play().catch(() => {
      stopAudio()
      startSynth()
    })
  }

  function handleEnded(): void {
    if (!audio || playlist.length === 0) {
      return
    }
    trackIndex = (trackIndex + 1) % playlist.length
    audio.src = playlist[trackIndex]
    playCurrent()
  }

  function handleError(): void {
    if (!audio || playlist.length === 0) {
      return
    }
    if (playlist.length > 1) {
      trackIndex = (trackIndex + 1) % playlist.length
      audio.src = playlist[trackIndex]
      playCurrent()
      return
    }
    stopAudio()
    startSynth()
  }

  function createAudio(): boolean {
    if (playlist.length === 0) {
      return false
    }
    trackIndex = ((trackIndex % playlist.length) + playlist.length) % playlist.length
    audio = new Audio(playlist[trackIndex])
    audio.volume = 0.55
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    playCurrent()
    return true
  }

  function stopAudio(): void {
    if (!audio) {
      return
    }
    audio.pause()
    audio.removeEventListener('ended', handleEnded)
    audio.removeEventListener('error', handleError)
    audio = null
    playing.value = false
  }

  function pauseAudio(): void {
    if (!audio) {
      return
    }
    audio.pause()
    playing.value = false
  }

  function ensureContext(): AudioContext | null {
    if (context) {
      return context
    }
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) {
      return null
    }
    context = new AudioCtor()
    master = context.createGain()
    master.gain.value = 0.0001
    master.connect(context.destination)
    return context
  }

  function startSynth(): void {
    const ctx = ensureContext()
    if (!ctx || !master) {
      return
    }
    void ctx.resume()

    const now = ctx.currentTime
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.6
    filter.frequency.setValueAtTime(520, now)
    filter.frequency.linearRampToValueAtTime(1080, now + 5)
    filter.connect(master)

    const notes = [110, 164.81, 196, 261.63]
    voices = notes.map((frequency, index) => {
      const osc = ctx.createOscillator()
      osc.type = index % 2 === 0 ? 'sine' : 'triangle'
      osc.frequency.value = frequency
      osc.detune.value = index * 2 - 3

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.05 / (index + 1), now + 3.4)

      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.045 + index * 0.017
      const lfoDepth = ctx.createGain()
      lfoDepth.gain.value = 2.4
      lfo.connect(lfoDepth)
      lfoDepth.connect(osc.detune)

      osc.connect(gain)
      gain.connect(filter)
      osc.start()
      lfo.start()

      return { osc, lfo, gain, filter }
    })

    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.24, now + 2.8)
    playing.value = true
  }

  function stopSynth(): void {
    const ctx = context
    if (!ctx || !master) {
      return
    }
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)

    const dying = voices
    voices = []
    playing.value = false

    window.clearTimeout(stopTimer)
    stopTimer = window.setTimeout(() => {
      dying.forEach((voice) => {
        try {
          voice.osc.stop()
          voice.lfo.stop()
        } catch {
          // 节点可能已经停止
        }
        voice.osc.disconnect()
        voice.lfo.disconnect()
        voice.gain.disconnect()
        voice.filter.disconnect()
      })
    }, 1000)
  }

  /** 单击：在播放与暂停之间切换；暂停后再播放会从暂停位置继续。 */
  async function toggle(): Promise<void> {
    if (loading) {
      return
    }
    if (playing.value) {
      stopSynth()
      pauseAudio()
      return
    }
    if (audio) {
      playCurrent()
      return
    }
    loading = true
    try {
      await loadPlaylist()
    } finally {
      loading = false
    }
    if (createAudio()) {
      return
    }
    startSynth()
  }

  /** 双击：切换到下一首；已经是最后一首时，从头重新播放当前曲目。 */
  async function nextTrack(): Promise<void> {
    if (loading) {
      return
    }
    if (!playlistLoaded) {
      loading = true
      try {
        await loadPlaylist()
      } finally {
        loading = false
      }
    }
    if (playlist.length === 0) {
      if (!playing.value) {
        startSynth()
      }
      return
    }
    if (!audio) {
      createAudio()
      return
    }
    if (trackIndex + 1 < playlist.length) {
      trackIndex += 1
      audio.src = playlist[trackIndex]
    } else {
      audio.currentTime = 0
    }
    playCurrent()
  }

  return { playing, toggle, nextTrack }
})
