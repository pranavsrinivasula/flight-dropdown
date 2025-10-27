// index.js
const express = require("express");
const bodyParser = require("body-parser");
const flightTypeRoutes = require("./Routes/routes");

const app = express();

app.use(bodyParser.json());

// Routes
app.use("/", flightTypeRoutes);

// Default route
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
