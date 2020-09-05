const {Grp, Msg} = require('../db/models');
const {decode} = require('./encryptor');
const {jwtDecode} = require('./jwt_decoder');
const {rotateMK} = require('./rotate_mk');

// function for creating groups
function createGrp(req,res) {
    jwtDecode(req.body.token, req.body.key_id, (err,data) => {
        if (err) {
            return res.sendStatus(400);
        }
        let name = data.name;
        let passkey = data.passkey;
        let admin = data.admin;
        let invite_only = data.invite_only;

        let group = new Grp({
            name : `@${name}`,  // group names always start with @
            passkey : passkey,
            admin : admin,
            invite_only : invite_only
        });

        group.save().then(() => {
            res.sendStatus(200);
            rotateMK(req.body.key_id);
        }, (err) => {
            res.status(500).send(err);
        });
    });
}

// function for joining groups using passphrase
function joinGrp(req,res) {
    jwtDecode(req.body.token, req.body.key_id, (err, data) => {
        if (err) {
            return res.sendStatus(400);
        }
        let name = data.name;
        let passkey = data.passkey;
        let username = data.username;

        Grp.find({name:name}).then((result) => {
            if(result.length === 0) {
                // group does not exist
                res.sendStatus(208);
            }
            else {
                let group = result[0];
                if (group.members.length === 50) {
                    // Group limit reached
                    return res.sendStatus(211);
                }
                if (group.invite_only === true) {
                    // group is invite only
                    return res.sendStatus(209);
                }
                if (group.members.includes(username)) {
                    // You are already a member of the group
                    return res.sendStatus(207);
                }
                let hash = group.passkey;
                decode(passkey, hash, (response) => {
                    if(response === true) {
                        if(group.admin !== username) {
                            group.members.push(username);
                            group.save().then(() => {
                                res.sendStatus(200);
                                rotateMK(req.body.key_id);
                            }, (err) => {
                                res.status(500).send(err);
                            });
                        }
                        else {
                            // Admins cannot join their own groups
                            res.sendStatus(207);
                        } 
                    }
                    else {
                        // Wrong passkey
                        return res.sendStatus(206);
                    }
                });
            }
        }, (err) => {
            res.status(500).send(err);
        });
    });
}

// function for inviting users to a group
function invite(req,res) {
    let username = req.params.username;
    let group = req.params.group;
    let invite = req.params.invite;
    Grp.find({name:group}).then((result) => {
        if(result.length === 0) {
            return res.sendStatus(207);
        }
        let grp = result[0];
        if(grp.admin !== username) {
            return res.sendStatus(208);
        }
        if(grp.members.length === 50) {
            return res.sendStatus(211);
        }
        if(grp.members.includes(invite)) {
            return res.sendStatus(209);
        }
        grp.invited.push(invite);
        grp.save().then(() => {
            res.sendStatus(200);
        }, (err) => {
            res.sendStatus(500);
        });
        // sending invite message
        let msg = new Msg({
            from : group,
            to : invite,
            msg : '(Invitation) You are invited to join our group. To accept your invitation use the accept-invite command.'
        });
        msg.save().then(() => {
            // Response status has been already sent
        }, (err) => {
            console.log('Invitation message failed');
        }); 
    }, (err) => {
        res.sendStatus(500);
    });
}

// function for accepting invites
function acceptInvite(req,res) {
    let username = req.params.username;
    let group = req.params.group;
    Grp.find({name:group}).then((result) => {
        if (result.length === 0) {
            return res.sendStatus(207);
        }
        let grp = result[0];
        if (grp.members.length === 50) {
            // Group limit reached
            return res.sendStatus(211);
        }
        if (grp.members.includes(username)) {
            // already a member
            return res.sendStatus(208);
        }
        if(grp.invited.includes(username)) {
            grp.members.push(username);
            res.sendStatus(200);
            let i = grp.invited.indexOf(username);
            grp.invited.splice(i, 1);
            grp.save().then(() => {
                // Response status has been already sent once
            }, (err) => {
                res.sendStatus(500);
            });
        }
        else {
            // Not invited
            res.sendStatus(209);
        }
    }, (err) => {
        res.sendStatus(500);
    });
}

// kick user from group
function kick(req,res) {
    let username = req.params.username;
    let group = req.params.group;
    let target = req.params.target;
    Grp.find({name:group}).then((result) => {
        if(result.length === 0) {
            return res.sendStatus(207);
        }
        let grp = result[0];
        if(grp.admin !== username) {
            // action taker is not group admin
            return res.sendStatus(208);
        }
        if(!grp.members.includes(target)) {
            // target is not a group member
            return res.sendStatus(209);
        }
        let i = grp.members.indexOf(target);
        grp.members.splice(i, 1);
        grp.save().then(() => {
            res.sendStatus(200);    
        }, (err) => {
            res.sendStatus(500);    
        });
    }, (err) => {
        res.sendStatus(500);
    });
}

// set group to invite only
function setInviteOnly(req,res) {
    let username = req.params.username;
    let group = req.params.group;
    Grp.find({name:group}).then((result) => {
        if(result.length === 0) {
            return res.sendStatus(207);
        }
        let grp = result[0];
        if(grp.admin !== username) {
            // not the group admin
            return res.sendStatus(208);
        }
        if(grp.invite_only) {
            // group is already invite only
            return res.sendStatus(209);
        }
        grp.invite_only = true;
        grp.save().then(() => {
            res.sendStatus(200);
        }, (err) => {
            res.sendStatus(500);
        });
    }, (err) => {
        res.sendStatus(500);
    });
}

// reset group to public access
function resetInviteOnly(req,res) {
    let username = req.params.username;
    let group = req.params.group;
    Grp.find({ name: group }).then((result) => {
        if (result.length === 0) {
            return res.sendStatus(207);
        }
        let grp = result[0];
        if (grp.admin !== username) {
            // not the group admin
            return res.sendStatus(208);
        }
        if (!grp.invite_only) {
            // group is already public
            return res.sendStatus(209);
        }
        grp.invite_only = false;
        grp.save().then(() => {
            res.sendStatus(200);
        }, (err) => {
            res.sendStatus(500);
        });
    }, (err) => {
        res.sendStatus(500);
    });
}

// leave group
function leave(req,res) {
    let username = req.params.username;
    let group = req.params.group;
    Grp.find({name:group}).then((result) => {
        if(result.length === 0) {
            return res.sendStatus(207);
        }
        let grp = result[0];
        if(grp.admin === username) {
            // oldest member becomes the new admin
            grp.admin = grp.members[0];
            grp.members.splice(0, 1);
            grp.save().then((grp) => {
                // Alert the new admin
                let msg = new Msg({
                    from : group,
                    to : grp.admin,
                    msg : '(Group Alert) Our admin has left the group. You are the new admin.'
                });
                msg.save().then(() => {
                    return res.sendStatus(200);
                }, (err) => {
                    return console.warn('Failed to send admin change alert');    
                });
            }, (err) => {
                return res.sendStatus(500);
            });    
        }
        if(!grp.members.includes(username)) {
            // not part of the group
            return res.sendStatus(209);
        }
        let i = grp.members.indexOf(username);
        grp.members.splice(i,1);
        grp.save().then(() => {
            res.sendStatus(200);
        }, (err) => {
            res.sendStatus(500);
        });
    }, (err) => {
        res.sendStatus(500);
    });
}

// view all group members
function viewMembers(req,res) {
    let username = req.params.username;
    let group = req.params.group;
    Grp.find({name:group}).then((result) => {
        if(result.length === 0) {
            return res.sendStatus(207);
        }
        let grp = result[0];
        if(!grp.members.includes(username) && !grp.admin === username) {
            // not a member of the group
            return res.sendStatus(208);
        }
        let response = {members : grp.members, admin : grp.admin};
        res.status(200).send(response);
    });
}

module.exports = {createGrp, joinGrp, invite, acceptInvite, kick, setInviteOnly, resetInviteOnly, leave, viewMembers};