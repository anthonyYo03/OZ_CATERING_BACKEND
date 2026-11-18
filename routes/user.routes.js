import express from 'express';
import { userController } from '../controllers/user.controller.js';


const router = express.Router();



// POST /register - Register a new user

// Registration closed: no new accounts can be created through the API
// router.post('/register', userController.registerUser);



// POST /login - Log in an existing user

router.post('/login' ,userController.loginUser);

router.post('/logout', userController.logoutUser);


export default router;