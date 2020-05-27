const functions = require('firebase-functions');
const express = require(`express`);
const app = express();

const {
    getAllScreams,
    postScream,
    getScream,
    commentOnScream,
    likeScream,
    unlikeScream,
    deleteScream
} = require('./handler/screams');

const {
    signup,
    login,
    uploadImg,
    addUserDetails,
    getAuthenticateduser,
    getUserDetails,
    markNotificationsRead
} = require('./handler/users');

const FBAuth = require('./utils/FBAuth');
const { db } = require('./utils/admin');

const cors = require('cors');
app.use(cors());

//Scream route
app.get('/getScreams', getAllScreams); //get all screams
app.post('/postScream', FBAuth, postScream); //post one scream
app.get('/scream/:screamId', getScream); //get a scream
app.post('/scream/:screamId/comment', FBAuth, commentOnScream); //making comment
app.get('/scream/:screamId/like', FBAuth, likeScream); //like a scream
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream); //unlike a scream
app.delete('/scream/:screamId', FBAuth, deleteScream); //delete scream

//Users Route
app.post('/signup', signup);
app.post('/login', login);
app.post('/user/image', FBAuth, uploadImg);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticateduser); //get account owner detail
app.get('/user/:handle', getUserDetails); //get any user details
app.post('/notifications', FBAuth, markNotificationsRead);

exports.api = functions.region('asia-east2').https.onRequest(app);

//Notification when like was made
exports.createNotificationOnLike = functions
    .region('asia-east2')
    .firestore.document('likes/{id}')
    .onCreate((snapshot) => {
        return db
            .doc(`/screams/${snapshot.data().screamId}`)
            .get()
            .then((doc) => {
                if (
                    doc.exists &&
                    doc.data().userHandle !== snapshot.data().userHandle
                ) {
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'like',
                        read: false,
                        screamId: doc.id
                    });
                }
                return;
            })
            .catch((err) => {
                console.error(err);
                // return;
            });
    });

//user will not get noti when their post got unliked
exports.deletNotificationOnUnlike = functions
    .region('asia-east2')
    .firestore.document('likes/{id}')
    .onDelete((snapshot) => {
        return (
            db
                .doc(`/notifications/${snapshot.id}`)
                .delete()
                // .then(() => {
                //     return;
                // })
                .catch((err) => {
                    console.error(err);
                    return;
                })
        );
    });

//Notifiction when comment was made
exports.createNotificationOnComment = functions
    .region('asia-east2')
    .firestore.document('comments/{id}')
    .onCreate((snapshot) => {
        return (
            db
                .doc(`/screams/${snapshot.data().screamId}`)
                .get()
                .then((doc) => {
                    if (
                        doc.exists &&
                        doc.data().userHandle !== snapshot.data().userHandle
                    ) {
                        return db.doc(`/notifications/${snapshot.id}`).set({
                            createdAt: new Date().toISOString(),
                            recipient: doc.data().userHandle,
                            sender: snapshot.data().userHandle,
                            type: 'comment',
                            read: false,
                            screamId: doc.id
                        });
                    }
                    return;
                })
                // .then(() => {
                //     return;
                // })
                .catch((err) => {
                    console.error(err);
                    // return;
                })
        );
    });

exports.onUserImageChange = functions
    .region('asia-east2')
    .firestore.document(`/users/{userId}`)
    .onUpdate((change) => {
        console.log(change.before.data());
        console.log(change.after.data);

        if (change.before.data().imgUrl !== change.after.data().imgUrl) {
            console.log('image has changed');

            const batch = db.batch();

            return db
                .collection('screams')
                .where('userHandle', '==', change.before.data().handle)
                .get()
                .then((data) => {
                    data.forEach((doc) => {
                        const scream = db.doc(`/screams/${doc.id}`);
                        batch.update(scream, {
                            imgUrl: change.after.data().imgUrl
                        });
                    });
                    return batch.commit();
                });
        } else return true;
    });

exports.onScreamDelete = functions
    .region('asia-east2')
    .firestore.document(`/screams/{screamId}`)
    .onDelete((snapshot, context) => {
        const screamId = context.params.screamId;
        const batch = db.batch();

        return db
            .collection('comments')
            .where('screamId', '==', screamId)
            .get()
            .then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/comments/${doc.id}`));
                });
                return db
                    .collection('likes')
                    .where('screamId', '==', screamId)
                    .get();
            })
            .then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/likes/${doc.id}`));
                });
                return db
                    .collection('notifications')
                    .where('screamId', '==', screamId)
                    .get();
            })
            .then((data) => {
                data.forEach((doc) => {
                    batch.delete(db.doc(`/notifications/${doc.id}`));
                });
                return batch.commit();
            })
            .catch((err) => {
                console.error(err);
            });
    });
