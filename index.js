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

// ---------- JWT middleware ----------
// The token is created by BetterAuth in the client. We check it using the client's public keys.
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
);

async function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: token missing" });
  }
  try {
    const { payload } = await jwtVerify(header.split(" ")[1], JWKS);
    req.user = payload; // contains email, name, id
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
}

// ---------- Public routes ----------
app.get("/", (req, res) => res.send("HelpHive server is running"));

// Upcoming events (optional ?limit=6&search=abc&type=Cleanup)
app.get("/events/upcoming", async (req, res) => {
  const query = { eventDate: { $gte: today() } };
  if (req.query.type) query.eventType = req.query.type;
  if (req.query.search) query.title = { $regex: req.query.search, $options: "i" };

  const result = await events
    .find(query)
    .sort({ eventDate: 1 })
    .limit(Number(req.query.limit) || 0)
    .toArray();
  res.json(result);
});

// Single event
app.get("/events/:id", async (req, res) => {
  try {
    const event = await events.findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (error) {
    res.status(404).json({ message: "Event not found" });
  }
});