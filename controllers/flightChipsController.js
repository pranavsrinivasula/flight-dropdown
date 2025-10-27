const { decryptRequest, encryptResponse } = require("../middleware/encryption");
const { FlowEndpointException } = require("../middleware/encryption");

exports.handleFlightType = async (req, res) => {
  try {
    // If request is encrypted (Flow request)
    if (req.body.encrypted_flow_data) {
      const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);

      const payload = decryptedBody.payload || {};
      const trigger = payload.trigger || null;
      const Type_Flight_raw = payload.Type_Flight;

      // 🩺 If Meta health check (no trigger)
      if (!trigger) {
        const healthMessage = {
          success: true,
          message: "Health check OK — trigger not provided",
        };

        const encryptedResponse = encryptResponse(healthMessage, aesKeyBuffer, ivBuffer);
        return res.status(200).send(encryptedResponse);
      }

      // Normalize
      const Type_Flight = Array.isArray(Type_Flight_raw)
        ? Type_Flight_raw[0]
        : Type_Flight_raw;

      if (trigger.toLowerCase() !== "chipper") {
        const errorResponse = { success: false, message: "Invalid trigger" };
        const encryptedResponse = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(encryptedResponse);
      }

      const chipOptions = [
        { id: "1", title: "One-Way" },
        { id: "2", title: "Return" },
      ];

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

      // ✅ Encrypt before sending
      const encryptedResponse = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
      return res.status(200).send(encryptedResponse);
    }

    // 🩺 If plain JSON (manual/Render health check)
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
