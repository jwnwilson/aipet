# AI Pet Backend

A Node.js Express backend application with authentication using Better Auth and PostgreSQL with Drizzle ORM.

## Features

- 🔐 **Authentication**: Better Auth with email/password and OAuth support
- 🗄️ **Database**: PostgreSQL with Drizzle ORM
- 🐾 **Pet Management**: CRUD operations for virtual pets
- 📊 **Activity Tracking**: Log and track pet activities
- 🛡️ **Security**: Helmet, CORS, and input validation
- 📝 **Logging**: Morgan HTTP request logger

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Authentication**: Better Auth
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Security**: Helmet, CORS

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- pnpm package manager

### Installation

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Set up environment variables:
   ```bash
   cp env.example .env
   ```

3. Update the `.env` file with your database credentials:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/aipet_db
   BETTER_AUTH_SECRET=your-secret-key-here
   BETTER_AUTH_URL=http://localhost:3001
   PORT=3001
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   ```

4. Generate and run database migrations:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. Start the development server:
   ```bash
   pnpm dev
   ```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /api/auth/sign-up` - User registration
- `POST /api/auth/sign-in` - User login
- `POST /api/auth/sign-out` - User logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/session` - Get current session

### Pets
- `GET /api/pets` - Get all user's pets
- `GET /api/pets/:id` - Get specific pet
- `POST /api/pets` - Create new pet
- `PUT /api/pets/:id` - Update pet
- `DELETE /api/pets/:id` - Delete pet
- `GET /api/pets/:id/activities` - Get pet activities
- `POST /api/pets/:id/activities` - Add pet activity

### Health
- `GET /health` - Health check endpoint

## Database Schema

### Users
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `name` (String, Optional)
- `emailVerified` (Boolean)
- `image` (String, Optional)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

### Pets
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `name` (String)
- `species` (String)
- `breed` (String, Optional)
- `age` (Integer, Optional)
- `health` (Integer, 0-100)
- `happiness` (Integer, 0-100)
- `hunger` (Integer, 0-100)
- `energy` (Integer, 0-100)
- `createdAt` (Timestamp)
- `updatedAt` (Timestamp)

### Pet Activities
- `id` (UUID, Primary Key)
- `petId` (UUID, Foreign Key)
- `activity` (String)
- `description` (String, Optional)
- `createdAt` (Timestamp)

## Development

### Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build the application
- `pnpm start` - Start production server
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio

### Project Structure

```
src/
├── config/
│   ├── auth.ts          # Better Auth configuration
│   └── database.ts      # Database connection
├── middleware/
│   ├── auth.ts          # Authentication middleware
│   └── errorHandler.ts  # Error handling middleware
├── models/
│   └── schema.ts        # Database schema definitions
├── routes/
│   ├── auth.ts          # Authentication routes
│   └── pets.ts          # Pet management routes
└── index.ts             # Main application entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `BETTER_AUTH_SECRET` | Secret key for Better Auth | Required |
| `BETTER_AUTH_URL` | Base URL for Better Auth | `http://localhost:3001` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |
| `CORS_ORIGIN` | CORS allowed origin | `http://localhost:5173` |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
