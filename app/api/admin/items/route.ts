import { checkAdmin, deny, json } from "@/lib/auth";
import { getItems, getStoredItems, saveItems } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);
  const [all, stored] = await Promise.all([getItems(), getStoredItems()]);
  return json({ ok: true, visible: all.length, stored: stored.length });
}

/** 清空自动抓取的条目（课程与冷启动内容不受影响） */
export async function DELETE(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return deny(auth);
  const saved = await saveItems([]);
  return json({ ok: saved, message: saved ? "已清空抓取条目" : "写入存储失败" });
}
