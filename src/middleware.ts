import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// A proteção é feita em cada página/ação/rota (getDbUser/requireUser/requireAdmin e auth()),
// como recomenda o Clerk. Aqui o middleware só disponibiliza a sessão e mostra a página de apresentação
// (/landing) para quem ainda não entrou, mantendo a URL "/".
export default clerkMiddleware(async (auth, req) => {
  if (req.nextUrl.pathname === "/") {
    const { userId } = await auth();
    if (!userId) return NextResponse.rewrite(new URL("/landing", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
