import { Suspense } from "react";
import { Chat } from "@/components/agent/chat";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Pergunte" };

export default async function ConversarPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Assistente" title="Pergunte" />
      <Suspense fallback={null}>
        <Chat hints={{ city: user.municipality ?? "sua cidade", party: user.party && user.party !== "NONE" ? user.party : null, hasQuiz: Boolean(user.quizAnswers) }} />
      </Suspense>
    </div>
  );
}
