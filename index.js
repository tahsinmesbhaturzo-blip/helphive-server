import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// ---------- Database ----------
const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db("eventsDB");
const events = db.collection("events");
const joined = db.collection("joinedEvents");

// ---------- Helpers ----------
const today = () => new Date().toISOString().slice(0, 10);