const { admin, db } = require('../utils/admin');
const config = require('../utils/config');

const firebase = require('firebase');
firebase.initializeApp(config);

const {
    signupValidator,
    loginValidator,
    reduceUserDetails
} = require('../utils/validator');

//signup
exports.signup = (request, response) => {
    const newUser = {
        email: request.body.email,
        password: request.body.password,
        confirmPassword: request.body.confirmPassword,
        handle: request.body.handle
    };

    const { valid, errors } = signupValidator(newUser);

    if (!valid) return response.status(400).json(errors);

    const blankAvatar = 'blank-avatar.png';

    let token, userId;

    db.doc(`/users/${newUser.handle}`)
        .get()
        .then((doc) => {
            if (doc.exists) {
                return response
                    .status(400)
                    .json({ handle: 'this handle already taken' });
            } else {
                return firebase
                    .auth()
                    .createUserWithEmailAndPassword(
                        newUser.email,
                        newUser.password
                    );
            }
        })
        .then((data) => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then((idToken) => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                imgUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${blankAvatar}?alt=media`,
                userId
            };
            db.doc(`/users/${newUser.handle}`).set(userCredentials);
            return response.status(201).json({ token });
        })
        .then((data) => {
            return response.status(201).json({ token });
        })
        .catch((err) => {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                return response
                    .status(400)
                    .json({ email: 'Email is already used' });
            } else {
                return response
                    .status(500)
                    .json({ general: 'Somthing went wrong, please try again' });
            }
        });
};

//login
exports.login = (request, response) => {
    const user = {
        email: request.body.email,
        password: request.body.password
    };

    const { valid, errors } = loginValidator(user);

    if (!valid) return response.status(400).json(errors);

    firebase
        .auth()
        .signInWithEmailAndPassword(user.email, user.password)
        .then((data) => {
            return data.user.getIdToken();
        })
        .then((token) => {
            return response.json({ token });
        })
        .catch((err) => {
            console.error(err);

            //auth/wrong-password
            //auth/user-not-user

            // if (err.code === "auth/wrong-password") {
            //     return response.status(403).json({ general: 'Wrong password, please try again' })
            // } else {
            //     return response.status(500).json({ error: err.code });
            // }

            return response
                .status(403)
                .json({ general: 'Wrong credentials, please try again' });
        });
};

//add user detail
exports.addUserDetails = (request, response) => {
    let userDetails = reduceUserDetails(request.body);

    db.doc(`users/${request.user.handle}`)
        .update(userDetails)
        .then(() => {
            return response.json({ message: 'Details added successfully' });
        })
        .catch((err) => {
            console.error(err);
            return response.status(500).json({ error: err.code });
        });
};

//get users deatils
exports.getUserDetails = (request, response) => {
    let userData = {};
    db.doc(`/users/${request.params.handle}`)
        .get()
        .then((doc) => {
            if (doc.exists) {
                userData.user = doc.data();
                return db
                    .collection('screams')
                    .where('userHandle', '==', request.params.handle)
                    .orderBy('createdAt', 'desc')
                    .get();
            } else {
                return response.status(404).json({ error: 'User not found' });
            }
        })
        .then((data) => {
            userData.screams = [];
            data.forEach((doc) => {
                userData.screams.push({
                    body: doc.data().body,
                    createdAt: doc.data().createdAt,
                    userHandle: doc.data().userHandle,
                    imgUrl: doc.data().imgUrl,
                    likeCount: doc.data().likeCount,
                    commentCount: doc.data().commentCount,
                    screamId: doc.id
                });
            });
            return response.json(userData);
        })
        .catch((err) => {
            console.error(err);
            return response.status(500).json({ error: err.code });
        });
};

//get account owner detail
exports.getAuthenticateduser = (request, response) => {
    let userData = {};
    db.doc(`/users/${request.user.handle}`)
        .get()
        .then((doc) => {
            if (doc.exists) {
                userData.credentials = doc.data();
                return db
                    .collection('likes')
                    .where('userHandle', '==', request.user.handle)
                    .get();
            }
            return;
        })
        .then((data) => {
            userData.likes = [];
            data.forEach((doc) => {
                userData.likes.push(doc.data());
            });
            return db
                .collection('notifications')
                .where('recipient', '==', request.user.handle)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();
        })
        .then((data) => {
            userData.notifications = [];
            data.forEach((doc) => {
                userData.notifications.push({
                    recipient: doc.data().recipient,
                    sender: doc.data().sender,
                    createdAt: doc.data().createdAt,
                    screamId: doc.data().screamId,
                    type: doc.data().type,
                    read: doc.data().read,
                    notificationsId: doc.id
                });
            });
            return response.json(userData);
        })
        .catch((err) => {
            console.error(err);
            return response.status(500).json({ error: err.code });
        });
};

//upload img
exports.uploadImg = (request, response) => {
    const BusBoy = require('busboy');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    let imgFileName;
    let imgToBeUploaded = {};

    const busboy = new BusBoy({ headers: request.headers });

    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        console.log(fieldname);
        console.log(filename);
        console.log(mimetype);

        if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
            return res
                .status(400)
                .json({ error: 'Please change your file type' });
        }

        //get img extension (my.image.123.jpeg)
        const imageExtension = filename.split('.')[
            filename.split('.').length - 1
        ];

        //12414.jpeg
        imgFileName = `${Math.round(
            Math.random() * 1000000000
        )}.${imageExtension}`;
        const filepath = path.join(os.tmpdir(), imgFileName);
        imgToBeUploaded = { filepath, mimetype };
        file.pipe(fs.createWriteStream(filepath));
    });

    busboy.on('finish', () => {
        admin
            .storage()
            .bucket()
            .upload(imgToBeUploaded.filepath, {
                resumable: false,
                metadata: {
                    metadata: {
                        contentType: imgToBeUploaded.mimetype
                    }
                }
            })
            .then(() => {
                const imgUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imgFileName}?alt=media`;
                return db
                    .doc(`users/${request.user.handle}`)
                    .update({ imgUrl });
            })
            .then(() => {
                return response.json({ message: 'Image upload successfully' });
            })
            .catch((err) => {
                console.error(err);
                return response.status(500).json({ error: err.code });
            });
    });
    busboy.end(request.rawBody);
};

exports.markNotificationsRead = (request, response) => {
    let batch = db.batch();
    request.body.forEach((notificaitionId) => {
        const notification = db.doc(`/notifications/${notificaitionId}`);
        batch.update(notification, { read: true });
    });
    batch
        .commit()
        .then(() => {
            return response.json({ message: 'Notificaiton marked read' });
        })
        .catch((err) => {
            console.error(err);
            return response.status(500).json({ error: err.code });
        });
};
