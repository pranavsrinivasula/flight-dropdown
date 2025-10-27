exports.handleFlightType = async (req, res) => {
  try {
    if (typeof isRequestSignatureValid === "function" && !isRequestSignatureValid(req)) {
      console.warn("Request signature invalid");
      return res.status(432).send();
    }

    if (req.body && req.body.encrypted_flow_data) {
      let decrypted;
      try {
        decrypted = decryptRequest(
          req.body,
          process.env.PRIVATE_KEY,
          process.env.PRIVATE_KEY_PASSPHRASE || process.env.PASSPHRASE
        );
      } catch (err) {
        console.error("Failed to decrypt request:", err);
        if (err instanceof FlowEndpointException) return res.status(err.statusCode).send();
        return res.status(500).send();
      }

      const { decryptedBody, aesKeyBuffer, ivBuffer } = decrypted;
      const payload = decryptedBody.payload || {};
      const trigger = typeof payload.trigger === "string" ? payload.trigger : null;
      const Type_Flight_raw = payload.Type_Flight;
      const Type_Flight = Array.isArray(Type_Flight_raw) ? Type_Flight_raw[0] : Type_Flight_raw;

      // ✅ 1. Health check (no trigger) — keep as is
      if (!trigger) {
        const healthObj = { data: { status: "active" } };
        const enc = encryptResponse(healthObj, aesKeyBuffer, ivBuffer);
        return res.status(200).send(enc);
      }

      // ✅ 2. When user selects a chip
      if (String(trigger).toLowerCase() !== "chipper") {
        const errorResponse = { success: false, message: "Invalid trigger received" };
        const enc = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(enc);
      }

      // If user selected something invalid
      if (Type_Flight && !CHIP_OPTIONS.some((c) => c.id === String(Type_Flight))) {
        const errorResponse = { success: false, message: "Invalid flight type selection" };
        const enc = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(enc);
      }

      // ✅ 3. Build response for Meta Flow
      const responseBody = {
        screen: {
          id: "FLIGHT_TYPE",
          title: "Flight Type Selection",
          data: {
            Flight_Type: {
              value: Type_Flight ? String(Type_Flight) : "", // empty initially, filled after selection
            },
            chips: CHIP_OPTIONS.map((chip) => ({
              id: chip.id,
              title: chip.title,
              selected: chip.id === String(Type_Flight),
              enabled: true,
              selectable: chip.id !== String(Type_Flight),
            })),
          },
        },
      };

      const enc = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
      return res.status(200).send(enc);
    }

    // Plain (manual) health check
    return res.status(200).json({
      success: true,
      message: "Plain health check OK (for manual testing).",
    });
  } catch (error) {
    console.error("Error in handleFlightType:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
