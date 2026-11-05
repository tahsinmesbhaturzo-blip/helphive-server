import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get("/", (req, res) => res.send("HelpHive server is running"));

app.listen(process.env.PORT || 5000, () => console.log("Server running"));