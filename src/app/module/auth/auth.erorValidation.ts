import z from "zod";

const patientEmailverifieydZodSchema = z.object({
 
  email: z
    .string("Email must be a string")
    .email("Please provide a valid email address"),
otp:z.string().length(6)

    
});
const patientRegisterZodSchema = z.object({
  name: z
    .string("Name must be a string")
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name cannot exceed 50 characters"),

  email: z
    .string("Email must be a string")
    .email("Please provide a valid email address"),

  password: z
    .string("Password must be a string")
    .min(8, "Password must be at least 8 characters long")
    .max(32, "Password cannot exceed 32 characters")
    .regex(
      /[A-Z]/,
      "Password must contain at least one uppercase letter",
    )
    .regex(
      /[a-z]/,
      "Password must contain at least one lowercase letter",
    )
    .regex(
      /[0-9]/,
      "Password must contain at least one number",
    )
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),

  patient: z
    .object({
      contactNumber: z.string().optional(),
    })
    .optional(),
});


// ===============================
// Login Validation
// ===============================

const loginZodSchema = z.object({
  email: z
    .string("Email must be a string")
    .email("Please provide a valid email address"),

  password: z
    .string("Password must be a string")
    .min(1, "Password is required"),
});

const forgetPasswordZodschema=z.object({


  email: z
    .string("Email must be a string")
    .email("Please provide a valid email address"),


});



const ResetPasswordzodschema = z.object({
  email: z
    .string("Email must be a string")
    .email("Please provide a valid email address"),

  newPassword: z
    .string("Password must be a string")
    .min(8, "Password must be at least 8 characters long")
    .max(32, "Password cannot exceed 32 characters")
    .regex(
      /[A-Z]/,
      "Password must contain at least one uppercase letter",
    )
    .regex(
      /[a-z]/,
      "Password must contain at least one lowercase letter",
    )
    .regex(
      /[0-9]/,
      "Password must contain at least one number",
    )
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),

  otp: z
    .string("OTP must be a string")
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
});

export const authErrorValidation = {
  patientRegisterZodSchema,
  loginZodSchema,
  patientEmailverifieydZodSchema,
  forgetPasswordZodschema,
  ResetPasswordzodschema
};