// controllers/flightChipsController.js

// Initial chip states
let Flight_Type = [
  { id: "1", title: "One-Way", selected: false, enabled: true },
  { id: "2", title: "Return", selected: false, enabled: true }
];

// GET current chip states
exports.getChips = (req, res) => {
  res.json({ chips: Flight_Type });
};

// POST select/deselect a chip
exports.toggleChip = (req, res) => {
  const { selectedId } = req.body;

  if (!selectedId) {
    return res.status(400).json({ error: "selectedId is required" });
  }

  flightChips = Flight_Type.map(chip => {
    if (chip.id === selectedId) {
      // Toggle the clicked chip
      return { ...chip, selected: !chip.selected, enabled: true };
    } else {
      // Deselect all other chips
      return { ...chip, selected: false, enabled: true };
    }
  });

  res.json({ chips: flightChips });
};
