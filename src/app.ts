import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";

import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";

const app: Application = express();

// ============================================
// CORS
// ============================================
app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// ============================================
// Body Parser
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// Cookie Parser
// ============================================
app.use(cookieParser());

// ============================================
// Routes
// ============================================
app.use("/api/v1/auth", AuthRoutes);

// ============================================
// Basic Test Route
// ============================================
app.get("/", (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to PH Healthcare System Backend",
	});
});

// ============================================
// Not Found
// ============================================
app.use(notFound);

// ============================================
// Global Error Handler
// ============================================
app.use(globalErrorHandler);

export default app;