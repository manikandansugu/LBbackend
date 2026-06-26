import express from "express";
import userRoutes from "./routes/user.routes";
import messageRoutes from "./routes/message.routes";
import streamRoutes from "./routes/stream.routes";
import callRoutes from "./routes/call.routes";
import Call from "./models/call.model";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { createServer } from "http";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { configureSocket } from "./socket";
import cors from "cors";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/calls", callRoutes);
app.get("/api/status", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running successfully port 3000",
    data: {
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      uptimeSeconds: Math.floor(process.uptime()),
    },
  });
});
app.use(notFoundHandler);
app.use(errorHandler);
configureSocket(server);

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined");
    }

    const connect = await mongoose.connect(process.env.MONGO_URI as string);
    if (Number(connect.connection.readyState === 1)) {
      await Call.collection.dropIndex("callId_1").catch(() => undefined);
      server.listen(PORT, Number("0.0.0.0"), () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exit(1);
  }
};
connectDB();

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});
