/**
 * Serverless Example — Vercel Edge API Route
 *
 * A standalone edge API route that doesn't use the full Web Loom app.
 * Useful for lightweight endpoints that need maximum cold start performance.
 *
 * This file maps to: GET /api/hello
 * (Vercel's file-based routing: src/vercel/api/hello.ts → /api/hello)
 */
export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? 'World';

  return new Response(
    JSON.stringify({
      message: `Hello, ${name}!`,
      region: process.env.VERCEL_REGION ?? 'unknown',
      timestamp: Date.now(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
