const express = require("express");
const admin = require("firebase-admin");

// Leer credenciales desde variable de entorno
const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();

app.get("/sendNotification", async (req, res) => {
  const message = {
    token: req.query.token,
    notification: {
      title: req.query.title || "Recordatorio",
      body: req.query.body || "Tu cita está programada"
    }
  };

  try {
    const response = await admin.messaging().send(message);
    res.send(`Notificación enviada: ${response}`);
  } catch (error) {
    res.status(500).send(`Error: ${error}`);
  }
});

app.listen(3000, () => console.log("Servidor listo en Railway"));