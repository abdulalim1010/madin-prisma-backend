import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";
import httpStatus from "http-status";

const applyAsDoctor = catchAsync(
  async (req: Request, res: Response) => {

    console.log("========== DOCTOR APPLICATION ==========");
    console.log("BODY:", req.body);
    console.log("DATA:", req.body?.data);
    console.log("FILES:", req.files);
    console.log("========================================");

    if (!req.body?.data) {
      throw new Error(
        "data field is missing. Please send doctor information using form-data."
      );
    }

    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const resume =
      files?.["resume"]?.[0] || null;

    const additionalFiles =
      files?.["additionalFiles"] || [];

    const data = JSON.parse(req.body.data);

    console.log("Parsed Data:", data);
    console.log("Resume:", resume);
    console.log("Additional Files:", additionalFiles);

    const result =
      await DoctorServices.applyAsDoctor(
        data,
        resume,
        additionalFiles,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Apply as doctor successfully",
      data: result,
    });
  },
);

export const DoctorAsApplyController = {
  applyAsDoctor,
};