import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db("eventsDB");
const events = db.collection("events");
const joined = db.collection("joinedEvents");

const today = () => new Date().toISOString().slice(0, 10);


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
    req.user = payload; 
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: invalid token" });
  }
}

app.get("/", (req, res) => res.send("HelpHive server is running"));

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


app.get("/events/:id", async (req, res) => {
  try {
    const event = await events.findOne({ _id: new ObjectId(req.params.id) });
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  } catch (error) {
    res.status(404).json({ message: "Event not found" });
  }
});


app.post("/events", verifyToken, async (req, res) => {
  const { title, description, eventType, thumbnail, location, eventDate } = req.body;
  if (!title || !description || !eventType || !thumbnail || !location || !eventDate) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (eventDate <= today()) {
    return res.status(400).json({ message: "Event date must be in the future" });
  }
  const newEvent = {
    title, description, eventType, thumbnail, location, eventDate,
    createdBy: req.user.email,
    creatorName: req.user.name,
    createdAt: new Date(),
  };
  const result = await events.insertOne(newEvent);
  res.status(201).json(result);
});

app.get("/my-events", verifyToken, async (req, res) => {
  const result = await events
    .find({ createdBy: req.user.email })
    .sort({ eventDate: 1 })
    .toArray();
  res.json(result);
});

app.put("/events/:id", verifyToken, async (req, res) => {
  const { title, description, eventType, thumbnail, location, eventDate } = req.body;
  if (eventDate <= today()) {
    return res.status(400).json({ message: "Event date must be in the future" });
  }
  const result = await events.updateOne(
    { _id: new ObjectId(req.params.id), createdBy: req.user.email },
    { $set: { title, description, eventType, thumbnail, location, eventDate } }
  );
  if (result.matchedCount === 0) {
    return res.status(403).json({ message: "You can only update your own events" });
  }
  res.json({ message: "Event updated" });
});

app.delete("/events/:id", verifyToken, async (req, res) => {
  const result = await events.deleteOne({
    _id: new ObjectId(req.params.id),
    createdBy: req.user.email, 
  });
  if (result.deletedCount === 0) {
    return res.status(403).json({ message: "You can only delete your own events" });
  }
  res.json({ message: "Event deleted" });
});

app.post("/join", verifyToken, async (req, res) => {
  const { eventId } = req.body;
  const event = await events.findOne({ _id: new ObjectId(eventId) });
  if (!event) return res.status(404).json({ message: "Event not found" });

  const already = await joined.findOne({ eventId, userEmail: req.user.email });
  if (already) return res.status(400).json({ message: "You already joined this event" });

  await joined.insertOne({
    eventId,
    userEmail: req.user.email,
    userName: req.user.name,
    title: event.title,
    thumbnail: event.thumbnail,
    location: event.location,
    eventType: event.eventType,
    eventDate: event.eventDate,
    joinedAt: new Date(),
  });
  res.status(201).json({ message: "Joined successfully" });
});

app.get("/joined", verifyToken, async (req, res) => {
  const result = await joined
    .find({ userEmail: req.user.email })
    .sort({ eventDate: 1 })
    .toArray();
  res.json(result);
});

app.listen(process.env.PORT || 5000, () => console.log("Server running"));