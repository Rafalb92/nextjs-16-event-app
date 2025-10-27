import mongoose from 'mongoose';

/**
 * Global type declaration for mongoose connection caching
 * This prevents TypeScript errors when accessing global.mongoose
 */
declare global {
  // eslint-disable-next-line no-var
  var mongoose: {
    conn: mongoose.Connection | null;
    promise: Promise<mongoose.Connection> | null;
  };
}

/**
 * MongoDB connection URI from environment variables
 * Throws an error if MONGODB_URI is not defined
 */
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local',
  );
}

/**
 * Global cache for the mongoose connection
 * In development, Next.js hot reloading can cause multiple connections
 * This cache prevents that by reusing the existing connection
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Establishes and returns a cached MongoDB connection
 *
 * @returns {Promise<mongoose.Connection>} A promise that resolves to the Mongoose connection
 *
 * @example
 * ```typescript
 * import dbConnect from '@/lib/mongodb';
 *
 * export async function GET() {
 *   await dbConnect();
 *   // Your database operations here
 * }
 * ```
 */
async function dbConnect(): Promise<mongoose.Connection> {
  // Return existing connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // Return existing promise if connection is in progress
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false, // Disable buffering for better error handling
    };

    // Create new connection promise
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
      return mongoose.connection;
    });
  }

  try {
    // Wait for connection to complete
    cached.conn = await cached.promise;
  } catch (error) {
    // Clear promise on error to allow retry
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}

export default dbConnect;
