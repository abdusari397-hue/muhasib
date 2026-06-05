// إعدادات تطبيق فاير بيز (Firebase Config)
// تم إعدادها تلقائياً للمشروع: muhasib-9cd3b

const firebaseConfig = {
    apiKey: "AIzaSyD4rX0lH1B5aANudrU2v-WOEop8jGK5dFg",
    authDomain: "muhasib-9cd3b.firebaseapp.com",
    projectId: "muhasib-9cd3b",
    storageBucket: "muhasib-9cd3b.firebasestorage.app",
    messagingSenderId: "315392661607",
    appId: "1:315392661607:web:307ed256a2dc33907f1cc2",
    measurementId: "G-6BGYG848R4",
    databaseId: "muhasib" // اسم قاعدة البيانات المخصصة في Firestore
};

// تصدير الإعدادات للنافذة العامة لكي يستخدمها التطبيق
window.firebaseConfig = firebaseConfig;
