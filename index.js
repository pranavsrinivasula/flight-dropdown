const express = require("express");
const app = express();
app.use(express.json());

// Define the /sendlist POST route
app.get("/", (req, res) => {
  res.json({
    options: [
      { value: "flight_1", label: "Hyderabad to Delhi" },
      { value: "flight_2", label: "Hyderabad to Mumbai" },
      { value: "flight_3", label: "Chennai to Bangalore" }
    ]
  });
});
// Start the server
app.listen(4000, () => {
  console.log("Server running on port 4000");
});
