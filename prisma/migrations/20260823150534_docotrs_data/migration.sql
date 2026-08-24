-- CreateEnum
CREATE TYPE "DoctorsVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Doctors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "adress" TEXT,
    "specilization" TEXT NOT NULL,
    "licenceNumber" TEXT NOT NULL,
    "qulaification" TEXT NOT NULL,
    "experienceYears" INTEGER NOT NULL,
    "bio" TEXT,
    "consultatinFee" DECIMAL(10,2),
    "contactNumber" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "verificationstatus" "DoctorsVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReson" TEXT,
    "revewBy" TEXT,
    "resume" TEXT,
    "revewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Doctors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Doctors_email_key" ON "Doctors"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Doctors_licenceNumber_key" ON "Doctors"("licenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Doctors_userId_key" ON "Doctors"("userId");

-- CreateIndex
CREATE INDEX "idx_doctor_email" ON "Doctors"("email");

-- AddForeignKey
ALTER TABLE "Doctors" ADD CONSTRAINT "Doctors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
