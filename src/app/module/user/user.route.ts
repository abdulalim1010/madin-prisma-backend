import { Router } from "express";

import { upload } from "../../lib/multer";
import { userController } from "./user.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";



const router = Router();



router.patch("/profile-image",
    auth(Role.PATIENT,Role.ADMIN,Role.DOCTOR,Role.PATIENT),
    upload.single("profile-image") 
 , userController.uploadProfileImage,
);

export const UserRoutes = router;
