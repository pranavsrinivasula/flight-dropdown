let Flight_Type1 = [
  { id: "1", title: "One-Way", selected: false, enabled: true },
  { id: "2", title: "Return", selected: false, enabled: true }
];

exports.getChips = (req, res) => {
  // read selectedId from nested object
  const selectedId = req.body.Flight_Type1?.selectedId;

  if (!selectedId) {
    return res.json({ chips: Flight_Type1 });
  }

 else  {
    Flight_Type1 = Flight_Type1.map(chip => ({
      ...chip,
      selected: chip.id === selectedId,
      enabled: true
    }));
  }
    
 const response = { chips: Flight_Type1 };
  const base64Response = Buffer.from(JSON.stringify(response)).toString('base64');

  res.send(base64Response);
};
