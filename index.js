const { decryptRequest, encryptResponse, FlowEndpointException } = require("./middleware/encryption");

let userFlightSelection = {};

exports.handleFlightType = async (req, res) => {
  try {
    console.log("🚀 Incoming Request Body:", req.body);

    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
    console.log("✅ Decrypted Body:", decryptedBody);

    const trigger = decryptedBody?.trigger;
    const userId = decryptedBody?.user_id || "guest";
    let currentSelection = userFlightSelection[userId] || "";

    // When user selects a chip -> respond with minimal update only
    if (trigger === "chipper") {
      const selected = decryptedBody?.Type_Flight;
      if (selected && ["One-Way", "Return"].includes(selected)) {
        userFlightSelection[userId] = selected;
        currentSelection = selected;
      }

      const responseBody = {
        version: "1.0",
        data: {
          action: {
            type: "update",
            message: `✅ Selected flight type: ${currentSelection}`,
          },
        },
      };

      const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
      console.log("🔐 Sending encrypted response (chipper) length:", encryptedResponse.length);
      return res.status(200).json({ encrypted_flow_data: encryptedResponse });
    }

    // When there's no trigger (ping or others) -> keep it minimal (empty data)
    const responseBody = {
      version: "1.0",
      data: {},
    };

    const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
    console.log("🔐 Sending encrypted response (no-trigger) length:", encryptedResponse.length);
    res.status(200).json({ encrypted_flow_data: encryptedResponse });
  } catch (error) {
    console.error("❌ Error in handleFlightType:", error);
    const status = error instanceof FlowEndpointException ? error.statusCode : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};
