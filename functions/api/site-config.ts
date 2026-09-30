// Returns site configuration, including whether it's in production (paused) mode.

interface Env {
  SITE_MODE: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  return new Response(
    JSON.stringify({
      siteMode: env.SITE_MODE || "live",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
