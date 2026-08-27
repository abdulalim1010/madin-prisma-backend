import cron from 'node-cron';
import { prisma } from './prisma';
import { DoctorsVerificationStatus, Role } from '../../generated/prisma/enums';



export const deleteUnVerifiedDoctor=async()=>{


    cron.schedule(' */10 * * * *', async() => {



try {
  const ondeHourAgo=new Date(Date.now()-60*60*1000)


 const deletedDoctors =await prisma.user.deleteMany({
  where:{
    role:Role.DOCTOR,
    emailVerified:false,
    createdAt:{lt:ondeHourAgo},
    doctor:{verificationStatus: DoctorsVerificationStatus.PENDING}
  }
 })


 if(deletedDoctors.count>0){
  console.log(` 
    
    Cron:Deleted ${deletedDoctors.count}unverified doctor application  older than 1 hour`)
 }
  
} catch (error) {

  console.log("Cron faield to delelte unverified doctor");
  
}

console.log("Doctor Deletedd cron schedule (every 10) minute")
});
}


