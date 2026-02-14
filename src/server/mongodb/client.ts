import { MongoClient, type Collection } from 'mongodb';

export type BasicUserRole = 'student' | 'teacher';

export interface BasicUserDocument {
  userId: string;
  name: string;
  role: BasicUserRole;
  className?: string;
  createdAt?: string;
  updatedAt?: string;
}

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/';
const dbName = process.env.MONGO_DB_NAME || 'user_profiles_db';
const collectionName = process.env.MONGO_COLLECTION_NAME || 'user';

let client: MongoClient | null = null;
let connecting: Promise<MongoClient> | null = null;

const getClient = async () => {
  if (client) return client;
  if (connecting) return connecting;
  connecting = MongoClient.connect(uri).then((connected) => {
    client = connected;
    return connected;
  });
  return connecting;
};

export const getUserCollection = async (): Promise<Collection<BasicUserDocument>> => {
  const conn = await getClient();
  return conn.db(dbName).collection<BasicUserDocument>(collectionName);
};
