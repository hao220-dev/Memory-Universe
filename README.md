# Memory Universe

**Your Personal Memory Universe**

> 每一刻，都值得被收藏。
>
> CAPTURE EVERY MOMENT

Memory Universe 是一款以个人生活记忆收藏为主题的桌面应用，支持照片管理、音乐收藏、时间轴回顾和个人记忆记录。通过深空宇宙视觉风格，打造属于自己的数字记忆空间。照片会放进一片可以自由探索的 3D 星空，用时间轴与照片墙重新遇见那些不想遗忘的瞬间。

安装包、窗口标题与桌面快捷方式统一使用 **Memory Universe**（Memory Universe · 时光收藏馆）。

全部数据保存在本机，不上传云端，不需要注册账号。

## 项目截图

> 截图占位：发布前把首页、照片宇宙、时光轴、时光墙、馆长控制台的实机截图放到 `docs/screenshots/`，再取消下方注释。

<!--
| 首页 | 照片宇宙 |
| --- | --- |
| ![](docs/screenshots/home.png) | ![](docs/screenshots/universe.png) |

| 时光轴 | 时光墙 | 馆长控制台 |
| --- | --- | --- |
| ![](docs/screenshots/timeline.png) | ![](docs/screenshots/time-wall.png) | ![](docs/screenshots/admin.png) |
-->

## 核心功能

### 浏览端

- **深空首页**：Three.js 实时星空、星云与传送门，GSAP 编排标题入场与进入过场。
- **照片宇宙**：照片以星球形态环绕分布，支持拖拽旋转、滚轮 / 双指缩放、点击拾取、分类筛选、随机回忆与照片详情面板。
- **时光轴**：按年月聚合照片，分页加载，灯箱查看原图。
- **时光墙**：全屏照片墙轮播。
- **背景音乐**：全局播放控制，播放后台上传的曲目；没有可用曲目时使用内置合成环境音。
- **响应式布局**：桌面与移动端均可操作 3D 场景。

### 管理端

- **馆长登录**：JWT 鉴权，路由守卫，401 自动退出。
- **控制台**：真实照片总数、分类数、分类分布与最新上传。
- **照片管理**：批量上传（服务端自动生成缩略图）、编辑、可见性开关、删除。
- **分类管理**：增删改查与排序。
- **音乐管理**：上传、试听、排序、启用 / 停用、删除。

### 桌面端

- **内置 Java 运行时**：打包 Temurin 17 精简 JRE，用户无需安装 Java。
- **内置后端**：Electron 自动启动 Spring Boot，动态分配端口，健康检查通过后加载界面。
- **稳定退出**：优雅关闭后端、关闭令牌校验、Java 进程身份验证、孤儿进程清理、有限次自动恢复。
- **本地数据**：H2 文件数据库，照片与音乐保存在本地，不依赖 MySQL / MinIO。
- **可观测性**：日志轮转、启动失败页、临时运行目录清理。

### 尚未实现

以下模块在界面中明确标注为「建设中」，不会展示虚构数据：

- 留言星球（前端占位页，后端接口未实现）
- 自动更新与代码签名
- 相册分享、海报导出

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3 + TypeScript + Vite + Vue Router + Pinia + Axios + Tailwind CSS |
| 3D / 动画 | Three.js + GSAP |
| UI 组件 | Element Plus |
| 桌面端 | Electron + electron-builder + NSIS |
| 后端 | Java 17 + Spring Boot 3.3 + Maven + Spring Security + JWT + MyBatis-Plus |
| 数据库 | H2 文件数据库（桌面运行）；MySQL 8 保留用于服务端部署 |
| 文件存储 | 本地文件存储（桌面运行）；MinIO 保留用于服务端部署 |
| 测试 | JUnit 5 + Spring Boot Test + MockMvc + H2 |

## 项目目录

```text
photo/
├─ frontend/                 Vue 3 前端
│  ├─ public/fonts/          本地字体（WOFF2）
│  ├─ src/api/               Axios 实例与按领域拆分的接口封装
│  ├─ src/components/        通用 / 宇宙 / 时光墙组件
│  ├─ src/engine/            Three.js 引擎（纯 TS，不依赖 Vue）
│  ├─ src/layouts/           公共端 / 管理端布局
│  ├─ src/router/            路由与守卫
│  ├─ src/stores/            Pinia
│  ├─ src/styles/            设计令牌与全局样式
│  └─ src/views/             页面（public / admin）
├─ backend/                  Spring Boot 后端
│  ├─ src/main/java/com/memoryuniverse/
│  │  ├─ common/             统一响应与异常
│  │  ├─ config/             安全、持久化、存储、CORS
│  │  ├─ security/           JWT 与用户主体
│  │  └─ module/<domain>/    entity / mapper / service / controller / dto
│  └─ src/main/resources/
│     ├─ application*.yml    dev / desktop / prod 配置
│     └─ db/schema.sql       建表脚本
├─ desktop/                  Electron 桌面壳
│  ├─ src/                   主进程、预加载、后端管理、静态服务、日志
│  ├─ resources/icon.ico     应用与安装器图标
│  ├─ resources/runtime/     内置 JRE（构建时生成，不提交）
│  └─ resources/backend/     后端 JAR（构建时生成，不提交）
├─ docs/IMPLEMENTATION_PLAN.md
├─ docker-compose.yml        MySQL 8 + MinIO（仅服务端开发需要）
├─ AGENTS.md                 仓库开发规范
└─ README.md
```

## 运行环境

### 普通用户

只需要 Windows 安装程序：

- Windows 10 / 11 x64。
- 安装包已内置 Temurin 17 精简 JRE、Spring Boot 后端与全部前端资源。
- **不需要安装 JDK、Maven、Node.js、MySQL 或 MinIO**，也不需要运行 Vite 开发服务器。
- 从 [GitHub Releases](#github-releases-下载) 下载 `Memory-Universe-Setup-1.0.0.exe` 安装即可使用。

目前仅提供 Windows x64 安装程序，未提供 macOS / Linux 版本。

### 开发者

以下环境仅用于从源码构建或二次开发，普通用户无需准备。

| 用途 | 要求 |
| --- | --- | --- |
| 前端开发 | Node.js 20+ 与 npm |
| 后端开发 | JDK 17（Temurin 17），Maven 3.9+ |
| 桌面端开发 | 同上，另需 Windows 10 / 11 x64 |
| 构建安装包 | Windows x64、JDK 17（含 `jlink`）、Maven 3.9+、Node.js 20+ |
| 可选 | Docker（仅在使用 MySQL / MinIO 的完整开发模式时需要） |

## 本地开发

### 方式一：轻量模式（推荐，无需 MySQL / MinIO）

```bash
cd backend
mvn spring-boot:run -Dspring-boot.run.profiles=desktop
```

- 后端端口 `8080`，数据写入 `backend/data/`（H2 + 本地文件存储）。
- 健康检查：<http://localhost:8080/api/health>

```bash
cd frontend
npm install
npm run dev
```

- 访问 <http://localhost:5173>，`/api` 与 `/media` 已代理到 `8080`。

### 方式二：完整模式（MySQL 8 + MinIO）

```bash
docker compose up -d

cd backend
mvn spring-boot:run
```

- MySQL：`localhost:3306`，库 `memory_universe`，账号 `root / memory123456`
- MinIO：API `localhost:9000`，控制台 `localhost:9001`，账号 `minioadmin / minioadmin`
- 首次创建数据卷时会执行 `backend/src/main/resources/db/schema.sql`

> 以上账号密码仅用于本地开发，已在 `application-dev.yml` 与 `docker-compose.yml` 中公开。
> 生产环境请通过环境变量覆盖，参见 `application-prod.yml`。

### 首次设置管理员密码

项目不再内置可直接使用的默认管理员口令。数据库中没有管理员时：

- 桌面端与开发环境会在馆长登录页显示「设置管理员密码」，由使用者自行设置（至少 8 位）。
- 密码经 BCrypt 哈希后保存在本机数据库，不会上传到任何服务器。
- 已存在管理员时登录页保持普通登录，不会要求重新设置，也不会重置原密码。
- 需要非交互初始化（如自动化部署）时，可通过环境变量 `MU_ADMIN_PASSWORD` 指定初始密码。

生产服务端默认关闭界面初始化能力，必须在启动前通过 `ADMIN_PASSWORD` 注入初始密码。

### 桌面端开发

先启动前端开发服务器（5173），再启动 Electron：

```bash
cd desktop
npm install
npm run dev
```

### 常用命令

```bash
# 后端测试（H2 + 本地存储，不依赖 MySQL / MinIO）
cd backend
mvn test

# 前端类型检查 + 生产构建
cd frontend
npm run build
```

## 构建 Windows 安装包

仓库不包含 JRE、后端 JAR 与安装包，需要按以下顺序在本地生成。

### 1. 构建前端

```bash
cd frontend
npm ci
npm run build
```

产物位于 `frontend/dist/`，会被 Electron 打包进 `resources/frontend`。

### 2. 构建后端 JAR

```bash
cd backend
mvn -DskipTests clean package
```

产物为 `backend/target/memory-universe-server-0.1.0.jar`，复制并重命名为打包要求的文件名：

```powershell
New-Item -ItemType Directory -Force ..\desktop\resources\backend
Copy-Item target\memory-universe-server-0.1.0.jar ..\desktop\resources\backend\memory-universe-backend.jar -Force
```

### 3. 准备内置 JRE（Temurin 17.0.21+9）

下载并解压 [Eclipse Temurin 17 (JDK, Windows x64)](https://adoptium.net/temurin/releases/?version=17)，使用其中的 `jlink` 生成精简运行时：

```powershell
jlink `
  --add-modules java.base,java.datatransfer,java.desktop,java.instrument,java.logging,java.management,java.naming,java.net.http,java.prefs,java.security.jgss,java.security.sasl,java.sql,java.transaction.xa,java.xml,jdk.charsets,jdk.crypto.ec,jdk.localedata,jdk.management,jdk.unsupported,jdk.zipfs `
  --strip-debug --no-man-pages --no-header-files --compress=2 `
  --output desktop\resources\runtime
```

其中 `jdk.localedata` 提供区域与语言环境数据（日期、月份、时区等本地化格式），缺少它会导致中文等非英语区域的格式化结果与正式发布版不一致。

验证（`javaw.exe` 是 GUI 程序、没有控制台输出，因此用 `java.exe` 校验版本）：

```powershell
desktop\resources\runtime\bin\java.exe -version
```

应输出 `17.0.21`。模块列表需覆盖 Spring Boot、H2、MyBatis-Plus、Thumbnailator、JJWT 与 TLS 的依赖；如果新增后端依赖导致 `ClassNotFoundException`，在此列表补充对应模块后重新生成。

### 4. 生成 NSIS 安装包

```bash
cd desktop
npm ci
npm run dist
```

`npm run dist` 会先执行 `tsc` 编译主进程，再调用 electron-builder 生成安装包。输出：

```text
desktop/release/Memory-Universe-Setup-<version>.exe
```

- 版本号来自 `desktop/package.json` 的 `version`（当前 `1.0.0`）。
- 安装包为 Windows x64，辅助安装模式，可自选安装目录，创建开始菜单与桌面快捷方式。
- `extraResources` 会把 `resources/runtime`、`resources/backend` 与 `../frontend/dist` 放到安装目录的 `resources/` 下，因此在 asar 外，无需 `asarUnpack`。
- 首次构建需要联网下载 Electron 与 NSIS 工具；网络受限时可设置
  `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`。

### 5. 检查安装包内容

安装后安装目录应包含：

```text
Memory Universe.exe
resources/
  app.asar
  backend/memory-universe-backend.jar
  frontend/index.html
  runtime/bin/javaw.exe
  runtime/lib/modules
```

安装目录内不应出现数据库、照片、音乐或 `secrets.json`。

## GitHub Releases 下载

仓库只提供源代码，不提交安装包。可运行的 Windows x64 安装程序通过 Releases 发布：

```text
Memory-Universe-Setup-1.0.0.exe
SHA-256: 8A29082EBEB79CBBA6AF362A8A6AB751AC03548846A4DB8BDC307C3C8542F117
```

> 当前安装包未进行代码签名，Windows SmartScreen 可能提示“未知发布者”。请核对 SHA-256 后再运行。
> 仓库尚未创建 Release，首个版本发布后此处应替换为实际下载链接。

安装与卸载说明：

- 安装程序支持自选安装目录，默认按用户级安装，无需管理员权限。
- 卸载默认**保留**用户数据，重装或升级不会清空照片、音乐与数据库。

## 数据存储与隐私

桌面版所有数据保存在本机用户目录：

```text
%APPDATA%\memory-universe-desktop\
├─ data/db/            H2 数据库文件
├─ uploads/photos/     照片原图与缩略图
├─ uploads/music/      背景音乐
├─ logs/               应用与后端日志（自动轮转）
├─ config/secrets.json 本机 JWT 密钥（管理员密码以 BCrypt 哈希存入数据库）
└─ runtime/            运行状态文件
```

- 应用启动时只监听 `127.0.0.1`，端口由系统动态分配。
- 不上传照片、音乐或日志到任何服务器，不含云同步与遥测。
- 升级、覆盖安装与卸载都不会删除上述目录；如需彻底清除，需要手动删除该目录。
- 首次启动时数据库不存在才会初始化；已存在的数据库直接复用，不会重置管理员账号或密码。
- 安装包内不包含任何用户数据。

## 版本信息

| 项目 | 值 |
| --- | --- |
| 应用版本 | 1.0.0 |
| 支持平台 | Windows 10 / 11 x64 |
| 安装包 | `Memory-Universe-Setup-1.0.0.exe` |
| 内置运行时 | Eclipse Temurin 17.0.21+9（jlink 精简） |
| 后端 | Spring Boot 3.3.5 / Java 17 |
| 代码签名 | 未签名 |

## 相关文档

- 开发规范：[AGENTS.md](./AGENTS.md)
- 实施计划：[docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md)
