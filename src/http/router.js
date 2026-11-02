// A tiny router: method + path, with :params like /api/events/:id
// It only matches. It never runs business rules.

export function createRouter() {
  const routes = [];

  function add(method, path, handler) {
    const parts = path.split('/').filter(Boolean);
    routes.push({ method, parts, handler });
  }

  // Returns { handler, params } or null if nothing matches.
  function match(method, pathname) {
    const given = pathname.split('/').filter(Boolean);
    for (const route of routes) {
      if (route.method !== method) continue;
      if (route.parts.length !== given.length) continue;

      const params = {};
      let ok = true;
      for (let i = 0; i < route.parts.length; i += 1) {
        const want = route.parts[i];
        const have = given[i];
        if (want.startsWith(':')) {
          params[want.slice(1)] = decodeURIComponent(have);
        } else if (want !== have) {
          ok = false;
          break;
        }
      }
      if (ok) return { handler: route.handler, params };
    }
    return null;
  }

  return {
    get: (path, handler) => add('GET', path, handler),
    post: (path, handler) => add('POST', path, handler),
    put: (path, handler) => add('PUT', path, handler),
    delete: (path, handler) => add('DELETE', path, handler),
    match,
  };
}