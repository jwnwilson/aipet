# AIPet Backend

Express.js backend API for the AIPet application with JWT-based authentication and MongoDB integration.

## Features

- **Authentication**: JWT-based authentication with access and refresh tokens
- **User Management**: User registration, login, email verification, password reset
- **Security**: CSRF protection, rate limiting, input validation, password hashing
- **Database**: MongoDB with Mongoose ODM
- **API Endpoints**: RESTful API matching the frontend client expectations

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/verify/:token` - Email verification
- `POST /api/v1/auth/resend-verification` - Resend verification email
- `POST /api/v1/auth/password-reset/request` - Request password reset
- `POST /api/v1/auth/password-reset/confirm` - Confirm password reset
- `GET /api/v1/auth/profile` - Get user profile
- `PUT /api/v1/auth/profile` - Update user profile

### Token Management
- `POST /api/v1/token/pair` - Get access and refresh tokens (login compatibility)
- `POST /api/v1/token/refresh` - Refresh access token
- `POST /api/v1/token/logout` - Logout (client-side token removal)
- `GET /api/v1/token/verify` - Verify token validity

### CSRF Protection
- `GET /api/v1/csrf/token` - Get CSRF token
- `POST /api/v1/csrf/verify` - Verify CSRF token

### AI Pet
- `POST /api/v1/aipet/recommendations` - Get pet action recommendations
- `GET /api/v1/aipet/status` - Get pet status
- `POST /api/v1/aipet/status` - Update pet status

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Configuration**:
   Copy `env.example` to `.env` and configure:
   ```bash
   cp env.example .env
   ```

   Required environment variables:
   - `PORT`: Server port (default: 8000)
   - `MONGODB_URI`: MongoDB connection string
   - `JWT_SECRET`: Secret for JWT access tokens
   - `JWT_REFRESH_SECRET`: Secret for JWT refresh tokens
   - `SESSION_SECRET`: Secret for session management
   - `CORS_ORIGIN`: Allowed CORS origin (default: http://localhost:5173)

3. **Database Setup**:
   Make sure MongoDB is running and accessible at the configured URI.

4. **Development**:
   ```bash
   pnpm dev
   ```

5. **Production Build**:
   ```bash
   pnpm build
   pnpm start
   ```

## Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure token-based authentication
- **CSRF Protection**: Session-based CSRF tokens
- **Rate Limiting**: Configurable request rate limits
- **Input Validation**: Comprehensive request validation
- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers middleware

## Database Schema

### User Model
```typescript
{
  username: string (unique, 3-30 chars)
  email: string (unique, validated)
  password: string (hashed, min 6 chars)
  firstName: string (1-50 chars)
  lastName: string (1-50 chars)
  isEmailVerified: boolean
  emailVerificationToken?: string
  passwordResetToken?: string
  passwordResetExpires?: Date
  createdAt: Date
  updatedAt: Date
}
```

## Development

The backend is designed to work seamlessly with the frontend webapp. The API endpoints match the expectations of the frontend API client in `apps/webapp/src/api/client.ts`.

### Testing

Run the test suite:
```bash
pnpm test
```

### Linting

Run ESLint:
```bash
pnpm lint
```

## Deployment

The backend can be deployed to any Node.js hosting platform. Make sure to:

1. Set all required environment variables
2. Configure MongoDB connection
3. Set up proper CORS origins for production
4. Use HTTPS in production
5. Configure proper rate limiting for your use case

## API Compatibility

This backend is designed to be compatible with the existing frontend API client. All endpoints return responses in the expected format:

```typescript
// Success response
{
  data?: any;
  message?: string;
  status: number;
}

// Error response
{
  error: string;
  detail?: string;
  status: number;
}
```
