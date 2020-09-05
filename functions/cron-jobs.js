const {MK} = require('../db/models');
const moment = require('moment');

// Clear old master keys
function clearKeys() {
    let threshold = moment().utc().subtract(5, 'minutes');
    let count = 0;
    MK.find().then((result) => {
        if(result.length === 0) {
            return console.log('Cron Job : 0 keys recycled');
        }
        result.forEach((mk) => {
            if(moment(mk.time).isBefore(threshold)) {
                MK.deleteOne({priority:mk.priority}).then(() => {
                    count = count + 1;
                }, (err) => {
                    return console.error('Failed to execute cron job');
                });
            }
        });
        console.log(`Cron Job : ${count} keys recycled`);
    }, (err) => {
        console.error('Failed to execute cron job');
    });   
}

module.exports = {clearKeys};