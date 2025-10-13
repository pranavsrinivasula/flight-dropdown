require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { flowRouter } = require("./routes/flowRoutes");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Routes
app.use("/flow-webhook", flowRouter);

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
