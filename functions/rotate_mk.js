// Module for rotating used master keys
const { MK } = require('../db/models');
const cryptoKey = require('secure-random');

function rotateMK(priority) {
    MK.find({ priority: priority }).then((result) => {
        if (result.length === 0) {
            console.error('No master key found with the given priority');
        }
        else {
            let mk = result[0];
            let newKey = cryptoKey(256, { type: 'Buffer' });
            mk.key = newKey.toString('base64');
            mk.save().then((mk) => {
                console.log(`Master key (${priority}) rotated`);
            }, (err) => {
                console.error('Failed to rotate master key');
            });
        }
    }, (err) => {
        console.error(err);
    });
}

module.exports = { rotateMK };