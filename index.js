exports.handleFlightType = async (req, res) => {
  try {
    // ✅ Normalize payload (handles nested cases)
    const payload = req.body.payload || req.body || {};
    const trigger = payload.trigger || req.body.trigger;
    const Type_Flight = payload.Type_Flight || req.body.Type_Flight;

    // ✅ Validate trigger
    if (!trigger || trigger.toLowerCase() !== "chipper") {
      console.log("Received body:", req.body); // debug once
      return res.status(400).json({
        success: false,
        message: "Invalid trigger received",
      });
    }

    // ✅ Rest of logic same
    const chipOptions = [
      { id: "1", title: "One-Way" },
      { id: "2", title: "Return" },
    ];

    if (!chipOptions.some((c) => c.title === Type_Flight)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flight type selection",
      });
    }

    const chips = chipOptions.map((chip) => ({
      id: chip.id,
      title: chip.title,
      selected: chip.title === Type_Flight,
      enabled: true,
      selectable: chip.title !== Type_Flight,
    }));

    return res.status(200).json({
      success: true,
      trigger,
      selected_type: Type_Flight,
      chips,
      init_value: Type_Flight,
    });
  } catch (error) {
    console.error("Error in handleFlightType:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
