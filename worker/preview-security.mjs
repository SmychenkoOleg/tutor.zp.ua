// Only used by the isolated Cloudflare preview Worker, never by tutor.zp.ua.
export const PREVIEW_USERNAME = "preview";
export const MIN_PASSWORD_LENGTH = 20;
const CHALLENGE = 'Basic realm="Tutor preview", charset="UTF-8"';

async function digest(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function authorized(request, password) {
  const header = request.headers.get("authorization") ?? "";
  if (!/^Basic\s+/i.test(header) || header.length > 1024) return false;
  let decoded;
  try {
    decoded = atob(header.replace(/^Basic\s+/i, "").trim());
  } catch {
    return false;
  }
  // Digest comparison avoids short-circuit timing differences on valid-length inputs.
  const [actual, expected] = await Promise.all([
    digest(decoded),
    digest(`${PREVIEW_USERNAME}:${password}`),
  ]);
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= actual[i] ^ expected[i];
  return mismatch === 0;
}

function securedResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  if ((headers.get("Content-Type") ?? "").toLowerCase().includes("text/html")) {
    // The test environment must not send Analytics/GTM traffic to production.
    // JavaScript and fetch calls to this Worker itself are still allowed.
    headers.set("Content-Security-Policy", "script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; img-src 'self' data:");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function staticAsset(pathname) {
  return pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    /\.(?:css|js|map|mjs|svg|png|jpe?g|webp|gif|avif|ico|woff2?|ttf|otf|txt|xml|webmanifest)$/i.test(pathname);
}

export function createPreviewWorker(siteWorker) {
  return {
    async fetch(request, env, ctx) {
      const password = env?.PREVIEW_AUTH_PASSWORD;
      // Fail closed if the Cloudflare Secret was not configured or is too short.
      if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
        return securedResponse(new Response("Preview access is not configured", { status: 503 }));
      }
      if (!(await authorized(request, password))) {
        return securedResponse(new Response("Authentication required", {
          status: 401,
          headers: { "WWW-Authenticate": CHALLENGE },
        }));
      }

      const pathname = new URL(request.url).pathname;
      const response = staticAsset(pathname)
        ? await env.ASSETS.fetch(request)
        : await siteWorker.fetch(request, env, ctx);
      return securedResponse(response);
    },
  };
}
