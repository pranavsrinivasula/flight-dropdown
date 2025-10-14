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
    // 0️⃣ Handle WhatsApp health check ping
    if (req.body?.action === "ping") {
      console.log("🟢 Health check ping received");
      return res.json({ data: { status: "active" } });
    }

    // 1️⃣ Only attempt decryption if AES key and IV exist
    if (!req.body?.encrypted_aes_key || !req.body?.initial_vector) {
      throw new FlowEndpointException(421, "Missing encryption fields for flow data");
    }

    // 2️⃣ Decrypt request
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
    const { trigger, query, selected_result } = decryptedBody;

    console.log("🟢 Decrypted request body:", decryptedBody);

    // 3️⃣ Your normal flow logic
    // ...
    // encrypt response
    const responseData = { data: { status: "active" } };
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
