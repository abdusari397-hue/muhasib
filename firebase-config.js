// إعدادات تطبيق فاير بيز (Firebase Config)
// انسخ الإعدادات الخاصة بك من لوحة تحكم فاير بيز والصقها هنا لكي تعمل المزامنة السحابية.

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تصدير الإعدادات للنافذة العامة لكي يستخدمها التطبيق
window.firebaseConfig = firebaseConfig;
