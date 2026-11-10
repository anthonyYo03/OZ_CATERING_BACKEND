import bcrypt from 'bcrypt';
import User from '../models/user.model.js'; 
import { generateToken } from '../middlewares/auth.js';

const registerUser = async (req, res) => {
  const { username, password, roles } = req.body;
  
  try {
    // Check if user already exists by username
    const existingUser = await User.findOne({ 
      where: { username }
    });
    
    if (existingUser) {
      return res.status(400).send({ message: 'User already exists' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Create user matching the model schema
    const newUser = await User.create({ 
      username,  
      password: hash,
      ...(roles && { roles }) // Optional: lets you pass a role, otherwise uses model default ('observer')
    });

    res.status(201).send({ 
      message: 'User registered successfully.',
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred!! ${error}` });
  }
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Look up user by username instead of email
    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).send({ message: 'Invalid login credentials' });
    }

    const payload = { userId: user.user_id, roles: user.roles };
    
    // Uncomment when generateToken is imported/defined
    const token = generateToken(payload);
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });
   
    res.status(200).json({ message: 'Login successful', roles: user.roles });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred while logging in ${error}` });
  }
};


const logoutUser = (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: 'An error occurred while logging out' });
  }
}






export const userController = {
  loginUser,
  registerUser,
  logoutUser
};