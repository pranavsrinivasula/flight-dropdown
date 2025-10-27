// controllers/flightTypeController.js
const { decryptRequest, encryptResponse } = require("../middleware/encryption");

exports.handleFlightType = async (req, res) => {
  try {
    // 🔹 Case 1: Encrypted WhatsApp request (normal)
    if (req.body.encrypted_flow_data) {
      const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
      const payload = decryptedBody.payload || {};
      const trigger = payload.trigger || null;
      const Type_Flight_raw = payload.Type_Flight;

      // 🩺 Case: Health check from Meta (no trigger)
      if (!trigger) {
        const healthMessage = {
          data: { status: "active" },
        };
        const encryptedResponse = encryptResponse(healthMessage, aesKeyBuffer, ivBuffer);
        return res.status(200).send(encryptedResponse);
      }

      // 🔹 Normalize flight type
      const Type_Flight = Array.isArray(Type_Flight_raw)
        ? Type_Flight_raw[0]
        : Type_Flight_raw;

      // 🔹 Validate trigger
      if (trigger.toLowerCase() !== "chipper") {
        const errorResponse = { success: false, message: "Invalid trigger received" };
        const encryptedResponse = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(encryptedResponse);
      }

      // 🔹 Define valid chips
      const chipOptions = [
        { id: "1", title: "One-Way" },
        { id: "2", title: "Return" },
      ];

      // 🔹 Validate flight type
      if (!chipOptions.some((c) => c.id === Type_Flight)) {
        const errorResponse = { success: false, message: "Invalid flight type selection" };
        const encryptedResponse = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(encryptedResponse);
      }

      // 🔹 Build chip data
      const chips = chipOptions.map((chip) => ({
        id: chip.id,
        title: chip.title,
        selected: chip.id === Type_Flight,
        enabled: true,
        selectable: chip.id !== Type_Flight,
      }));

      // 🔹 WhatsApp Flow requires this structure (with "response.screen")
      const responseBody = {
        response: {
          screen: {
            id: "FLIGHT_TYPE_SCREEN",
            title: "✈️ Choose your flight type",
            data: {
              chips,
              init_value: [Type_Flight],
            },
          },
        },
      };

      const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
      return res.status(200).send(encryptedResponse);
    }

    // 🔹 Case 2: Plain Render/Manual Health check (non-encrypted)
    // This is for Postman or Render testing only
    return res.status(200).json({
      success: true,
      message: "Plain health check OK (for manual or Render ping)",
    });
  } catch (error) {
    console.error("❌ Error in handleFlightType:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
