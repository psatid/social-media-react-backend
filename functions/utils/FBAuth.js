const { admin, db } = require('./admin')

module.exports = (request, response, next) => {
    let idToken;

    // console.log(request.headers.Authorization)

    if (request.headers.authorization && request.headers.authorization.startsWith('Bearer ')) {
        idToken = request.headers.authorization.split('Bearer ')[1];
        // console.log(idToken);
    } else {
        console.error('No token found')
        return response.status(403).json({ error: 'Unauthorized' })
    }

    admin.auth().verifyIdToken(idToken)
        .then((decodedToken) => {
            request.user = decodedToken;
            console.log(decodedToken);

            return db.collection('users')
                .where('userId', '==', request.user.uid)
                .limit(1)
                .get();
        })
        .then((data) => {
            // console.log(data)
            request.user.handle = data.docs[0].data().handle;
            request.user.imgUrl = data.docs[0].data().imgUrl;
            return next();
        })
        .catch((err) => {
            console.error('Error while verifying token', err);
            return response.status(403).json(err);
        })
}