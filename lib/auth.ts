import { timingSafeEqual } from "node:crypto";

export type AuthResult = { ok: true } | { ok: false; status: number; message: string };

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** 管理台鉴权：请求头 x-admin-password，与 ADMIN_PASSWORD 比对 */
export function checkAdmin(request: Request): AuthResult {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return {
      ok: false,
      status: 503,
      message: "服务端未配置 ADMIN_PASSWORD，管理台不可用。请在 Vercel 环境变量里设置后重新部署。",
    };
  }
  const got = request.headers.get("x-admin-password") || "";
  if (!got) return { ok: false, status: 401, message: "缺少管理密码" };
  if (!safeEqual(got, expected)) return { ok: false, status: 401, message: "管理密码不正确" };
  return { ok: true };
}

/** 定时任务鉴权：Vercel Cron 会带 Authorization: Bearer $CRON_SECRET */
export function checkCron(request: Request): AuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        status: 503,
        message: "生产环境必须配置 CRON_SECRET，否则定时抓取接口会被公开调用。",
      };
    }
    return { ok: true };
  }
  const auth = request.headers.get("authorization") || "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  if (auth === `Bearer ${secret}` || query === secret) return { ok: true };
  return { ok: false, status: 401, message: "定时任务密钥不正确" };
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(init.headers || {}),
    },
  });
}

export function jsonError(status: number, message: string): Response {
  return json({ ok: false, error: message }, { status });
}

/** 管理台鉴权失败时统一返回 */
export function deny(result: Extract<AuthResult, { ok: false }>): Response {
  return jsonError(result.status, result.message);
}
