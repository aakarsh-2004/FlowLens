import express from "express";
import { config } from "./config/config";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(config.port, () => {
  console.log(`${new Date()}: Server is started successfully on port ${config.port}`);
});