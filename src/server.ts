import app from "./app";
import config from "./app/config";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import { seedSuperAdmin, seedTesterAdmin, seedTesterDoctor } from "./app/utils/seed";
import cron from 'node-cron';



const PORT = config.port;

const main = async () => {
	try {







		await prisma.$connect();
		console.log("Connected to the database successfully.");

		await redisClient.connect();
		console.log("rdis connect successfulyy")



      await transporter.verify()
	  console.log("nodemailer connect successfully")
		await seedSuperAdmin();
		await seedTesterDoctor();
		await seedTesterAdmin();
		
cron.schedule(' * * * * *', () => {
  console.log('running a task every minute');
});






		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();
