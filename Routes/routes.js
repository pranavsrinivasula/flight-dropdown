const express = require("express");
const router = express.Router();

const { flowWebhook } = require("../controllers/sendDropdown");
const app = express();

app.use('/flow-webhook', express.raw({ type: '*/*' }), flowRouter);

// Other parsers for normal routes
app.use(express.json());

module.exports = router;
