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
    if (req.body?.action === "ping") {
      console.log("🟢 Health check ping received");
      return res.json({ data: { status: "active" } });
    }

    if (!req.body?.encrypted_aes_key || !req.body?.initial_vector || !req.body?.encrypted_flow_data) {
      throw new FlowEndpointException(421, "Missing encryption fields for flow data");
    }

    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
    console.log("🟢 Decrypted request:", decryptedBody);

    const { trigger, query, selected_result } = decryptedBody;

    if (trigger === "Search_Flights" && query) {
      const lowerQuery = query.toLowerCase();
      availableFlightsListTemp = FLIGHT_LIST.filter(f => f.title.toLowerCase().includes(lowerQuery));
      isSearchEnabled = true;
      selectedFlightOption = "";
    } else if (trigger === "Enable_Search_Field") {
      isSearchEnabled = true;
    } else if (trigger === "Data_Submitted") {
      selectedFlightOption = decryptedBody.selected_flight_option || "";
      isSearchEnabled = false;
    }

    const responseData = {
      data: {
        Flying_from_data: [
          { id: "JNB", title: "Johannesburg International" },
          { id: "CPT", title: "Cape Town International" },
        ],
        Flying_to_data: [
          { id: "JNB", title: "Johannesburg International" },
          { id: "CPT", title: "Cape Town International" },
        ],
        min_date: "2025-07-07",
        Available_flights_list_temp,
        selected_flight_option: selectedFlightOption,
        is_search_enabled: isSearchEnabled,
        filtered_flights: availableFlightsListTemp,
      },
    };

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
