import jwt from 'jsonwebtoken';

import {secretKey} from './config.js';



export const generateToken = (payload) => {

  const token = jwt.sign(payload, secretKey, { expiresIn: '6h' });

  return token ;

};



export const verifyToken = (req, res, next) => {

  const token = req.cookies.token;



  if (!token) {

    return res.status(401).json({ message: 'No token provided' });

  }



  jwt.verify(token, secretKey, (err, decoded) => {

    if (err) {

      return res.status(401).json({ message: 'Invalid token' });

    }



    req.user_id = decoded.userId;

    next();

  });

}; 