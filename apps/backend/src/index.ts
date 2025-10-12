import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "dotenv";
import { auth } from "./config/auth.js";
import authRoutes from "./routes/auth.js";
import petRoutes from "./routes/pets.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";

// Load environment variables
config();

const app: express.Application = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

// Logging middleware
app.use(morgan("combined"));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Better-auth middleware
app.use("/api/auth", (req, res, next) => {
  console.log("Auth request:", req.method, req.url, req.headers.host);
  return auth.handler(req, res, next);
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/pets", petRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Pet Backend API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      pets: "/api/pets",
      health: "/health",
    },
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log(`🐾 Pet endpoints: http://localhost:${PORT}/api/pets`);
});

export default app;
