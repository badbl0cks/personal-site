import type { APIRoute } from "astro";
export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    return new Response(
      JSON.stringify({
        status: "pass",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
      },
    );
  } catch {
    return new Response(
      JSON.stringify({
        status: "fail",
        timestamp: new Date().toISOString(),
      }),
      { status: 500 },
    );
  }
};
