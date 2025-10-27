// controllers/flightTypeController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require('../middleware/encryption');

const WHATSAPP_PUBLIC_KEY = process.env.WHATSAPP_PUBLIC_KEY; // the recipient's public key (PEM)

async function handleFlightType(req, res) {
  try {
    // Decrypt incoming envelope
    const { decryptedBody } = decryptRequest(req.body); // throws on problems
    console.log('✅ Decrypted body:', decryptedBody);

    // Expect decrypted payload shape to include Type_Flight (the client chip selection)
    // Accept either array or single value
    const sel = decryptedBody.Type_Flight || decryptedBody.flight_type || decryptedBody.Flight_Type;
    const selectedFlightType = Array.isArray(sel) ? sel[0] : sel;

    if (!selectedFlightType) {
      // Respond with plain JSON (not encrypted) to indicate required field
      return res.status(400).json({ success: false, message: 'Missing Type_Flight in decrypted payload' });
    }

    // Build minimal flow that updates init-value for ChipsSelector
    const responseFlow = {
      version: '7.1',
      data_api_version: '3.0',
      screens: [
        {
          id: 'SEARCH',
          title: 'Flight Type Selector',
          terminal: true,
          success: true,
          data: {
            Flight_Type: [selectedFlightType],
            // toggles for UI (you can expand)
            is_To_enabled: true,
            is_Departure_date_enabled: true,
            is_Return_date_enabled: selectedFlightType === '2',
            is_Book_enabled: true,
            min_date: new Date().toISOString().slice(0, 10),
          },
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'ChipsSelector',
                name: 'Flight_Type',
                label: '🛫 Book Your Flight',
                description: 'Choose where you want to fly from to begin your booking :',
                required: true,
                enabled: true,
                'init-value': [selectedFlightType],
                'data-source': [
                  { id: '2', title: 'Return' },
                  { id: '1', title: 'One-Way' }
                ],
                'on-select-action': {
                  name: 'data_exchange',
                  payload: {
                    trigger: 'chipper',
                    Type_Flight: '${form.Flight_Type}'
                  }
                }
              }
            ]
          }
        }
      ]
    };

    // encrypt response using WHATSAPP_PUBLIC_KEY (recipient)
    if (!WHATSAPP_PUBLIC_KEY) {
      // if not configured, return plain JSON for local dev
      console.warn('⚠️ WHATSAPP_PUBLIC_KEY not set — returning plain JSON for dev');
      return res.json(responseFlow);
    }

    const envelope = encryptResponse(responseFlow, WHATSAPP_PUBLIC_KEY);
    return res.json({ success: true, ...envelope });
  } catch (err) {
    console.error('❌ Error in handleFlightType:', err && err.message);
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
}

module.exports = { handleFlightType };
