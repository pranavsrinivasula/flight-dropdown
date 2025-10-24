// Chips data
let Flight_Type = [
  { id: "1", title: "One-Way", selected: true, enabled: true }, // init-value = One-Way
  { id: "2", title: "Return", selected: false, enabled: true }
];

exports.getChips = (req, res) => {
  const selectedId = req.body?.Type_Flight; // payload from on-select-action

  // If user clicks the already-selected chip, do nothing
  const currentlySelected = Flight_Type.find(chip => chip.selected);
  if (selectedId && selectedId !== currentlySelected.id) {
    // Update selection: select only the new chip
    Flight_Type = Flight_Type.map(chip => ({
      ...chip,
      selected: chip.id === selectedId,
      enabled: true // both chips remain enabled
    }));
  }

  // Return updated chips array
  res.json({ chips: Flight_Type });
};
