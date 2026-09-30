// Waitlist email signup for October 2026 drops.
// Stores emails in KV and returns a thank you message.

interface Env {
  GALLERY_CACHE: KVNamespace;
  WAITLIST?: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  try {
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return jsonResponse({ error: "Invalid email address" }, 400);
    }

    // Store email in KV with a timestamp key to avoid duplicates
    // Use WAITLIST if available, otherwise fall back to GALLERY_CACHE
    // Format: "waitlist:<email>:<timestamp>"
    const key = `waitlist:${email}:${Date.now()}`;
    const kv = env.WAITLIST || env.GALLERY_CACHE;
    await kv.put(key, JSON.stringify({ email, timestamp: new Date().toISOString() }), {
      expirationTtl: 365 * 24 * 60 * 60, // 1 year
    });

    return jsonResponse({
      success: true,
      message: "Thanks for signing up! I'll notify you when new drops arrive.",
    });
  } catch (err) {
    console.error("waitlist signup failed", err);
    return jsonResponse(
      { error: "Something went wrong. Please try again." },
      500
    );
  }
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
