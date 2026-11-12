<template>
  <div class="admin-shell">
    <aside class="admin-sidebar" :class="{ 'is-open': sidebarOpen }">
      <RouterLink to="/admin/dashboard" class="admin-brand">
        <span class="admin-brand-mark" aria-hidden="true"></span>
        <span>
          <strong>MEMORY UNIVERSE</strong>
          <small>馆长控制台</small>
        </span>
      </RouterLink>

      <nav class="admin-nav" aria-label="后台导航">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="item.to"
          class="admin-nav-item"
          :class="{ 'is-active': route.name === item.name }"
        >
          <el-icon :size="17"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
          <small>{{ item.code }}</small>
        </RouterLink>
      </nav>

      <div class="admin-sidebar-footer">
        <div class="admin-user">
          <span class="admin-avatar">{{ initial }}</span>
          <div>
            <strong>{{ auth.user?.nickname || '馆长' }}</strong>
            <small>{{ auth.user?.username || '—' }}</small>
          </div>
        </div>
        <button type="button" class="admin-logout" @click="handleLogout">
          <el-icon :size="15"><SwitchButton /></el-icon>
          <span>退出登录</span>
        </button>
      </div>
    </aside>

    <div v-if="sidebarOpen" class="admin-overlay" @click="sidebarOpen = false"></div>

    <div class="admin-body">
      <header class="admin-topbar">
        <button type="button" class="admin-menu" aria-label="打开侧边栏" @click="sidebarOpen = true">
          <el-icon :size="18"><Expand /></el-icon>
        </button>
        <div class="admin-topbar-title">
          <p>ADMIN CONSOLE</p>
          <h1>{{ pageTitle }}</h1>
        </div>
        <div class="admin-topbar-right">
          <MusicToggle />
          <RouterLink to="/" class="admin-return">返回主站</RouterLink>
          <span class="status-pill">在线</span>
        </div>
      </header>

      <main class="admin-content">
        <RouterView v-slot="{ Component, route: currentRoute }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="currentRoute.path" />
          </transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  ChatDotRound,
  Collection,
  DataBoard,
  Expand,
  Headset,
  Picture,
  SwitchButton
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import MusicToggle from '@/components/common/MusicToggle.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const sidebarOpen = ref(false)

const navItems = [
  { name: 'admin-dashboard', label: '控制台', code: '01', to: '/admin/dashboard', icon: DataBoard },
  { name: 'admin-photos', label: '照片管理', code: '02', to: '/admin/photos', icon: Picture },
  { name: 'admin-categories', label: '分类管理', code: '03', to: '/admin/categories', icon: Collection },
  { name: 'admin-messages', label: '留言管理', code: '04', to: '/admin/messages', icon: ChatDotRound },
  { name: 'admin-music', label: '音乐管理', code: '05', to: '/admin/music', icon: Headset }
]

const pageTitle = computed(() => (route.meta.title as string | undefined) ?? '控制台')
const initial = computed(() => (auth.user?.nickname || '馆').slice(0, 1))

watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
  }
)

async function handleLogout() {
  auth.logout()
  await router.replace({ name: 'admin-login' })
}
</script>

<style scoped>
.admin-shell {
  position: relative;
  z-index: 1;
  min-height: 100vh;
}

.admin-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  width: 268px;
  padding: 1.75rem 1.35rem;
  border-right: 1px solid rgba(148, 163, 184, 0.14);
  background: linear-gradient(180deg, rgba(11, 21, 48, 0.96), rgba(5, 8, 22, 0.98));
  backdrop-filter: blur(20px);
  transform: translateX(-100%);
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.admin-sidebar.is-open {
  transform: translateX(0);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0 0.4rem 1.8rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.admin-brand-mark {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.45);
  background: radial-gradient(circle at 35% 30%, rgba(56, 189, 248, 0.35), transparent 68%);
  box-shadow: 0 0 20px rgba(56, 189, 248, 0.2);
}

.admin-brand strong {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  color: var(--mu-star);
}

.admin-brand small {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.62rem;
  letter-spacing: 0.3em;
  color: var(--mu-muted);
}

.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 1.5rem;
}

.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.8rem 0.9rem;
  border-radius: 12px;
  border: 1px solid transparent;
  color: rgba(203, 213, 225, 0.72);
  font-size: 0.86rem;
  transition: all 0.3s ease;
}

.admin-nav-item small {
  margin-left: auto;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  color: rgba(148, 163, 184, 0.45);
}

.admin-nav-item:hover {
  background: rgba(56, 189, 248, 0.06);
  color: var(--mu-star);
}

.admin-nav-item.is-active {
  border-color: rgba(56, 189, 248, 0.3);
  background: linear-gradient(100deg, rgba(56, 189, 248, 0.16), rgba(168, 85, 247, 0.1));
  color: #e0f2fe;
  box-shadow: inset 0 0 24px rgba(56, 189, 248, 0.08);
}

.admin-sidebar-footer {
  margin-top: auto;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
}

.admin-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.4rem 1rem;
}

.admin-avatar {
  display: grid;
  place-items: center;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 50%;
  border: 1px solid rgba(168, 85, 247, 0.4);
  background: rgba(168, 85, 247, 0.12);
  font-size: 0.85rem;
  color: #e9d5ff;
}

.admin-user strong {
  display: block;
  font-size: 0.82rem;
  color: var(--mu-star);
}

.admin-user small {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.68rem;
  color: var(--mu-muted);
}

.admin-logout {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: transparent;
  color: var(--mu-muted);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.admin-logout:hover {
  border-color: rgba(248, 113, 113, 0.4);
  color: #fca5a5;
}

.admin-overlay {
  position: fixed;
  inset: 0;
  z-index: 55;
  background: rgba(2, 6, 23, 0.7);
  backdrop-filter: blur(4px);
}

.admin-body {
  min-height: 100vh;
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.5rem;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(5, 8, 22, 0.72);
  backdrop-filter: blur(18px);
}

.admin-menu {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: transparent;
  color: var(--mu-star);
  cursor: pointer;
}

.admin-topbar-title p {
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.58rem;
  letter-spacing: 0.26em;
  color: var(--mu-muted);
}

.admin-topbar-title h1 {
  margin: 0.18rem 0 0;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--mu-star);
}

.admin-topbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.admin-return {
  font-size: 0.74rem;
  color: var(--mu-muted);
  transition: color 0.3s ease;
}

.admin-return:hover {
  color: #7dd3fc;
}

.admin-content {
  padding: 1.75rem 1.5rem 3rem;
}

@media (min-width: 1100px) {
  .admin-sidebar {
    transform: translateX(0);
  }

  .admin-body {
    margin-left: 268px;
  }

  .admin-menu {
    display: none;
  }

  .admin-topbar {
    padding: 1.2rem 2.25rem;
  }

  .admin-content {
    padding: 2.25rem 2.25rem 4rem;
  }

  .admin-overlay {
    display: none;
  }
}
</style>
