const { decryptRequest, encryptResponse, isRequestSignatureValid, FlowEndpointException } = require("../middleware/encryption");
const PRIVATE_KEY = process.env.PRIVATE_KEY.replace(/\\n/g, "\n");
const PASSPHRASE = process.env.PASSPHRASE;


const SCREEN_RESPONSES = {
  FLIGHT_BOOKING_SCREEN: {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: [
        { id: "HYD_TO_MUMBAI", title: "HYD TO MUMBAI" },
        { id: "HYD_TO_GOA", title: "HYD TO GOA" }
      ]
    }
  },
  SUMMARY_SCREEN: {
    screen: "SUMMARY_SCREEN",
    data: {
      selected_flight: "Hyderabad to Delhi - Economy Class\nMon Jan 01 2024 at 11:30",
      details: "Passenger: PRANAV\nEmail: john@example.com\nPhone: 123456789\n\nWindow seat, vegetarian meal"
    }
  }
};

const getNextScreen = async (decryptedBody) => {
  const { action, screen, flow_token, data } = decryptedBody;

  if (action === "ping") return { data: { status: "active" } };
  if (data?.error) return { data: { acknowledged: true } };

  if (action === "INIT") {
    return SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN;
  }

  if (action === "data_exchange") {
    switch (screen) {
      case "FLIGHT_BOOKING_SCREEN":
        return SCREEN_RESPONSES.SUMMARY_SCREEN;

      case "SUMMARY_SCREEN":
        return {
          screen: "SUCCESS",  
          data: {
            extension_message_response: {
              params: {
                flow_token,
  
              }
            }
          }
        };

      default:
        throw new Error("Unhandled screen in data_exchange");
    }
  }

  throw new Error("Unhandled action in Flow webhook");
};

// const flowWebhook = async (req, res) => {
//   try {
//     if (!PRIVATE_KEY) throw new Error("Private key missing");

//     if (!isRequestSignatureValid(req)) return res.status(432).send(); 

//     let encryptedBody = req.body;
//     if (Buffer.isBuffer(encryptedBody)) encryptedBody = JSON.parse(encryptedBody.toString("utf8"));

//     const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptRequest(encryptedBody, PRIVATE_KEY, PASSPHRASE);

//     console.log("Decrypted Body:", decryptedBody);

//     const screenResponse = await getNextScreen(decryptedBody);

//     const encryptedResponse = encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer);

//     res.send(encryptedResponse);
//   } catch (error) {
//     console.error("Flow Webhook Error:", error);
//     if (error instanceof FlowEndpointException) return res.status(error.statusCode).send();
//     res.status(500).send();
//   }
// };
const flowWebhook = async (req, res) => {
  try {
    // 1. Check private key
    if (!PRIVATE_KEY) throw new Error("Private key missing");

    // 2. Validate signature
    if (!isRequestSignatureValid(req)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    // 3. If req.body is a buffer, parse it
    // let encryptedBody = req.body;
    // if (Buffer.isBuffer(encryptedBody)) {
    //   encryptedBody = JSON.parse(encryptedBody.toString("utf8"));
    // }

 let decryptedRequest = null;
    try {
        decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } catch (err) {
        console.error(err);
        if (err instanceof FlowEndpointException) {
            return res.status(err.statusCode).send();
        }
        return res.status(500).send();
    }


    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptRequest;

    console.log("Decrypted Body:", decryptedBody);

     const screenResponse = await getNextScreen(decryptedBody);

    // 6. Encrypt response before sending
    // const encryptedResponse = encryptResponse(
    //   responseData,
    //   aesKeyBuffer,
    //   initialVectorBuffer
    // );

    // res.json(encryptedResponse);
    res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));

  
  } catch (error) {
    console.error(error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message });
  }
};


module.exports = { flowWebhook, getNextScreen };
