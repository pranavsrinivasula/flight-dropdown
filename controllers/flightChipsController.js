const { decryptRequest, encryptResponse } = require("../middleware/encryption");

exports.handleFlightType = async (req, res) => {
  try {
    // Case 1: Meta encrypted payload
    if (req.body.encrypted_flow_data) {
      const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
      const payload = decryptedBody.payload || {};
      const trigger = payload.trigger || null;
      const Type_Flight_raw = payload.Type_Flight;

      // 🩺 Health check — happens when no trigger
      if (!trigger) {
        const responseBody = {
          response: {
            screen: {
              id: "HEALTH_CHECK",
              title: "✅ Health Check OK",
              data: {
                status: "active",
              },
            },
          },
        };

        const encrypted = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
        return res.status(200).send(encrypted);
      }

      // Normalize flight type
      const Type_Flight = Array.isArray(Type_Flight_raw)
        ? Type_Flight_raw[0]
        : Type_Flight_raw;

      // Validate trigger
      if (trigger.toLowerCase() !== "chipper") {
        const errorResponse = {
          response: {
            screen: {
              id: "ERROR_SCREEN",
              title: "⚠️ Invalid Trigger",
              data: { message: "Invalid trigger received" },
            },
          },
        };
        const encrypted = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(encrypted);
      }

      // Define valid chips
      const chipOptions = [
        { id: "1", title: "One-Way" },
        { id: "2", title: "Return" },
      ];

      // Validate flight type
      if (!chipOptions.some((c) => c.id === Type_Flight)) {
        const errorResponse = {
          response: {
            screen: {
              id: "ERROR_SCREEN",
              title: "⚠️ Invalid Flight Type",
              data: { message: "Invalid flight type selection" },
            },
          },
        };
        const encrypted = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(encrypted);
      }

      // Build response
      const chips = chipOptions.map((chip) => ({
        id: chip.id,
        title: chip.title,
        selected: chip.id === Type_Flight,
        enabled: true,
        selectable: chip.id !== Type_Flight,
      }));

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

      const encrypted = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
      return res.status(200).send(encrypted);
    }

    // Case 2: Manual/Browser health check
    return res.status(200).json({
      response: {
        screen: {
          id: "HEALTH_CHECK",
          title: "✅ Health Check OK",
          data: { status: "active" },
        },
      },
    });
  } catch (error) {
    console.error("❌ Error in handleFlightType:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
