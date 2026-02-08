import type { APIRoute } from "astro";
import { createCap } from "@lib/CapAdapter";
export const prerender = false;

export const POST: APIRoute = async (context) => {
  if (!context.session) {
    return new Response(
      JSON.stringify({ success: false, error: "Session unavailable." }),
      { status: 500 },
    );
  }

  const { token, solutions } = await context.request.json();
  if (!token || !solutions) {
    return new Response(JSON.stringify({ success: false }), { status: 400 });
  }

  const cap = createCap(context.session);
  return new Response(
    JSON.stringify(await cap.redeemChallenge({ token, solutions })),
    { status: 200 },
  );
};
