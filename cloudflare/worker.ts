export interface Env {
  ASSETS: Fetcher;
  API_ORIGIN?: string;
}

const isAssetRequest = (pathname: string) =>
  /\.[a-zA-Z0-9]+$/.test(pathname) || pathname.startsWith("/assets/");

const buildUpstreamRequest = (request: Request, upstreamUrl: string) => {
  const headers = new Headers(request.headers);
  const url = new URL(request.url);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

  return new Request(upstreamUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  });
};

const jsonError = (message: string, status = 500) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const apiOrigin = env.API_ORIGIN?.trim();
      if (!apiOrigin) {
        return jsonError(
          "API_ORIGIN is not configured on this Cloudflare Worker deployment.",
          500,
        );
      }

      const upstreamUrl = new URL(`${url.pathname}${url.search}`, apiOrigin).toString();
      return fetch(buildUpstreamRequest(request, upstreamUrl));
    }

    let response = await env.ASSETS.fetch(request);

    if (response.status === 404 && !isAssetRequest(url.pathname)) {
      const fallbackUrl = new URL("/index.html", url.origin);
      response = await env.ASSETS.fetch(new Request(fallbackUrl.toString(), request));
    }

    return response;
  },
};
