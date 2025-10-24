const { decryptRequest, encryptResponse } = require("./cryptohelpers");
const { FlowEndpointException } = require("./cryptohelpers");

// Your in-memory storage
let userFlightSelection = {};

app.post("/api/flightType/:userId", async (req, res) => {
    try {
        // Step 1: Decrypt incoming request
        const { decryptedBody, aesKeyBuffer, ivBuffer } = decryptRequest(req.body);
        const { selectedId } = decryptedBody;

        // Step 2: Update selection in-memory
        if (selectedId && ["1", "2"].includes(selectedId)) {
            userFlightSelection[req.params.userId] = selectedId;
        }
        const currentSelection = userFlightSelection[req.params.userId] || null;

        // Step 3: Prepare response
        const responseObj = {
            initValue: currentSelection,
            dataSource: [
                { id: "1", title: "One-Way", enabled: true },
                { id: "2", title: "Return", enabled: true }
            ],
            maxSelectedItems: 1
        };

        // Step 4: Encrypt response
        const encryptedResponse = encryptResponse(responseObj, aesKeyBuffer, ivBuffer);

        res.send(encryptedResponse); // Base64 string
    } catch (err) {
        if (err instanceof FlowEndpointException) {
            return res.status(err.statusCode).json({ message: err.message });
        }
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
});
