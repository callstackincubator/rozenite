---
'@rozenite/storage-plugin': minor
---

The Storage plugin now runs in **development on web** (React Native for Web) when using Rozenite for Web. AsyncStorage and Expo SecureStore adapters work as on native; **MMKV** stays unavailable in the browser, so the MMKV adapter resolves to an **empty inspector** (same as production) without loading `react-native-mmkv` in your web bundle.
