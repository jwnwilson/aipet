import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// CSRF token endpoint
router.get('/token', (req, res) => {
  try {
    // Generate a new CSRF token
    const csrfToken = uuidv4();
    
    // Store the token in the session
    req.session.csrfToken = csrfToken;
    
    res.json({
      csrf_token: csrfToken,
    });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    res.status(500).json({
      error: 'Failed to generate CSRF token',
      message: 'Internal server error'
    });
  }
});

// Verify CSRF token endpoint
router.post('/verify', (req, res) => {
  try {
    const { csrf_token } = req.body;
    const sessionToken = req.session.csrfToken;

    if (!csrf_token || !sessionToken) {
      return res.status(400).json({
        error: 'Missing CSRF token',
        message: 'CSRF token is required'
      });
    }

    if (csrf_token !== sessionToken) {
      return res.status(403).json({
        error: 'Invalid CSRF token',
        message: 'CSRF token mismatch'
      });
    }

    res.json({
      valid: true,
      message: 'CSRF token is valid'
    });
  } catch (error) {
    console.error('CSRF token verification error:', error);
    res.status(500).json({
      error: 'Failed to verify CSRF token',
      message: 'Internal server error'
    });
  }
});

export default router;
