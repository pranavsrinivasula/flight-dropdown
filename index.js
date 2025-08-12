// server.js
const express = require("express");
const bodyParser = require("body-parser");
const flowRoutes = require("./Routes/routes");

const app = express();
app.use(bodyParser.json());

// Routes
app.use("/", flowRoutes);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
