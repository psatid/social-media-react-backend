const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://hw-project-1537196375025.firebaseio.com",
    storageBucket: "hw-project-1537196375025.appspot.com"
});

const db = admin.firestore();

module.exports = { admin, db };