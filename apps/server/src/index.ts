import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import authRoutes from "./routes/auth";
import hostelRoutes from "./routes/hostels";
import bookingRoutes from "./routes/bookings";
import paymentRoutes from "./routes/payments";
import adminRoutes from "./routes/admin";
import ratingRoutes from "./routes/ratings";
import issueRoutes from "./routes/issues";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "freizy-stays-api", env: env.nodeEnv }));
app.use("/api/auth", authRoutes);
app.use("/api/hostels", hostelRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/issues", issueRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => console.log(`[freizy-stays-api] listening on :${env.port}`));
