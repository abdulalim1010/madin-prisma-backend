import {  Request, Response } from "express"
import { catchAsync } from "../../utils/catchAsync"
import { sendResponse } from "../../utils/sendResponse"
import httpStatus from "http-status"
import { UserSerivces } from "./user.service"
const uploadProfileImage=catchAsync(async(req:Request,res:Response)=>{
    if(!req.file){
        throw new Error("no fiile provied");
        
    }

    const userId=req.user?.userId

console.log(req.file,"req.file")

await UserSerivces.uploadProfileImage(req.file?.buffer,userId!)
    sendResponse(res,{
        statusCode:httpStatus.OK,
        success:true,
        message:"New token successfully",
        data:null
    })
})
export const userController={

uploadProfileImage
}