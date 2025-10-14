const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");

const FLIGHT_LIST = [
  { id: "AI203", title: "Air India AI-203" },
  { id: "6E512", title: "IndiGo 6E-512" },
  { id: "UK811", title: "Vistara UK-811" }
];

let availableFlightsListTemp = [];
let selectedFlightOption = "";
let isSearchEnabled = false;

const flowController = async (req, res) => {
  try {
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(
      req.body,
      process.env.PRIVATE_KEY,
      process.env.PRIVATE_KEY_PASSPHRASE
    );

    const { trigger, query, selected_result } = decryptedBody;

    // OptIn clicked → enable search/input fields
    if (trigger === "Enable_Search_Field") {
      isSearchEnabled = true;
    }

    // Flight selected
    if (trigger === "Flight_Selected" && selected_result) {
      availableFlightsListTemp = [selected_result];
      selectedFlightOption = selected_result.title;
    }

    // Booking submit
    if (trigger === "Data_Submitted") {
      console.log("Booking Data Received:", decryptedBody);
    }

    const responseData = {
      data: {
        status: "active",
        is_search_enabled: isSearchEnabled,
        Available_flights_list_temp: availableFlightsListTemp,
        selected_flight_option: selectedFlightOption
      }
    };

    const encryptedPayload = encryptResponse(responseData, aesKeyBuffer, initialVectorBuffer);
    return res.json({ encrypted_flow_data: encryptedPayload });

  } catch (err) {
    console.error("❌ flowController error:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { flowController };
