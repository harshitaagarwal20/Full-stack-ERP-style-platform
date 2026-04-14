import dotenv from "dotenv";

dotenv.config();

const env = {
  port: process.env.PORT || 5000,
  dbUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "30d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5174,http://127.0.0.1:5174"
};

export default env;
