const express = require("express");
const app = express();
app.use(express.json());

// Define the /sendlist POST route
app.post("/sendlist", (req, res) => {
  res.json({ message: "Dropdown sent!" });
});

// Start the server
app.listen(4000, () => {
  console.log("Server running on port 4000");
});
