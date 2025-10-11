import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { 
  signupValidation, 
  loginValidation, 
  emailValidation, 
  passwordResetValidation,
  handleValidationErrors 
} from '../utils/validation.js';

const router = express.Router();

// Signup endpoint
router.post('/signup', signupValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, email, password, first_name, last_name } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password,
      firstName: first_name,
      lastName: last_name,
      emailVerificationToken: uuidv4(),
    });

    await user.save();

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      message: 'User created successfully',
      user_id: user._id,
      verification_required: true,
      access: accessToken,
      refresh: refreshToken,
      username: user.username,
    });
  } catch (error) {
    next(error);
  }
});

// Login endpoint
router.post('/login', loginValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      access: accessToken,
      refresh: refreshToken,
      username: user.username,
    });
  } catch (error) {
    next(error);
  }
});

// Email verification endpoint
router.get('/verify/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
      return res.status(400).json({
        error: 'Invalid verification token',
        message: 'Token not found or expired'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    res.json({
      message: 'Email verified successfully',
      verified: true,
    });
  } catch (error) {
    next(error);
  }
});

// Resend verification email endpoint
router.post('/resend-verification', emailValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'No user found with this email address'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        error: 'Email already verified',
        message: 'This email address is already verified'
      });
    }

    // Generate new verification token
    user.emailVerificationToken = uuidv4();
    await user.save();

    // In a real application, you would send an email here
    console.log(`Verification email would be sent to ${email} with token: ${user.emailVerificationToken}`);

    res.json({
      message: 'Verification email sent',
      user_id: user._id,
      verification_required: true,
    });
  } catch (error) {
    next(error);
  }
});

// Password reset request endpoint
router.post('/password-reset/request', emailValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({
        message: 'If the email exists, a password reset link has been sent',
        success: true,
      });
    }

    // Generate reset token
    user.passwordResetToken = uuidv4();
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    // In a real application, you would send an email here
    console.log(`Password reset email would be sent to ${email} with token: ${user.passwordResetToken}`);

    res.json({
      message: 'If the email exists, a password reset link has been sent',
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

// Password reset confirmation endpoint
router.post('/password-reset/confirm', passwordResetValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { token, new_password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        message: 'Reset token not found or expired'
      });
    }

    // Update password
    user.password = new_password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({
      message: 'Password reset successfully',
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    res.json({
      user: req.user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const { firstName, lastName, email } = req.body;
    const updates: any = {};

    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (email && email !== req.user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existingUser) {
        return res.status(409).json({
          error: 'Email already taken',
          message: 'This email address is already registered'
        });
      }
      updates.email = email;
      updates.isEmailVerified = false; // Require re-verification
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser?.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
