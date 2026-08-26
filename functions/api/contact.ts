interface Env {
  EMAIL: SendEmail;
}

interface ContactRequestBody {
  name: string;
  email: string;
  description: string;
}

const NOTIFY_TO = "robby.stillwagon@gmail.com";
const FROM_ADDRESS = "commissions@robbypots.com";
const MAX_FIELD_LENGTH = 5000;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: ContactRequestBody;
  try {
    const form = await request.formData();
    body = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      description: String(form.get("description") ?? ""),
    };
  } catch {
    return jsonResponse({ error: "Invalid form submission" }, 400);
  }

  if (!body.name || !body.email || !body.description) {
    return jsonResponse({ error: "name, email, and description are all required" }, 400);
  }
  if (
    body.name.length > MAX_FIELD_LENGTH ||
    body.email.length > MAX_FIELD_LENGTH ||
    body.description.length > MAX_FIELD_LENGTH
  ) {
    return jsonResponse({ error: "Field too long" }, 400);
  }
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(body.email)) {
    return jsonResponse({ error: "Invalid email address" }, 400);
  }

  const escapedName = escapeHtml(body.name);
  const escapedEmail = escapeHtml(body.email);
  const escapedDescription = escapeHtml(body.description).replace(/\n/g, "<br>");

  try {
    await env.EMAIL.send({
      to: NOTIFY_TO,
      from: { email: FROM_ADDRESS, name: "Robby Pots Commission Form" },
      replyTo: body.email,
      subject: `New commission inquiry from ${body.name}`,
      text: `New commission inquiry\n\nName: ${body.name}\nEmail: ${body.email}\n\n${body.description}`,
      html: `<h2>New commission inquiry</h2><p><strong>Name:</strong> ${escapedName}</p><p><strong>Email:</strong> ${escapedEmail}</p><p><strong>Message:</strong><br>${escapedDescription}</p>`,
    });
  } catch (err) {
    return jsonResponse({ error: "Failed to send email" }, 502);
  }

  return jsonResponse({ ok: true }, 200);
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
