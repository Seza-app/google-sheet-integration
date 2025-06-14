require('dotenv').config();
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const twilio = require('twilio');

const app = express();
app.use(express.json());

// Twilio Setup
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

// Google Sheets Setup
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

async function logToSheet(data) {
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_CLIENT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY,
  });
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow(data);
}

async function sendWhatsAppMessage(to, message) {
  await client.messages.create({
    body: message,
    from: TWILIO_WHATSAPP_NUMBER,
    to: `whatsapp:${to}`,
  });
}

app.post('/reloadly-webhook', async (req, res) => {
  const payload = req.body;
  console.log('Received Payload:', payload);

  const {
    transactionId,
    status,
    amount,
    operatorName,
    recipientPhone,
  } = payload;

  try {
    await logToSheet({
      TransactionID: transactionId,
      Status: status,
      Amount: amount,
      Operator: operatorName,
      Phone: recipientPhone,
      Date: new Date().toISOString(),
    });

    await sendWhatsAppMessage(
      recipientPhone,
      `✅ Your ${operatorName} top-up of ${amount} was ${status}. Txn ID: ${transactionId}`
    );

    res.status(200).send('Processed successfully');
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
