const express = require("express");
const bodyParser = require("body-parser");
const flightTypeRoutes = require("./Routes/routes");

const app = express();
app.use(bodyParser.json());
app.use("/", flightTypeRoutes);

// ✅ Important: listen on the Render-provided PORT
const PORT =  3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
