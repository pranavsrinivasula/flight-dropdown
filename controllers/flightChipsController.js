// controllers/flightTypeController.js
let userFlightSelection = {}; // For demo, replace with DB

exports.getChips = (req, res) => {
    const { userId } = req.params;
    const { selectedId } = req.body || {};

    // Update if selectedId is sent
    if (selectedId && ["1", "2"].includes(selectedId)) {
        userFlightSelection[userId] = selectedId;
    }

    // Respond with current selection
    const currentSelection = userFlightSelection[userId] || null;

    res.json({
        initValue: currentSelection,
        dataSource: [
            { id: "1", title: "One-Way", enabled: true },
            { id: "2", title: "Return", enabled: true }
        ]
    });
};
