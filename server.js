const express = require('express');
const app = express();
const https = require('https');
const fs = require('fs');
const zum = require('zumjs');
const rateLimit = require("express-rate-limit");

const {jwtDecode} = require('./functions/jwt_decoder');
const {getMK} = require('./functions/get_mk');
const {rotateMK} = require('./functions/rotate_mk');
const {singleMsg, grpMsg} = require('./functions/send_msg');
const {inbox} = require('./functions/inbox');
const {createGrp, joinGrp, invite, acceptInvite, kick, setInviteOnly, resetInviteOnly, leave, viewMembers} = require('./functions/groups');
const {Grp} = require('./db/models');

zum.configure({
    // zum configuration
});

const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 15 // limit each IP to 15 requests per minute
});

app.use(limiter);
app.use(express.json());
app.use(express.static(__dirname + '/static', { dotfiles: 'allow' }));  // ssl domain verify 
let port = process.env.PORT || 443;

// Endpoints
app.post('/register', (req,res) => {
    jwtDecode(req.body.token, req.body.key_id, (err, data) => {
        if (err) {
            return res.status(400).send(err);
        }
        let username = data.username;
        let password = data.password;
        zum.register('primary', {
            username : username,
            password : password
        }, (err, response) => {
            if (err) {
                return res.status(500).send(err);
            }
            if (response.status === 200) {
                rotateMK(req.body.key_id);
                return res.sendStatus(200);
            }
            res.sendStatus(400);
        });
    });
});

app.post('/login', (req, res) => {
    jwtDecode(req.body.token, req.body.key_id, (err, data) => {
        if (err) {
            return res.sendStatus(400);
        }
        let username = data.username;
        let password = data.password;
        zum.login('secondary', username, password, (err, response) => {
            if (err) {
                return res.status(500).send(err);
            }
            if (response.status === 200) {
                rotateMK(req.body.key_id);
                let token = response.headers['x-auth-token'];
                return res.set('X-Auth-Token', token).send();
            }
            else if(response.status === 206) {
                // wrong password
                return res.sendStatus(206);
            }
            res.sendStatus(400);
        });
    });
});

app.get('/logout/:username/:token', (req,res) => {
    let username = req.params.username;
    let token = req.params.token;
    zum.verify(username, token, (err, response) => {
        if(err) {
            return res.status(500).send(err);
        }
        zum.logout(username, (err, response) => {
            if (err) {
                return res.status(500).send(err);
            }
            if (response.status === 200) {
                return res.sendStatus(200);
            }
            res.sendStatus(400);
        });
    });
});

app.post('/send', (req,res) => {
    let username = req.body.from;
    let access_token = req.get('x-auth-token');
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(500);
        }
        let recepient = req.body.to;
        if (recepient.startsWith('@')) {
            // Group Message
            grpMsg(req, res);
        }
        else {
            // Single Message
            zum.fetchUser(recepient, (err, response) => {
                if(err) {
                    return res.sendStatus(500);
                }
                if(response.status === 207) {
                    return res.sendStatus(207);
                }
                singleMsg(req,res);
            });
        }  
    });
});

app.get('/inbox/:username/:token', (req,res) => {
    let username = req.params.username;
    let access_token = req.params.token;
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(500);
        }
        inbox(req,res);  
    });
});

app.post('/groups/create', (req,res) => {
    let username = req.body.username;
    let access_token = req.get('x-auth-token');
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        createGrp(req,res);
    });
});

app.post('/groups/join', (req,res) => {
    let username = req.body.username;
    let access_token = req.get('x-auth-token');
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        joinGrp(req,res);
    });
});

app.get('/mk/:priority', (req,res) => {
    getMK(req,res);
});

app.get('/userAvail/:username', (req,res) => {
    zum.fetchUser(req.params.username, (err,response) => {
        if (err) {
            return res.sendStatus(500);
        }
        if (response.status === 207) {
            return res.sendStatus(200);
        }
        res.sendStatus(206);
    });
});

app.get('/grpAvail/:grp', (req,res) => {
    Grp.find({ name: req.params.grp}).then((result) => {
        if(result.length === 0) {
            return res.sendStatus(200);
        }
        res.sendStatus(206);
    }, (err) => {
        res.status(500).send(err);
    });
});

app.get('/invite/:username/:token/:invite/:group', (req,res) => {
    let username = req.params.username;
    let access_token = req.params.token;
    let invited_user = req.params.invite;
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        zum.fetchUser(invited_user, (err, response) => {
            if (err) {
                return res.sendStatus(401);
            }
            if (response.status === 207) {
                // invited user does not exist
                return res.sendStatus(210);
            }
            invite(req,res);
        });
    });
});

app.get('/accept-invite/:username/:token/:group', (req,res) => {
    let username = req.params.username;
    let access_token = req.params.token;
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        acceptInvite(req,res);
    });
});

app.get('/kick/:username/:token/:group/:target', (req, res) => {
    let username = req.params.username;
    let access_token = req.params.token;
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        kick(req,res);
    });
});

app.get('/set-private/:username/:token/:group', (req, res) => {
    let username = req.params.username;
    let access_token = req.params.token;
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        setInviteOnly(req,res);
    });
});

app.get('/set-public/:username/:token/:group', (req, res) => {
    let username = req.params.username;
    let access_token = req.params.token;
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        resetInviteOnly(req,res);
    });
});

app.get('/leave/:username/:token/:group', (req,res) => {
    let username = req.params.username;
    let access_token = req.params.token;
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        leave(req,res);
    });
});

app.get('/members/:username/:token/:group', (req,res) => {
    let username = req.params.username;
    let access_token = req.params.token;
    zum.verify(username, access_token, (err, response) => {
        if (err) {
            return res.sendStatus(401);
        }
        viewMembers(req,res);
    });
});

// Production
https.createServer({
    key: fs.readFileSync('/etc/letsencrypt/live/domain/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/domain/cert.pem'),
    ca: fs.readFileSync('/etc/letsencrypt/live/domain/chain.pem')
}, app).listen(port, () => {
    console.log('Server started');
});

// Development
// app.listen(port, (err) => {
//     if (err) throw err;
//     console.log(`Server started on ${port}`);
// });
