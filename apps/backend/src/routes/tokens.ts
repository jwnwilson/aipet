import express from 'express';
import { User } from '../models/User.js';
import { generateAccessToken, verifyRefreshToken } from '../utils/jwt.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Token pair endpoint (for login compatibility)
router.post('/pair', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Username and password are required'
      });
    }

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

// Refresh token endpoint
router.post('/refresh', [
  body('refresh').notEmpty().withMessage('Refresh token is required'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { refresh } = req.body;

    try {
      const decoded = verifyRefreshToken(refresh);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(401).json({
          error: 'Invalid refresh token',
          message: 'User not found'
        });
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      res.json({
        access: newAccessToken,
        refresh: newRefreshToken,
      });
    } catch (tokenError) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Token is malformed or expired'
      });
    }
  } catch (error) {
    next(error);
  }
});

// Logout endpoint (client-side token removal)
router.post('/logout', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    // In a stateless JWT setup, logout is typically handled client-side
    // by removing tokens from storage. However, we can implement token
    // blacklisting here if needed for enhanced security.
    
    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Verify token endpoint
router.get('/verify', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
    }

    res.json({
      valid: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
