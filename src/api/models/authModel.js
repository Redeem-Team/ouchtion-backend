import httpStatus from 'http-status-codes';
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv';
import bcrypt from 'bcrypt'
dotenv.config();

import { DB_QUERY_ERROR, EXPIRED_ACCESSTOKEN, EXPIRED_REFRESHTOKEN, EXPIRED_VERIFYTOKEN, INVAILD_ACCESSTOKEN, INVAILD_REFRESHTOKEN, INVAILD_VERIFYTOKEN, LOGIN_ERROR, NOTFOUND_REDIS, REDIS_SERVER_ERROR, UNEXPECTED_ERROR } from '../helpers/constants/Errors';
import { setRedis,getRedis, delRedis } from '../helpers/constants/redisClient';
import userModel from './userModel';
import sendEmail from '../helpers/constants/sendEmail';

const optsAccess = {
    expiresIn: process.env.EXPIRED_ACCESSTOKEN
};
const optsVerify = {
    expiresIn: process.env.EXPIRED_VERIFYTOKEN
};
const optsRefresh = {
    expiresIn: process.env.EXPIRED_REFRESHTOKEN
};

export default {
    login: async (req, res) => {
        try{
            //find user by email
            const user = await userModel.findByEmail(req.body.email);
            if (user === null) {
                return res.status(httpStatus.UNAUTHORIZED).send(LOGIN_ERROR)
            }
            
            // check password
            if (bcrypt.compareSync(req.body.password, user.password) === false) {
                return res.status(httpStatus.UNAUTHORIZED).send(LOGIN_ERROR)
            }

            // create access token and refresh token
            const payloadAccessToken = {
                userId: user.id
            };
            const payloadRefreshToken = {
                userId: user.id,
                userEmail: user.email
            };
            const accessToken = jwt.sign(payloadAccessToken, process.env.SERET_KEY, optsAccess);
            const refreshToken = jwt.sign(payloadRefreshToken, process.env.SERET_KEY, optsRefresh);
            
            // set value from redis
            try{
                await setRedis(user.id,{ 
                    refreshToken: refreshToken,
                })
            }catch(err){
                return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(REDIS_SERVER_ERROR);
            }

            // return access token and refresh token
            return res.json({
                accessToken,
                refreshToken
            });
        }catch (err) {
            console.log(err);
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(UNEXPECTED_ERROR);
        }
    },
    refresh: async (req, res) => {
        const { accessToken, refreshToken } = req.body;
        const opts = {
            ignoreExpiration: true
        };

        var _userId = -1

        // verify token and get user id
        try {
            const { userId } = jwt.verify(accessToken, process.env.SERET_KEY, opts);
            _userId = userId;
        } catch (err) {
            return res.status(httpStatus.UNAUTHORIZED).send(INVAILD_REFRESHTOKEN)
        }

        // get value from redis
        var value = null;
        try{
            value = await getRedis(_userId);
        }catch(err){
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(REDIS_SERVER_ERROR);
        }
        if (!value)
        {
            return res.status(httpStatus.NOT_FOUND).send(NOTFOUND_REDIS);
        }

        // check refresh token and redis refresh token
        if (value.refreshToken !== refreshToken)
        {
            return res.status(httpStatus.UNAUTHORIZED).send(INVAILD_REFRESHTOKEN)
        }

        // check expired and valid of refresh token
        try {
            const { userId, userEmail } = jwt.verify(refreshToken, process.env.SERET_KEY, opts);
        } catch (err) {
            if (error.name === "TokenExpiredError")
                return res.status(httpStatus.UNAUTHORIZED).send(EXPIRED_REFRESHTOKEN)
            else
                return res.status(httpStatus.UNAUTHORIZED).send(INVAILD_REFRESHTOKEN)
        }

        // create new access token
        const payload = { _userId };
        const new_accessToken = jwt.sign(payload, process.env.SERET_KEY, optsAccess);
        
        // return new access token and refresh token
        return res.json({
            accessToken: new_accessToken,
            refreshToken: refreshToken
        });
    },
    logout: async (req, res) =>{
        const { accessToken, refreshToken } = req.body;
        const opts = {
            ignoreExpiration: true
        };
        try {
            const { userId } = jwt.verify(accessToken, process.env.SERET_KEY, opts);
            
            // delete data of user have userId in redis
            try{
                await delRedis(userId);
            }catch(err){
                return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(REDIS_SERVER_ERROR);
            }

            return res.status(httpStatus.NO_CONTENT).send()
        } catch (err) {
            return res.status(httpStatus.UNAUTHORIZED).send(INVAILD_REFRESHTOKEN)
        }
    },
    register: async(req, res) =>{
        //hash pass
        req.body.password = bcrypt.hashSync(req.body.password, 10);
        var user = null

        //add user
        try {
            user = await userModel.add(req.body)
        } catch (error) {
            return res.status(httpStatus.CONFLICT).send(DB_QUERY_ERROR)
        }

        // create access token and refresh token
        const payloadVerifyToken = {
            userId: user[0]
        };

        const verifyToken = jwt.sign(payloadVerifyToken, process.env.SERET_KEY, optsVerify);
        
        // save verifyToken in redis
        try{
            await setRedis(user.id,{ 
                verifyToken: verifyToken,
            })
        }catch(err){
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(REDIS_SERVER_ERROR);
        }

        // send email to user
        sendEmail(req.body.email,verifyToken)

        return res.status(httpStatus.NO_CONTENT).send()
    },
    verify: async(req, res) =>{
        const verifyToken = req.query.token

        // get value and del value from redis
        var value = null;
        try{
            // get value
            value = await getRedis(_userId);
            if (!value)
            {
                return res.status(httpStatus.NOT_FOUND).send(NOTFOUND_REDIS);
            }

            // del value redis
            await delRedis(_userId)
        }catch(err){
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(REDIS_SERVER_ERROR);
        }

        // check verifytoken with value in redis
        if (value.verifyToken !== verifyToken){
            return res.status(httpStatus.UNAUTHORIZED).send(INVAILD_VERIFYTOKEN);
        }

        // check vaild and update new password
        try {
            const { userId } = jwt.verify(verifyToken, process.env.SERET_KEY);
            await userModel.patch(userId, {
                active: true
            });
            return res.status(httpStatus.NO_CONTENT).send()
        } catch (err) {
            if (err.name === "TokenExpiredError")
                return res.status(httpStatus.UNAUTHORIZED).send(EXPIRED_VERIFYTOKEN)
            else
                return res.status(httpStatus.UNAUTHORIZED).send(INVAILD_VERIFYTOKEN)
        }
    },
    resetByEmail: async(req, res) =>{
        const email = req.query.email
        const user = await userModel.findByEmail(email);
        
        // check user exist
        if (user === null) {
            return res.status(httpStatus.UNAUTHORIZED).send(LOGIN_ERROR)
        }

        // create verify token
        const payloadVerifyToken = {
            userId: user.id
        };

        const verifyToken = jwt.sign(payloadVerifyToken, process.env.SERET_KEY, optsVerify);
        
        // save verifyToken in redis
        try{
            await setRedis(user.id,{ 
                verifyToken: verifyToken,
            })
        }catch(err){
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(REDIS_SERVER_ERROR);
        }
        
        // send email to yser
        sendEmail(email,verifyToken)

        return res.status(httpStatus.NO_CONTENT).send()
    },
    resetPass: async(req,res) =>{
        const {password, token} = req.body
        var _userId = -1;

        // get userId and check jwt
        try {
            const { userId } = jwt.verify(token, process.env.SERET_KEY, optsVerify);
            _userId = userId;
        } catch (err) {
            if (error.name === "TokenExpiredError")
                return res.status(httpStatus.UNAUTHORIZED).send(EXPIRED_VERIFYTOKEN)
            else
                return res.status(httpStatus.UNAUTHORIZED).send(INVAILD_VERIFYTOKEN)
        }

        // get value and del value from redis
        var value = null;
        try{
            // get value
            value = await getRedis(_userId);
            if (!value)
            {
                return res.status(httpStatus.NOT_FOUND).send(NOTFOUND_REDIS);
            }

            // del value redis
            await delRedis(_userId)
        }catch(err){
            console.log(err)
            return res.status(httpStatus.INTERNAL_SERVER_ERROR).send(REDIS_SERVER_ERROR);
        }

        // check verifytoken with value in redis
        if (value.verifyToken !== token){
            return res.status(httpStatus.UNAUTHORIZED).send(INVAILD_VERIFYTOKEN);
        }

        await userModel.patch(_userId, {
            password: password
        });

        return res.status(httpStatus.NO_CONTENT).send()
    }
};