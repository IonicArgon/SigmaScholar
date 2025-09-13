import { MongoClient, Db, Collection, Document, ServerApiVersion } from 'mongodb'
import { defineString, defineSecret } from 'firebase-functions/params'

let client: MongoClient | null = null
let db: Db | null = null

// Define parameterized configuration
const mongodbUri = defineSecret('MONGODB_URI')
const mongodbDatabase = defineString('MONGODB_DATABASE', { default: 'sigmaMain' })

export async function connectToMongoDB(): Promise<Db> {
  if (db) {
    return db
  }

  // Note: This function should only be called from within Firebase Functions
  // that have declared mongodbUri in their secrets array
  const uri = mongodbUri.value()
  if (!uri) {
    throw new Error('MONGODB_URI parameter is not set')
  }

  const dbName = mongodbDatabase.value()

  try {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
      retryWrites: true,
      w: 'majority',
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 1,
      directConnection: false
    })
    
    await client.connect()
    db = client.db(dbName)
    
    // Ensure collections exist with proper indexes
    await initializeCollections(db)
    
    console.log(`Connected to MongoDB database: ${dbName}`)
    return db
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error)
    throw error
  }
}

/**
 * Initialize collections and indexes
 */
async function initializeCollections(database: Db): Promise<void> {
  try {
    // Create users collection if it doesn't exist
    const collections = await database.listCollections().toArray()
    const usersCollectionExists = collections.some(col => col.name === 'users')
    
    if (!usersCollectionExists) {
      await database.createCollection('users')
      console.log('Created users collection')
    }
    
    // Create indexes for better performance
    const usersCollection = database.collection('users')
    await usersCollection.createIndex({ firebaseUid: 1 }, { unique: true })
    await usersCollection.createIndex({ 'profile.email': 1 })
    
    console.log('MongoDB collections and indexes initialized')
  } catch (error) {
    console.warn('Failed to initialize collections:', error)
    // Don't throw here - the database connection is still valid
  }
}

export async function getCollection<T extends Document = Document>(collectionName: string): Promise<Collection<T>> {
  const database = await connectToMongoDB()
  return database.collection<T>(collectionName)
}

/**
 * Execute a function with MongoDB transaction support
 * Provides atomic operations across multiple collections
 */
export async function withTransaction<T>(
  operation: (session: any) => Promise<T>
): Promise<T> {
  if (!client) {
    throw new Error('MongoDB client not initialized')
  }
  
  const session = client.startSession()
  
  try {
    let result: T
    
    await session.withTransaction(async () => {
      result = await operation(session)
    })
    
    return result!
  } finally {
    await session.endSession()
  }
}

// Collection helpers
export const getUsersCollection = () => getCollection('users')

// Graceful shutdown
export async function closeMongoDB(): Promise<void> {
  if (client) {
    await client.close()
    client = null
    db = null
    console.log('MongoDB connection closed')
  }
}
