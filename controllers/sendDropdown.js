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
      ]
    }
  },
  SUMMARY_SCREEN: {
    screen: "SUMMARY_SCREEN",
    data: {
      selected_trip: "Hyderabad to Delhi - Economy Class\nMon Jan 01 2024 at 11:30",
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

// Helper to format date for calendar
const formatDate = (date) => date.toISOString().split("T")[0];

// Main logic to determine next screen
const getNextScreen = async (decryptedBody) => {
  const { action, data } = decryptedBody;

  // Ping request
  if (action === "ping") {
    return { screen: "FLIGHT_BOOKING_SCREEN", data: { status: "active" } };
  }

  // Error handling
  if (data?.error) {
    return { screen: decryptedBody.screen || "FLIGHT_BOOKING_SCREEN", data: { acknowledged: true } };
  }

  // Initial screen load
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
        },
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types
      }
    };
  }

  // Data exchange triggers
  if (action === "data_exchange") {
    const trigger = data?.trigger;

    // Load trip types
    if (trigger === "load_trip_types") {
      return {
        screen: "FLIGHT_BOOKING_SCREEN",
        data: {
          trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types
        }
      };
    }

    // Trip type selected → show summary
    if (trigger === "trip_type_selected") {
      return {
        screen: "SUMMARY_SCREEN",
        data: {
          selected_trip: data?.selected_trip || SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types[0].title
        }
      };
    }
  }

  // Default handler for unhandled requests
  console.warn("Unhandled request body:", decryptedBody);
  return {
    screen: decryptedBody.screen || "FLIGHT_BOOKING_SCREEN",
    data: { acknowledged: true }
  };
};

// Flow webhook endpoint
const flowWebhook = async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error('Private key is empty. Please check env variable "PRIVATE_KEY".');
  }

  // Validate request signature
  if (!isRequestSignatureValid(req)) {
    return res.status(432).send();
  }

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Decryption failed:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send();
    }
    return res.status(500).send();
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", JSON.stringify(decryptedBody, null, 2));

  const screenResponse = await getNextScreen(decryptedBody);
  console.log("👉 Response to Encrypt:", JSON.stringify(screenResponse, null, 2));

  res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
};

module.exports = { flowWebhook, getNextScreen };
