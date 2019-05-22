const {promisify} = require('util');

const {removePeer} = require('./');

/** Remove a peer if possible (no active or pending channels)

  {
    lnd: <Authenticated LND gRPC API Object>
    public_key: <Public Key Hex String>
  }
*/
module.exports = promisify(removePeer);
