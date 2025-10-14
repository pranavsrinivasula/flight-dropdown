const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");

const FLIGHT_LIST = [
  { id: "AI203", title: "Air India AI-203" },
  { id: "6E512", title: "IndiGo 6E-512" },
  { id: "UK811", title: "Vistara UK-811" },
];

let availableFlightsListTemp = [];
let selectedFlightOption = "";
let isSearchEnabled = false;

const flowController = async (req, res) => {
  try {
    // Step 0: Check for health check ping
    if (req.body?.action === "ping") {
      console.log("🟢 Health check ping received");
      return res.json({ data: { status: "active" } });
    }

    // Step 1: Decrypt incoming request
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
    const { trigger, query, selected_result } = decryptedBody;

    console.log("🟢 Decrypted request body:", decryptedBody);

    // Step 2: Logic based on trigger
    if (trigger === "Enable_Search_Field") {
      isSearchEnabled = true;
    }

    if (trigger === "Search_Flights" && query) {
      availableFlightsListTemp = FLIGHT_LIST.filter((f) =>
        f.title.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (trigger === "Flight_Selected" && selected_result) {
      availableFlightsListTemp = [selected_result];
      selectedFlightOption = selected_result.title;
    }

    if (trigger === "Data_Submitted") {
      console.log("🛫 Booking submitted:", decryptedBody);
    }

    // Step 3: Prepare response data
    const responseData = {
      data: {
        status: "active",
        is_search_enabled: isSearchEnabled,
        available_flights_list: availableFlightsListTemp,
        selected_flight_option: selectedFlightOption,
      },
    };

    // Step 4: Encrypt response before sending
    const encryptedPayload = encryptResponse(responseData, aesKeyBuffer, ivBuffer);

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
