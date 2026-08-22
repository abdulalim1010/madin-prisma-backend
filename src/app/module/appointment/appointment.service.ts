import { AppointmentStatus, PaymentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";

const bookAppointment = async (payload:any,user:RequestUser) => {







    const transactionResult=await prisma.$transaction(async(tx)=>{



const appointment=await tx.appointment.create({
    data:{
        status:AppointmentStatus.PENDING

    }
})

        const bkashIdToken = await getBkashIdToken()

    if(!bkashIdToken){
        throw new Error("No Bkash Access Token Found!")
    }

    console.log({bkashIdToken});

    const bkashCreatePaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/create`, {
        method : "POST",
        headers : {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: bkashIdToken,
            "X-App-Key" : config.bkash_app_key

        },
        body: JSON.stringify({
            mode: "0011",
            // payerReference: "0123456789", //user email or phone number
            payerReference: user.email, //user email or phone number
            callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
            amount: "1200",
            currency: "BDT",
            intent: "sale",
            // merchantInvoiceNumber: "Inv4" // apppointment id
            merchantInvoiceNumber: appointment.id // apppointment id
        })
    });

    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json()


//payment model
await tx.payment.create({
    data :{
        marchentInvoiceNumber:bkashCreatePaymentResult.merchantInvoiceNumber,
        appointmentId:appointment.id,
        amount:"1200",
           gatewayResponse:bkashCreatePaymentResult,
           bkashPaymentId:bkashCreatePaymentResult.paymentID,
           payerReference:user.email,


    }})





    console.log({bkashCreatePaymentResult});
  

   return{paymentUrl:bkashCreatePaymentResult.bkashURL

   }
    });
    // // business logic
return transactionResult
    
}


const payAppointment=async(payload:any,user:RequestUser)=>{
const appointmentId=payload.appointmentId
const existingApppointment=await prisma.appointment.findUnique({

   where:{
    id:appointmentId
   }
});
if(!existingApppointment){
    throw new Error("Appointment Does not exits");
    
}
if(existingApppointment.status ==="CONFIRMED"){
    throw new Error("Appointment and payed alredy conferm");
    

}
if(existingApppointment.status==="PENDING"){
    throw new Error("Appointment is not pending");
    
}
const bkashIdToken = await getBkashIdToken()

    if(!bkashIdToken){
        throw new Error("No Bkash Access Token Found!")
    }

    console.log({bkashIdToken});

    const bkashCreatePaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/create`, {
        method : "POST",
        headers : {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: bkashIdToken,
            "X-App-Key" : config.bkash_app_key

        },
        body: JSON.stringify({
            mode: "0011",
            // payerReference: "0123456789", //user email or phone number
            payerReference: user.email, //user email or phone number
            callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,
            amount: "1200",
            currency: "BDT",
            intent: "sale",
            // merchantInvoiceNumber: "Inv4" // apppointment id
            merchantInvoiceNumber: existingApppointment.id // apppointment id
        })
    });

    const bkashCreatePaymentResult = await bkashCreatePaymentResponse.json()



    await prisma.payment.update({
        where:{
            bkashPaymentId:bkashCreatePaymentResult.paymentID
        },
        data:{

             marchentInvoiceNumber:bkashCreatePaymentResult.merchantInvoiceNumber,
      
        amount:"1200",
           gatewayResponse:bkashCreatePaymentResult,
           bkashPaymentId:bkashCreatePaymentResult.paymentID,
           payerReference:user.email,

        }
    })
// if(existingApppointment.status==="CANCEL"||existingApppointment.status ==="ONGOING"|| existingApppointment.status ==="COMPLETED"){
  

//     const appointmentStatus=existingApppointment.status
//     throw new Error(`appointmentis alrady${appointmentStatus.toLocaleLowerCase}`);
    
// }




}

const bookAppointmentCallback = async (query : Record<string, any>) => {

   const transactionResult=await prisma.$transaction(async(tx)=>{
     const paymentId = query.paymentID

    if(!paymentId){
        throw new Error("Payment Id Missing")
    }

    const status = query.status

    if(!status){
        throw new Error("Payment Status is Missing")
    }

    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
        throw new Error("No Bkash Access Token Found!")
    }


    const executedPaymentResponse = await fetch(`${config.bkash_base_url}/tokenized/checkout/execute`, {
        method : "POST",
        headers : {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: bkashIdToken,
            "X-App-Key": config.bkash_app_key
        },

        body : JSON.stringify({
            paymentID : paymentId
        })
    })

    const executedPaymentResult = await executedPaymentResponse.json()


    if(status === "success"){

        await tx.appointment.update({
            where:{
                id:executedPaymentResult.merchantInvoiceNumber
            },
            data:{
status:AppointmentStatus.CONFIRMED
            }
        })

await tx.payment.update({
    where:{
        appointmentId:executedPaymentResult.merchantInvoiceNumber,
        bkashPaymentId:paymentId,
     
    },
    data:{
        status:PaymentStatus.PAID,
        bkashTrxId:executedPaymentResult.trxID,
           paidAt:executedPaymentResult.paymentExecuteTime,
           gatewayResponse:executedPaymentResult


    }
    
})


        return {
            executedPaymentResult,
            redirectUrl : `${config.frontend_url}/dashboard/my-appointments?status=success`
        }
    }
    else if(status === "failure"){

        await tx.payment.update({
    where:{
   
        bkashPaymentId:paymentId,
     
    },
    data:{
        status:PaymentStatus.FIALED,
gatewayResponse:executedPaymentResult


    }
    
})

        
        return {
            executedPaymentResult,
            redirectUrl : `${config.frontend_url}/dashboard/my-appointments?status=failue`
        }
    }
     else if(status === "cancel"){
              await tx.payment.update({
    where:{
   
        bkashPaymentId:paymentId,
     
    },
    data:{
        status:PaymentStatus.CANCELLED,
gatewayResponse:executedPaymentResult


    }
    
})
        return {
            executedPaymentResult,
            redirectUrl : `${config.frontend_url}/dashboard/my-appointments?status=cancel`
        }
    }
    else{


           return {
        executedPaymentResult,
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments?error-payment-failed`
    }

    }

 
   })
   return transactionResult
}

export const AppointmentServices = {
    bookAppointment,
    bookAppointmentCallback
}