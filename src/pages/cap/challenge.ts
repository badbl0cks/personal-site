import type { APIRoute } from "astro";
import cap from "@lib/CapAdapter";
export const prerender = false;

export const POST: APIRoute = async () => {
  try {
    return new Response(JSON.stringify(await cap.createChallenge()), {
      status: 200,
    });
  } catch {
    return new Response(JSON.stringify({ success: false }), { status: 400 });
  }
};
