const {Msg} = require('../db/models');

function inbox(req,res) {
    let username = req.params.username;
    Msg.find({to:username}).then((result) => {
        if(result.length === 0) {
            res.sendStatus(207);
        }
        else {
            res.send(result);
            // Delete messages on the server
            Msg.deleteMany({to:username}).then((err) => {
                if (err) throw err;
            });
        }
    });
}

module.exports = {inbox};