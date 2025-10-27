// controllers/flightTypeController.js

exports.handleFlightType = async (req, res) => {
  try {
    const payload = req.body.payload || {};
    const trigger = payload.trigger || null;
    const Type_Flight_raw = payload.Type_Flight;

    // 🩺 Handle health check
    if (!trigger) {
      const healthMessage = {
        success: true,
        message: "Health check OK — trigger not provided",
      };

      // Encode as Base64
      const encoded = Buffer.from(JSON.stringify(healthMessage)).toString("base64");

      return res.status(200).send(encoded);
    }

    // Normalize Type_Flight
    const Type_Flight = Array.isArray(Type_Flight_raw)
      ? Type_Flight_raw[0]
      : Type_Flight_raw;

    // ✅ Validate trigger
    if (trigger.toLowerCase() !== "chipper") {
      console.log("Invalid trigger received:", req.body);
      return res.status(400).json({
        success: false,
        message: "Invalid trigger received",
      });
    }

    // ✅ Define valid options
    const chipOptions = [
      { id: "1", title: "One-Way" },
      { id: "2", title: "Return" },
    ];

    // ✅ Validate selection
    if (!chipOptions.some((c) => c.id === Type_Flight)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flight type selection",
      });
    }

    // ✅ Build chip data
    const chips = chipOptions.map((chip) => ({
      id: chip.id,
      title: chip.title,
      selected: chip.id === Type_Flight,
      enabled: true,
      selectable: chip.id !== Type_Flight,
    }));

    // ✅ Return structured JSON (normal)
    return res.status(200).json({
      success: true,
      trigger,
      selected_type: Type_Flight,
      chips,
      init_value: [Type_Flight],
    });
  } catch (error) {
    console.error("Error in handleFlightType:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
