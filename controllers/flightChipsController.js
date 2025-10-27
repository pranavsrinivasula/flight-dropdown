/// controllers/flightTypeController.js
const { decryptRequest, encryptResponse } = require("../middleware/encryption");

exports.handleFlightType = async (req, res) => {
  try {
    // 🧩 Detect encrypted WhatsApp Flow request
    if (req.body.encrypted_flow_data) {
      const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
      const payload = decryptedBody.payload || {};
      const trigger = payload.trigger || null;
      const Type_Flight_raw = payload.Type_Flight;

      // 🩺 Health check from Meta (no trigger)
      if (!trigger) {
        const healthMessage = {
          success: true,
          message: "Health check OK — trigger not provided",
        };

        // ✅ Encrypt even this health-check response
        const encryptedResponse = encryptResponse(healthMessage, aesKeyBuffer, ivBuffer);
        return res.status(200).send(encryptedResponse);
      }

      // Normalize Type_Flight
      const Type_Flight = Array.isArray(Type_Flight_raw)
        ? Type_Flight_raw[0]
        : Type_Flight_raw;

      // ✅ Validate trigger
      if (trigger.toLowerCase() !== "chipper") {
        const errorResponse = { success: false, message: "Invalid trigger received" };
        const encryptedResponse = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(encryptedResponse);
      }

      // ✅ Define valid chip options
      const chipOptions = [
        { id: "1", title: "One-Way" },
        { id: "2", title: "Return" },
      ];

      // ✅ Validate selection
      if (!chipOptions.some((c) => c.id === Type_Flight)) {
        const errorResponse = { success: false, message: "Invalid flight type selection" };
        const encryptedResponse = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(encryptedResponse);
      }

      // ✅ Build response chips
      const chips = chipOptions.map((chip) => ({
        id: chip.id,
        title: chip.title,
        selected: chip.id === Type_Flight,
        enabled: true,
        selectable: chip.id !== Type_Flight,
      }));

      const responseBody = {
        success: true,
        trigger,
        selected_type: Type_Flight,
        chips,
        init_value: [Type_Flight],
      };

      // ✅ Encrypt final flow response
      const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
      return res.status(200).send(encryptedResponse);
    }

    // 🩺 Plain (non-encrypted) health check (Render or manual)
    const healthMessage = {
      success: true,
      message: "Health check OK — trigger not provided",
    };

    return res.status(200).json(healthMessage);
  } catch (error) {
    console.error("Error in handleFlightType:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
