import bcrypt from "bcryptjs";
import { Role, UserStatus } from "../../generated/prisma/enums"
import { prisma } from "../lib/prisma"
import config from "../config";

export const seedSuperAdmin=async()=>{
    try{


const isSuperAdminExists=await prisma.user.findFirst({
    where:{
        role:Role.SUPER_ADMIN
    }
});
if(isSuperAdminExists){
    console.log("Super Admin already exists");
    return;
}

const name=config.super_admin_name
 const email=config.super_admin_email
const password=config.super_admin_password
if(!name ||!email||!password){
    throw new Error("Super admin name,email,password missing env file");
    
}

const hashedPassword=await bcrypt.hash(password,Number(config.bcrypt_salt_rounds))

const superadmin=await  prisma.user.create({
    data:{
        name,
        email,
        password:hashedPassword,
        needPasswordChange:false,
        role: Role.SUPER_ADMIN,
        emailVerified:true
    }
})
console.log("super admin created:",superadmin);

    }
   
    catch(error){
        console.log("Erorr super admin: ",error)
        await prisma.user.delete({
            where:{
                email:config.super_admin_email
            }
        })

    }
}

//tester docotor and admin
export const seedTesterDoctor = async () => {
  try {
    const name = config.tester_doctor_name;
    const email = config.tester_doctor_email;
    const password = config.tester_doctor_password;

    // Check environment variables
    if (!name || !email || !password) {
      throw new Error(
        "Tester Doctor name, email, password missing in env file",
      );
    }

    // Check if tester doctor already exists
    const existingDoctor = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingDoctor) {
      console.log("Tester Doctor already exists");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    // Create Tester Doctor
    const testerDoctor = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.DOCTOR,
        status: UserStatus.ACTIVE,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    console.log(
      "Tester Doctor created successfully:",
      testerDoctor.id,
    );
  } catch (error) {
    console.error("Error creating Tester Doctor:", error);
  }
};
//test admin\\


export const seedTesterAdmin = async () => {
  try {
    const name = config.tester_admin_name;
    const email = config.tester_admin_email;
    const password = config.tester_admin_password;

    // Check environment variables
    if (!name || !email || !password) {
      throw new Error(
        "Tester Admin name, email, password missing in env file",
      );
    }

    // Check if tester admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingAdmin) {
      console.log("Tester Admin already exists");
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      password,
      Number(config.bcrypt_salt_rounds),
    );

    // Create Tester Admin
    const testerAdmin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        needPasswordChange: false,
        emailVerified: true,
      },
    });

    console.log(
      "Tester Admin created successfully:",
      testerAdmin.id,
    );
  } catch (error) {
    console.error("Error creating Tester Admin:", error);
  }
};