import bcrypt from "bcryptjs";
import { UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import ejs from "ejs";
import path from "path";

import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";

import {
  IApplyAsDoctorPayload,
  IGetAllDoctorsQuery,
  IVerifyDoctorEmailPayload,
} from "./doctor.interface";
import { Prisma } from "../../../generated/prisma/client";

const OTP_EXPIRATION_SECONDS = 60 * 10; // 10 minutes

const buildOtpKey = (email: string) => `doctor:otp:${email}`;

// ==========================================================
// APPLY AS DOCTOR
// ==========================================================

const applyAsDoctor = async (
  payload: IApplyAsDoctorPayload,
  resume: Express.Multer.File | null,
  additionalFiles: Express.Multer.File[],
) => {
  // ========================================================
  // 1. Validate Resume
  // ========================================================
  if (!resume) {
    throw new Error("Resume file is required");
  }

  // ========================================================
  // 2. Check Existing User
  // ========================================================
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.user.email },
  });

  if (existingUser) {
    throw new Error("A user already exists with this email");
  }

  // ========================================================
  // 3. Hash Password
  // ========================================================
  const hashedPassword = await bcrypt.hash(
    payload.user.password,
    Number(config.bcrypt_salt_rounds),
  );

  // ========================================================
  // 4. Upload Resume to Cloudinary
  // ========================================================
  let resumeUploadResult: UploadApiResponse;
  try {
    resumeUploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { resource_type: "auto", folder: "doctor/resumes" },
            (error, result) => {
              if (error) return reject(error);
              if (!result)
                return reject(new Error("Resume upload failed"));
              resolve(result);
            },
          )
          .end(resume.buffer);
      },
    );
  } catch (error) {
    throw new Error("Failed to upload resume. Please try again.");
  }

  // ========================================================
  // 5. Upload Additional Files
  // ========================================================
  let additionalFilesUpload: UploadApiResponse[] = [];
  try {
    additionalFilesUpload = await Promise.all(
      additionalFiles.map((file) => {
        return new Promise<UploadApiResponse>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              { resource_type: "auto", folder: "doctor/additional-files" },
              (error, result) => {
                if (error) return reject(error);
                if (!result)
                  return reject(
                    new Error("Additional file upload failed"),
                  );
                resolve(result);
              },
            )
            .end(file.buffer);
        });
      }),
    );
  } catch (error) {
    throw new Error("Failed to upload additional files. Please try again.");
  }

  // ========================================================
  // 6. Create User + Doctor Together (Prisma nested write)
  // ========================================================
let doctorApplication: DoctorApplicationResult;
  try {
    doctorApplication = await prisma.user.create({
      data: {
        name: payload.user.name,
        email: payload.user.email,
        password: hashedPassword,
        role: "DOCTOR",
        authProvider: "CREDENTIAL",
        status: "ACTIVE",
        emailVerified: false,
        needPasswordChange: true,

        doctor: {
          create: {
            name: payload.doctor.name,
            email: payload.doctor.email,
            adress: payload.doctor.adress,
            specilization: payload.doctor.specilization,
            licenceNumber: payload.doctor.licenceNumber,
            qulaification: payload.doctor.qulaification,
            experienceYears: Number(payload.doctor.experienceYears),
            bio: payload.doctor.bio,
            consultatinFee: payload.doctor.consultatinFee
              ? new Prisma.Decimal(payload.doctor.consultatinFee)
              : undefined,
            contactNumber: payload.doctor.contactNumber,

            verificationstatus: "PENDING",

            resume: resumeUploadResult.secure_url,
            resumePublicId: resumeUploadResult.public_id,

            additionalFiles: additionalFilesUpload.map((file) => ({
              url: file.secure_url,
              publicId: file.public_id,
            })),
          },
        },
      },
      include: { doctor: true },
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

  // ========================================================
  // 7. Generate OTP
  // ========================================================
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpKey = buildOtpKey(payload.user.email);

  // ========================================================
  // 8. Store ONLY the OTP in Redis
  // ========================================================
  await redisClient.set(otpKey, otp, {
    expiration: { type: "EX", value: OTP_EXPIRATION_SECONDS },
  });

  console.log("Doctor OTP:", otp);

  // ========================================================
  // 9. Render EJS Email Template & Send
  // ========================================================
  const templatePath = path.join(
    process.cwd(),
    "src/app/templets/verify-doctor-email.ejs",
  );

  try {
    const emailHtml = await ejs.renderFile(templatePath, {
      name: payload.user.name,
      otp,
      expiresInMinutes: 10,
    });

    await transporter.sendMail({
      from: `"PH Madin Healthcare" <${config.smtp_user}>`,
      to: payload.user.email,
      subject: "Verify Your Doctor Account - PH Madin Healthcare",
      html: emailHtml,
    });
  } catch (error) {
    // User + Doctor already exist in DB — don't fail the whole request,
    // just let them know the email didn't go out.
    console.error("Failed to send OTP email:", error);
    throw new Error(
      "Application created, but failed to send verification email. Please contact support or request a new OTP.",
    );
  }

  console.log(`Doctor verification OTP sent to ${payload.user.email}`);

  // ========================================================
  // 10. Return Safe Response
  // ========================================================
  const { password, ...userWithoutPassword } = doctorApplication;

  return userWithoutPassword;
};

// ==========================================================
// VERIFY DOCTOR EMAIL (only updates emailVerified)
// ==========================================================

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
  const { email, otp } = payload;

  // ========================================================
  // 1. Find User
  // ========================================================
  const user = await prisma.user.findUnique({
    where: { email },
    include: { doctor: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // ========================================================
  // 2. Ensure User Is a Doctor
  // ========================================================
  if (user.role !== "DOCTOR" || !user.doctor) {
    throw new Error("This account is not a doctor account");
  }

  // ========================================================
  // 3. Check Already Verified
  // ========================================================
  if (user.emailVerified) {
    throw new Error("Email is already verified");
  }

  // ========================================================
  // 4. Get OTP From Redis
  // ========================================================
  const otpKey = buildOtpKey(email);
  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp) {
    throw new Error("OTP expired or does not exist. Please request a new one.");
  }

  // ========================================================
  // 5. Compare OTP
  // ========================================================
  if (storedOtp !== otp) {
    throw new Error("Invalid OTP");
  }

  // ========================================================
  // 6. Update ONLY emailVerified
  // ========================================================
  const updatedUser = await prisma.user.update({
    where: { email },
    data: { emailVerified: true },
    include: { doctor: true },
  });

  // ========================================================
  // 7. Delete OTP From Redis
  // ========================================================
  await redisClient.del(otpKey);

  // ========================================================
  // 8. Return Safe Response
  // ========================================================
  const { password, ...userWithoutPassword } = updatedUser;

  return userWithoutPassword;
};

// ==========================================================
// APPROVE DOCTOR (Admin action)
// ==========================================================

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
    const templatePath = path.join(
      process.cwd(),
      "src/app/templets/doctor-approved.ejs",
    );

    const emailHtml = await ejs.renderFile(templatePath, {
      name: updatedDoctor.user.name,
    });

    await transporter.sendMail({
      from: `"PH Madin Healthcare" <${config.smtp_user}>`,
      to: updatedDoctor.user.email,
      subject: "Your Doctor Application Has Been Approved",
      html: emailHtml,
    });
  } catch (error) {
    console.error("Failed to send approval email:", error);
  }

  const { password, ...userWithoutPassword } = updatedDoctor.user;

  return { ...updatedDoctor, user: userWithoutPassword };
};

// ==========================================================
// REJECT DOCTOR (Admin action)
// ==========================================================

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
    const templatePath = path.join(
      process.cwd(),
      "src/app/templets/doctor-rejected.ejs",
    );

    const emailHtml = await ejs.renderFile(templatePath, {
      name: updatedDoctor.user.name,
      reason: updatedDoctor.rejectionReson,
    });

    await transporter.sendMail({
      from: `"PH Madin Healthcare" <${config.smtp_user}>`,
      to: updatedDoctor.user.email,
      subject: "Update on Your Doctor Application",
      html: emailHtml,
    });
  } catch (error) {
    console.error("Failed to send rejection email:", error);
  }

  const { password, ...userWithoutPassword } = updatedDoctor.user;

  return { ...updatedDoctor, user: userWithoutPassword };
};

// ==========================================================
// EXPORT
// ==========================================================
// sorting 




const getAllDoctors = async (
  query: IGetAllDoctorsQuery,
) => {
  // ==========================================
  // 1. Query Parameters
  // ==========================================

  const search = query.search || "";

  const specialization = query.specialization;

  const minExperience = query.minExperience
    ? Number(query.minExperience)
    : undefined;

  const maxExperience = query.maxExperience
    ? Number(query.maxExperience)
    : undefined;

  const page = query.page
    ? Number(query.page)
    : 1;

  const limit = query.limit
    ? Number(query.limit)
    : 10;

  const skip = (page - 1) * limit;

  const sortBy = query.sortBy || "createdAt";

  const sortOrder =
    query.sortOrder === "asc"
      ? "asc"
      : "desc";

  // ==========================================
  // 2. Search + Filter
  // ==========================================

  const andConditions: Prisma.DoctorWhereInput[] = [];

  // Search
  if (search) {
    andConditions.push({
      OR: [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          specilization: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          licenceNumber: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  // Specialization filter
  if (specialization) {
    andConditions.push({
      specilization: {
        equals: specialization,
        mode: "insensitive",
      },
    });
  }

  // Minimum experience
  if (minExperience !== undefined) {
    andConditions.push({
      experienceYears: {
        gte: minExperience,
      },
    });
  }

  // Maximum experience
  if (maxExperience !== undefined) {
    andConditions.push({
      experienceYears: {
        lte: maxExperience,
      },
    });
  }

  // Only active/non-deleted doctors
  andConditions.push({
    isDeleted: false,
  });

  // ==========================================
  // 3. Where Condition
  // ==========================================

  const whereCondition: Prisma.DoctorWhereInput =
    andConditions.length > 0
      ? {
          AND: andConditions,
        }
      : {};

  // ==========================================
  // 4. Sorting
  // ==========================================

  const allowedSortFields = [
    "name",
    "experienceYears",
    "consultatinFee",
    "createdAt",
  ];

  const finalSortBy =
    allowedSortFields.includes(sortBy)
      ? sortBy
      : "createdAt";

  // ==========================================
  // 5. Get Doctors + Total Count
  // ==========================================

  const [doctors, total] =
    await Promise.all([
      prisma.doctor.findMany({
        where: whereCondition,

        skip,

        take: limit,

        orderBy: {
          [finalSortBy]: sortOrder,
        },

        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              imageUrl: true,
              emailVerified: true,
            },
          },
        },
      }),

      prisma.doctor.count({
        where: whereCondition,
      }),
    ]);

  // ==========================================
  // 6. Pagination Meta
  // ==========================================

  const totalPage = Math.ceil(
    total / limit,
  );

  return {
    doctors,

    meta: {
      page,
      limit,
      total,
      totalPage,
    },
  };
};





export const DoctorServices = {
  applyAsDoctor,
  verifyDoctorEmail,
  approveDoctor,
  rejectDoctor,
  getAllDoctors
};