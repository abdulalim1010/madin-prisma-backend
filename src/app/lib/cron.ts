import cron from 'node-cron';



export const deleteUnVerifiedDoctor=async()=>{


    cron.schedule(' * * * * *', () => {
  console.log('delet unverifieddoctor is delletede');
});
}