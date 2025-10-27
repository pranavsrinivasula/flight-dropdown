// controllers/flightTypeController.js

let userFlightSelection = {}; // in-memory store, no DB needed

exports.getChips = (req, res) => {
    const { userId } = req.params;
    const { selectedId } = req.body || {};

    // Update selection if user sent one
    if (selectedId && ["1", "2"].includes(selectedId)) {
        userFlightSelection[userId] = selectedId;
    }

    const currentSelection = userFlightSelection[userId] || null;

    // Respond with JSON
    res.json({
        initValue: currentSelection,
        dataSource: [
            { id: "1", title: "One-Way", enabled: true },
            { id: "2", title: "Return", enabled: true }
        ],
        maxSelectedItems: 1 // only one selection allowed
    });
};
