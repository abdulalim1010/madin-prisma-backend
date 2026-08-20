import config from "../config"
import { redisClient } from "./redis";

export const getBkashIdToken=async()=>{


try {
    
const IdTokenKey="bkash:IdToken"
const RefreshTOkenKey="bkash:refreshToken"


let bkashIdToken=await redisClient.get(IdTokenKey)
const bkashIdTokenTTL=await redisClient.ttl(IdTokenKey)

const bkashRefreshToken=await redisClient.get(RefreshTOkenKey)
const bkashRefreshTokenTTL=await redisClient.ttl(RefreshTOkenKey)
console.log({
    bkashIdToken,
    bkashIdTokenTTL,
    bkashRefreshToken,
    bkashRefreshTokenTTL
})





if((bkashIdTokenTTL <=600||!bkashIdToken)
     && bkashRefreshToken && bkashRefreshTokenTTL >600){

     const refreshTOkenResponse=await fetch(`${config.bkash_base_url}/tokenized/checkout/token/refresh`,
        {
            method:"POST",
            headers:{
                "Content-Type": "application/json",
                Accept: "application/json",
                username:config.bkash_username,
                password:config.bkash_password
            },


body:JSON.stringify(
    {  
   app_key: config.bkash_app_key,
   app_secret: config.bkash_app_secret,
   refresh_token:bkashRefreshToken
}
)


        }


    )


    const bkashRefreshTokenResult=await refreshTOkenResponse.json()

  bkashIdToken=bkashRefreshTokenResult.id_token as string
    await redisClient.set(IdTokenKey,bkashIdToken,{




        expiration:{
            type:"EX",
            value:60*60
        }
    })
    if(!refreshTOkenResponse.ok){
    throw new Error("Bkash access token grant faild");
    
}
  
    return bkashIdToken

}

if(bkashIdToken){
    return bkashIdToken
}
    const response=await fetch(`${config.bkash_base_url}/tokenized/checkout/token/grant`,
        {
            method:"POST",
            headers:{
                "Content-Type": "application/json",
                Accept: "application/json",
                username:config.bkash_username,
                password:config.bkash_password
            },


body:JSON.stringify(
    {  
   app_key: config.bkash_app_key,
   app_secret: config.bkash_app_secret
}
)


        }


    )


  

if(!response.ok){
    throw new Error("Bkash access token grant faild");
    
}
  const result=await response.json();

 await redisClient.set(IdTokenKey,result.id_token,{
    expiration:{
        type:"EX",
        value:60*60//one hours
    }
 })

await redisClient.set(RefreshTOkenKey,result.refresh_token,{
      expiration:{
        type:"EX",
        value:60*60*24*28//28days
    }

})


bkashIdToken=result.id_token
return bkashIdToken









 //bksh refresh token


    
} catch (error:any) {
    throw new Error(error.message);
    
    
}
}