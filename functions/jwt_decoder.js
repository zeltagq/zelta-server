// This module decodes the jwt token received from a client using a master key
const { MK } = require('../db/models');
const njwt = require('njwt');

function jwtDecode(token, priority, callback) {
    MK.find({ priority: priority }).then((result) => {
        let mk = result[0].key;
        let key = Buffer.from(mk, 'base64');
        njwt.verify(token, key, (err, verifiedJwt) => {
            if (callback)
                callback(err ? err : null, err ? null : verifiedJwt.body)
        });
    }, (err) => {
        console.error(`Could not find master key with priority ${priority}`);
    });
}

module.exports = { jwtDecode };