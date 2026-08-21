import { catchAsync } from "../../utils/catchAsync";
import httpStatus from "http-status"
import { sendResponse } from "../../utils/sendResponse";
import { Request, Response } from "express";
import { AppointmentServices } from "./appointment.service";
const bookAppointment = catchAsync(
  async (req: Request, res: Response) => {

    const result =
      await AppointmentServices.bookAppointment(
        req.body,
        req.user,
      );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payment created successfully",
      data: result,
    });
  },
);
const bookAppointmentCallback = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await AppointmentServices.bookAppointmentCallback(req.query);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Payment callback processed successfully",
      data: result,
    });
  },
);
export const AppointmentController={
    bookAppointment,
    bookAppointmentCallback
}