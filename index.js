const express = require("express");
const flowRoutes = require("./Routes/routes");
const app = express();

// Raw parser only on /flow-webhook - no JSON parser here
app.use('/flow-webhook', express.raw({ type: '*/*' }), flowRoutes);

// JSON parser for other routes if any
app.use(express.json());

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
