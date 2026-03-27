const userModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const TokenBlacklistModel = require('../models/blacklist.model')

async function registerUserController(req, res){
    const {username, email, password} = req.body;
    
    if(!username || !email || !password){
        return res.status(400).json({messsage: 
        'all fields are required'
        })
    }
    const isUserExist = await userModel.findOne({
        $or: [{username}, {email}]
})
    if(isUserExist){
        return res.status(400).json({
            message: 'username or email already exists'
        })
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await userModel.create({
        username,
        email,
        password: hash
    })

    const token = jwt.sign(
        {id: user._id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn: "1d"}
    )
    res.cookie("token", token)
    res.status(201).json({
        message: "User registered successfully",
        user:{
            id: user._id,
            username: user.username,
            email: user.email
        }
    })

}

async function loginUserController(req, res){
    const {email, password} = req.body;

    const user = await userModel.findOne({email})
    if(!user){
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }
    const isPasswordValid = await bcrypt.compare(password, user.password)
    if(!isPasswordValid){
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }
    const token = jwt.sign(
        {id: user._id, username: user.username},
        process.env.JWT_SECRET,
        {expiresIn: "1d"}
    )
    res.cookie("token",token)
    res.status(200).json({
        message: "user login successfully",
        user:{
            id:user._id,
            username:user.username,
            email:user.email
        }
    })
}

async function logoutUserController(req, res){
    const token = req.cookies.token
    if(token){
        await TokenBlacklistModel.create({token})
    }
    res.clearCookie("token")
    res.status(200).json({
        message: "user logged out successfully"
    })
}

async function getMeController(req, res){
    const user = await userModel.findById(req.user.id)
    res.status(200).json({
        message:"User details fetched successfully",
        user:{
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}
module.exports = { registerUserController
    , loginUserController,
        logoutUserController,
    getMeController};