<template>
  <section class="phase-panel glass-panel">
    <div class="phase-visual" aria-hidden="true">
      <span class="phase-core"></span>
      <span class="phase-ring phase-ring--one"></span>
      <span class="phase-ring phase-ring--two"></span>
      <span class="phase-ring phase-ring--three"></span>
      <span class="phase-dot phase-dot--one"></span>
      <span class="phase-dot phase-dot--two"></span>
    </div>

    <div class="phase-content">
      <div class="phase-head">
        <p class="eyebrow">{{ eyebrow }}</p>
        <span class="status-pill status-pill--violet">{{ phase }}</span>
      </div>
      <h1 class="phase-title display-title">{{ title }}</h1>
      <p class="phase-description">{{ description }}</p>

      <ul class="phase-features">
        <li v-for="(feature, index) in features" :key="feature">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <p>{{ feature }}</p>
        </li>
      </ul>

      <p class="phase-note">
        该模块尚未接入后端能力，页面不会展示虚构数据。详细排期见
        <code>docs/IMPLEMENTATION_PLAN.md</code>。
      </p>

      <div class="phase-actions">
        <RouterLink to="/universe" class="mu-btn mu-btn--primary mu-btn--sm">先去照片宇宙</RouterLink>
        <RouterLink to="/" class="mu-btn mu-btn--ghost mu-btn--sm">返回首页</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  eyebrow: string
  title: string
  description: string
  phase: string
  features: string[]
}>()
</script>

<style scoped>
.phase-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  padding: 2.5rem 1.75rem;
  overflow: hidden;
}

.phase-visual {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 220px;
}

.phase-core {
  width: 4.2rem;
  height: 4.2rem;
  border-radius: 50%;
  background: radial-gradient(circle at 38% 32%, #e0f2fe, #38bdf8 38%, #7c3aed 78%);
  box-shadow:
    0 0 40px rgba(56, 189, 248, 0.65),
    0 0 90px rgba(168, 85, 247, 0.35);
  animation: phase-pulse 5s ease-in-out infinite;
}

.phase-ring {
  position: absolute;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 50%;
}

.phase-ring--one {
  width: 9rem;
  height: 9rem;
  border-color: rgba(56, 189, 248, 0.34);
  animation: phase-spin 18s linear infinite;
}

.phase-ring--one::after {
  content: '';
  position: absolute;
  top: -3px;
  left: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #7dd3fc;
  box-shadow: 0 0 12px #38bdf8;
}

.phase-ring--two {
  width: 13rem;
  height: 13rem;
  border-style: dashed;
  border-color: rgba(168, 85, 247, 0.26);
  animation: phase-spin 32s linear infinite reverse;
}

.phase-ring--three {
  width: 17rem;
  height: 17rem;
  border-color: rgba(148, 163, 184, 0.1);
}

.phase-dot {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #c084fc;
  box-shadow: 0 0 12px #a855f7;
}

.phase-dot--one {
  top: 16%;
  right: 22%;
}

.phase-dot--two {
  bottom: 18%;
  left: 18%;
  background: #7dd3fc;
  box-shadow: 0 0 12px #38bdf8;
}

@keyframes phase-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes phase-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.95;
  }
  50% {
    transform: scale(1.06);
    opacity: 1;
  }
}

.phase-content {
  position: relative;
  z-index: 1;
}

.phase-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.phase-title {
  margin: 1.1rem 0 0.9rem;
  font-size: clamp(1.9rem, 4vw, 2.7rem);
  color: var(--mu-star);
}

.phase-description {
  margin: 0;
  max-width: 36rem;
  font-size: 0.92rem;
  line-height: 1.9;
  color: var(--mu-muted);
}

.phase-features {
  display: grid;
  gap: 0.85rem;
  margin: 1.8rem 0 0;
  padding: 0;
  list-style: none;
}

.phase-features li {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.8rem 1rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.1);
  background: rgba(5, 8, 22, 0.4);
}

.phase-features span {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  color: #7dd3fc;
}

.phase-features p {
  margin: 0;
  font-size: 0.84rem;
  color: rgba(226, 232, 240, 0.86);
}

.phase-note {
  margin: 1.5rem 0 0;
  font-size: 0.72rem;
  line-height: 1.8;
  color: rgba(148, 163, 184, 0.72);
}

.phase-note code {
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.08);
  color: #7dd3fc;
  font-size: 0.7rem;
}

.phase-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-top: 1.8rem;
}

@media (min-width: 900px) {
  .phase-panel {
    grid-template-columns: 0.85fr 1.15fr;
    align-items: center;
    gap: 3.5rem;
    padding: 3.5rem 3rem;
  }

  .phase-visual {
    min-height: 340px;
  }
}
</style>
