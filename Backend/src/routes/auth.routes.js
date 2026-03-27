const express = require('express');
const authController = require('../controller/auth.controller');
const authMiddleware = require('../middleware/auth.middleware')

const authRouter = express.Router();


/*
*@route POST /api/auth/register
*@desc register a new user
*/
authRouter.post('/register', authController.registerUserController);

/*
*@route POST /api/auth/login
*desc login a user
*/
authRouter.post('/login', authController.loginUserController);

/*
*@route GET /api/auth/logout
*/
authRouter.get('/logout', authController.logoutUserController)

/* 
*@route GET /api/auth/get-me
*@description get the current logged in user details
*/
authRouter.get('/get-me', authMiddleware.authUser, authController.getMeController)

module.exports = authRouter;