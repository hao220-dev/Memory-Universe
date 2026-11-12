<template>
  <section ref="heroEl" class="hero" :class="{ 'is-leaving': leaving }">
    <div class="hero-canvas">
      <CosmicCanvas />
    </div>
    <div class="hero-scrim" aria-hidden="true"></div>

    <div class="hero-content">
      <div ref="introEl" class="hero-intro">
        <p class="hero-eyebrow">
          <span class="eyebrow-rule" aria-hidden="true"></span>
          <span>MEMORY UNIVERSE</span>
          <span class="eyebrow-rule" aria-hidden="true"></span>
        </p>

        <h1 class="hero-title">
          <span class="title-line">一张照片，一段时光，</span>
          <span class="title-line">一个不想遗忘的<em class="title-story">故事</em></span>
        </h1>

        <p class="hero-en">A JOURNEY THROUGH OUR YOUTH</p>

        <button type="button" class="enter-btn" @click="enterUniverse">
          <span class="enter-btn-halo" aria-hidden="true"></span>
          <span class="enter-label">开启记忆之旅</span>
          <span class="enter-arrow" aria-hidden="true">→</span>
        </button>

        <p class="hero-note">拖拽 · 缩放 · 拾取，在星海中重新遇见四年</p>
      </div>
    </div>

    <footer class="hero-footer">
      <span class="footer-rule" aria-hidden="true"></span>
      <span class="footer-class">CLASS OF 2026</span>
      <span class="footer-rule" aria-hidden="true"></span>
    </footer>

    <div class="warp-flash" aria-hidden="true"></div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'
import CosmicCanvas from '@/components/universe/CosmicCanvas.vue'

const router = useRouter()
const heroEl = ref<HTMLElement | null>(null)
const introEl = ref<HTMLElement | null>(null)
const leaving = ref(false)

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

let context: gsap.Context | null = null
let moveX: ((value: number) => void) | null = null
let moveY: ((value: number) => void) | null = null
let leaveTimer = 0

function handlePointerMove(event: PointerEvent) {
  if (!moveX || !moveY) {
    return
  }
  const nx = (event.clientX / window.innerWidth) * 2 - 1
  const ny = (event.clientY / window.innerHeight) * 2 - 1
  moveX(nx * -12)
  moveY(ny * -8)
}

function enterUniverse() {
  if (leaving.value) {
    return
  }
  leaving.value = true

  if (reduceMotion) {
    void router.push('/universe')
    return
  }

  leaveTimer = window.setTimeout(() => {
    void router.push('/universe')
  }, 620)
}

onMounted(() => {
  if (!heroEl.value) {
    return
  }

  context = gsap.context(() => {
    const targets = ['.hero-eyebrow', '.title-line', '.hero-en', '.enter-btn', '.hero-note', '.hero-footer']

    if (reduceMotion) {
      gsap.set(targets, { opacity: 1, y: 0, filter: 'none' })
      return
    }

    gsap
      .timeline({ defaults: { ease: 'power3.out' }, delay: 0.25 })
      .fromTo('.hero-eyebrow', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.1 })
      .fromTo(
        '.title-line',
        { opacity: 0, y: 52, filter: 'blur(16px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.5, stagger: 0.16 },
        '-=0.75'
      )
      .fromTo('.hero-en', { opacity: 0, y: 18, letterSpacing: '0.9em' }, { opacity: 1, y: 0, letterSpacing: '0.5em', duration: 1.3 }, '-=0.85')
      .fromTo('.enter-btn', { opacity: 0, y: 26, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 1.1 }, '-=0.8')
      .fromTo('.hero-note', { opacity: 0 }, { opacity: 1, duration: 1 }, '-=0.7')
      .fromTo('.hero-footer', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.1 }, '-=0.9')

    if (introEl.value) {
      moveX = gsap.quickTo(introEl.value, 'x', { duration: 1.3, ease: 'power3.out' })
      moveY = gsap.quickTo(introEl.value, 'y', { duration: 1.3, ease: 'power3.out' })
      window.addEventListener('pointermove', handlePointerMove, { passive: true })
    }
  }, heroEl.value)
})

onBeforeUnmount(() => {
  window.clearTimeout(leaveTimer)
  window.removeEventListener('pointermove', handlePointerMove)
  moveX = null
  moveY = null
  context?.revert()
  context = null
})
</script>

<style scoped>
.hero {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100svh;
  overflow: hidden;
  background: #050816;
}

.hero-canvas {
  position: absolute;
  inset: 0;
  animation: canvas-in 2.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes canvas-in {
  from {
    opacity: 0;
    transform: scale(1.04);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.hero-scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 44% 34% at 50% 48%, rgba(5, 8, 22, 0.58), transparent 72%),
    radial-gradient(ellipse 70% 55% at 50% 50%, transparent 40%, rgba(5, 8, 22, 0.55) 100%),
    linear-gradient(180deg, rgba(5, 8, 22, 0.62) 0%, transparent 24%, transparent 68%, rgba(5, 8, 22, 0.82) 100%);
}

.hero-content {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  width: 100%;
  padding: 7.5rem 1.4rem 7rem;
  text-align: center;
  pointer-events: none;
}

.hero-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 960px;
  will-change: transform;
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.58rem;
  letter-spacing: 0.42em;
  color: rgba(186, 230, 253, 0.72);
}

.eyebrow-rule {
  width: clamp(1.4rem, 5vw, 3.4rem);
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(125, 211, 252, 0.5));
}

.eyebrow-rule:last-child {
  background: linear-gradient(90deg, rgba(125, 211, 252, 0.5), transparent);
}

.hero-title {
  margin: clamp(1.2rem, 3vw, 2rem) 0 0;
  font-family: 'Space Grotesk', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: clamp(2.2rem, 6.6vw, 5.2rem);
  font-weight: 600;
  line-height: 1.14;
  letter-spacing: 0.04em;
  color: #f8fafc;
  text-shadow:
    0 0 46px rgba(56, 189, 248, 0.22),
    0 0 120px rgba(168, 85, 247, 0.18);
}

.title-line {
  display: block;
}

.title-story {
  font-style: normal;
  font-size: 1.08em;
  background: linear-gradient(104deg, #f8fafc 6%, #bae6fd 40%, #7dd3fc 62%, #c4b5fd 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 26px rgba(56, 189, 248, 0.34));
}

.hero-en {
  margin: clamp(1.2rem, 2.6vw, 1.8rem) 0 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: clamp(0.56rem, 1.05vw, 0.72rem);
  letter-spacing: 0.5em;
  text-indent: 0.5em;
  color: rgba(148, 163, 184, 0.78);
}

.enter-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: clamp(2rem, 4vw, 3rem);
  padding: 0.95rem 2rem 0.95rem 2.2rem;
  border: 1px solid rgba(125, 211, 252, 0.34);
  border-radius: 999px;
  background: rgba(8, 16, 38, 0.42);
  color: #e0f2fe;
  cursor: pointer;
  pointer-events: auto;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow:
    inset 0 0 22px rgba(56, 189, 248, 0.08),
    0 10px 40px rgba(2, 6, 23, 0.45);
  transition:
    transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
    border-color 0.45s ease,
    background 0.45s ease,
    box-shadow 0.45s ease;
}

.enter-btn::before {
  content: '';
  position: absolute;
  inset: -7px;
  border-radius: 999px;
  border: 1px solid rgba(56, 189, 248, 0.16);
  animation: btn-pulse 3.8s ease-in-out infinite;
  pointer-events: none;
}

.enter-btn-halo {
  position: absolute;
  inset: -40%;
  z-index: -1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(56, 189, 248, 0.16), transparent 62%);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.enter-btn:hover {
  transform: translateY(-2px);
  border-color: rgba(125, 211, 252, 0.62);
  background: rgba(11, 26, 54, 0.62);
  box-shadow:
    inset 0 0 26px rgba(56, 189, 248, 0.14),
    0 14px 48px rgba(2, 6, 23, 0.55),
    0 0 34px rgba(56, 189, 248, 0.18);
}

.enter-btn:hover .enter-btn-halo {
  opacity: 1;
}

.enter-label {
  font-size: 0.8rem;
  letter-spacing: 0.26em;
  text-indent: 0.26em;
}

.enter-arrow {
  font-size: 0.95rem;
  color: #7dd3fc;
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.enter-btn:hover .enter-arrow {
  transform: translateX(4px);
}

@keyframes btn-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.99);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.015);
  }
}

.hero-note {
  margin: 1.4rem 0 0;
  font-size: 0.66rem;
  letter-spacing: 0.18em;
  color: rgba(148, 163, 184, 0.56);
}

.hero-footer {
  position: absolute;
  bottom: 1.6rem;
  left: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 1rem;
  transform: translateX(-50%);
  white-space: nowrap;
}

.footer-rule {
  width: clamp(1.2rem, 4vw, 2.6rem);
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.38));
}

.footer-rule:last-child {
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.38), transparent);
}

.footer-class {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.58rem;
  letter-spacing: 0.52em;
  text-indent: 0.52em;
  color: rgba(203, 213, 225, 0.6);
}

.warp-flash {
  position: absolute;
  inset: 0;
  z-index: 20;
  opacity: 0;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%, rgba(224, 242, 254, 0.92), rgba(56, 189, 248, 0.5) 30%, rgba(168, 85, 247, 0.16) 55%, transparent 74%);
}

.hero.is-leaving .hero-intro {
  animation: hero-out 0.68s cubic-bezier(0.4, 0, 1, 1) forwards;
}

.hero.is-leaving .hero-footer {
  animation: footer-out 0.4s ease forwards;
}

.hero.is-leaving .hero-canvas {
  animation: canvas-out 0.9s cubic-bezier(0.4, 0, 1, 1) forwards;
}

.hero.is-leaving .warp-flash {
  animation: warp 0.92s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

@keyframes hero-out {
  to {
    opacity: 0;
    transform: translateY(-26px) scale(1.03);
    filter: blur(10px);
  }
}

@keyframes footer-out {
  to {
    opacity: 0;
  }
}

@keyframes canvas-out {
  to {
    opacity: 0.2;
    transform: scale(1.1);
  }
}

@keyframes warp {
  0% {
    opacity: 0;
  }
  42% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
  }
}

@media (max-width: 640px) {
  .hero-content {
    padding: 6.5rem 1.15rem 6.5rem;
  }

  .hero-title {
    letter-spacing: 0.02em;
  }

  .hero-en {
    letter-spacing: 0.34em;
    text-indent: 0.34em;
  }

  .hero-note {
    font-size: 0.6rem;
    letter-spacing: 0.12em;
  }

  .hero-footer {
    bottom: 1.2rem;
  }
}

@media (max-width: 520px) {
  .hero-title {
    font-size: clamp(1.55rem, 7.6vw, 2.2rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-canvas,
  .enter-btn::before {
    animation: none;
  }
}
</style>
