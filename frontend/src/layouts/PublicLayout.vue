<template>
  <div class="public-shell">
    <header class="site-header" :class="{ 'is-scrolled': scrolled }">
      <RouterLink to="/" class="brand" aria-label="Memory Universe 首页">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-text">
          <strong>MEMORY <em>UNIVERSE</em></strong>
          <small>时光收藏馆</small>
        </span>
      </RouterLink>

      <nav class="desktop-nav" aria-label="主导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="nav-link"
          :class="{ 'is-active': route.name === item.name }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="header-actions">
        <MusicToggle />
        <RouterLink to="/admin/login" class="admin-entry">管理入口</RouterLink>
        <button
          class="menu-toggle"
          type="button"
          :aria-expanded="menuOpen"
          aria-label="打开导航"
          @click="menuOpen = !menuOpen"
        >
          <span :class="{ 'is-open': menuOpen }"></span>
          <span :class="{ 'is-open': menuOpen }"></span>
        </button>
      </div>
    </header>

    <transition name="menu-fade">
      <div v-if="menuOpen" class="mobile-menu" @click.self="menuOpen = false">
        <nav aria-label="移动端导航">
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="item.to"
            class="mobile-link"
            :class="{ 'is-active': route.name === item.name }"
          >
            <span>{{ item.label }}</span>
            <small>{{ item.en }}</small>
          </RouterLink>
          <RouterLink to="/admin/login" class="mobile-link mobile-link--admin">
            <span>管理入口</span>
            <small>ADMIN</small>
          </RouterLink>
        </nav>
      </div>
    </transition>

    <main class="public-main">
      <RouterView v-slot="{ Component, route: currentRoute }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="currentRoute.path" />
        </transition>
      </RouterView>
    </main>

    <footer v-if="!route.meta.immersive" class="site-footer">
      <div class="mu-container footer-inner">
        <div class="footer-brand">
          <span class="brand-mark brand-mark--small" aria-hidden="true"></span>
          <div>
            <strong>Memory Universe</strong>
            <p>把大学四年，收藏成一片宇宙。</p>
          </div>
        </div>
        <div class="footer-links">
          <RouterLink to="/universe">照片宇宙</RouterLink>
          <RouterLink to="/timeline">时光轴</RouterLink>
          <RouterLink to="/message">留言星球</RouterLink>
          <RouterLink to="/time-wall">时光墙</RouterLink>
        </div>
        <p class="footer-note">Class of 2026 · Built with Three.js</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import MusicToggle from '@/components/common/MusicToggle.vue'

const route = useRoute()
const scrolled = ref(false)
const menuOpen = ref(false)

const navItems = [
  { name: 'home', label: '首页', en: 'HOME', to: '/' },
  { name: 'universe', label: '照片宇宙', en: 'UNIVERSE', to: '/universe' },
  { name: 'timeline', label: '时光轴', en: 'TIMELINE', to: '/timeline' },
  { name: 'message', label: '留言星球', en: 'MESSAGES', to: '/message' },
  { name: 'time-wall', label: '时光墙', en: 'TIME WALL', to: '/time-wall' }
]

function handleScroll() {
  scrolled.value = window.scrollY > 24
}

onMounted(() => {
  handleScroll()
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  }
)
</script>

<style scoped>
.public-shell {
  min-height: 100vh;
}

.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1.15rem clamp(1.25rem, 4vw, 3.5rem);
  border-bottom: 1px solid transparent;
  transition:
    background 0.45s ease,
    border-color 0.45s ease,
    backdrop-filter 0.45s ease;
}

.site-header.is-scrolled {
  background: rgba(5, 8, 22, 0.72);
  border-bottom-color: rgba(148, 163, 184, 0.12);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-shrink: 0;
}

.brand-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.42);
  background: radial-gradient(circle at 35% 30%, rgba(56, 189, 248, 0.28), transparent 65%);
  box-shadow: inset 0 0 18px rgba(56, 189, 248, 0.18);
}

.brand-mark::before {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #7dd3fc, #a855f7);
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.9);
}

.brand-mark::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 50%;
  border: 1px solid rgba(168, 85, 247, 0.45);
  transform: rotate(38deg) scaleY(0.42);
}

.brand-mark--small {
  width: 2rem;
  height: 2rem;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 0.16rem;
  line-height: 1;
}

.brand-text strong {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.24em;
  color: var(--mu-star);
}

.brand-text em {
  font-style: normal;
  color: #7dd3fc;
}

.brand-text small {
  font-size: 0.6rem;
  letter-spacing: 0.34em;
  color: var(--mu-muted);
}

.desktop-nav {
  display: none;
  align-items: center;
  gap: 2rem;
  margin-left: auto;
}

.nav-link {
  position: relative;
  padding: 0.35rem 0;
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  color: rgba(203, 213, 225, 0.72);
  transition: color 0.3s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #38bdf8, #a855f7, transparent);
  transform: scaleX(0);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.nav-link:hover,
.nav-link.is-active {
  color: var(--mu-star);
}

.nav-link:hover::after,
.nav-link.is-active::after {
  transform: scaleX(1);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.desktop-nav + .header-actions {
  margin-left: 0;
}

.admin-entry {
  display: none;
  padding: 0.55rem 1.1rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: var(--mu-muted);
  transition: all 0.35s ease;
}

.admin-entry:hover {
  border-color: rgba(56, 189, 248, 0.55);
  color: var(--mu-star);
}

.menu-toggle {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 2.6rem;
  height: 2.6rem;
  padding: 0 0.55rem;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(11, 21, 48, 0.5);
  cursor: pointer;
}

.menu-toggle span {
  display: block;
  height: 1px;
  width: 100%;
  background: var(--mu-star);
  transition: transform 0.35s ease, opacity 0.35s ease;
}

.menu-toggle span:first-child.is-open {
  transform: translateY(3px) rotate(45deg);
}

.menu-toggle span:last-child.is-open {
  transform: translateY(-3px) rotate(-45deg);
}

.mobile-menu {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 6.5rem 1.5rem 2rem;
  background: rgba(5, 8, 22, 0.94);
  backdrop-filter: blur(24px);
}

.mobile-menu nav {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
}

.mobile-link {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 1.15rem 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.mobile-link span {
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.4rem;
  color: var(--mu-star);
}

.mobile-link small {
  font-size: 0.62rem;
  letter-spacing: 0.24em;
  color: var(--mu-muted);
}

.mobile-link.is-active span {
  color: #7dd3fc;
}

.mobile-link--admin {
  margin-top: 1.5rem;
  border-bottom: none;
}

.mobile-link--admin span {
  font-size: 1rem;
  color: var(--mu-muted);
}

.public-main {
  position: relative;
  z-index: 1;
}

.site-footer {
  position: relative;
  z-index: 2;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(5, 8, 22, 0.6);
  backdrop-filter: blur(16px);
}

.footer-inner {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding-top: 2.75rem;
  padding-bottom: 2.75rem;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.footer-brand strong {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.82rem;
  letter-spacing: 0.2em;
  color: var(--mu-star);
}

.footer-brand p {
  margin: 0.25rem 0 0;
  font-size: 0.76rem;
  color: var(--mu-muted);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  font-size: 0.78rem;
  color: var(--mu-muted);
}

.footer-links a {
  transition: color 0.3s ease;
}

.footer-links a:hover {
  color: #7dd3fc;
}

.footer-note {
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.6);
}

@media (min-width: 900px) {
  .desktop-nav {
    display: flex;
    margin-left: auto;
  }

  .admin-entry {
    display: inline-flex;
  }

  .menu-toggle {
    display: none;
  }

  .footer-inner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .footer-note {
    margin-left: auto;
  }
}

@media (min-width: 1100px) {
  .header-actions {
    margin-left: 1rem;
  }
}
</style>
