const express = require("express");
const flowRoutes = require("./Routes/routes");
const app = express();

app.use("/", flowRoutes);

// JSON parser for other routes if any
app.use(express.json());

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
