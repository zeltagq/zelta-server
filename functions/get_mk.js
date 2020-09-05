// Module for retrieving master keys
const { MK } = require('../db/models');
const cryptoKey = require('secure-random');

function getMK(req, res) {
    MK.find({ priority: req.params.priority }).then((mk) => {
        if (mk.length === 0) {
            // Generate new master key
            let newKey = cryptoKey(256, { type: 'Buffer' });
            let key = newKey.toString('base64');
            let masterKey = new MK({
                priority: req.params.priority,
                key: key
            });
            masterKey.save().then((mk) => {
                console.log(`Master key (${req.params.priority}) created`);
                res.status(200).send(key);
            }, (err) => {
                res.status(500).send(err);
            });
        }
        else {
            res.status(200).send(mk[0].key);
        }
    }, (err) => {
        res.status(500).send(err);
    });
}

module.exports = { getMK };