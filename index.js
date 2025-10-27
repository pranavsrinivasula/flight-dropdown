// index.js
require("dotenv").config(); // <--- MUST BE FIRST LINE
console.log("✅ .env loaded");

const express = require("express");
const bodyParser = require("body-parser");
const flightTypeRoutes = require("./Routes/routes");

const app = express();

app.use(bodyParser.json());

app.use("/", flightTypeRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
