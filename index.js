const express = require("express");
const flowRoutes = require("./Routes/routes");
const app = express();




app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }, // needed for signature verification
}));

// app.use("/", flowRoutes);
app.get("/", (req, res) => {
  try {
    const { aesKeyBuffer, initialVectorBuffer, decryptedBody } =
      decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);

    console.log("Decrypted Dropdown Request:", decryptedBody);

    const dropdownData = {
      options: [
        { label: "Hyderabad to Delhi", value: "flight_1" },
        { label: "Hyderabad to Mumbai", value: "flight_2" }
      ]
    };

    const encryptedResponse = encryptResponse(dropdownData, aesKeyBuffer, initialVectorBuffer);
    res.send(encryptedResponse);

  } catch (err) {
    console.error(err);
    res.status(500).send();
  }
});


app.listen(3000, () => {
  console.log("Server running on port 3000");
});
