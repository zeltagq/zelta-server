const {Msg, Grp, MK} = require('../db/models');
const CryptoJS = require('crypto-js');

function singleMsg(req,res) {
    let from = req.body.from;
    let to = req.body.to;
    let msg_cipher = req.body.msg;
    let key_id = req.body.key_id;

    if (from === to) {
        return res.sendStatus(400);
    }

    MK.find({priority:key_id}).then((result) => {
        let key = result[0].key;
        let bytes = CryptoJS.AES.decrypt(msg_cipher, key);
        let msg = bytes.toString(CryptoJS.enc.Utf8);

        let message = new Msg({
            from : from,
            to : to,
            msg : msg
        });

        message.save().then(() => {
            res.sendStatus(200);
        }, (err) => {
            res.status(500).send(err);
        });
    });
}

function grpMsg(req,res) {
    let from = req.body.from;
    let to = req.body.to;
    let msg_cipher = req.body.msg;
    let key_id = req.body.key_id;

    MK.find({ priority: key_id }).then((result) => {
        let key = result[0].key;
        let bytes = CryptoJS.AES.decrypt(msg_cipher, key);
        let msg = bytes.toString(CryptoJS.enc.Utf8);

        Grp.find({name:to}).then((result) => {
            if(result.length !== 0) {
                let members = result[0].members;
                let admin = result[0].admin;
                if(members.includes(from) === false && admin !== from) {
                    // sender is not a member of the group
                    return res.sendStatus(210);
                }
                if(members.length !== 0) {
                    res.sendStatus(200);
                    members.forEach((member) => {
                        if(member !== from) {
                            let message = new Msg({
                                from: `${from}${to}`,
                                to: member,
                                msg: msg
                            });

                            message.save().then(() => {
                                // response will be sent once
                            }, (err) => {
                                return res.status(500).send(err);
                            });
                        }             
                    });
                    //send message to admin
                    if(admin !== from) {
                        let message = new Msg({
                            from: `${from}${to}`,
                            to: admin,
                            msg: msg
                        });
                        message.save().then(() => {
                            // response will be sent once
                        }, (err) => {
                            return res.status(500).send(err);
                        });
                    }
                    // res.sendStatus(200);
                }
                else {
                    res.status(209).send('Group has no members!');
                }
            }
            else {
                res.status(208).send('Group does not exist!');
            }
        });
    });
}

module.exports = {singleMsg, grpMsg};