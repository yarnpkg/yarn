let pnp = require('../.pnp.js');

module.exports = (request, {basedir}) => {
    return pnp.resolveRequest(request, `${basedir}/`);
};
