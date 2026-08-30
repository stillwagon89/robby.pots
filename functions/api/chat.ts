import { SYSTEM_PROMPT, TOOLS } from "../lib/tools";
import { dispatchTool, Env } from "../lib/backend";

const ANTHROPIC_MODEL = "claude-sonnet-4-5-20250929";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const RATE_LIMIT_MAX = 15; // messages per window
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const MAX_TOOL_TURNS = 6;
const MAX_TOKENS = 1200;

interface ChatRequestBody {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  turnstileToken: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.message || typeof body.message !== "string" || body.message.length > 2000) {
    return jsonResponse({ error: "message is required and must be under 2000 characters" }, 400);
  }
  if (!body.turnstileToken) {
    return jsonResponse({ error: "Missing bot-verification token" }, 400);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  // 1. Verify Turnstile before doing anything that costs money.
  const turnstileOk = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!turnstileOk) {
    return jsonResponse({ error: "Bot verification failed. Please refresh and try again." }, 403);
  }

  // 2. Rate limit per IP.
  const rateLimitResult = await checkRateLimit(env, ip);
  if (!rateLimitResult.allowed) {
    return jsonResponse(
      { error: `Rate limit reached (${RATE_LIMIT_MAX} messages/hour). Please try again later.` },
      429
    );
  }

  // 3. Run the tool-use loop against Claude.
  const messages: any[] = [...(body.history || []), { role: "user", content: body.message }];
  const toolCallsLog: any[] = [];

  try {
    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      const response = await callClaude(env, messages);

      if (response.stop_reason !== "tool_use") {
        const text = response.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("");
        return jsonResponse({ reply: text, tool_calls: toolCallsLog });
      }

      messages.push({ role: "assistant", content: response.content });
      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          toolCallsLog.push({ tool: block.name, input: block.input });
          const result = await dispatchTool(env, block.name as string, block.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }

    return jsonResponse({ reply: "(reached tool-use turn limit — please try rephrasing your question)", tool_calls: toolCallsLog });
  } catch (e: any) {
    return jsonResponse({ error: `Server error: ${String(e?.message || e)}` }, 500);
  }
};

interface ClaudeResponse {
  stop_reason: string;
  content: Array<{ type: string; text?: string; name?: string; input?: any; id?: string }>;
}

async function callClaude(env: Env, messages: any[]): Promise<ClaudeResponse> {
  const resp = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${text.slice(0, 300)}`);
  }
  return (await resp.json()) as ClaudeResponse;
}

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  form.append("remoteip", ip);
  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const outcome: any = await resp.json();
  return outcome.success === true;
}

async function checkRateLimit(env: Env, ip: string): Promise<{ allowed: boolean; count: number }> {
  const key = `ratelimit:${ip}`;
  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= RATE_LIMIT_MAX) {
    return { allowed: false, count };
  }
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS });
  return { allowed: true, count: count + 1 };
}

function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
