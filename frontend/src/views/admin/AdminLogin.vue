<template>
  <section class="login-page">
    <div class="login-canvas">
      <UniverseCanvas :interactive="false" />
    </div>
    <div class="login-vignette" aria-hidden="true"></div>

    <RouterLink to="/" class="login-brand">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>
        <strong>MEMORY UNIVERSE</strong>
        <small>时光收藏馆</small>
      </span>
    </RouterLink>

    <MusicToggle class="login-music" />

    <div class="login-grid">
      <div class="login-visual">
        <p class="eyebrow">Curator Access</p>
        <h1 class="display-title login-title">
          欢迎回来，<br />
          <span class="text-gradient">馆长</span>
        </h1>
        <p class="login-desc">
          登录后可以批量上传毕业照片、维护记忆星系分类，并审核来自留言星球的信号。
        </p>

        <div class="login-orbit" aria-hidden="true">
          <span class="orbit-core"></span>
          <span class="orbit-ring orbit-ring--one"></span>
          <span class="orbit-ring orbit-ring--two"></span>
          <span class="orbit-ring orbit-ring--three"></span>
        </div>
      </div>

      <div class="login-card glass-panel">
        <div class="login-card-head">
          <p class="eyebrow">Secure Channel</p>
          <h2>{{ needSetup ? '设置管理员密码' : '馆长登录' }}</h2>
        </div>

        <p v-if="!statusLoaded" class="login-checking">正在准备安全通道…</p>

        <form v-else class="login-form" @submit.prevent="submit">
          <label class="field">
            <span>账号</span>
            <el-input
              v-model="form.username"
              size="large"
              placeholder="请输入管理员账号"
              autocomplete="username"
              :prefix-icon="User"
              :disabled="needSetup"
            />
          </label>

          <label class="field">
            <span>密码</span>
            <el-input
              v-model="form.password"
              size="large"
              type="password"
              show-password
              :placeholder="needSetup ? '至少 8 位，仅保存在本机' : '请输入密码'"
              :autocomplete="needSetup ? 'new-password' : 'current-password'"
              :prefix-icon="Lock"
            />
          </label>

          <label v-if="needSetup" class="field">
            <span>确认密码</span>
            <el-input
              v-model="confirmPassword"
              size="large"
              type="password"
              show-password
              placeholder="请再次输入密码"
              autocomplete="new-password"
              :prefix-icon="Lock"
            />
          </label>

          <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>

          <button type="submit" class="mu-btn mu-btn--primary login-submit" :disabled="loading">
            {{ submitLabel }}
          </button>
        </form>

        <p class="login-hint">
          <template v-if="needSetup">
            首次使用，请设置馆长密码。密码经 BCrypt 哈希后仅保存在本机数据库，不会上传。
          </template>
          <template v-else>
            账号密码在首次使用时设置，经 BCrypt 哈希后仅保存在本机，不会上传。
          </template>
        </p>

        <RouterLink to="/" class="login-back">← 返回主站</RouterLink>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Lock, User } from '@element-plus/icons-vue'
import UniverseCanvas from '@/components/universe/UniverseCanvas.vue'
import MusicToggle from '@/components/common/MusicToggle.vue'
import { fetchSetupStatus, setupAdmin } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({
  username: '',
  password: ''
})
const confirmPassword = ref('')
const needSetup = ref(false)
const statusLoaded = ref(false)
const loading = ref(false)
const errorMessage = ref('')

const submitLabel = computed(() => {
  if (loading.value) {
    return needSetup.value ? '正在创建管理员…' : '正在验证身份…'
  }
  return needSetup.value ? '设置并进入控制台' : '进入控制台'
})

function redirectTarget(): string {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  return redirect.startsWith('/admin') ? redirect : '/admin/dashboard'
}

onMounted(async () => {
  try {
    const status = await fetchSetupStatus()
    needSetup.value = !status.initialized && status.setupAllowed
    if (needSetup.value) {
      form.username = 'admin'
    }
  } catch {
    needSetup.value = false
  } finally {
    statusLoaded.value = true
  }
})

async function submit() {
  errorMessage.value = ''

  if (needSetup.value) {
    if (form.password.length < 8) {
      errorMessage.value = '密码至少需要 8 位'
      return
    }
    if (form.password !== confirmPassword.value) {
      errorMessage.value = '两次输入的密码不一致'
      return
    }

    loading.value = true
    try {
      const result = await setupAdmin(form.password)
      auth.applySession(result)
      await router.replace(redirectTarget())
    } catch (cause) {
      errorMessage.value = (cause as Error).message
    } finally {
      loading.value = false
    }
    return
  }

  if (!form.username.trim() || !form.password) {
    errorMessage.value = '请输入账号与密码'
    return
  }

  loading.value = true
  try {
    await auth.login(form.username.trim(), form.password)
    await router.replace(redirectTarget())
  } catch (cause) {
    errorMessage.value = (cause as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  background: #050816;
}

.login-canvas {
  position: absolute;
  inset: 0;
  opacity: 0.86;
}

.login-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 60% 55% at 22% 38%, rgba(5, 8, 22, 0.82), transparent 72%),
    linear-gradient(180deg, rgba(5, 8, 22, 0.5), rgba(5, 8, 22, 0.86));
}

.login-brand {
  position: absolute;
  top: 1.5rem;
  left: 1.5rem;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.login-music {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 3;
}

.brand-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 50%;
  border: 1px solid rgba(56, 189, 248, 0.42);
  background: radial-gradient(circle at 35% 30%, rgba(56, 189, 248, 0.28), transparent 65%);
}

.brand-mark::before {
  content: '';
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: linear-gradient(135deg, #7dd3fc, #a855f7);
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.9);
}

.login-brand strong {
  display: block;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  color: var(--mu-star);
}

.login-brand small {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.58rem;
  letter-spacing: 0.32em;
  color: var(--mu-muted);
}

.login-grid {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr;
  gap: 2.5rem;
  align-items: center;
  width: 100%;
  max-width: 1180px;
  min-height: 100svh;
  margin: 0 auto;
  padding: 6.5rem 1.4rem 2.5rem;
}

.login-visual {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.login-title {
  margin: 1rem 0 0;
  font-size: clamp(2.2rem, 5.4vw, 3.8rem);
  color: var(--mu-star);
}

.login-desc {
  max-width: 26rem;
  margin: 1.1rem 0 0;
  font-size: 0.86rem;
  line-height: 1.95;
  color: var(--mu-muted);
}

.login-orbit {
  position: relative;
  display: none;
  place-items: center;
  width: 220px;
  height: 220px;
  margin-top: 2rem;
}

.orbit-core {
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 50%;
  background: radial-gradient(circle at 36% 30%, #e0f2fe, #38bdf8 40%, #7c3aed 80%);
  box-shadow:
    0 0 34px rgba(56, 189, 248, 0.6),
    0 0 80px rgba(168, 85, 247, 0.32);
}

.orbit-ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.orbit-ring--one {
  width: 7rem;
  height: 7rem;
  border-color: rgba(56, 189, 248, 0.32);
  animation: orbit-spin 16s linear infinite;
}

.orbit-ring--one::after {
  content: '';
  position: absolute;
  top: -3px;
  left: 50%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #7dd3fc;
  box-shadow: 0 0 12px #38bdf8;
}

.orbit-ring--two {
  width: 10.5rem;
  height: 10.5rem;
  border-style: dashed;
  border-color: rgba(168, 85, 247, 0.26);
  animation: orbit-spin 30s linear infinite reverse;
}

.orbit-ring--three {
  width: 13.5rem;
  height: 13.5rem;
  border-color: rgba(148, 163, 184, 0.08);
}

@keyframes orbit-spin {
  to {
    transform: rotate(360deg);
  }
}

.login-card {
  padding: 2rem 1.5rem;
}

.login-card-head h2 {
  margin: 0.85rem 0 0;
  font-family: 'Space Grotesk', 'PingFang SC', sans-serif;
  font-size: 1.6rem;
  font-weight: 600;
  color: var(--mu-star);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  margin-top: 1.9rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field > span {
  font-size: 0.66rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--mu-muted);
}

.login-error {
  margin: 0;
  padding: 0.62rem 0.9rem;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(127, 29, 29, 0.18);
  font-size: 0.76rem;
  color: #fca5a5;
}

.login-checking {
  margin: 1.6rem 0;
  font-size: 0.76rem;
  letter-spacing: 0.12em;
  color: rgba(148, 163, 184, 0.7);
}

.login-submit {
  width: 100%;
  margin-top: 0.35rem;
}

.login-hint {
  margin: 1.4rem 0 0;
  font-size: 0.7rem;
  line-height: 1.8;
  color: rgba(148, 163, 184, 0.7);
}

.login-hint code {
  padding: 0.08rem 0.3rem;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.08);
  color: #7dd3fc;
}

.login-back {
  display: inline-block;
  margin-top: 1.1rem;
  font-size: 0.72rem;
  color: var(--mu-muted);
  transition: color 0.3s ease;
}

.login-back:hover {
  color: #7dd3fc;
}

@media (min-width: 900px) {
  .login-grid {
    grid-template-columns: 1.05fr 0.95fr;
    gap: 4rem;
    padding: 6.5rem 3rem 3rem;
  }

  .login-orbit {
    display: grid;
  }

  .login-card {
    padding: 2.6rem 2.2rem;
  }
}
</style>
