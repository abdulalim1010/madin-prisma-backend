import type { Role } from "../../../generated/prisma/browser";

export interface IRegisterPatientPayload {
	name: string;
	email: string;
	password: string;
	patient?:{
		contactNumber?: string;	
	}
}

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}
export interface IGoogleLoginPayload {
	idToken: string;
}
export interface IfogetPasswordPayload{
	email:string;
}
export interface IResetPasswordPayload{
email:string;
newPassword:string;
otp:string;

}