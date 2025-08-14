const express = require("express");
const flowRoutes = require("./Routes/routes");
const app = express();
const cors = require('cors')
const bodyParser = require('body-parser')

app.use(
  express.json({
    // store the raw request body to use it for signature verification
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  }),
);
app.set('trust proxy', true)
app.use(cors());
app.use(express.urlencoded({ extended: false }))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// Your routes must be mounted after the raw body middleware
app.use("/", flowRoutes);


// JSON parser for other routes if any
// app.use(express.json());


app.listen(PORT, async () => {
    console.log('Server running on port ' + PORT)
})

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
})