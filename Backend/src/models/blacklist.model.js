const mongoose = require('mongoose');

const blacklistTokenSchema = new mongoose.Schema({
    token: {
        type:String,
        required:[true, "token is required"],
    }
},{
    timestamps:true
})

const TokenBlacklistModel = mongoose.model("blacklistToken", blacklistTokenSchema)
module.exports = TokenBlacklistModel