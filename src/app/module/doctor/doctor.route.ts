import { Router } from "express";
import { DoctorAsApplyController } from "./doctor.controller";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";

const router = Router();

router.post(
  "/apply-as-doctor",
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "additionalFiles", maxCount: 2 },
  ]),
  DoctorAsApplyController.applyAsDoctor,
);

router.post(
  "/verify-doctor-email",
  DoctorAsApplyController.verifyDoctorEmail,
);

router.patch(
  "/:doctorId/approve",
  auth("ADMIN", "SUPER_ADMIN"),
  DoctorAsApplyController.approveDoctor,
);

router.patch(
  "/:doctorId/reject",
  auth("ADMIN", "SUPER_ADMIN"),
  DoctorAsApplyController.rejectDoctor,
);

export const DoctorRoutes = router;