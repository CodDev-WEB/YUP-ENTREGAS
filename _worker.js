export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return env.ASSETS.fetch(request);
    }

    // Canonical URLs: hide .html from the browser address bar.
    if (url.pathname === "/index.html") {
      return Response.redirect(new URL("/", url), 302);
    }
    if (url.pathname === "/entregador.html") {
      return Response.redirect(new URL("/", url), 302);
    }

    // Serve the existing HTML files behind extensionless routes.
    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", url), { method: request.method, headers: request.headers }));
    }
    if (url.pathname === "/entregador") {
      return Response.redirect(new URL("/", url), 302);
    }

    return env.ASSETS.fetch(request);
  }
};
