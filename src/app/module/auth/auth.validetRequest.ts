import z from "zod"
import { catchAsync } from "../../utils/catchAsync"
import { NextFunction, Request, Response } from "express"

const validReqeust=(zodschema:z.ZodObject)=>{

return catchAsync(
		 (req:Request,res:Response,next:NextFunction)=>{
	
		

		const payload=req.body??{}


const result=zodschema.safeParse(payload)
if(!result.success){
	console.log(result.error.issues)	
	console.log(result.error)
	const errorMessage=result.error.issues.map((issue)=>issue.message).join(", ")
	throw new Error(errorMessage)
}
req.body=result.data

next()

	



}



)






}
export const validRequest={
validReqeust
}