import { DoctorsVerificationStatus } from "../../../generated/prisma/enums";


export interface IApplyAsDoctorPayload {
  user: {
    name: string;
    email: string;
    password: string;
  };

  doctor: {
    name: string;
    email: string;
    adress?: string;
    specilization: string;
    licenceNumber: string;
    qulaification: string;
    experienceYears: number;
    bio?: string;
    consultatinFee?: string | number;
    contactNumber?: string;
  };
}

export interface IVerifyDoctorEmailPayload {
  email: string;
  otp: string;
}

export interface IUploadedFile {
  url: string;
  publicId: string;
}

export interface IStoredDoctorApplication {
  user: {
    name: string;
    email: string;
    password: string;
  };
  doctor: IApplyAsDoctorPayload["doctor"];
  resume: IUploadedFile;
  additionalFiles: IUploadedFile[];
}

export interface IRejectDoctorPayload {
  rejectionReson?: string;
}

// Used only internally for typing safe responses
export interface ISafeDoctorWithUser {
  id: string;
  name: string;
  email: string;
  verificationstatus: DoctorsVerificationStatus;
  [key: string]: unknown;
}