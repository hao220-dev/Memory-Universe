import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/PublicLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: '首页', immersive: true }
      },
      {
        path: 'universe',
        name: 'universe',
        component: () => import('@/views/UniverseView.vue'),
        meta: { title: '照片宇宙', immersive: true }
      },
      {
        path: 'timeline',
        name: 'timeline',
        component: () => import('@/views/TimelineView.vue'),
        meta: { title: '时光轴' }
      },
      {
        path: 'message',
        name: 'message',
        component: () => import('@/views/MessageView.vue'),
        meta: { title: '留言星球' }
      },
      {
        path: 'time-wall',
        name: 'time-wall',
        component: () => import('@/views/TimeWallView.vue'),
        meta: { title: '时光墙', immersive: true }
      }
    ]
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/admin/AdminLogin.vue'),
    meta: { title: '馆长登录' }
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: { name: 'admin-dashboard' }
      },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/Dashboard.vue'),
        meta: { title: '控制台', requiresAuth: true }
      },
      {
        path: 'photos',
        name: 'admin-photos',
        component: () => import('@/views/admin/PhotoManage.vue'),
        meta: { title: '照片管理', requiresAuth: true }
      },
      {
        path: 'categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/CategoryManage.vue'),
        meta: { title: '分类管理', requiresAuth: true }
      },
      {
        path: 'messages',
        name: 'admin-messages',
        component: () => import('@/views/admin/MessageManage.vue'),
        meta: { title: '留言管理', requiresAuth: true }
      },
      {
        path: 'music',
        name: 'admin-music',
        component: () => import('@/views/admin/MusicManage.vue'),
        meta: { title: '音乐管理', requiresAuth: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' }
    }
    return { top: 0 }
  }
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth)

  if (requiresAuth) {
    if (!auth.token) {
      return { name: 'admin-login', query: { redirect: to.fullPath } }
    }
    if (!auth.user) {
      try {
        const user = await auth.loadMe()
        if (!user || user.role !== 'ADMIN') {
          auth.logout()
          return { name: 'admin-login', query: { redirect: to.fullPath } }
        }
      } catch {
        auth.logout()
        return { name: 'admin-login', query: { redirect: to.fullPath } }
      }
    }
  }

  if (to.name === 'admin-login' && auth.token && auth.user?.role === 'ADMIN') {
    return { name: 'admin-dashboard' }
  }

  return true
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · Memory Universe` : 'Memory Universe · 时光收藏馆'
})

export default router
