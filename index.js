const express = require("express");
const flowRoutes = require("./Routes/routes");
const app = express();




// app.use(express.json({
//   verify: (req, res, buf) => { req.rawBody = buf.toString(); }, // needed for signature verification
// }));

// app.use("/", flowRoutes);
app.use('/flow-webhook', express.raw({ type: '*/*' }),flowRoutes);

// Other parsers for normal routes
app.use(express.json());

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
