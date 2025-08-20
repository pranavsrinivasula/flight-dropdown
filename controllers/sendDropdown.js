const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;

// Predefined data
const SCREEN_RESPONSES = {
  FLIGHT_BOOKING_SCREEN: {
    screen: "FLIGHT_BOOKING_SCREEN",
    data: {
      cities: [
        { id: "HYD", title: "Hyderabad" },
        { id: "MUM", title: "Mumbai" },
        { id: "GOA", title: "Goa" },
        { id: "DEL", title: "Delhi" }
      ]
    }
  }
};

const flowWebhook = async (req, res) => {
  if (!PRIVATE_KEY) throw new Error('Private key is empty');

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
const getNextScreen = async (decryptedBody) => {
  const { action, data, form } = decryptedBody;

  // Ping request
  if (action === "ping") {
    return { screen: "FLIGHT_BOOKING_SCREEN", data: { status: "active" } };
  }

  // Initial screen load
  if (action === "INIT") {
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 365);

    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        cities: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.cities,
        calendar: {
          min_date: formatDate(today),
          max_date: formatDate(maxDate),
          init_value: {
            start_date: formatDate(today),
            end_date: formatDate(maxDate)
          }
        },
        DatePicker: {
          min_date: formatDate(today),
          max_date: formatDate(maxDate),
          init_value: {
            start_date: formatDate(today),
            end_date: formatDate(maxDate)
          }
        }
      }
    };
  }

  // When user submits the flight selection
  if (action === "data_exchange" && data?.trigger === "submit_flight") {
    const { from_city, to_city, Startdate, Enddate } = data;

  return {
  screen: "SUMMARY_SCREEN",
  form: {  // <-- send under form instead of data
    from_city: from_city || "",
    to_city: to_city || "",
    Startdate: Startdate || "",
    Enddate: Enddate || ""
  }
};

  }

  // Default fallback
  return { screen: "FLIGHT_BOOKING_SCREEN", data: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data };
};

module.exports = { flowWebhook, getNextScreen };
