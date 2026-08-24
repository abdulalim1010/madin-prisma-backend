import { Router } from "express";
import { DoctorAsApplyController } from "./doctor.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.post(
  "/apply-as-doctor",

  upload.fields([
    {
      name: "resume",
      maxCount: 1,
    },
    {
      name: "additionalFiles",
      maxCount: 2,
    },
  ]),

  DoctorAsApplyController.applyAsDoctor,
);

export const DoctorRoutes = router;