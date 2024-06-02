const {
    deleteObject,
    getDownloadURL,
    getStorage,
    ref,
    uploadBytes
} = require("@firebase/storage");

const { initializeApp } = require("firebase/app");

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

const uploadFileToFirebaseStorage = async (imageBlob, fileName, mimeType, path) => {
    const storageRef = ref(storage, `${path}${fileName}`);
    await uploadBytes(storageRef, imageBlob, { contentType: mimeType });
    return await getDownloadURL(storageRef);
}

const deleteFileFromFirebaseStorage = async (fileURL) => {
    try {
        const fileRef = ref(storage, fileURL);
        await deleteObject(fileRef);
        console.log('\n\nFile deleted successfully:', fileURL);
    } catch (error) {
        console.error('\n\nError deleting file from Firebase Storage:', error);
    }
};

const retrieveFilesFromFirebaseStorage = async (fileNames, storageLocation) => {
    const downloadURLs = [];
    for (const fileName of fileNames) {
        try {
            const storageRef = ref(storage, storageLocation + fileName);
            const downloadURL = await getDownloadURL(storageRef);
            downloadURLs.push(downloadURL);
        } catch (error) {
            console.error('Error retrieving file:', error);
        }
    }
    return downloadURLs;
}

module.exports = { uploadFileToFirebaseStorage, deleteFileFromFirebaseStorage, retrieveFilesFromFirebaseStorage };