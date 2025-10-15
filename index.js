require("dotenv").config();
const express = require("express");
const cors = require("cors");
const flowRouter = require("./Routes/routes"); // ✅ no destructuring
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ✅ Use router
app.use("/flow-webhook", flowRouter);

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
