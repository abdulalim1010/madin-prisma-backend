import { NextFunction, Request, Response, Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { authErrorValidation } from "./auth.erorValidation";
import { catchAsync } from "../../utils/catchAsync";
import z from "zod";
import { validRequest } from "./auth.validetRequest";



const router = Router();












router.post("/register",
	validRequest.validReqeust(authErrorValidation.patientRegisterZodSchema),
	AuthController.registerPatient
);
router.post("/verify-email",
  validRequest.validReqeust(authErrorValidation.patientEmailverifieydZodSchema),AuthController.verifyPatientEmail
)










router.post(
  "/login",
  (req: Request, res: Response, next: NextFunction) => {
    const result = authErrorValidation.loginZodSchema.safeParse(
      req.body ?? {},
    );

    if (!result.success) {
      const errorMessage = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return next(new Error(errorMessage));
    }   

    req.body = result.data;

    next();
  },
  AuthController.loginUser,
);


router.get(
	"/me",
	auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
	AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);

router.post("/google", AuthController.googleLogin);
router.post(
  "/forget-password",
  validRequest.validReqeust(
    authErrorValidation.forgetPasswordZodschema
  ),
  AuthController.forgetPassword,
);
router.post("/reset-password",
  validRequest.validReqeust(authErrorValidation.ResetPasswordzodschema)
   ,AuthController.resetPassword);
export const AuthRoutes = router;
