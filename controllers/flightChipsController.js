// src/controllers/flightChipsController.js
const { decryptRequest, encryptResponse, FlowEndpointException } = require('../middleware/encryption');

const RECIPIENT_PUBLIC_KEY = process.env.WHATSAPP_PUBLIC_KEY || null; // used to encrypt response back (if present)

exports.handleFlightType = async (req, res) => {
  try {
    // 1) Decrypt request (throws FlowEndpointException on problems)
    const { decryptedBody } = decryptRequest(req.body);
    console.log('✅ Decrypted body:', decryptedBody);

    // 2) Flexible extraction (handles multiple payload shapes)
    const sel =
      decryptedBody.Type_Flight ||
      decryptedBody.TypeFlight ||
      decryptedBody.flight_type ||
      decryptedBody.Flight_Type ||
      decryptedBody.form?.Flight_Type ||
      decryptedBody.form?.flight_type ||
      null;

    if (!sel) {
      return res.status(400).json({ success: false, message: 'Missing Type_Flight in decrypted payload' });
    }
    const selectedFlightType = Array.isArray(sel) ? sel[0] : sel;

    // 3) Build ChipsSelector-only flow (init-value set to user's choice)
    const responseFlow = {
      version: '7.1',
      data_api_version: '3.0',
      screens: [
        {
          id: 'SEARCH',
          title: 'Flight Type Selector',
          terminal: true,
          success: true,
          data: { Flight_Type: [selectedFlightType], is_Book_enabled: true },
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'ChipsSelector',
                name: 'Flight_Type',
                label: '🛫 Book Your Flight',
                description: 'Choose your flight type:',
                required: true,
                enabled: true,
                'init-value': [selectedFlightType],
                'data-source': [
                  { id: '2', title: 'Return' },
                  { id: '1', title: 'One-Way' },
                ],
                'on-select-action': {
                  name: 'data_exchange',
                  payload: { trigger: 'chipper', Type_Flight: '${form.Flight_Type}' },
                },
              },
            ],
          },
        },
      ],
    };

    // 4) Encrypt response envelope if we have recipient public key; else return plain JSON (dev convenience)
    if (!RECIPIENT_PUBLIC_KEY) {
      console.warn('WHATSAPP_PUBLIC_KEY not set; returning plain JSON for dev');
      return res.json(responseFlow);
    }

    const envelope = encryptResponse(responseFlow, RECIPIENT_PUBLIC_KEY);
    return res.json({ success: true, ...envelope });
  } catch (err) {
    console.error('❌ Error in handleFlightType:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, message: err.message || 'Internal server error' });
  }
};
