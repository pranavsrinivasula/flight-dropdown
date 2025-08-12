// index.js
const express = require("express");
const flowRoutes = require("./Routes/routes");
const app = express();

// ✅ Only /flow-webhook gets raw parser, no JSON parser after it
app.use('/flow-webhook', express.raw({ type: '*/*' }), flowRoutes);

// ✅ All other routes get JSON parser
app.use(express.json());



app.listen(3000, () => {
  console.log("Server running on port 3000");
});
