// Initial chips data
let Flight_Type = [
  { id: "1", title: "One-Way", selected: true, enabled: true, selectable: false }, // init-value, cannot select again after selection changes
  { id: "2", title: "Return", selected: false, enabled: true, selectable: true }
];

exports.getChips = (req, res) => {
  const selectedId = req.body?.Type_Flight; // payload from front-end trigger

  // If no selection or user clicks a chip that is not selectable, do nothing
  const chipToSelect = Flight_Type.find(chip => chip.id === selectedId);
  if (!chipToSelect || !chipToSelect.selectable) {
    return res.json({ chips: Flight_Type }); // no change
  }

  // Update selection: select only the new chip
  Flight_Type = Flight_Type.map(chip => {
    if (chip.id === selectedId) {
      return { ...chip, selected: true, selectable: false }; // new selection, now cannot select again
    } else {
      return { ...chip, selected: false, enabled: true }; // previous selection deselected but remains enabled
    }
  });

  // Return updated chips
  res.json({ chips: Flight_Type });
};
