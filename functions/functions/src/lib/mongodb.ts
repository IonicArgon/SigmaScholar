import { MongoClient, Db, Collection, Document, ServerApiVersion } from 'mongodb'
import { defineString } from 'firebase-functions/params'

let client: MongoClient | null = null
let db: Db | null = null

// Define parameterized configuration
const mongodbUri = defineString('MONGODB_URI')
const mongodbDatabase = defineString('MONGODB_DATABASE', { default: 'sigmaMain' })

export async function connectToMongoDB(): Promise<Db> {
  if (db) {
    return db
  }

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
      }
    })
    
    await client.connect()
    db = client.db(dbName)
    
    console.log(`Connected to MongoDB database: ${dbName}`)
    return db
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error)
    throw error
  }
}

export async function getCollection<T extends Document = Document>(collectionName: string): Promise<Collection<T>> {
  const database = await connectToMongoDB()
  return database.collection<T>(collectionName)
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
