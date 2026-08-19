import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { UploadApiResponse } from "cloudinary";

const uploadProfileImage = async (
  buffer: Buffer,
  userId: string,
) => {
  // ==========================================
  // 1. Get existing user's imagePublicId
  // ==========================================

  const existingUser = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      imagePublicId: true,
    },
  });

  if (!existingUser) {
    throw new Error("User not found");
  }

  // ==========================================
  // 2. Upload new image to Cloudinary
  // ==========================================

  const cloudinaryResult =
    await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: "image",
            },
            (error, result) => {
              if (error) {
                return reject(error);
              }

              if (!result) {
                return reject(
                  new Error("Cloudinary upload failed"),
                );
              }

              resolve(result);
            },
          )
          .end(buffer);
      },
    );

  // ==========================================
  // 3. Delete old image from Cloudinary
  // ==========================================

  if (existingUser.imagePublicId) {
    try {
      await cloudinary.uploader.destroy(
        existingUser.imagePublicId,
        {
          resource_type: "image",
        },
      );
    } catch (error) {
      console.error(
        "Failed to delete old profile image:",
        error,
      );
    }
  }

  // ==========================================
  // 4. Update new image info in database
  // ==========================================

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      imageUrl: cloudinaryResult.secure_url,
      imagePublicId: cloudinaryResult.public_id,
    },
    omit: {
      password: true,
    },
  });

  return updatedUser;
};

export const UserSerivces = {
  uploadProfileImage,
};