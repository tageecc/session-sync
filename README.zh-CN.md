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
| `user_hash` | 在数据库中查找数据 | SHA-256(key) |
| `write_token` | 验证写入权限 | SHA-256(`session-sync:write:` + key) |
| AES 密钥 | 加解密数据 | PBKDF2(key, random_salt) → AES-256-GCM |

## 快速开始

1. 在 [Supabase](https://supabase.com) 创建项目，从 Settings → API 获取 **URL** 和 **anon key**

2. 复制环境变量并填入你的配置

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. 在 Supabase SQL Editor 中执行[建表 SQL](#supabase-建表-sql)

4. 构建扩展

```bash
npm install
npm run build
```

5. 打开 `chrome://extensions/` → 开启开发者模式 → 加载已解压的扩展程序 → 选择 `dist` 目录

## Supabase 建表 SQL

```sql
CREATE TABLE sync_data (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_hash         TEXT NOT NULL,
  origin            TEXT NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv                TEXT NOT NULL,
  salt              TEXT NOT NULL,
  write_token       TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_hash, origin)
);

-- RLS：禁止所有直接访问，数据只能通过 RPC 函数访问
ALTER TABLE sync_data ENABLE ROW LEVEL SECURITY;

-- 读取：仅返回匹配调用者 user_hash 的行
CREATE OR REPLACE FUNCTION read_sync_data(
  p_user_hash TEXT,
  p_origin TEXT
) RETURNS TABLE (encrypted_payload TEXT, iv TEXT, salt TEXT)
  LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT encrypted_payload, iv, salt
  FROM sync_data
  WHERE user_hash = p_user_hash AND origin = p_origin
  ORDER BY updated_at DESC
  LIMIT 1;
$$;

-- 写入：通过 write_token 验证 + 输入大小限制
CREATE OR REPLACE FUNCTION upsert_sync_data(
  p_user_hash TEXT, p_origin TEXT,
  p_encrypted_payload TEXT, p_iv TEXT, p_salt TEXT,
  p_write_token TEXT
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 输入大小保护（防止滥用）
  IF length(p_encrypted_payload) > 5242880 THEN  -- 5 MB
    RAISE EXCEPTION 'payload too large';
  END IF;
  IF length(p_origin) > 2048 THEN
    RAISE EXCEPTION 'origin too long';
  END IF;

  IF EXISTS (SELECT 1 FROM sync_data WHERE user_hash = p_user_hash AND origin = p_origin) THEN
    IF NOT EXISTS (
      SELECT 1 FROM sync_data
      WHERE user_hash = p_user_hash AND origin = p_origin AND write_token = p_write_token
    ) THEN
      RAISE EXCEPTION 'write_token mismatch';
    END IF;
    UPDATE sync_data SET
      encrypted_payload = p_encrypted_payload, iv = p_iv, salt = p_salt, updated_at = now()
    WHERE user_hash = p_user_hash AND origin = p_origin;
  ELSE
    INSERT INTO sync_data (user_hash, origin, encrypted_payload, iv, salt, write_token)
    VALUES (p_user_hash, p_origin, p_encrypted_payload, p_iv, p_salt, p_write_token);
  END IF;
END;
$$;
```

## 项目结构

```
src/
├── shared/
│   ├── crypto.ts           # 密钥生成 + E2EE (AES-256-GCM)
│   ├── config.ts           # 配置读写 (chrome.storage)
│   ├── supabaseClient.ts   # Supabase 客户端
│   ├── messaging.ts        # 扩展内消息通信
│   ├── i18n.ts             # 国际化
│   └── toast.ts            # Toast 通知组件
├── background/index.ts     # 推送 / 拉取（通过 Supabase RPC）
├── content/index.ts        # 读写页面 storage
├── popup/                  # 弹窗 UI
├── options/                # 设置页
└── manifest.json
```

## 技术栈

Manifest V3 · TypeScript · Vite · CRXJS · Tailwind CSS · Supabase · Web Crypto API

## License

[MIT](LICENSE)
