import type { APIRoute } from "astro";
import { createCap } from "@lib/CapAdapter";
export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const cap = createCap(context.session ?? null);
    return new Response(JSON.stringify(await cap.createChallenge()), {
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 400 },
    );
  }
};
