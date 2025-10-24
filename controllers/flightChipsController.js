// controllers/flightTypeController.js

// In-memory store (no DB)
let userFlightSelection = {}; 

exports.getChips = (req, res) => {
    const { userId } = req.params;
    const { selectedId } = req.body || {};

    // Update selection if user sent one
    if (selectedId && ["1", "2"].includes(selectedId)) {
        userFlightSelection[userId] = selectedId;
    }

    // Get current selection for user
    const currentSelection = userFlightSelection[userId] || null;

    // Send response for ChipsSelector
    res.json({
        initValue: currentSelection, // previously selected option
        dataSource: [
            { id: "1", title: "One-Way", enabled: true },
            { id: "2", title: "Return", enabled: true }
        ],
        maxSelectedItems: 1 // only allow one selection at a time
    });
};
