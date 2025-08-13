const express = require("express");
const flowRoutes = require("./Routes/routes");
const app = express();

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // Capture the raw body buffer
  }
}));

// Your routes must be mounted after the raw body middleware
app.use("/", flowRoutes);


// JSON parser for other routes if any
// app.use(express.json());

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
