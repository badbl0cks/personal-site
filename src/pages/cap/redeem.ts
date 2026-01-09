import type { APIRoute } from "astro";
import cap from "@lib/CapAdapter";
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { token, solutions } = await request.json();
  if (!token || !solutions) {
    return new Response(JSON.stringify({ success: false }), { status: 400 });
  }
  return new Response(
    JSON.stringify(await cap.redeemChallenge({ token, solutions })),
    { status: 200 },
  );
};
