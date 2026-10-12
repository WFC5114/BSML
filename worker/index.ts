// Edge entry point for the BSML website.
//
// Serves the pre-built site from static assets and adds, on every response:
// security headers, caching rules, and (on previews) no-indexing plus an
// optional password. App code lives elsewhere; this file stays small.

interface Env {
  ASSETS: Fetcher;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
  SITE_ENV: "production" | "preview";
  // Optional. When set, production redirects every other hostname here (e.g. "bsml.com").
  CANONICAL_HOST?: string;
  // Optional. Address for /.well-known/security.txt (e.g. "mailto:security@bsml.com").
  SECURITY_CONTACT?: string;
  // Optional secret. When set, previews ask for this password (any username).
  PREVIEW_PASSWORD?: string;
  // "enforce" (default) or "report-only", to relax CSP quickly without a code change.
  CSP_MODE?: string;
}

// Same-origin only: no third-party scripts, fonts or trackers. This also keeps
// the site free of services blocked in mainland China. Payment and analytics
// origins get added here deliberately when those features arrive.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
};

// Fingerprinted build files never change, so browsers and the edge keep them for a year.
const IMMUTABLE_PATH = /^\/(_astro|_next\/static|assets|_app\/immutable)\/|\.[0-9a-f]{8,}\.[a-z0-9]+$/i;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isPreview = env.SITE_ENV !== "production";

    // HTTP to HTTPS is handled by the zone's "Always Use HTTPS" setting.
    if (!isPreview && env.CANONICAL_HOST && url.hostname !== env.CANONICAL_HOST) {
      url.hostname = env.CANONICAL_HOST;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/__health") {
      return finalize(health(env), env, url, isPreview);
    }

    if (isPreview && env.PREVIEW_PASSWORD && !(await authorized(request, env.PREVIEW_PASSWORD))) {
      return finalize(
        new Response("This BSML preview is private.", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="BSML preview", charset="UTF-8"' },
        }),
        env,
        url,
        isPreview,
      );
    }

    if (isPreview && url.pathname === "/robots.txt") {
      return finalize(text("User-agent: *\nDisallow: /\n"), env, url, isPreview);
    }

    if (url.pathname === "/.well-known/security.txt" && env.SECURITY_CONTACT) {
      return finalize(securityTxt(env.SECURITY_CONTACT, url), env, url, isPreview);
    }

    const response = await env.ASSETS.fetch(request);
    return finalize(response, env, url, isPreview);
  },
} satisfies ExportedHandler<Env>;

function finalize(response: Response, env: Env, url: URL, isPreview: boolean): Response {
  const res = new Response(response.body, response);
  const h = res.headers;

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) h.set(name, value);
  h.set(
    env.CSP_MODE === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    CSP,
  );

  if (isPreview) {
    h.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  } else {
    h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const type = h.get("Content-Type") ?? "";
  if (res.status === 200 && IMMUTABLE_PATH.test(url.pathname)) {
    h.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (type.startsWith("text/html")) {
    h.set("Cache-Control", isPreview && env.PREVIEW_PASSWORD ? "private, no-store" : "public, max-age=0, must-revalidate");
  } else if (res.status === 401 || url.pathname === "/__health") {
    h.set("Cache-Control", "no-store");
  }

  if (env.CF_VERSION_METADATA?.id) h.set("X-BSML-Version", env.CF_VERSION_METADATA.id);
  return res;
}

function health(env: Env): Response {
  return new Response(
    JSON.stringify({
      status: "ok",
      env: env.SITE_ENV,
      version: env.CF_VERSION_METADATA?.id ?? null,
      tag: env.CF_VERSION_METADATA?.tag || null,
      deployedAt: env.CF_VERSION_METADATA?.timestamp ?? null,
    }),
    { headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}

function text(body: string): Response {
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function securityTxt(contact: string, url: URL): Response {
  const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return text(
    [
      `Contact: ${contact}`,
      `Expires: ${expires}T00:00:00.000Z`,
      "Preferred-Languages: en, zh, es",
      `Canonical: ${url.origin}/.well-known/security.txt`,
    ].join("\n") + "\n",
  );
}

async function authorized(request: Request, password: string): Promise<boolean> {
  const header = request.headers.get("Authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let supplied = "";
  try {
    supplied = atob(header.slice(6)).split(":").slice(1).join(":");
  } catch {
    return false;
  }
  // Hash both sides so the comparison is constant-time regardless of length.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(supplied)),
    crypto.subtle.digest("SHA-256", enc.encode(password)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}
