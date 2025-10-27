// index.js
const express = require("express");
const bodyParser = require("body-parser");
const flightTypeRoutes = require("./routes");

const app = express();

app.use(bodyParser.json());

// Routes
app.use("/api", flightTypeRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("✅ WhatsApp Flight API is running!");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
