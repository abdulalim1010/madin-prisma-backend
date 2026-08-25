import { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
  if (!req.body?.data) {
    throw new Error(
      "data field is missing. Please send doctor information using form-data.",
    );
  }

  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  const resume = files?.["resume"]?.[0] || null;
  const additionalFiles = files?.["additionalFiles"] || [];

  const data = JSON.parse(req.body.data);

  const result = await DoctorServices.applyAsDoctor(
    data,
    resume,
    additionalFiles,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message:
      "OTP sent to your email. Verify your email to submit the doctor application.",
    data: result,
  });
});

const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {
  const result = await DoctorServices.verifyDoctorEmail(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message:
      "Email verified. Doctor application created with PENDING status and is waiting for admin review.",
    data: result,
  });
});

const approveDoctor = catchAsync(async (req: Request, res: Response) => {
  const { doctorId } = req.params;

  if (!doctorId || Array.isArray(doctorId)) {
    throw new Error("Invalid doctorId parameter");
  }

  if (!req.user) {
    throw new Error(
      "You are not logged in. Please log in to access this resource.",
    );
  }

  const adminId = req.user.userId;

  const result = await DoctorServices.approveDoctor(doctorId, adminId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor approved successfully",
    data: result,
  });
});

const rejectDoctor = catchAsync(async (req: Request, res: Response) => {
  const { doctorId } = req.params;

  if (!doctorId || Array.isArray(doctorId)) {
    throw new Error("Invalid doctorId parameter");
  }

  if (!req.user) {
    throw new Error(
      "You are not logged in. Please log in to access this resource.",
    );
  }

  const adminId = req.user.userId;
  const { rejectionReson } = req.body;

  const result = await DoctorServices.rejectDoctor(
    doctorId,
    adminId,
    rejectionReson,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor rejected successfully",
    data: result,
  });
});

export const DoctorAsApplyController = {
  applyAsDoctor,
  verifyDoctorEmail,
  approveDoctor,
  rejectDoctor,
};