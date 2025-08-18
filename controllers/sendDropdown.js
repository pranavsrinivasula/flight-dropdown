const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");
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
          some_param_name: "PASS_CUSTOM_VALUE"
        }
      }
    }
  }
};


const formatDate = (date) => date.toISOString().split("T")[0];

const getNextScreen = async (decryptedBody) => {
  const { action, data } = decryptedBody;

  if (action === "ping") return { data: { status: "active" } };
  if (data?.error) return { data: { acknowledged: true } };

  if (action === "INIT") {

    const today = new Date();
    const todayStr = formatDate(today);

    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 30);
    const maxDateStr = formatDate(maxDate);

    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        calendar: {
          "min-date": todayStr,
          "max-date": maxDateStr,
          "init-value": {
            "start-date": todayStr,
            "end-date": todayStr
          }
        }
      }
    };
  }

  if (action === "data_exchange") {
    const trigger = data?.trigger;

    if (trigger === "load_trip_types") {
      try {
        const response = await fetch("https://flight-dropdown.onrender.com");
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
  throw new Error("Unhandled endpoint request.");
};

const flowWebhook = async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error('Private key is empty. Please check env variable "PRIVATE_KEY".');
  }

  if (!isRequestSignatureValid(req)) {
    return res.status(432).send();
  }

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error(err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send();
    }
    return res.status(500).send();
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", decryptedBody);

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", screenResponse);

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

module.exports = { flowWebhook, getNextScreen };
