import { Quiz } from "@/components/quiz/quiz";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Você" };

export default async function PerfilPage() {
  const user = await requireUser();
  const saved =
    user.quizAnswers && user.quizWeights
      ? { answers: user.quizAnswers as Record<string, string>, weights: user.quizWeights as Record<string, number> }
      : null;
  return <Quiz initialParty={user.party} saved={saved} />;
}
