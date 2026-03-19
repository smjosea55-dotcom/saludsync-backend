const express = require("express");
const admin = require("firebase-admin");

// Leer credenciales desde variable de entorno
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  throw new Error("La variable GOOGLE_APPLICATION_CREDENTIALS_JSON no está definida en Railway");
}
const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();
app.use(express.json()); // Para leer JSON en el body

app.post("/scheduleReminder", async (req, res) => {
  const { userId, title, body, scheduledDate, alerta } = req.body;

  try {
    await admin.firestore().collection("reminders").add({
      userId,
      title,
      body,
      scheduledDate: new Date(scheduledDate),
      alerta,
      status: "pending"
    });
    res.send("✅ Recordatorio guardado en Firestore");
  } catch (error) {
    res.status(500).send(`❌ Error al guardar recordatorio: ${error}`);
  }
});

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

app.listen(process.env.PORT || 3000, () => {
  console.log("Servidor listo en Railway");
});

async function checkReminders() {
  const now = new Date();

  const snapshot = await admin.firestore()
    .collection("reminders")
    .where("status", "==", "pending")
    .get();

  snapshot.forEach(async (doc) => {
    const reminder = doc.data();
    const scheduledDate = reminder.scheduledDate.toDate(); // Firestore Timestamp → JS Date

    // 🔹 Nueva condición: solo enviar si ya llegó la hora exacta
    if (scheduledDate <= now) {
      // Buscar token del usuario
      const userDoc = await admin.firestore().collection("users").doc(reminder.userId).get();
      const userToken = userDoc.data()?.fcmToken;

      if (userToken) {
        const message = {
          token: userToken,
          notification: {
            title: reminder.title,
            body: reminder.body
          }
        };

        try {
          await admin.messaging().send(message);
          console.log(`✅ Notificación enviada a ${reminder.userId}`);

          await doc.ref.update({ status: "sent" });
        } catch (error) {
          console.error(`❌ Error al enviar notificación: ${error}`);
        }
      } else {
        console.log(`⚠️ Usuario ${reminder.userId} no tiene token registrado`);
      }
    } else {
      console.log(`⏳ Recordatorio ${doc.id} aún no toca (programado para ${scheduledDate})`);
    }
  });
}
// Ejecutar cada minuto
setInterval(checkReminders, 60 * 1000);