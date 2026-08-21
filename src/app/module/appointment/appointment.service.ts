import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const bookAppointment = async (payload: any, user: any) => {
  const bkashIdToken = await getBkashIdToken();

  if (!bkashIdToken) {
    throw new Error("No Bkash Access Token Found!");
  }

  const paymentBody = {
    mode: "0011",

    payerReference: user.email,

    callbackURL:
      `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,

    amount: "1200",

    currency: "BDT",

    intent: "sale",

    merchantInvoiceNumber: "TEST-INV-001",
  };

  console.log("========== BKASH ==========");
  console.log("Base URL:", config.bkash_base_url);
  console.log("Callback:", paymentBody.callbackURL);
  console.log("Payment Body:", paymentBody);
  console.log("===========================");

  const response = await fetch(
    `${config.bkash_base_url}/tokenized/checkout/create`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: bkashIdToken,
        "X-App-Key": config.bkash_app_key,
      },

      body: JSON.stringify(paymentBody),
    },
  );

  const responseText = await response.text();

  console.log("bKash status:", response.status);
  console.log("bKash response:", responseText);

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Invalid bKash response: ${responseText}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `bKash payment creation failed: ${response.status} - ${
        result?.statusMessage || responseText
      }`,
    );
  }

  return {
    paymentUrl: result.bkashURL,
    ...result,
  };
};

export const AppointmentServices = {
  bookAppointment,
};