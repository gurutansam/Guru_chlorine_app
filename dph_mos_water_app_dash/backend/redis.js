import dotenv from "dotenv";
dotenv.config();

import { createClient } from "redis";

console.log({
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_DB: process.env.REDIS_DB,
});

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT, 10),
  },
  password: process.env.REDIS_PASSWORD || undefined,
  database: parseInt(process.env.REDIS_DB || "0", 10),
});

redisClient.on("connect", () => {
  console.log("? Redis Connected");
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

await redisClient.connect();

export default redisClient;