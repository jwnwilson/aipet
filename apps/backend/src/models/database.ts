import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
const connectionString = process.env.DATABASE_URL!;

console.log("Connection string:", connectionString);

// Create the connection
const client = postgres(connectionString);

// Create the database instance
export const db = drizzle(client);

export default db;