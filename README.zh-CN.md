# SessionSync

> 端到端加密，跨设备同步浏览器登录态。无需注册，一个密钥搞定。

[English](README.md)

## 特性

- **零注册** — 系统生成随机密钥，无需邮箱或账号
- **端到端加密** — AES-256-GCM 加密，PBKDF2（600K 迭代）派生密钥，服务端只存密文
- **写入保护** — 所有写操作通过 RPC 函数验证 `write_token`，无法篡改或删除他人数据
- **可选自建后端** — 默认使用公共云端，也可配置自己的 Supabase
- **开源透明** — 代码公开，欢迎审计

## 工作原理

一个密钥派生出三个互不相关的值：

| 派生值 | 用途 | 算法 |
|--------|------|------|
| `user_hash` | 在数据库中查找数据 | HMAC-SHA-256(key, `session-sync:user-id`) |
| `write_token` | 验证写入权限 | HMAC-SHA-256(key, `session-sync:write-token`) |
| AES 密钥 | 加解密数据 | PBKDF2(key, random_salt) → AES-256-GCM |

---

## 使用方式

### 方式 A：从 Chrome 商店安装（推荐）

> **即将上线** — [SessionSync Chrome 商店页面](#)
>
> 直接安装扩展即可使用，默认内置公共云后端，无需任何配置。

### 方式 B：自建后端（从源码构建）

如果你希望使用自己的后端服务，按以下步骤操作。

#### 1. 创建 Supabase 项目

前往 [supabase.com](https://supabase.com) 创建项目，从 Settings → API 获取 **URL** 和 **anon key**。

#### 2. 配置环境变量

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### 3. 初始化数据库

将 [`supabase/schema.sql`](supabase/schema.sql) 中的 SQL 复制到 [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) 中执行。

#### 4. 构建扩展

```bash
pnpm install
pnpm run build
```

#### 5. 加载到 Chrome

打开 `chrome://extensions/` → 开启**开发者模式** → **加载已解压的扩展程序** → 选择 `dist` 目录。

---

## 数据库结构

所有公开 SQL 集中在一个文件中：[`supabase/schema.sql`](supabase/schema.sql)

- **`sync_data`** 表 — 按用户和网站存储加密后的 session 数据
- **`read_sync_data()`** — 根据 `user_hash` + `origin` 读取加密数据
- **`upsert_sync_data()`** — 验证 `write_token` 后写入，含大小限制
- **`list_user_origins()`** — 列出用户已同步的所有站点
- **`delete_sync_data()`** — 删除指定站点的同步数据（需 `write_token`）

## 项目结构

```
├── src/
│   ├── shared/
│   │   ├── crypto.ts           # 密钥生成 + E2EE (AES-256-GCM)
│   │   ├── config.ts           # 配置读写 (chrome.storage)
│   │   ├── supabaseClient.ts   # Supabase 客户端
│   │   ├── messaging.ts        # 扩展内消息通信
│   │   ├── i18n.ts             # 国际化
│   │   └── toast.ts            # Toast 通知组件
│   ├── background/index.ts     # 推送 / 拉取（通过 Supabase RPC）
│   ├── content/index.ts        # 读写页面 storage
│   ├── popup/                  # 弹窗 UI
│   ├── options/                # 设置页
│   └── manifest.json
├── supabase/
│   └── schema.sql              # 数据库结构（公开）
└── public/
    └── _locales/               # 国际化消息 (en, zh_CN)
```

## 技术栈

Manifest V3 · TypeScript · Vite · CRXJS · Tailwind CSS · Supabase · Web Crypto API

## License

[MIT](LICENSE)
