# AGENTS.md — Memory Universe（时光收藏馆）开发规范

本文件是仓库级约束。任何后续开发（人类或 AI）都必须先阅读并遵守。

## 1. 项目定位

沉浸式 3D 星空宇宙大学毕业纪念照片墙。用户通过 3D 空间探索照片、时间轴、留言与毕业结尾。

- 用户端：禁止做成普通后台模板风格，必须有电影级深空视觉与真实 3D 场景。
- 管理端：可以走标准管理布局，但视觉需与主站同一设计语言（深空 + 玻璃拟态）。

## 2. 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3 + TypeScript + Vite + Vue Router + Pinia + Axios + Three.js + GSAP + Element Plus + Tailwind CSS |
| 后端 | Java 17 + Spring Boot 3.3 + Maven + Spring Security + JWT + MyBatis-Plus + MySQL 8 + MinIO |
| 测试 | JUnit 5 + Spring Boot Test + MockMvc + H2（测试环境） |

本机 JDK 为 21 时，Maven 仍通过 `<java.version>17</java.version>` 以 Java 17 为目标编译。

## 3. 目录结构

```
photo/
├─ frontend/                 Vue 3 应用
│  ├─ src/
│  │  ├─ api/                Axios 实例与按领域拆分的 API 封装
│  │  ├─ assets/             静态资源
│  │  ├─ components/         通用组件（common / universe / admin）
│  │  ├─ directives/         自定义指令（滚动显现等）
│  │  ├─ engine/             Three.js 引擎（纯 TS，不依赖 Vue 组件）
│  │  ├─ layouts/            公共端 / 管理端布局
│  │  ├─ router/             路由与守卫
│  │  ├─ stores/             Pinia
│  │  ├─ styles/             设计令牌与全局样式
│  │  ├─ types/              领域类型
│  │  └─ views/              页面（按 public / admin 分层）
│  └─ ...
├─ backend/                  Spring Boot 应用
│  └─ src/main/java/com/memoryuniverse/
│     ├─ common/             统一响应、异常
│     ├─ config/             安全、持久化、存储、CORS 配置
│     ├─ security/           JWT 与用户主体
│     └─ module/<domain>/    按领域拆分的 entity / mapper / service / controller / dto
├─ docs/                     实施计划等文档
├─ docker-compose.yml        MySQL + MinIO 本地依赖
└─ README.md
```

## 4. 分层与代码约束

1. **页面、业务逻辑、3D 引擎必须分离**：
   - Vue 页面不得直接操作 `THREE.*`，只能通过 `src/engine/**` 暴露的类。
   - 引擎类只接收 DOM 容器与纯数据，不引用 Vue / Pinia / Router。
2. **禁止单文件巨石**：单个 `.vue` 超过约 300 行时必须拆分组件或逻辑 composable。
3. **前后端必须真实 API 连接**：禁止用静态假数据冒充已完成的后端能力。未实现的功能必须明确标记为「建设中」，不得伪造结果。
4. **Three.js 资源释放**：引擎必须实现 `dispose()`，释放 renderer、几何体、材质、纹理、事件监听、RAF、ResizeObserver，并在组件 `onBeforeUnmount` 调用。
5. **所有 `/api/admin/**` 接口必须校验 JWT 且角色为 `ADMIN`**，前端路由守卫不能替代后端鉴权。
6. **密钥、数据库密码禁止提交到 Git**：生产环境通过环境变量注入，仓库只保留开发默认值（见 README）。
7. **所有页面兼容移动端**：断点 375 / 768 / 1024 / 1440，触屏必须可操作 3D 场景。
8. **不随意删除已完成功能**；重构前先确认引用范围。

## 5. API 约定

- 统一前缀：`/api`。
- 统一响应：

```json
{ "code": 0, "message": "ok", "data": {}, "timestamp": 1760000000000 }
```

- 失败时 `code` 为 HTTP 状态码语义（400/401/403/404/409/500），`data` 为 null。
- 分页数据：`{ "records": [], "total": 0, "page": 1, "size": 24 }`。
- 认证：`Authorization: Bearer <token>`。
- 时间：ISO-8601 字符串；日期字段 `yyyy-MM-dd`。

### 已实现接口（阶段一）

| 方法 | 路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | 公开 | 健康检查 |
| POST | `/api/auth/login` | 公开 | 管理员登录 |
| GET | `/api/auth/me` | 登录 | 当前用户 |
| GET | `/api/public/categories` | 公开 | 分类列表（含照片数） |
| GET | `/api/public/photos` | 公开 | 分页照片（categoryId / year / keyword） |
| GET | `/api/public/photos/{id}` | 公开 | 照片详情 |
| GET | `/api/public/photos/random` | 公开 | 随机回忆 |
| GET | `/api/admin/photos` | ADMIN | 后台照片分页 |
| POST | `/api/admin/photos/batch` | ADMIN | 批量上传（multipart，自动生成缩略图） |
| PUT | `/api/admin/photos/{id}` | ADMIN | 编辑照片 |
| DELETE | `/api/admin/photos/{id}` | ADMIN | 删除照片及对象 |
| GET/POST/PUT/DELETE | `/api/admin/categories/**` | ADMIN | 分类管理 |

## 6. 设计系统

颜色令牌（必须使用 CSS 变量，不要散落硬编码）：

```
--mu-void:   #050816   /* 主背景 */
--mu-deep:   #0B1530   /* 深蓝 */
--mu-neon:   #38BDF8   /* 霓虹蓝 */
--mu-nebula: #A855F7   /* 星云紫 */
--mu-star:   #F8FAFC   /* 白 */
--mu-muted:  #94A3B8   /* 辅助灰 */
```

- 字体：标题使用 `Space Grotesk` / `Orbitron` 风格，正文使用 `Inter` 系统栈；已配置网络字体加载失败回退。
- 玻璃卡片：半透明深色 + `backdrop-filter: blur()` + 1px 渐变描边 + 内阴影。
- 光效：蓝紫径向渐变、低透明度叠加，禁止大面积纯饱和色。
- 动画：GSAP 用于页面/元素编排；Three.js 场景使用自身 RAF，不用 GSAP 驱动每帧。

## 7. 环境与命令

```bash
# 基础设施
docker compose up -d

# 后端（默认 dev profile，端口 8080）
cd backend
mvn spring-boot:run

# 后端测试
cd backend
mvn test

# 前端（端口 5173，/api 与 /media 代理到 8080）
cd frontend
npm install
npm run dev

# 前端类型检查 + 生产构建
cd frontend
npm run build
```

## 8. 阶段状态

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| P1 | 工程基座、设计系统、JWT 鉴权、照片存储管线、3D 宇宙引擎基础、路由与页面骨架 | 已完成 |
| P2 | 3D 宇宙深化：LOD、后处理、随机回忆动效、移动端性能 | 待开始（基础拾取 / 随机回忆 / 详情面板已具备） |
| P3 | 后台照片 / 分类管理 UI 接入、批量上传交互 | 已完成（批量上传、编辑、可见性、删除、分类 CRUD、真实统计）；失败重试与裁剪预览待办 |
| P4 | 时光轴、留言星球（留言提交 + 审核） | 部分完成：时光轴已接入真实分页数据与灯箱；留言后端与页面待开始 |
| P5 | 音乐系统、毕业结尾动画 | 部分完成：毕业礼字幕序列与光环动画已完成；音乐系统待开始 |
| P6 | 全链路测试、性能优化、部署 | 待开始 |

详见 `docs/IMPLEMENTATION_PLAN.md`。
