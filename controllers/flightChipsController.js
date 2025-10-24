let Flight_Type1 = [
  { id: "1", title: "One-Way", selected: false, enabled: true },
  { id: "2", title: "Return", selected: false, enabled: true }
];

exports.getChips = (req, res) => {
  const selectedId = req.body?.Flight_Type1?.selectedId;

  // Update selection if provided
  if (selectedId) {
    Flight_Type1 = Flight_Type1.map(chip => ({
      ...chip,
      selected: chip.id === selectedId,
      enabled: true
    }));
  }

  // Return plain JSON — this works for ChipsSelector
  res.json({ chips: Flight_Type1 });
};
