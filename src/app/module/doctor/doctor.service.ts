import bcrypt from "bcryptjs";
import { UploadApiResponse } from "cloudinary";

import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";

const applyAsDoctor = async (
  payload: any,
  resume: Express.Multer.File | null,
  additionalFiles: Express.Multer.File[],
) => {
  // ==========================================
  // 1. Check required files
  // ==========================================

  if (!resume) {
    throw new Error("Resume file is required");
  }

  // ==========================================
  // 2. Check existing user
  // ==========================================

  const existingUser = await prisma.user.findUnique({
    where: {
      email: payload.user.email,
    },
  });

  if (existingUser) {
    throw new Error("User already exists with this email");
  }

  // ==========================================
  // 3. Hash password
  // ==========================================

  const hashedPassword = await bcrypt.hash(
    payload.user.password,
    Number(config.bcrypt_salt_rounds),
  );

  // ==========================================
  // 4. Upload Resume
  // ==========================================

  const resumeUploadResult =
    await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: "auto",
              folder: "doctor/resumes",
            },
            (error, result) => {
              if (error) {
                return reject(error);
              }

              if (!result) {
                return reject(
                  new Error("Resume upload failed"),
                );
              }

              resolve(result);
            },
          )
          .end(resume.buffer);
      },
    );

  // ==========================================
  // 5. Upload Additional Files
  // ==========================================

  const additionalFilesUpload =
    await Promise.all(
      additionalFiles.map((file) => {
        return new Promise<UploadApiResponse>(
          (resolve, reject) => {
            cloudinary.uploader
              .upload_stream(
                {
                  resource_type: "auto",
                  folder: "doctor/additional-files",
                },
                (error, result) => {
                  if (error) {
                    return reject(error);
                  }

                  if (!result) {
                    return reject(
                      new Error(
                        "Additional file upload failed",
                      ),
                    );
                  }

                  resolve(result);
                },
              )
              .end(file.buffer);
          },
        );
      }),
    );

  // ==========================================
  // 6. Create User + Doctor
  // ==========================================

  const doctorApplication =
    await prisma.user.create({
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

            specilization:
              payload.doctor.specilization,

            licenceNumber:
              payload.doctor.licenceNumber,

            qulaification:
              payload.doctor.qulaification,

            experienceYears:
              Number(
                payload.doctor.experienceYears,
              ),

            bio: payload.doctor.bio,

            consultatinFee:
              payload.doctor.consultatinFee,

            contactNumber:
              payload.doctor.contactNumber,

            resume:
              resumeUploadResult.secure_url,

            resumePublicId:
              resumeUploadResult.public_id,

            additionalFiles:
              additionalFilesUpload.map(
                (file) => ({
                  url: file.secure_url,
                  publicId: file.public_id,
                }),
              ),
          },
        },
      },

      include: {
        doctor: true,
      },
    });

  // ==========================================
  // 7. Remove password from response
  // ==========================================

  const { password, ...userWithoutPassword } =
    doctorApplication;

  return userWithoutPassword;
};

export const DoctorServices = {
  applyAsDoctor,
};