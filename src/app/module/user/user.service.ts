import { cloudinary } from "../../lib/cloudinary";
import { prisma } from "../../lib/prisma";
import { UploadApiResponse } from "cloudinary";

const uploadProfileImage = async (
  buffer: Buffer,
  userId: string,
) => {
  // Cloudinary upload
  const cloudinaryResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "auto",
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

  // Update user in database
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