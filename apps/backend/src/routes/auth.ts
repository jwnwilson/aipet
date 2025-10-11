import { Router } from "express";
import { auth } from "../config/auth.js";
import { authenticateUser, AuthenticatedRequest } from "../middleware/auth.js";

const router: Router = Router();

// Better-auth handles most auth routes automatically
// This file is for custom auth-related endpoints

// Get current user
router.get("/me", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
        session: req.session,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user information",
    });
  }
});

// Logout (better-auth handles this automatically, but we can add custom logic here)
router.post("/logout", authenticateUser, async (req: AuthenticatedRequest, res) => {
  try {
    // Better-auth handles session invalidation
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to logout",
    });
  }
});

export default router;
