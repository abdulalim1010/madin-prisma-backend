import bcrypt from "bcryptjs";
import { UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import ejs from "ejs";
import path from "path";

import { Prisma } from "../../../generated/prisma/client";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import {
  IApplyAsDoctorPayload,
  IStoredDoctorApplication,
  IUploadedFile,
  IVerifyDoctorEmailPayload,
} from "./doctor.interface";

const OTP_EXPIRATION_SECONDS = 10 * 60;

const buildOtpKey = (email: string) => `doctor:otp:${email}`;
const buildApplicationKey = (email: string) => `doctor:application:${email}`;

const mailFrom = `"PH Madin Healthcare" <${config.email_sender || config.smtp_user}>`;

const uploadToCloudinary = (
  file: Express.Multer.File,
  folder: string,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ resource_type: "auto", folder }, (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("File upload failed"));
        resolve(result);
      })
      .end(file.buffer);
  });
};

const renderAndSendMail = async (options: {
  templateFile: string;
  templateData: Record<string, unknown>;
  to: string;
  subject: string;
}) => {
  const templatePath = path.join(
    process.cwd(),
    "src/app/templets",
    options.templateFile,
  );
  const html = await ejs.renderFile(templatePath, options.templateData);
  await transporter.sendMail({
    from: mailFrom,
    to: options.to,
    subject: options.subject,
    html,
  });
};

const applyAsDoctor = async (
  payload: IApplyAsDoctorPayload,
  resume: Express.Multer.File | null,
  additionalFiles: Express.Multer.File[],
) => {
  if (!payload?.user || !payload?.doctor) {
    throw new Error(
      "Invalid payload. Send JSON in the data field with user and doctor objects.",
    );
  }

  if (!resume) {
    throw new Error("Resume file is required");
  }

  const userEmail = payload.user.email.trim().toLowerCase();
  const doctorEmail = payload.doctor.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (existingUser) {
    throw new Error("A user already exists with this email");
  }

  const existingDoctorEmail = await prisma.doctor.findUnique({
    where: { email: doctorEmail },
  });

  if (existingDoctorEmail) {
    throw new Error("A doctor already exists with this email");
  }

  const existingLicence = await prisma.doctor.findUnique({
    where: { licenceNumber: payload.doctor.licenceNumber },
  });

  if (existingLicence) {
    throw new Error("A doctor already exists with this licence number");
  }

  const hashedPassword = await bcrypt.hash(
    payload.user.password,
    Number(config.bcrypt_salt_rounds),
  );

  let resumeUploadResult: UploadApiResponse;
  try {
    resumeUploadResult = await uploadToCloudinary(resume, "doctor/resumes");
  } catch {
    throw new Error("Failed to upload resume. Please try again.");
  }

  let additionalUploads: UploadApiResponse[] = [];
  try {
    additionalUploads = await Promise.all(
      additionalFiles.map((file) =>
        uploadToCloudinary(file, "doctor/additional-files"),
      ),
    );
  } catch {
    throw new Error("Failed to upload additional files. Please try again.");
  }

  const storedApplication: IStoredDoctorApplication = {
    user: {
      name: payload.user.name,
      email: userEmail,
      password: hashedPassword,
    },
    doctor: {
      name: payload.doctor.name,
      email: doctorEmail,
      adress: payload.doctor.adress,
      specilization: payload.doctor.specilization,
      licenceNumber: payload.doctor.licenceNumber,
      qulaification: payload.doctor.qulaification,
      experienceYears: Number(payload.doctor.experienceYears),
      bio: payload.doctor.bio,
      consultatinFee: payload.doctor.consultatinFee,
      contactNumber: payload.doctor.contactNumber,
    },
    resume: {
      url: resumeUploadResult.secure_url,
      publicId: resumeUploadResult.public_id,
    },
    additionalFiles: additionalUploads.map((file) => ({
      url: file.secure_url,
      publicId: file.public_id,
    })),
  };

  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpKey = buildOtpKey(userEmail);
  const applicationKey = buildApplicationKey(userEmail);

  await redisClient.set(otpKey, otp, {
    expiration: { type: "EX", value: OTP_EXPIRATION_SECONDS },
  });

  await redisClient.set(applicationKey, JSON.stringify(storedApplication), {
    expiration: { type: "EX", value: OTP_EXPIRATION_SECONDS },
  });

  console.log("Doctor OTP:", otp);

  try {
    await renderAndSendMail({
      templateFile: "verify-doctor-email.ejs",
      templateData: {
        name: payload.user.name,
        otp,
        expiresInMinutes: OTP_EXPIRATION_SECONDS / 60,
      },
      to: userEmail,
      subject: "Verify Your Doctor Account - PH Madin Healthcare",
    });
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    throw new Error("Failed to send verification email. Please try again.");
  }

  return {
    email: userEmail,
    message: "OTP sent to your email. Verify to submit your application.",
  };
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
  const email = payload.email.trim().toLowerCase();
  const otp = payload.otp;

  const otpKey = buildOtpKey(email);
  const applicationKey = buildApplicationKey(email);

  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp) {
    throw new Error("OTP expired or does not exist. Please apply again.");
  }

  if (storedOtp !== otp) {
    throw new Error("Invalid OTP");
  }

  const storedApplicationRaw = await redisClient.get(applicationKey);

  if (!storedApplicationRaw) {
    throw new Error("Application data expired. Please apply again.");
  }

  const storedApplication = JSON.parse(
    storedApplicationRaw,
  ) as IStoredDoctorApplication;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("A user already exists with this email");
  }

  let createdUser;
  try {
    createdUser = await prisma.user.create({
      data: {
        name: storedApplication.user.name,
        email: storedApplication.user.email,
        password: storedApplication.user.password,
        role: "DOCTOR",
        authProvider: "CREDENTIAL",
        status: "ACTIVE",
        emailVerified: true,
        needPasswordChange: false,
        doctor: {
          create: {
            name: storedApplication.doctor.name,
            email: storedApplication.doctor.email,
            adress: storedApplication.doctor.adress,
            specilization: storedApplication.doctor.specilization,
            licenceNumber: storedApplication.doctor.licenceNumber,
            qulaification: storedApplication.doctor.qulaification,
            experienceYears: Number(storedApplication.doctor.experienceYears),
            bio: storedApplication.doctor.bio,
            consultatinFee: storedApplication.doctor.consultatinFee
              ? new Prisma.Decimal(storedApplication.doctor.consultatinFee)
              : undefined,
            contactNumber: storedApplication.doctor.contactNumber,
            verificationstatus: "PENDING",
            resume: storedApplication.resume.url,
            resumePublicId: storedApplication.resume.publicId,
            additionalFiles: storedApplication.additionalFiles as IUploadedFile[],
          },
        },
      },
      include: { doctor: true },
      omit: { password: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[])?.join(", ");
      throw new Error(
        `A record with this ${target || "field"} already exists`,
      );
    }
    throw error;
  }

  await redisClient.del([otpKey, applicationKey]);

  try {
    await renderAndSendMail({
      templateFile: "welcome-doctor.ejs",
      templateData: {
        name: createdUser.name,
        email: createdUser.email,
      },
      to: createdUser.email,
      subject: "Application Received - Pending Admin Review",
    });
  } catch (error) {
    console.error("Failed to send doctor welcome email:", error);
  }

  return createdUser;
};

const approveDoctor = async (doctorId: string, adminId: string) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!doctor || doctor.isDeleted) {
    throw new Error("Doctor not found");
  }

  if (!doctor.user.emailVerified) {
    throw new Error("Doctor has not verified their email yet");
  }

  if (doctor.verificationstatus === "APPROVED") {
    throw new Error("Doctor is already approved");
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationstatus: "APPROVED",
      rejectionReson: null,
      revewBy: adminId,
      revewedAt: new Date(),
    },
    include: { user: true },
  });

  try {
    await renderAndSendMail({
      templateFile: "doctor-approved.ejs",
      templateData: {
        name: updatedDoctor.user.name,
        loginUrl: `${config.frontend_url}/login`,
      },
      to: updatedDoctor.user.email,
      subject: "Your Doctor Application Has Been Approved",
    });
  } catch (error) {
    console.error("Failed to send approval email:", error);
  }

  const { password: _password, ...userWithoutPassword } = updatedDoctor.user;

  return { ...updatedDoctor, user: userWithoutPassword };
};

const rejectDoctor = async (
  doctorId: string,
  adminId: string,
  rejectionReson?: string,
) => {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!doctor || doctor.isDeleted) {
    throw new Error("Doctor not found");
  }

  if (!doctor.user.emailVerified) {
    throw new Error("Doctor has not verified their email yet");
  }

  if (doctor.verificationstatus === "REJECTED") {
    throw new Error("Doctor is already rejected");
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationstatus: "REJECTED",
      rejectionReson: rejectionReson ?? "Not specified",
      revewBy: adminId,
      revewedAt: new Date(),
    },
    include: { user: true },
  });

  try {
    await renderAndSendMail({
      templateFile: "doctor-rejected.ejs",
      templateData: {
        name: updatedDoctor.user.name,
        reason: updatedDoctor.rejectionReson,
      },
      to: updatedDoctor.user.email,
      subject: "Update on Your Doctor Application",
    });
  } catch (error) {
    console.error("Failed to send rejection email:", error);
  }

  const { password: _password, ...userWithoutPassword } = updatedDoctor.user;

  return { ...updatedDoctor, user: userWithoutPassword };
};

export const DoctorServices = {
  applyAsDoctor,
  verifyDoctorEmail,
  approveDoctor,
  rejectDoctor,
};
