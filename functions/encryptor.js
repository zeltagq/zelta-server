//These functions are used to encrypt & validate group passkeys

const bcrypt = require('bcryptjs');
const saltRounds = 10;

function encrypt(passkey, callback) {
    bcrypt.hash(passkey, saltRounds, (err, hash) => {
        if (callback)
            callback(err ? err : null, err ? null : hash);
    });
}

function decode(passkey, hash, callback) {
    bcrypt.compare(passkey, hash, (err, res) => {
        if (!err && res === true) {
            if (callback)
                callback(true)
        }
        else {
            if (callback)
                callback(false)
        }
    });
}

module.exports = {encrypt, decode};