import { clerkMiddleware } from "@clerk/nextjs/server";

// A proteção é feita em cada página/ação/rota (getDbUser/requireUser/requireAdmin e auth()),
// como recomenda o Clerk; o middleware só disponibiliza a sessão.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
