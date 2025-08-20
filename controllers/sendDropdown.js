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
      selected_dates: {
        start_date: "",
        end_date: ""
      }
    }
  }
};
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

// Helper to format date as YYYY-MM-DD
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
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 365);

    return {
      screen: "FLIGHT_BOOKING_SCREEN",
      data: {
        trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types,
       calendar: {
                  min_date: formatDate(today),
                  max_date: formatDate(maxDate),
                  init_value: {
                    start_date: formatDate(today),
                    end_date: formatDate(maxDate)
                  }
                },
        DatePicker:
        {
           min_date: formatDate(today),
                  max_date: formatDate(maxDate),
                  init_value: {
                    start_date: formatDate(today),
                    end_date: formatDate(maxDate)
                  }
        },
      }
    };
  }


  // Data exchange triggers
  if (action === "data_exchange") {
    const trigger = data?.trigger;

    // Trip type selected → show summary
    if (trigger === "trip_type_selected") {
      return {
        screen: "SUMMARY_SCREEN",
        data: {
          selected_trip: data?.selected_trip || SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types[0].title,
          selected_dates: data?.selected_dates || { start_date: "", end_date: "" }
        }
      };
    }


    // Load trip types again if needed
    if (trigger === "load_trip_types") {
      return {
        screen: "FLIGHT_BOOKING_SCREEN",
        data: {
          trip_types: SCREEN_RESPONSES.FLIGHT_BOOKING_SCREEN.data.trip_types
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

module.exports = { flowWebhook, getNextScreen };
