const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");

let userFlightSelection = {};

exports.handleFlightType = async (req, res) => {
  try {
    console.log("🚀 Incoming Request Body:", req.body);

    // 1️⃣ Decrypt
    const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
    console.log("✅ Decrypted Body:", decryptedBody);

    const trigger = decryptedBody?.trigger;
    const userId = decryptedBody?.user_id || "guest";
    let currentSelection = userFlightSelection[userId] || "";

    if (trigger === "chipper") {
      const selected = decryptedBody?.Type_Flight;

      if (selected && ["One-Way", "Return"].includes(selected)) {
        userFlightSelection[userId] = selected;
        currentSelection = selected;
      }

      // 🔹 Return only minimal action response (no full screen)
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
      return res.status(200).json({ encrypted_flow_data: encryptedResponse });
    }

    const responseBody = {
      version: "1.0",
      data: {},
    };

    const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
    res.status(200).json({ encrypted_flow_data: encryptedResponse });
  } catch (error) {
    console.error("❌ Error in handleFlightType:", error);
    const status = error instanceof FlowEndpointException ? error.statusCode : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};
