import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	NextFunction,
	type Application,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";

import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { UserRoutes } from "./app/module/user/user.route";
import { HttpStatus } from "http-status";
import { getBkashIdToken } from "./app/lib/bkash";

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
app.use("/api/v1/user", UserRoutes);

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


//test route
app.get("/test",async(req:Request,res:Response,next:NextFunction)=>{
	try {

		const grantIdTokenResult=await getBkashIdToken()
		console.log(grantIdTokenResult)



		res.status(httpStatus.OK).json({
			success:true,
			message:"welcome to the paymetn route",
			data:null
		});
		
	} catch (error) {
		console.log(error)
		next(error)
		
	}
})
// Not Found
// ============================================
app.use(notFound);

// ============================================
// Global Error Handler
// ============================================
app.use(globalErrorHandler);

export default app;