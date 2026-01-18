import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/doctors(.*)",
  "/onboarding(.*)",
  "/doctor(.*)",
  "/admin(.*)",
  "/video-call(.*)",
  "/appointments(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  try {
    const { userId } = await auth();

    if (!userId && isProtectedRoute(req)) {
      const { redirectToSignIn } = await auth();
      return redirectToSignIn();
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    return NextResponse.json(
      { error: "Authentication middleware failed" },
      { status: 500 }
    );
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
