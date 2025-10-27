// controllers/flightTypeController.js

/**
 * Handles user chip selection for flight type (One-Way / Return)
 */
exports.handleFlightType = async (req, res) => {
  try {
    const { trigger, Type_Flight } = req.body;

    // ✅ Step 1: Validate trigger
    if (trigger !== "chipper") {
      return res.status(400).json({
        success: false,
        message: "Invalid trigger received",
      });
    }

    // ✅ Step 2: Define valid chip options
    const chipOptions = [
      { id: "1", title: "One-Way" },
      { id: "2", title: "Return" },
    ];

    // ✅ Step 3: Ensure valid selection
    if (!chipOptions.some((c) => c.title === Type_Flight)) {
      return res.status(400).json({
        success: false,
        message: "Invalid flight type selection",
      });
    }

    // ✅ Step 4: Prepare response chips
    const chips = chipOptions.map((chip) => ({
      id: chip.id,
      title: chip.title,
      selected: chip.title === Type_Flight, // only selected one active
      enabled: true,
      selectable: chip.title !== Type_Flight, // others selectable
    }));

    // ✅ Step 5: Return structured response for flow
    return res.status(200).json({
      success: true,
      trigger,
      selected_type: Type_Flight,
      chips,
      init_value: Type_Flight, // this becomes ${data.Flight_Type}
    });
  } catch (error) {
    console.error("Error in handleFlightType:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
