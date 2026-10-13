import { AdminNav } from "@/components/admin-nav";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/user";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [pendingInvites, feedErrors, aiPending] = await Promise.all([
    db.user.count({ where: { clerkId: { startsWith: "pending:" } } }),
    db.feedSource.count({ where: { active: true, lastError: { not: null } } }),
    db.source.count({ where: { tierBy: "ai" } }),
  ]);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <AdminNav
        badges={{
          usuarios: { n: pendingInvites, tone: "info" },
          feeds: { n: feedErrors, tone: "warn" },
          veiculos: { n: aiPending, tone: "info" },
        }}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
