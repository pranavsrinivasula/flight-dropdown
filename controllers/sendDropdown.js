const { decryptRequest, encryptResponse,FlowEndpointException, isRequestSignatureValid } = require("../middleware/encryption");
const PRIVATE_KEY = process.env.PRIVATE_KEY;
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
  },
  SUCCESS: {
        screen: "SUCCESS",
        data: {
            extension_message_response: {
                params: {
                    flow_token: "REPLACE_FLOW_TOKEN",
                    some_param_name: "PASS_CUSTOM_VALUE",
                },
            },
        },
    },
};

const getNextScreen = async (decryptedBody) => {
  const { action, screen, flow_token, data } = decryptedBody;

  if (action === "ping") return { data: { status: "active" } };
  if (data?.error) return { data: { acknowledged: true } };

  if (action === "INIT") {
    // When flow first loads
    return SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN;
  }

  if (action === "data_exchange") {
    const trigger = data?.trigger;

    if (trigger === "load_trip_types") {
      try {
        // Call your real API endpoint here
        const response = await fetch("https://flight-dropdown.onrender.com/flow-webhook"); // change to your real endpoint
        const flights = await response.json();

        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            trip_types: flights.map(f => ({
              id: f.id,
              title: `${f.from} to ${f.to}`
            }))
          }
        };
      } catch (err) {
        console.error("Failed to fetch trip types:", err);
        return {
          screen: "FLIGHT_BOOKING_SCREEN",
          data: {
            trip_types: []
          }
        };
      }
    }

    if (trigger === "trip_type_selected") {
      return {
        screen: "SUMMARY_SCREEN",
        data: {
          selected_trip: data?.selected_trip || "No trip selected"
        }
      };
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & trigger."
  );
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
    if (!PRIVATE_KEY) {
        throw new Error(
            'Private key is empty. Please check your env variable "PRIVATE_KEY".'
        );
    }
console.log("flowwebhook",flowWebhook);

    if (!isRequestSignatureValid(req)) {
        // Return status code 432 if request signature does not match.
        // To learn more about return error codes visit: https://developers.facebook.com/docs/whatsapp/flows/reference/error-codes#endpoint_error_codes
        return res.status(432).send();
    }
console.log("valid sign only",isRequestSignatureValid);

    let decryptedRequest = null;
    try {
        decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
    } 
 
    
    catch (err) {
        console.error(err);
        if (err instanceof FlowEndpointException) {
            return res.status(err.statusCode).send();
        }
        return res.status(500).send();
    }
console.log("req.body ia ",req.body);

    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
    console.log("💬 Decrypted Request:", decryptedBody);

    const screenResponse = await getNextScreen(decryptedBody);
    console.log("👉 Response to Encrypt:", screenResponse);

    res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
    console.log("enxrypted response is"+encryptResponse);
    
}


module.exports = { flowWebhook, getNextScreen };
