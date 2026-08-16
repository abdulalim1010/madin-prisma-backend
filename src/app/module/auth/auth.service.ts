import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
	AuthProvider,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";


import ejs from "ejs"

import crypto from "crypto"
import type {
	IfogetPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPasswordPayload,
	IverifyEmailPayload,
} from "./auth.interface";
import {  TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleAuth";
import { redisClient } from "../../lib/redis";
import { RedisClient } from "redis";
import { transporter } from "../../lib/nodemailer";
import path from "path";
import { ota } from "zod/locales";
import { json } from "zod";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password, patient: patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	// 1. Check existing user
	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	// 2. Hash password
	const hashedPassword = await bcrypt.hash(password, 8);

	// 3. Generate OTP
	const expirationSecond = 5 * 60;

	const otpKey = `patient-registration-otp:${email}`;

	const otpValue = crypto.randomInt(100000, 1000000).toString();

	// 4. Save OTP in Redis
	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: expirationSecond,
		},
	});

	// 5. Save temporary registration data in Redis
	const patientRegistrationKey = `patient-registration-data:${email}`;

	const redisUserDataPayload = {
		name,
		email,
		password: hashedPassword,
		patient: patientData,
	};

	await redisClient.set(
		patientRegistrationKey,
		JSON.stringify(redisUserDataPayload),
		{
			expiration: {
				type: "EX",
				value: expirationSecond,
			},
		},
	);

	// 6. Render email template
	const templatePath = path.join(
		process.cwd(),
		"src/app/templets/registration-user-otp.ejs",
	);

	const templateData = {
		name,
		email,
		otp: otpValue,
		expirationSecond: expirationSecond / 60, // 5 minutes
	};

	const html = await ejs.renderFile(templatePath, templateData);

	// 7. Send verification email
	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Email Verification",
		html,
	});

	return {
		message: "Registration OTP sent to your email",
		email,
	};
};

const verifyEmail = async (payload: IverifyEmailPayload) => {
	const email = payload.email.trim().toLowerCase();
	const otp = payload.otp;

	// ==========================================
	// 1. Get OTP from Redis
	// ==========================================

	const otpKey = `patient-registration-otp:${email}`;

	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new Error("Invalid or expired OTP");
	}

	if (redisOtp !== otp) {
		throw new Error("OTP does not match");
	}

	// ==========================================
	// 2. Get temporary registration data
	// ==========================================

	const patientRegistrationKey = `patient-registration-data:${email}`;

	const redisPatientData = await redisClient.get(
		patientRegistrationKey,
	);

	if (!redisPatientData) {
		throw new Error(
			"Registration data expired. Please register again.",
		);
	}

	const patientPayload = JSON.parse(redisPatientData) as {
		name: string;
		email: string;
		password: string;
		patient?: {
			contactNumber?: string;
		};
	};

	// ==========================================
	// 3. Double check user doesn't already exist
	// ==========================================

	const existingUser = await prisma.user.findUnique({
		where: {
			email,
		},
	});

	if (existingUser) {
		throw new Error("User with this email already exists");
	}

	// ==========================================
	// 4. Create verified user
	// ==========================================

	const createdUser = await prisma.user.create({
		data: {
			name: patientPayload.name,
			email: patientPayload.email,
			password: patientPayload.password,

			role: Role.PATIENT,
			status: UserStatus.ACTIVE,

			// IMPORTANT
			emailVerified: true,

			patient: {
				create: {
					name: patientPayload.name,
					email: patientPayload.email,
					contactNumber:
						patientPayload.patient?.contactNumber,
				},
			},
		},

		omit: {
			password: true,
		},

		include: {
			patient: true,
		},
	});

	// ==========================================
	// 5. Delete OTP + temporary registration data
	// ==========================================

	await redisClient.del([
		otpKey,
		patientRegistrationKey,
	]);

	// ==========================================


	await redisClient.del(patientRegistrationKey)
	// 6. Separate patient and user
	// ==========================================

	const { patient, ...user } = createdUser;

	// ==========================================
	// 7. Create JWT payload
	// ==========================================

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	// ==========================================
	// 8. Create access token
	// ==========================================

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// ==========================================
	// 9. Create refresh token
	// ==========================================

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		patient,
		accessToken,
		refreshToken,
	};
};



const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	if (user.password === null && user.googleId !== null) {
		throw new Error("Please login with Google");
	}
	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	return isUserExists;
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new Error("User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
	let googleIdTokenPayload: TokenPayload | undefined;

	// 1. Verify Google ID Token
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: payload.idToken,
			audience: config.google_client_id,
		});

		googleIdTokenPayload = ticket.getPayload();
	} catch (error) {
		console.error("GOOGLE VERIFICATION ERROR:", error);
		throw new Error("Invalid or expired Google Token");
	}

	// 2. Validate Google Payload
	if (!googleIdTokenPayload) {
		throw new Error("Invalid or expired Google Token");
	}

	if (!googleIdTokenPayload.sub) {
		throw new Error("Google ID not found");
	}

	if (!googleIdTokenPayload.email) {
		throw new Error("Email not found in Google account");
	}

	if (!googleIdTokenPayload.name) {
		throw new Error("Name not found in Google account");
	}

	if (googleIdTokenPayload.email_verified !== true) {
		throw new Error("Google email is not verified");
	}

	const googleId = googleIdTokenPayload.sub;
	const email = googleIdTokenPayload.email.trim().toLowerCase();

	// 3. First: Find user by Google ID
	let user = await prisma.user.findUnique({
		where: {
			googleId: googleId,
		},
	});

	// 4. Google account doesn't exist
	if (!user) {
		// Find existing user by email
		const existingUser = await prisma.user.findUnique({
			where: {
				email: email,
			},
		});

		// 5. Credential account already exists
		if (existingUser) {
			// Check status
			if (existingUser.status === UserStatus.BLOCKED) {
				throw new Error("User is blocked");
			}

			if (
				existingUser.isDeleted ||
				existingUser.status === UserStatus.DELETED
			) {
				throw new Error("User is deleted");
			}

			// Link Google account with existing account
			user = await prisma.user.update({
				where: {
					id: existingUser.id,
				},
				data: {
					googleId: googleId,
					emailVerified: true,
				},
			});
		}

		// 6. Completely new Google user
		else {
			user = await prisma.user.create({
				data: {
					name: googleIdTokenPayload.name,
					email: email,
					password: null,
					googleId: googleId,
					authProvider: AuthProvider.GOOGLE,
					emailVerified: true,
					role: Role.PATIENT,
					status: UserStatus.ACTIVE,

					patient: {
						create: {
							name: googleIdTokenPayload.name,
							email: email,
						},
					},
				},
			});
		}
	}

	// 7. Check user status
	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	// 8. Create JWT Payload
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	// 9. Create Access Token
	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	// 10. Create Refresh Token
	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};


const forgetPassword = async (payload: IfogetPasswordPayload) => {
  const { email } = payload;

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExist) {
    throw new Error("User does not exist");
  }

  if (isUserExist.status === "BLOCKED") {
    throw new Error("User is blocked");
  }

  if (!isUserExist.emailVerified) {
    throw new Error("User not verified");
  }

  if (
    isUserExist.isDeleted ||
    isUserExist.status === "DELETED"
  ) {
    throw new Error("User is deleted");
  }

  if (
    isUserExist.googleId &&
    isUserExist.authProvider === "GOOGLE"
  ) {
    throw new Error("User account is linked with Google");
  }

  // Generate OTP
  const otp = crypto.randomInt(100000, 1000000).toString();

  // Save OTP in Redis for 5 minutes
  const key = `forget-password-otp:${isUserExist.email}`;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: 5 * 60,
    },
  });

  // Render EJS template
  const templetpath = path.join(
    process.cwd(),
    "src/app/templets/forget-password.ejs",
  );

  const html = await ejs.renderFile(templetpath, {
  name: isUserExist.name,
  otp,
});

await transporter.sendMail({
  from: config.email_sender,
  to: isUserExist.email,
  subject: "Password Reset OTP - PH Madin Healthcare",
  html,
});

  // Send email
  await transporter.sendMail({
    from: config.email_sender,
    to: isUserExist.email,
    subject: "Forget Password - OTP",
    html,
  });
};
const resetPassword = async (payload: IResetPasswordPayload) => {
  const { email, otp, newPassword } = payload;

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExist) {
    throw new Error("User does not exist");
  }

  if (isUserExist.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  if (
    isUserExist.isDeleted ||
    isUserExist.status === UserStatus.DELETED
  ) {
    throw new Error("User is deleted");
  }

  if (!isUserExist.emailVerified) {
    throw new Error("User not verified");
  }

  if (
    isUserExist.googleId &&
    isUserExist.authProvider === AuthProvider.GOOGLE
  ) {
    throw new Error("Google account cannot reset password this way");
  }

  // ===============================
  // Check OTP
  // ===============================

  const key = `forget-password-otp:${isUserExist.email}`;

  const redisOtp = await redisClient.get(key);

  if (!redisOtp) {
    throw new Error("Invalid or expired OTP");
  }

  if (redisOtp !== otp) {
    throw new Error("OTP does not match");
  }

  // ===============================
  // Hash new password
  // ===============================

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(config.bcrypt_salt_rounds),
  );

  // ===============================
  // Update password
  // ===============================

  await prisma.user.update({
    where: {
      email: isUserExist.email,
    },
    data: {
      password: hashedPassword,
    },
  });

  // ===============================
  // Delete OTP
  // ===============================

  await redisClient.del(key);

  // ===============================
  // Send confirmation email
  // ===============================

  const templatePath = path.join(
    process.cwd(),
    "src/app/templets/reset-password.ejs",
  );

  const html = await ejs.renderFile(templatePath, {
    name: isUserExist.name,
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: isUserExist.email,
    subject: "Password Reset Successful",
    html,
  });

  return {
    message: "Password reset successfully",
  };
};


export const AuthService = {
	registerPatient,
	verifyEmail,
	loginUser,
	getMe,
	refreshToken,
	googleLogin,
	forgetPassword,
	resetPassword
};
