import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";

config();

const connectionString = process.env.DATABASE_URL!;

// Create the connection
const client = postgres(connectionString);

// Create the database instance
export const db = drizzle(client);

export default db;
