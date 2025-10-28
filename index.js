const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const flowRoutes = require("./Routes/routes");

dotenv.config();

const app = express();
app.use(express.json());
app.use(bodyParser.json({ limit: "5mb" }));

app.use("/", flowRoutes);

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server running on port", process.env.PORT || 3000);
});
