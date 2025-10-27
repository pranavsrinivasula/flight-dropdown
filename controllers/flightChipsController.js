// controllers/flightTypeController.js

/**
 * Handles user chip selection for flight type (One-Way / Return)
 */
exports.handleFlightType = async (req, res) => {
  try {
    const payload = req.body.payload || {};
    const trigger = payload.trigger;
    const Type_Flight_raw = payload.Type_Flight;

    // Convert array to single string value if needed
    const Type_Flight = Array.isArray(Type_Flight_raw)
      ? Type_Flight_raw[0]
      : Type_Flight_raw;

    // ✅ Validate trigger
    if (!trigger || trigger.toLowerCase() !== "chipper") {
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

    // ✅ Handle initial state (no selection yet)
    if (!Type_Flight) {
      const chips = chipOptions.map((chip) => ({
        id: chip.id,
        title: chip.title,
        selected: false,
        enabled: true,
        selectable: true,
      }));

      return res.status(200).json({
        success: true,
        trigger,
        selected_type: null,
        chips,
        init_value: [],
      });
    }

    // ✅ Ensure valid selection
    const selectedOption = chipOptions.find((c) => c.id === Type_Flight);
    if (!selectedOption) {
      return res.status(400).json({
        success: false,
        message: "Invalid flight type selection",
      });
    }

    // ✅ Build response chip list
    const chips = chipOptions.map((chip) => ({
      id: chip.id,
      title: chip.title,
      selected: chip.id === Type_Flight,
      enabled: true,
      selectable: chip.id !== Type_Flight,
    }));

    // ✅ Return structured JSON response
    return res.status(200).json({
      success: true,
      trigger,
      selected_type: selectedOption.title,
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
