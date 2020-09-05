const moment = require('moment');
const { db } = require('./dbconf');
const {encrypt} = require('../functions/encryptor');

// Schema for messages
let MsgSchema = new db.Schema({
    from : {
        type : String,
        required : true,
        trim : true,
        min : 1
    },
    to : {
        type: String,
        required: true,
        trim: true,
        min: 1
    },
    msg : {
        type: String,
        required: true,
        trim: true,
        min: 1
    },
    time : {
        type: Object,
        default: moment().utc()
    }
});

// Schema for groups
let GrpSchema = new db.Schema({
    name : {
        type: String,
        required: true,
        unique: true,
        trim: true,
        min: 1
    },
    passkey : {
        type: String,
        required: true,
        trim: true,
        min: 8  
    },
    admin : {
        type: String,
        required: true,
        trim: true,
        min: 1
    },
    members : {
        type: Array,
        default: []
    },
    invited : {
        type: Array,
        default: []
    },
    invite_only : {
        type: Boolean,
        default: false
    }
});

// Encrypt group passkey before saving
GrpSchema.pre('save', function (next) {
    let group = this;
    if (group.isModified('passkey')) {
        encrypt(group.passkey, (err, hash) => {
            if (!err) {
                group.passkey = hash;
            }
            next();
        });
    } else {
        next();
    }
});

// Schema for master keys
let MasterKeySchema = new db.Schema({
    // This field is for maintaining multiple master keys to prevent bottlenecks
    priority: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        min: 1
    },
    // This key will be rotated by the server after each successful signup/login
    key: {
        type: String,
        required: true,
        trim: true,
        min: 1
    },
    // Timestamp of key creation
    time: {
        type: Object,
        default: moment().utc()
    }
});

// Models
let Msg = db.model('Msg', MsgSchema);
let Grp = db.model('Grp', GrpSchema);
let MK = db.model('MK', MasterKeySchema);

module.exports = {Msg, Grp, MK};