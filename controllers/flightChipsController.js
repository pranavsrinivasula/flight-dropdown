// controllers/flightTypeController.js
const crypto = require("crypto");

let userFlightSelection = {}; // in-memory storage

// Helper function to AES encrypt JSON
function encryptAES(text, key) {
    const iv = crypto.randomBytes(16); // generate random IV
    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
    let encrypted = cipher.update(JSON.stringify(text), "utf8", "base64");
    encrypted += cipher.final("base64");

    // return IV + encrypted text (both Base64)
    return {
        iv: iv.toString("base64"),
        data: encrypted
    };
}

exports.getChips = (req, res) => {
    const { userId } = req.params;
    const { selectedId, aesKey } = req.body; // aesKey should be 32 bytes in hex (256-bit)

    if (!aesKey || aesKey.length !== 64) {
        return res.status(400).json({ message: "Invalid AES key. Must be 32 bytes hex string." });
    }

    // Update selection if sent
    if (selectedId && ["1", "2"].includes(selectedId)) {
        userFlightSelection[userId] = selectedId;
    }

    const currentSelection = userFlightSelection[userId] || null;

    // Prepare response
    const responseObj = {
        initValue: currentSelection,
        dataSource: [
            { id: "1", title: "One-Way", enabled: true },
            { id: "2", title: "Return", enabled: true }
        ],
        maxSelectedItems: 1
    };

    // Encrypt response
    const encrypted = encryptAES(responseObj, aesKey);

    res.json(encrypted); // returns { iv: "...", data: "..." }
};
