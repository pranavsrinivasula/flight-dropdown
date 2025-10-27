// controllers/flightTypeController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require("../middleware/encryption");
const { isRequestSignatureValid } = require("../middleware/valid");

const CHIP_OPTIONS = [
  { id: "1", title: "One-Way" },
  { id: "2", title: "Return" },
];

exports.handleFlightType = async (req, res) => {
  try {
    // optional signature validation - comment out while debugging if unsure
    if (typeof isRequestSignatureValid === "function" && !isRequestSignatureValid(req)) {
      console.warn("Request signature invalid");
      return res.status(432).send();
    }

    // Path A: Encrypted Meta request
    if (req.body && req.body.encrypted_flow_data) {
      let decrypted;
      try {
        // Pass env/key explicitly for clarity
        decrypted = decryptRequest(req.body, process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_PASSPHRASE || process.env.PASSPHRASE);
      } catch (err) {
        console.error("Failed to decrypt request:", err);
        if (err instanceof FlowEndpointException) {
          return res.status(err.statusCode).send();
        }
        return res.status(500).send();
      }

      const { decryptedBody, aesKeyBuffer, ivBuffer } = decrypted;
      console.info("Decrypted body:", JSON.stringify(decryptedBody));

      const payload = decryptedBody.payload || {};
      const trigger = typeof payload.trigger === "string" ? payload.trigger : null;
      const Type_Flight_raw = payload.Type_Flight;

      // Meta health check (no trigger) -> return encrypted status object
      if (!trigger) {
        const healthObj = { data: { status: "active" } };
        const enc = encryptResponse(healthObj, aesKeyBuffer, ivBuffer);
        return res.status(200).send(enc);
      }

      // Normalize Type_Flight (payload may be array or string)
      const Type_Flight = Array.isArray(Type_Flight_raw) ? Type_Flight_raw[0] : Type_Flight_raw;

      // Validate trigger safely
      if (!trigger || String(trigger).toLowerCase() !== "chipper") {
        const errorResponse = { success: false, message: "Invalid trigger received" };
        const enc = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(enc);
      }

      // Validate flight id
      if (!CHIP_OPTIONS.some((c) => c.id === String(Type_Flight))) {
        const errorResponse = { success: false, message: "Invalid flight type selection" };
        const enc = encryptResponse(errorResponse, aesKeyBuffer, ivBuffer);
        return res.status(400).send(enc);
      }

      // Build chips
      const chips = CHIP_OPTIONS.map((chip) => ({
        id: chip.id,
        title: chip.title,
        selected: chip.id === String(Type_Flight),
        enabled: true,
        selectable: chip.id !== String(Type_Flight),
      }));

      const responseBody = {
        success: true,
        trigger,
        selected_type: String(Type_Flight),
        chips,
        init_value: [String(Type_Flight)],
      };

      const enc = encryptResponse(responseBody, aesKeyBuffer, ivBuffer);
      return res.status(200).send(enc);
    }

    // Path B: Plain/manual health check (Postman / local)
    return res.status(200).json({
      success: true,
      message: "Plain health check OK (for manual testing).",
    });
  } catch (error) {
    console.error("Error in handleFlightType:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
