const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;

// Predefined screens and data
const SCREEN_RESPONSES = {
  FLIGHT_BOOKING_SCREEN: {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      trip_types: [
        { id: "HYD_TO_MUMBAI", title: "HYD TO MUMBAI" },
        { id: "HYD_TO_GOA", title: "HYD TO GOA" }
      ],
      cities: [
        { id: "HYD", title: "Hyderabad" },
        { id: "MUM", title: "Mumbai" },
        { id: "GOA", title: "Goa" }
      ]
    }
  }
};

const flowWebhook = async (req, res) => {
  if (!PRIVATE_KEY) throw new Error("Private key is empty");

  if (!isRequestSignatureValid(req)) return res.status(432).send();

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Decryption failed:", err);
    if (err instanceof FlowEndpointException) return res.status(err.statusCode).send();
    return res.status(500).send();
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", JSON.stringify(decryptedBody, null, 2));

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", JSON.stringify(screenResponse, null, 2));

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => date.toISOString().split("T")[0];

// Main logic
function getNextScreen(action, screen, data) {
  if (action === "INIT") {
    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        from_city: "",
        to_city: "",
        Startdate: "",
        Enddate: ""
      }
    };
  }

  if (screen === "FLIGHT_BOOKING_SCREEN" && action === "data_exchange") {
    return {
      screen: "SUMMARY_SCREEN",
      data: {
        from_city: data.from_city || "Not selected",
        to_city: data.to_city || "Not selected",
        Startdate: data.Startdate || "Not selected",
        Enddate: data.Enddate || "Not selected"
      }
    };
  }

  return {
    screen: "TERMINAL_SCREEN",
    data: {
      message: "Booking flow complete."
    }
  };
}


module.exports = { flowWebhook, getNextScreen };
