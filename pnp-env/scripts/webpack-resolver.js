const pnp = require(`../.pnp.js`);

module.exports = {
  apply: function(resolver) {
    const resolvedHook = resolver.ensureHook(`resolved`);
    resolver.getHook(`resolve`).tapAsync(`PnpResolver`, (request, resolveContext, callback) => {
      if (request.context.issuer === undefined) {
        return callback();
      }

      let issuer;
      let resolution;

      if (!request.context.issuer) {
        issuer = `${request.path}/`;
      } else if (request.context.issuer.startsWith(`/`)) {
        issuer = request.context.issuer;
      } else {
        throw new Error(`Cannot successfully resolve this dependency`);
      }

      try {
        resolution = pnp.resolveRequest(request.request, issuer);
      } catch (error) {
        // TODO This is not good! But the `debug` package tries to require `supports-color` without declaring it in its
        // package.json, and Webpack accepts this because it`s in a try/catch, so we need to do it as well.
        return callback(error);
      }

      resolver.doResolve(resolvedHook, Object.assign({}, request, {
        path: resolution,
      }), null, resolveContext, callback);
    });
  }
};
