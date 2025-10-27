// controllers/flightTypeController.js

exports.handleFlightType = async (req, res) => {
  try {
    const payload = req.body.payload || {};
    const trigger = payload.trigger || null;
    const Type_Flight_raw = payload.Type_Flight;

    // Handle Render/Flow health check or test pings
    if (!trigger) {
      return res.status(200).json({
        success: true,
        message: "Health check OK — trigger not provided",
      });
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

    // ✅ Define valid chip options
    const chipOptions = [
      { id: "1", title: "One-Way" },
      { id: "2", title: "Return" },
    ];

    // ✅ Ensure valid selection
    if (!chipOptions.some((c) => c.id === Type_Flight)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flight type selection",
      });
    }

    // ✅ Build response chips
    const chips = chipOptions.map((chip) => ({
      id: chip.id,
      title: chip.title,
      selected: chip.id === Type_Flight,
      enabled: true,
      selectable: chip.id !== Type_Flight,
    }));

    // ✅ Return structured response
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
